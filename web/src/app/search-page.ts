import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, convertToParamMap } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';
import { GROUPS, PRESETS, groupLabel } from './catalog';
import { Facets, FinderApi, LocationHit, MapBounds, ProviderDetail, ProviderSummary, UnderstoodItem } from './finder-api';
import { nextSnap, snapHeights } from './drawer-state';
import { credentialLabel, distanceText, placeCase, phoneText, streetCase } from './format';
import { ResultMap } from './map-view';
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
  readonly fitToken = signal(0);
  readonly reveal = signal(0);
  readonly bounds = signal<MapBounds | null>(null);
  readonly sheetHeight = signal(420);
  readonly drawerClosed = signal(false);
  readonly dragging = signal(false);
  readonly wide = signal(false);
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
    inject(DestroyRef).onDestroy(() => {
      media.removeEventListener('change', onChange);
      clearTimeout(this.nearTimer);
    });

    this.sheetHeight.set(snapHeights(window.innerHeight).half);

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
    if (this.flyPending) {
      return;
    }
    this.requests.next({ query: this.filters(), bounds: box, page: 1, reason: 'bounds' });
  }

  choose(npi: string) {
    this.selectedNpi.set(npi);
    this.reveal.update((n) => n + 1);
    this.api.detail(npi).subscribe((detail) => {
      if (this.selectedNpi() === npi) {
        this.picked.set(detail);
      }
    });
    queueMicrotask(() => document.getElementById('result-' + npi)?.scrollIntoView({ block: 'nearest' }));
  }

  highlight(npi: string) {
    this.selectedNpi.set(npi);
  }

  cycleDrawer() {
    if (this.wide()) {
      this.drawerClosed.update((closed) => !closed);
      return;
    }
    const snaps = snapHeights(window.innerHeight);
    const order = [snaps.peek, snaps.half, snaps.full];
    const next = order.find((point) => point > this.sheetHeight() + 24) ?? snaps.peek;
    this.sheetHeight.set(next);
  }

  onHandleKey(event: KeyboardEvent) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.cycleDrawer();
    }
  }

  dragStart(event: PointerEvent) {
    if (this.wide() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    const snaps = snapHeights(window.innerHeight);
    this.sheetHeight.set(Math.min(snaps.full, Math.max(snaps.peek, next)));
  }

  dragEnd() {
    if (!this.dragging()) {
      return;
    }
    this.dragging.set(false);
    this.sheetHeight.set(nextSnap(this.sheetHeight(), this.dragVelocity, snapHeights(window.innerHeight)));
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
