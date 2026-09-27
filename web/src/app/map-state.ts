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

export function plottable(places: MapPlace[]): Array<MapPlace & { lat: number; lng: number }> {
  return places.filter((place): place is MapPlace & { lat: number; lng: number } =>
    typeof place.lat === 'number' && typeof place.lng === 'number');
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
