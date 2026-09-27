import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, convertToParamMap } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { GROUPS, PRESETS, groupLabel } from './catalog';
import { Facets, FinderApi, LocationHit, ProviderSummary, UnderstoodItem } from './finder-api';
import { credentialLine, distanceText, placeCase, phoneText } from './format';
import { ResultMap } from './map-view';
import { SearchQuery, isActive, readQuery, toParams } from './query';

@Component({
  selector: 'app-search-page',
  imports: [RouterLink, ResultMap],
  templateUrl: './search-page.html',
})
export class SearchPage {
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
  readonly showMap = signal(false);
  readonly selectedNpi = signal<string | null>(null);
  readonly wide = signal(false);
  readonly page = signal(1);
  readonly active = computed(() => isActive(this.filters()));
  readonly placeCase = placeCase;
  readonly phoneText = phoneText;
  readonly distanceText = distanceText;
  readonly credentialLine = credentialLine;
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

    toObservable(this.filters)
      .pipe(
        switchMap((query) => {
          this.nearDraft.set(query.near ?? '');
          this.page.set(1);
          this.error.set(null);
          if (!isActive(query)) {
            this.loading.set(false);
            this.items.set([]);
            this.total.set(0);
            return of(null);
          }
          this.loading.set(true);
          return forkJoin({
            search: this.api.search(query, 1),
            facets: this.api.facets(query.groups).pipe(catchError(() => of(null))),
          }).pipe(catchError((err: HttpErrorResponse) => {
            this.error.set(message(err));
            this.loading.set(false);
            return of(null);
          }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.items.set(result.search.items);
        this.total.set(result.search.total);
        if (result.facets) {
          this.facets.set(result.facets);
        }
        this.loading.set(false);
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

  showOnMap(npi: string) {
    this.selectedNpi.set(npi);
    if (!this.wide()) {
      this.showMap.set(false);
    }
    queueMicrotask(() => document.getElementById('result-' + npi)?.scrollIntoView({ block: 'nearest' }));
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
    this.api.search(query, 1).subscribe({
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
    this.api.search(this.filters(), next).subscribe({
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
