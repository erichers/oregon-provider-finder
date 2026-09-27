import { ParamMap, Params, convertToParamMap } from '@angular/router';

export interface SearchQuery {
  q: string | null;
  groups: string[];
  specialties: string[];
  credentials: string[];
  preset: string | null;
  near: string | null;
  radius: number;
  sex: 'F' | 'M' | null;
  sort: 'name' | 'distance' | 'relevance';
}

export const emptyQuery: SearchQuery = {
  q: null,
  groups: [],
  specialties: [],
  credentials: [],
  preset: null,
  near: null,
  radius: 25,
  sex: null,
  sort: 'name',
};

export function readQuery(map: ParamMap | null): SearchQuery {
  const source = map ?? convertToParamMap({});
  const near = clean(source.get('near'));
  const radius = clamp(Number(source.get('radius') ?? 25), 1, 100);
  const requested = source.get('sort');
  let sort: SearchQuery['sort'] = near ? 'distance' : 'name';
  if (requested === 'distance' || requested === 'relevance' || requested === 'name') {
    sort = requested;
  }
  if (sort === 'distance' && !near) {
    sort = 'name';
  }
  const sex = source.get('sex');
  return {
    q: clean(source.get('q')),
    groups: split(source.get('groups')),
    specialties: split(source.get('specialties')),
    credentials: split(source.get('credentials')),
    preset: clean(source.get('preset')),
    near,
    radius,
    sex: sex === 'F' || sex === 'M' ? sex : null,
    sort,
  };
}

export function toParams(query: SearchQuery): Params {
  return {
    q: query.q,
    groups: query.groups.join(',') || null,
    specialties: query.specialties.join(',') || null,
    credentials: query.credentials.join(',') || null,
    preset: query.preset,
    near: query.near,
    radius: query.near ? String(query.radius) : null,
    sex: query.sex,
    sort: query.sort === 'name' && !query.near ? null : query.sort === 'name' ? 'name' : query.sort,
  };
}

export function isActive(query: SearchQuery): boolean {
  return Boolean(
    query.q ||
      query.groups.length ||
      query.specialties.length ||
      query.credentials.length ||
      query.preset ||
      query.near ||
      query.sex,
  );
}

function split(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function clean(value: string | null): string | null {
  const text = value?.trim() ?? '';
  return text.length > 0 ? text : null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 25;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
