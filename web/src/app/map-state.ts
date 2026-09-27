export interface MapPlace {
  npi: string;
  fullName: string;
  primarySpecialty: string | null;
  addressLine1: string | null;
  city: string | null;
  zip5: string | null;
  phone: string | null;
  distanceMiles: number | null;
  lat: number | null;
  lng: number | null;
}

export const oregonView = { lat: 44.0, lng: -120.5, zoom: 6 };

export interface PlaceGroup {
  key: string;
  lat: number;
  lng: number;
  places: Array<MapPlace & { lat: number; lng: number }>;
}

export function plottable(places: MapPlace[]): Array<MapPlace & { lat: number; lng: number }> {
  return places.filter((place): place is MapPlace & { lat: number; lng: number } =>
    typeof place.lat === 'number' && typeof place.lng === 'number');
}

export function nodeHeading(places: Array<{ city: string | null }>): string {
  const count = places.length;
  const noun = count === 1 ? 'provider' : 'providers';
  const counts = new Map<string, { label: string; n: number }>();
  for (const place of places) {
    if (!place.city) {
      continue;
    }
    const label = place.city === place.city.toUpperCase()
      ? place.city.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
      : place.city;
    const key = label.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.n += 1;
    } else {
      counts.set(key, { label, n: 1 });
    }
  }
  let best: { label: string; n: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.n > best.n) {
      best = entry;
    }
  }
  return best ? `${count} ${noun} near ${best.label}` : `${count} ${noun}`;
}

export function clusterPlaces(places: MapPlace[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const place of plottable(places)) {
    const key = `${place.lat.toFixed(3)},${place.lng.toFixed(3)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.places.push(place);
    } else {
      groups.set(key, { key, lat: place.lat, lng: place.lng, places: [place] });
    }
  }
  return [...groups.values()];
}

export function popupLines(place: MapPlace): string[] {
  const lines = [place.fullName];
  if (place.primarySpecialty) {
    lines.push(place.primarySpecialty);
  }
  const cityLine = [place.city, place.zip5].filter((part) => !!part).join(' ');
  const address = [place.addressLine1, cityLine].filter((part) => !!part).join(', ');
  if (address) {
    lines.push(address);
  }
  if (place.phone) {
    lines.push(place.phone);
  }
  if (place.distanceMiles !== null) {
    lines.push(place.distanceMiles < 1 ? 'under 1 mi' : `${Math.round(place.distanceMiles)} mi`);
  }
  return lines;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
