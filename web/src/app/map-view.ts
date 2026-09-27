import { Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { MapPoint } from './finder-api';

@Component({
  selector: 'app-result-map',
  template: `<div #host class="map-frame" role="region" aria-label="Provider counts by ZIP"></div>`,
})
export class ResultMap {
  readonly points = input<MapPoint[]>([]);
  private readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private map: LeafletMap | null = null;
  private layer: LayerGroup | null = null;

  constructor() {
    const destroy = inject(DestroyRef);
    effect(() => {
      const el = this.host()?.nativeElement;
      const points = this.points();
      if (!el) {
        return;
      }
      void this.draw(el, points);
    });
    destroy.onDestroy(() => this.map?.remove());
  }

  private async draw(el: HTMLElement, points: MapPoint[]) {
    const L = await import('leaflet');
    if (!this.map) {
      const map = L.map(el, { scrollWheelZoom: false }).setView([44.1, -120.5], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 16,
      }).addTo(map);
      this.layer = L.layerGroup().addTo(map);
      this.map = map;
      setTimeout(() => map.invalidateSize(), 0);
    }
    this.layer?.clearLayers();
    const markers = points.map((point) =>
      L.circleMarker([point.lat, point.lng], {
        radius: Math.min(18, 6 + Math.sqrt(point.count)),
        color: '#234836',
        weight: 1,
        fillColor: '#c98b2b',
        fillOpacity: 0.9,
      }).bindTooltip(`${point.zip5}: ${point.count}`, { direction: 'top' })
        .bindPopup(`${point.zip5}: ${point.count} providers`),
    );
    markers.forEach((marker) => this.layer?.addLayer(marker));
    if (markers.length > 0 && this.map) {
      const group = L.featureGroup(markers);
      this.map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 12 });
    }
    this.map?.invalidateSize();
  }
}
