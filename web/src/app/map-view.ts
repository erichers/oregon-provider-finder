import { Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type { Map as LeafletMap, Marker, MarkerClusterGroup } from 'leaflet';
import { phoneText, placeCase, streetCase } from './format';
import { MapBounds } from './finder-api';
import { escapeHtml, MapPlace, oregonView, plottable, popupLines } from './map-state';

type LeafletApi = typeof import('leaflet');

@Component({
  selector: 'app-result-map',
  template: `
    <div class="map-wrap map-stage">
      <div #host class="map-frame" role="region" aria-label="Providers on a map" [attr.data-count]="markerCount()"></div>
      <button type="button" class="locate" (click)="locate()">Your location</button>
      @if (loading() && markerCount() === 0) {
        <p class="map-status">Loading locations</p>
      } @else if (!loading() && places().length > 0 && markerCount() === 0) {
        <p class="map-status">No providers to place on the map.</p>
      }
      @if (tilesFailed()) {
        <p class="map-status">Tiles did not load. The markers are still placed.</p>
      }
      @if (locateNote()) {
        <p class="map-status">{{ locateNote() }}</p>
      }
    </div>
  `,
})
export class ResultMap {
  readonly places = input<MapPlace[]>([]);
  readonly selected = input<string | null>(null);
  readonly loading = input(false);
  readonly fitToken = input(0);
  readonly reveal = input(0);
  readonly wide = input(false);
  readonly selectPlace = output<string>();
  readonly highlightPlace = output<string>();
  readonly boundsChange = output<MapBounds>();
  readonly tilesFailed = signal(false);
  readonly locateNote = signal<string | null>(null);
  readonly markerCount = signal(0);

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private map: LeafletMap | null = null;
  private cluster: MarkerClusterGroup | null = null;
  private markers = new Map<string, Marker>();
  private leaflet: LeafletApi | null = null;
  private appliedFit = 0;
  private appliedReveal = 0;
  private fitting = false;

  constructor() {
    const destroy = inject(DestroyRef);
    effect(() => {
      const el = this.host()?.nativeElement;
      const places = this.places();
      const token = this.fitToken();
      if (!el) {
        return;
      }
      this.draw(el, places, token);
    });
    effect(() => {
      const npi = this.selected();
      const reveal = this.reveal();
      if (this.leaflet && this.cluster) {
        this.applySelection(this.leaflet, npi, reveal !== this.appliedReveal);
        this.appliedReveal = reveal;
      }
    });
    destroy.onDestroy(() => this.map?.remove());
  }

  locate() {
    const map = this.map;
    if (!map || !navigator.geolocation) {
      this.locateNote.set('Location is off in this browser.');
      return;
    }
    this.locateNote.set(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.fitting = true;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const view: [number, number] = [position.coords.latitude, position.coords.longitude];
        if (reduce) {
          map.setView(view, 12);
        } else {
          map.flyTo(view, 12, { duration: 0.7 });
        }
      },
      () => this.locateNote.set('Location is off in this browser.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  private draw(el: HTMLElement, places: MapPlace[], token: number) {
    const L = leafletApi();
    if (!L) {
      return;
    }
    this.leaflet = L;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.map) {
      const map = L.map(el, {
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        zoomControl: false,
      }).setView([oregonView.lat, oregonView.lng], oregonView.zoom);
      L.control.zoom({ position: 'topright' }).addTo(map);
      this.map = map;
      const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      });
      osm.on('tileerror', () => this.tilesFailed.set(true));
      osm.addTo(map);
      this.cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 52,
        spiderfyOnMaxZoom: true,
        animate: !reduce,
        animateAddingMarkers: !reduce,
        iconCreateFunction: (cluster) => L.divIcon({
          className: 'pin-wrap',
          html: `<span class="cluster-pin">${cluster.getChildCount()}</span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      });
      this.cluster.addTo(map);
      map.on('moveend', () => {
        this.fitting = false;
        this.emitBounds(map);
      });
      setTimeout(() => {
        map.invalidateSize();
        this.emitBounds(map);
      }, 0);
    }
    const cluster = this.cluster;
    const map = this.map;
    if (!cluster || !map) {
      return;
    }
    cluster.clearLayers();
    this.markers.clear();
    for (const place of plottable(places)) {
      const marker = L.marker([place.lat, place.lng], {
        icon: this.pin(L, place.npi === this.selected()),
        keyboard: true,
        title: placeCase(place.fullName),
      });
      marker.bindPopup(this.popup(place));
      marker.on('click', () => this.selectPlace.emit(place.npi));
      marker.on('mouseover', () => this.highlightPlace.emit(place.npi));
      this.markers.set(place.npi, marker);
      cluster.addLayer(marker);
    }
    this.markerCount.set(this.markers.size);
    if (token !== this.appliedFit && token > 0 && this.markers.size > 0) {
      this.appliedFit = token;
      this.fly(L, map, reduce);
    } else if (this.markers.size === 0 && token === 0) {
      map.setView([oregonView.lat, oregonView.lng], oregonView.zoom);
    }
    this.applySelection(L, this.selected(), false);
  }

  private fly(L: LeafletApi, map: LeafletMap, reduce: boolean) {
    const cluster = this.cluster;
    if (!cluster || this.markers.size === 0) {
      return;
    }
    this.fitting = true;
    const wide = this.wide();
    const pad = wide
      ? { paddingTopLeft: L.point(440, 96), paddingBottomRight: L.point(48, 48) }
      : { paddingTopLeft: L.point(16, 168), paddingBottomRight: L.point(16, 150) };
    if (reduce) {
      map.fitBounds(cluster.getBounds(), { ...pad, maxZoom: 13 });
    } else {
      map.flyToBounds(cluster.getBounds(), { ...pad, maxZoom: 13, duration: 0.65 });
    }
  }

  private emitBounds(map: LeafletMap) {
    const box = map.getBounds();
    this.boundsChange.emit({
      minLat: box.getSouth(),
      minLng: box.getWest(),
      maxLat: box.getNorth(),
      maxLng: box.getEast(),
    });
  }

  private applySelection(L: LeafletApi, npi: string | null, reveal: boolean) {
    const cluster = this.cluster;
    const map = this.map;
    if (!cluster || !map) {
      return;
    }
    for (const [id, marker] of this.markers) {
      const el = marker.getElement();
      if (el) {
        el.classList.toggle('selected', id === npi);
      } else {
        marker.setIcon(this.pin(L, id === npi));
      }
    }
    if (!npi || !reveal) {
      return;
    }
    const marker = this.markers.get(npi);
    if (!marker) {
      return;
    }
    const visible = cluster.getVisibleParent(marker);
    if (visible && visible !== marker) {
      cluster.zoomToShowLayer(marker, () => undefined);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const zoom = Math.min(15, Math.max(map.getZoom(), 13));
    this.fitting = true;
    if (reduce) {
      map.setView(marker.getLatLng(), zoom);
    } else {
      map.flyTo(marker.getLatLng(), zoom, { duration: 0.45 });
    }
  }

  private pin(L: LeafletApi, selected: boolean) {
    return L.divIcon({
      className: selected ? 'pin-wrap selected' : 'pin-wrap',
      html: '<span class="pin pin-in"></span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -16],
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

function leafletApi(): LeafletApi | null {
  return (window as unknown as { L?: LeafletApi }).L ?? null;
}
