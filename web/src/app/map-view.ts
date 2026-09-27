import { Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type { Map as LeafletMap, Marker, MarkerClusterGroup } from 'leaflet';
import { phoneText, placeCase, streetCase } from './format';
import { escapeHtml, MapPlace, oregonView, plottable, popupLines } from './map-state';

@Component({
  selector: 'app-result-map',
  template: `
    <div class="map-wrap">
      <div #host class="map-frame" role="region" aria-label="Providers on a map"></div>
      @if (loading() && plottable(places()).length === 0) {
        <p class="map-status">Loading locations</p>
      } @else if (!loading() && plottable(places()).length === 0) {
        <p class="map-status">No providers to place on the map.</p>
      }
      @if (tilesFailed()) {
        <p class="map-status">Tiles did not load. The markers are still placed.</p>
      }
    </div>
  `,
})
export class ResultMap {
  readonly places = input<MapPlace[]>([]);
  readonly selected = input<string | null>(null);
  readonly loading = input(false);
  readonly selectPlace = output<string>();
  readonly tilesFailed = signal(false);
  readonly plottable = plottable;

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private map: LeafletMap | null = null;
  private cluster: MarkerClusterGroup | null = null;
  private markers = new Map<string, Marker>();
  private drawing = false;

  constructor() {
    const destroy = inject(DestroyRef);
    effect(() => {
      const el = this.host()?.nativeElement;
      const places = this.places();
      if (!el) {
        return;
      }
      void this.draw(el, places);
    });
    effect(() => {
      this.applySelection(this.selected());
    });
    destroy.onDestroy(() => this.map?.remove());
  }

  private async draw(el: HTMLElement, places: MapPlace[]) {
    const L = await loadLeaflet();
    this.drawing = true;
    if (!this.map) {
      const map = L.map(el, { scrollWheelZoom: false }).setView([oregonView.lat, oregonView.lng], oregonView.zoom);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 16,
      });
      tiles.on('tileerror', () => this.tilesFailed.set(true));
      tiles.addTo(map);
      this.cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48 });
      this.cluster.addTo(map);
      this.map = map;
    }
    const cluster = this.cluster;
    const map = this.map;
    if (!cluster || !map) {
      this.drawing = false;
      return;
    }
    cluster.clearLayers();
    this.markers.clear();
    const placed = plottable(places);
    for (const place of placed) {
      const marker = L.marker([place.lat, place.lng], {
        icon: this.icon(L, false),
        keyboard: true,
        title: placeCase(place.fullName),
      });
      marker.bindPopup(this.popup(place));
      marker.on('click', () => this.selectPlace.emit(place.npi));
      this.markers.set(place.npi, marker);
      cluster.addLayer(marker);
    }
    if (placed.length > 0) {
      map.fitBounds(cluster.getBounds(), { padding: [24, 24], maxZoom: 12 });
    } else {
      map.setView([oregonView.lat, oregonView.lng], oregonView.zoom);
    }
    this.drawing = false;
    this.applySelection(this.selected());
    setTimeout(() => map.invalidateSize(), 0);
  }

  private applySelection(npi: string | null) {
    if (this.drawing || !this.cluster) {
      return;
    }
    void this.restyle(npi);
  }

  private async restyle(npi: string | null) {
    const L = await import('leaflet');
    const cluster = this.cluster;
    if (!cluster) {
      return;
    }
    for (const [id, marker] of this.markers) {
      marker.setIcon(this.icon(L, id === npi));
    }
    if (!npi) {
      return;
    }
    const marker = this.markers.get(npi);
    if (!marker) {
      return;
    }
    const visible = cluster.getVisibleParent(marker);
    if (visible && visible !== marker) {
      cluster.zoomToShowLayer(marker, () => undefined);
    }
  }

  private icon(L: typeof import('leaflet'), selected: boolean) {
    return L.divIcon({
      className: selected ? 'pin-wrap selected' : 'pin-wrap',
      html: '<span class="pin"></span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -18],
    });
  }

  private popup(place: MapPlace): string {
    const lines = popupLines({
      ...place,
      fullName: placeCase(place.fullName),
      primarySpecialty: place.primarySpecialty,
      addressLine1: streetCase(place.addressLine1),
      city: placeCase(place.city),
      phone: place.phone ? phoneText(place.phone) : null,
    });
    const body = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
    const href = '/provider/' + encodeURIComponent(place.npi);
    return `<div class="map-popup">${body}<p><a href="${href}">Profile</a></p></div>`;
  }
}

async function loadLeaflet() {
  const L = await import('leaflet');
  (globalThis as unknown as { L: typeof L }).L = L;
  await import('leaflet.markercluster');
  return L;
}
