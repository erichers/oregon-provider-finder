import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SearchQuery } from './query';

export interface ProviderSummary {
  npi: string;
  fullName: string;
  credentialText: string | null;
  primarySpecialty: string | null;
  groups: string[];
  city: string | null;
  zip5: string | null;
  phone: string | null;
  distanceMiles: number | null;
  locationPrecision: string;
  addressLine1: string | null;
  lat: number | null;
  lng: number | null;
}

export interface SearchResponse {
  total: number;
  page: number;
  pageSize: number;
  center: { lat: number; lng: number; label: string } | null;
  items: ProviderSummary[];
}

export interface MapPoint {
  zip5: string;
  lat: number;
  lng: number;
  count: number;
}

export interface Facets {
  groups: { key: string; label: string; count: number }[];
  specialties: { code: string; label: string; count: number }[];
  credentials: { token: string; count: number }[];
}

export interface LocationHit {
  kind: string;
  label: string;
  value: string;
}

export interface UnderstoodItem {
  kind: string;
  label: string;
}

export interface InterpretResponse {
  filters: {
    preset: string | null;
    groups: string[];
    specialties: string[];
    credentials: string[];
    near: string | null;
    radius: number;
    sex: string | null;
    q: string | null;
  };
  understood: UnderstoodItem[];
  unsupported: string[];
  engine: { provider: string; model: string | null };
  ms: number;
}

export interface TaxonomyItem {
  code: string;
  displayName: string | null;
  isPrimary: boolean;
  licenseNumber: string | null;
  licenseState: string | null;
}

export interface ProviderDetail {
  npi: string;
  fullName: string;
  credentialText: string | null;
  credentials: string[];
  sex: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  zip5: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  locationPrecision: string;
  groups: string[];
  primarySpecialty: string | null;
  primaryTaxonomyCode: string | null;
  enumerationDate: string | null;
  registryLastUpdated: string | null;
  registryUrl: string;
  taxonomies: TaxonomyItem[];
}

export interface MetaResponse {
  dataAsOf: string | null;
  providerCount: number;
  lastImport: { sourceName: string | null; status: string } | null;
}

@Injectable({ providedIn: 'root' })
export class FinderApi {
  private readonly http = inject(HttpClient);

  search(query: SearchQuery, page: number) {
    return this.http.get<SearchResponse>('/api/providers', { params: this.params(query, page) });
  }

  map(query: SearchQuery) {
    return this.http.get<MapPoint[]>('/api/providers/map', { params: this.params(query, 1) });
  }

  detail(npi: string) {
    return this.http.get<ProviderDetail>(`/api/providers/${npi}`);
  }

  facets(groups: string[]) {
    let params = new HttpParams();
    if (groups.length > 0) {
      params = params.set('groups', groups.join(','));
    }
    return this.http.get<Facets>('/api/facets', { params });
  }

  locations(q: string) {
    return this.http.get<LocationHit[]>('/api/locations', { params: { q } });
  }

  interpret(text: string) {
    return this.http.post<InterpretResponse>('/api/search/interpret', { text });
  }

  meta() {
    return this.http.get<MetaResponse>('/api/meta');
  }

  private params(query: SearchQuery, page: number): HttpParams {
    let params = new HttpParams().set('page', page).set('pageSize', 20).set('sort', query.sort);
    if (query.q) params = params.set('q', query.q);
    if (query.groups.length) params = params.set('groups', query.groups.join(','));
    if (query.specialties.length) params = params.set('specialties', query.specialties.join(','));
    if (query.credentials.length) params = params.set('credentials', query.credentials.join(','));
    if (query.preset) params = params.set('preset', query.preset);
    if (query.near) {
      params = params.set('near', query.near).set('radius', query.radius);
    }
    if (query.sex) params = params.set('sex', query.sex);
    return params;
  }
}
