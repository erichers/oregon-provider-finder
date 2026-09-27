import { Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import { phoneText, placeCase, streetCase } from './format';
import { PlaceGroup, clusterPlaces, escapeHtml, MapPlace, oregonView, plottable, popupLines } from './map-state';

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
  private layer: LayerGroup | null = null;
  private markers = new Map<string, Marker>();
  private groups: PlaceGroup[] = [];
  private leaflet: typeof import('leaflet') | null = null;

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
      const npi = this.selected();
      if (this.leaflet) {
        this.applySelection(this.leaflet, npi);
      }
    });
    destroy.onDestroy(() => this.map?.remove());
  }

  private async draw(el: HTMLElement, places: MapPlace[]) {
    const L = await import('leaflet');
    this.leaflet = L;
    if (!this.map) {
      const map = L.map(el, { scrollWheelZoom: false }).setView([oregonView.lat, oregonView.lng], oregonView.zoom);
      this.map = map;
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 16,
      });
      tiles.on('tileerror', () => this.tilesFailed.set(true));
      tiles.addTo(map);
      this.layer = L.layerGroup().addTo(map);
    }
    const map = this.map;
    const layer = this.layer;
    if (!layer) {
      return;
    }
    layer.clearLayers();
    this.markers.clear();
    this.groups = clusterPlaces(places);
    for (const group of this.groups) {
      if (group.places.length === 1) {
        this.addPerson(L, group.places[0], group.lat, group.lng);
      } else {
        this.addCluster(L, group);
      }
    }
    if (this.groups.length > 0) {
      const bounds = L.latLngBounds(this.groups.map((group) => [group.lat, group.lng]));
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
    } else {
      map.setView([oregonView.lat, oregonView.lng], oregonView.zoom);
    }
    this.applySelection(L, this.selected());
    setTimeout(() => map.invalidateSize(), 0);
  }

  private addPerson(L: typeof import('leaflet'), place: MapPlace, lat: number, lng: number) {
    const marker = L.marker([lat, lng], {
      icon: this.pin(L, place.npi === this.selected()),
      keyboard: true,
      title: placeCase(place.fullName),
    });
    marker.bindPopup(this.popup(place));
    marker.on('click', () => this.selectPlace.emit(place.npi));
    this.markers.set(place.npi, marker);
    this.layer?.addLayer(marker);
  }

  private addCluster(L: typeof import('leaflet'), group: PlaceGroup) {
    const marker = L.marker([group.lat, group.lng], {
      icon: L.divIcon({
        className: 'pin-wrap',
        html: `<span class="cluster-pin">${group.places.length}</span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
      keyboard: true,
      title: `${group.places.length} providers`,
    });
    marker.on('click', () => this.spider(L, group));
    this.layer?.addLayer(marker);
  }

  private spider(L: typeof import('leaflet'), group: PlaceGroup) {
    const map = this.map;
    if (!map) {
      return;
    }
    const origin = map.latLngToLayerPoint([group.lat, group.lng]);
    group.places.forEach((place, index) => {
      if (this.markers.has(place.npi)) {
        return;
      }
      const angle = (2 * Math.PI * index) / group.places.length;
      const point = L.point(origin.x + Math.cos(angle) * 28, origin.y + Math.sin(angle) * 28);
      const latlng = map.layerPointToLatLng(point);
      this.addPerson(L, place, latlng.lat, latlng.lng);
    });
  }

  private applySelection(L: typeof import('leaflet'), npi: string | null) {
    if (npi && !this.markers.has(npi)) {
      const group = this.groups.find((item) => item.places.some((place) => place.npi === npi));
      if (group) {
        this.spider(L, group);
      }
    }
    for (const [id, marker] of this.markers) {
      const place = this.groups.flatMap((group) => group.places).find((item) => item.npi === id);
      if (place) {
        marker.setIcon(this.pin(L, id === npi));
      }
    }
  }

  private pin(L: typeof import('leaflet'), selected: boolean) {
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
      addressLine1: streetCase(place.addressLine1),
      city: placeCase(place.city),
      phone: place.phone ? phoneText(place.phone) : null,
    });
    const body = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
    const href = '/provider/' + encodeURIComponent(place.npi);
    return `<div class="map-popup">${body}<p><a href="${href}">Profile</a></p></div>`;
  }
}
