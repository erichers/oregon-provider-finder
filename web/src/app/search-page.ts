import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, HostListener, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, convertToParamMap } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';
import { GROUPS, PRESETS, groupLabel } from './catalog';
import { Facets, FinderApi, LocationHit, MapBounds, ProviderDetail, ProviderSummary, UnderstoodItem } from './finder-api';
import { chevronDir, nextSnap, phoneKey, phoneTap, rowFade, sheetExpanded, sheetLabel, snapHeights, toggleLabel } from './drawer-state';
import { credentialLabel, distanceText, placeCase, phoneText, streetCase } from './format';
import { ResultMap } from './map-view';
import { nodeHeading } from './map-state';
import { SearchQuery, isActive, readQuery, toParams } from './query';

@Component({
  selector: 'app-search-page',
  imports: [RouterLink, ResultMap],
  templateUrl: './search-page.html',
  styles: [':host { display: block; position: absolute; inset: 0; }'],
})
export class SearchPage {
  private readonly requests = new Subject<{ query: SearchQuery; bounds: MapBounds | null; page: number; reason: 'filter' | 'bounds' | 'more' }>();
  private dragOriginY = 0;
  private dragOriginH = 0;
  private dragLastY = 0;
  private dragLastT = 0;
  private dragVelocity = 0;
  private flyPending = false;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FinderApi);
  private readonly queryMap = toSignal(this.route.queryParamMap, { initialValue: convertToParamMap({}) });
  private nearTimer = 0;

  readonly groups = GROUPS;
  readonly radiusChoices = [10, 25, 50, 100];
  readonly presets = PRESETS;
  readonly filters = computed(() => readQuery(this.queryMap()));
  readonly filterChips = computed(() => {
    const query = this.filters();
    const chips: { id: string; label: string; patch: Partial<SearchQuery> }[] = [];
    if (query.q) {
      chips.push({ id: 'q', label: query.q, patch: { q: null } });
    }
    if (query.preset) {
      chips.push({ id: 'preset', label: PRESETS.find((item) => item.key === query.preset)?.label ?? query.preset, patch: { preset: null } });
    }
    for (const key of query.groups) {
      chips.push({ id: 'group-' + key, label: groupLabel(key), patch: { groups: query.groups.filter((group) => group !== key) } });
    }
    for (const code of query.specialties) {
      const label = this.facets()?.specialties.find((item) => item.code === code)?.label ?? code;
      chips.push({ id: 'specialty-' + code, label, patch: { specialties: query.specialties.filter((item) => item !== code) } });
    }
    for (const token of query.credentials) {
      chips.push({ id: 'credential-' + token, label: token, patch: { credentials: query.credentials.filter((item) => item !== token) } });
    }
    if (query.near) {
      chips.push({ id: 'near', label: `${placeCase(query.near)}, ${query.radius} miles`, patch: { near: null, sort: 'name' } });
    }
    if (query.sex) {
      chips.push({ id: 'sex', label: query.sex === 'F' ? 'Women' : 'Men', patch: { sex: null } });
    }
    return chips;
  });
  readonly items = signal<ProviderSummary[]>([]);
  readonly total = signal(0);
  readonly facets = signal<Facets | null>(null);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly words = signal('');
  readonly interpreting = signal(false);
  readonly understood = signal<UnderstoodItem[]>([]);
  readonly unsupported = signal<string[]>([]);
  readonly suggestions = signal<LocationHit[]>([]);
  readonly nearDraft = signal('');
  readonly selectedNpi = signal<string | null>(null);
  readonly picked = signal<ProviderDetail | null>(null);
  readonly nodeProviders = signal<ProviderSummary[] | null>(null);
  readonly teaserPerson = signal<ProviderSummary | null>(null);
  private teaserFrom: 'card' | 'marker' | null = null;
  readonly fitToken = signal(0);
  readonly reveal = signal(0);
  readonly bounds = signal<MapBounds | null>(null);
  readonly sheetHeight = signal(420);
  readonly drawerClosed = signal(false);
  readonly filtersOpen = signal(false);
  readonly dragging = signal(false);
  readonly listScrolled = signal(false);
  readonly wide = signal(false);
  readonly stripFade = signal<'none' | 'left' | 'right' | 'both'>('none');
  readonly zoomQuiet = signal(false);
  private readonly chromeReserve = signal(132);
  readonly page = signal(1);
  readonly active = computed(() => isActive(this.filters()));
  readonly placeCase = placeCase;
  readonly streetCase = streetCase;
  readonly phoneText = phoneText;
  readonly distanceText = distanceText;
  readonly credentialLabel = credentialLabel;
  readonly groupLabel = groupLabel;

  constructor() {
    const media = window.matchMedia('(min-width: 1024px)');
    this.wide.set(media.matches);
    const onChange = () => this.wide.set(media.matches);
    media.addEventListener('change', onChange);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      media.removeEventListener('change', onChange);
      clearTimeout(this.nearTimer);
    });

    this.sheetHeight.set(this.snaps().peek);
    effect(() => {
      const height = this.sheetHeight();
      const wide = this.wide();
      const reserve = this.chromeReserve();
      if (wide) {
        this.zoomQuiet.set(false);
        return;
      }
      const snaps = snapHeights(window.innerHeight, reserve);
      const stripBottom = reserve - 8;
      const zoomTop = window.innerHeight - height - 28 - 88;
      this.zoomQuiet.set(height > snaps.half + 8 || zoomTop < stripBottom + 8);
    });
    afterNextRender(() => {
      this.syncChrome();
      const strip = document.querySelector('.filter-strip');
      const watched = [strip, document.querySelector('.float-search'), document.querySelector('.mast')].filter((node): node is Element => !!node);
      const observer = new ResizeObserver(() => this.syncChrome());
      for (const node of watched) {
        observer.observe(node);
      }
      const watchKids = () => {
        if (!strip) {
          return;
        }
        for (const child of strip.children) {
          observer.observe(child);
        }
      };
      watchKids();
      const mutations = new MutationObserver(() => {
        watchKids();
        this.syncChrome();
      });
      if (strip) {
        mutations.observe(strip, { childList: true });
      }
      window.addEventListener('resize', this.syncChrome);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        mutations.disconnect();
        window.removeEventListener('resize', this.syncChrome);
      });
    });

    this.requests.pipe(
      debounceTime(260),
      switchMap((req) => {
        this.error.set(null);
        if (req.reason === 'filter' && !isActive(req.query) && !req.bounds) {
          this.loading.set(false);
          this.items.set([]);
          this.total.set(0);
          return of(null);
        }
        if (req.reason === 'filter') {
          this.loading.set(true);
        }
        return this.api.search(req.query, req.page, req.bounds).pipe(
          switchMap((search) => of({ req, search })),
          catchError((err: HttpErrorResponse) => {
            this.error.set(message(err));
            this.loading.set(false);
            this.loadingMore.set(false);
            return of(null);
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe((result) => {
      if (!result) {
        return;
      }
      if (result.req.reason === 'more') {
        this.page.set(result.req.page);
        this.items.update((list) => [...list, ...result.search.items]);
        this.loadingMore.set(false);
      } else {
        this.items.set(result.search.items);
        this.total.set(result.search.total);
        this.page.set(1);
        this.loading.set(false);
        if (result.req.reason === 'filter' && isActive(result.req.query) && result.search.items.some((item) => item.lat !== null && item.lng !== null)) {
          this.flyPending = false;
          this.fitToken.update((n) => n + 1);
        } else if (result.req.reason === 'filter') {
          this.flyPending = false;
        }
      }
    });

    toObservable(this.filters)
      .pipe(takeUntilDestroyed())
      .subscribe((query) => {
        this.nearDraft.set(query.near ?? '');
        this.page.set(1);
        this.flyPending = isActive(query);
        this.nodeProviders.set(null);
        this.teaserPerson.set(null);
        this.requests.next({ query, bounds: null, page: 1, reason: 'filter' });
        if (isActive(query)) {
          this.api.facets(query.groups).subscribe((facets) => this.facets.set(facets));
        }
      });

    this.api.facets([]).subscribe((facets) => {
      if (!this.facets()) {
        this.facets.set(facets);
      }
    });
  }

  reset() {
    this.words.set('');
    this.understood.set([]);
    this.unsupported.set([]);
    void this.router.navigate(['/']);
  }

  onBounds(box: MapBounds) {
    this.bounds.set(box);
    if (this.flyPending || this.nodeProviders()) {
      return;
    }
    this.requests.next({ query: this.filters(), bounds: box, page: 1, reason: 'bounds' });
  }

  onNode(node: { npis: string[]; teaser: boolean }) {
    const wanted = new Set(node.npis);
    const list = this.items().filter((item) => wanted.has(item.npi));
    if (!list.length) {
      return;
    }
    this.nodeProviders.set(list);
    this.holdDrawer();
    if (node.teaser) {
      this.openTeaser(list[0].npi, 'marker');
    }
  }

  listed(): ProviderSummary[] {
    return this.nodeProviders() ?? this.items();
  }

  clearNode() {
    this.nodeProviders.set(null);
    this.closeTeaser();
    const box = this.bounds();
    if (box) {
      this.requests.next({ query: this.filters(), bounds: box, page: 1, reason: 'bounds' });
    }
  }

  openTeaser(npi: string, from: 'card' | 'marker') {
    const person = (this.nodeProviders() ?? this.items()).find((item) => item.npi === npi);
    if (!person) {
      return;
    }
    this.teaserPerson.set(person);
    this.teaserFrom = from;
    this.selectedNpi.set(npi);
    this.reveal.update((n) => n + 1);
    this.holdDrawer();
    queueMicrotask(() => document.getElementById('teaser-close')?.focus());
  }

  closeTeaser() {
    if (!this.teaserPerson()) {
      return;
    }
    const from = this.teaserFrom;
    const npi = this.teaserPerson()?.npi;
    this.teaserPerson.set(null);
    this.teaserFrom = null;
    // Wait for the render that shows the card again on phones, where the teaser stands in for it.
    setTimeout(() => {
      if (!npi) {
        return;
      }
      const target = from === 'marker'
        ? document.querySelector<HTMLElement>('.pin-wrap.selected')
        : document.querySelector<HTMLElement>('#result-' + npi + ' .result-hit');
      target?.focus();
    }, 0);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeTeaser();
  }

  @HostListener('document:pointerdown', ['$event'])
  onOutside(event: PointerEvent) {
    if (!this.teaserPerson()) {
      return;
    }
    const node = event.target as HTMLElement | null;
    if (node?.closest('.teaser, .result-hit, .pin-wrap, .cluster-pin')) {
      return;
    }
    this.closeTeaser();
  }

  private holdDrawer() {
    this.drawerClosed.set(false);
    if (this.wide()) {
      return;
    }
    const snaps = this.snaps();
    if (this.sheetHeight() < snaps.half - 8) {
      this.sheetHeight.set(snaps.half);
    }
  }

  choose(npi: string) {
    this.openTeaser(npi, 'card');
  }

  highlight(npi: string) {
    this.selectedNpi.set(npi);
  }

  labelText(): string {
    const node = this.nodeProviders();
    if (node) {
      return nodeHeading(node);
    }
    return sheetLabel(this.loading(), this.total());
  }

  toggleText(): string {
    return toggleLabel(this.expanded());
  }

  arrowDir(): 'left' | 'right' | 'up' | 'down' {
    return chevronDir(this.wide(), this.expanded());
  }

  filtersAria(): string {
    const count = this.filterChips().length;
    return count ? `Filters, ${count} active` : 'Filters';
  }

  onListScroll(event: Event) {
    this.listScrolled.set((event.target as HTMLElement).scrollTop > 8);
  }

  onStripScroll(event: Event) {
    const el = event.target as HTMLElement;
    this.stripFade.set(rowFade(el.scrollLeft, el.clientWidth, el.scrollWidth));
  }

  snaps() {
    return snapHeights(window.innerHeight, this.wide() ? 132 : this.chromeReserve());
  }

  private readonly syncChrome = () => {
    const strip = document.querySelector<HTMLElement>('.filter-strip');
    if (strip) {
      this.stripFade.set(rowFade(strip.scrollLeft, strip.clientWidth, strip.scrollWidth));
      if (!this.wide()) {
        this.chromeReserve.set(Math.ceil(strip.getBoundingClientRect().bottom + 8));
        const snaps = this.snaps();
        if (this.sheetHeight() > snaps.full) {
          this.sheetHeight.set(snaps.full);
        }
      }
    }
  };

  expanded(): boolean {
    return sheetExpanded(this.wide(), this.drawerClosed(), this.sheetHeight(), this.snaps().peek);
  }

  cycleDrawer() {
    if (this.wide()) {
      this.drawerClosed.update((closed) => !closed);
      return;
    }
    this.sheetHeight.set(phoneTap(this.sheetHeight(), this.snaps()));
  }

  onHandleKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    if (this.wide()) {
      this.cycleDrawer();
      return;
    }
    const direction = event.key === 'ArrowUp' ? 'up' : 'down';
    this.sheetHeight.set(phoneKey(this.sheetHeight(), direction, this.snaps()));
  }

  dragStart(event: PointerEvent) {
    if (this.wide() || (event.target as HTMLElement).closest('.drawer-toggle') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    this.dragging.set(true);
    this.dragOriginY = event.clientY;
    this.dragOriginH = this.sheetHeight();
    this.dragLastY = event.clientY;
    this.dragLastT = event.timeStamp;
    this.dragVelocity = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  dragMove(event: PointerEvent) {
    if (!this.dragging()) {
      return;
    }
    const dt = Math.max(16, event.timeStamp - this.dragLastT);
    this.dragVelocity = (this.dragLastY - event.clientY) / dt;
    this.dragLastY = event.clientY;
    this.dragLastT = event.timeStamp;
    const next = this.dragOriginH + (this.dragOriginY - event.clientY);
    const snaps = this.snaps();
    this.sheetHeight.set(Math.min(snaps.full, Math.max(snaps.peek, next)));
  }

  dragEnd() {
    if (!this.dragging()) {
      return;
    }
    this.dragging.set(false);
    this.sheetHeight.set(nextSnap(this.sheetHeight(), this.dragVelocity, this.snaps()));
  }

  emptyLine(): string {
    const query = this.filters();
    const place = placeCase(query.near);
    if (query.near && query.groups.length === 1) {
      return `No ${groupLabel(query.groups[0]).toLowerCase()} within ${query.radius} miles of ${place}.`;
    }
    if (query.near) {
      return `No providers within ${query.radius} miles of ${place}.`;
    }
    return 'No providers matched those filters.';
  }

  submitWords(event: Event) {
    event.preventDefault();
    const text = this.words().trim();
    if (!text) {
      return;
    }
    this.interpreting.set(true);
    this.error.set(null);
    this.api.interpret(text).subscribe({
      next: (res) => {
        this.interpreting.set(false);
        this.understood.set(res.understood);
        this.unsupported.set(res.unsupported);
        const sex = res.filters.sex === 'F' || res.filters.sex === 'M' ? res.filters.sex : null;
        this.router.navigate(['/'], {
          queryParams: toParams({
            q: res.filters.q,
            groups: res.filters.groups ?? [],
            specialties: res.filters.specialties ?? [],
            credentials: res.filters.credentials ?? [],
            preset: res.filters.preset,
            near: res.filters.near,
            radius: res.filters.radius || 25,
            sex,
            sort: res.filters.near ? 'distance' : 'name',
          }),
        });
      },
      error: (err: HttpErrorResponse) => {
        this.interpreting.set(false);
        this.error.set(err.status === 429 ? 'Plain-words search is limited to 20 requests a minute.' : message(err));
      },
    });
  }

  go(patch: Partial<SearchQuery>, chips: UnderstoodItem[] | null = null) {
    const next = { ...this.filters(), ...patch };
    this.understood.set(chips ?? []);
    if (!chips) {
      this.unsupported.set([]);
    }
    void this.router.navigate(['/'], { queryParams: toParams(next) });
  }

  toggle(list: string[], value: string, key: 'groups' | 'specialties' | 'credentials') {
    const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
    this.go({ [key]: next });
  }

  pickPreset(key: string) {
    const current = this.filters().preset;
    this.go({ preset: current === key ? null : key });
  }

  onNear(value: string) {
    this.nearDraft.set(value);
    clearTimeout(this.nearTimer);
    this.nearTimer = window.setTimeout(() => {
      const text = value.trim();
      if (text.length < 2) {
        this.suggestions.set([]);
        return;
      }
      this.api.locations(text).subscribe((hits) => this.suggestions.set(hits));
    }, 250);
  }

  pickPlace(hit: LocationHit) {
    this.suggestions.set([]);
    this.nearDraft.set(hit.value);
    this.go({ near: hit.value, sort: 'distance' });
  }

  applyNear() {
    const text = this.nearDraft().trim();
    this.suggestions.set([]);
    this.go({ near: text || null, sort: text ? 'distance' : 'name' });
  }

  retry() {
    const query = this.filters();
    this.error.set(null);
    this.loading.set(true);
    this.api.search(query, 1, this.bounds()).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.page.set(1);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(message(err));
      },
    });
  }

  showMore() {
    const next = this.page() + 1;
    this.loadingMore.set(true);
    this.api.search(this.filters(), next, this.bounds()).subscribe({
      next: (res) => {
        this.page.set(next);
        this.items.update((list) => [...list, ...res.items]);
        this.loadingMore.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingMore.set(false);
        this.error.set(message(err));
      },
    });
  }

  removeChip(item: UnderstoodItem) {
    const query = this.filters();
    const rest = this.understood().filter((chip) => chip !== item);
    if (item.kind === 'preset') this.go({ preset: null }, rest);
    else if (item.kind === 'group') {
      const key = GROUPS.find((group) => group.label === item.label)?.key;
      this.go({ groups: query.groups.filter((group) => group !== key) }, rest);
    } else if (item.kind === 'specialty') this.go({ specialties: [] }, rest);
    else if (item.kind === 'credential') this.go({ credentials: query.credentials.filter((token) => token !== item.label) }, rest);
    else if (item.kind === 'place') this.go({ near: null, sort: 'name' }, rest);
    else if (item.kind === 'radius') this.go({ radius: 25 }, rest);
    else if (item.kind === 'sex') this.go({ sex: null }, rest);
    else if (item.kind === 'name') this.go({ q: null }, rest);
  }
}

function message(err: HttpErrorResponse): string {
  const detail = err.error && typeof err.error === 'object' ? err.error.detail : null;
  return typeof detail === 'string' ? detail : 'The directory did not respond.';
}
