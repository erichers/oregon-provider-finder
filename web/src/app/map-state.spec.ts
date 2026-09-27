import { escapeHtml, oregonView, plottable, popupLines, MapPlace } from './map-state';

const salem: MapPlace = {
  npi: '1548266448',
  fullName: 'Neda Lynne Grant',
  primarySpecialty: 'Counselor',
  addressLine1: '123 State St',
  city: 'Salem',
  zip5: '97301',
  phone: '(503) 555-0100',
  distanceMiles: 1.2,
  lat: 44.94,
  lng: -123.03,
};

describe('map state', () => {
  it('keeps only places that have a point', () => {
    const placed = plottable([salem, { ...salem, npi: '0000000000', lat: null, lng: null }]);
    expect(placed.map((place) => place.npi)).toEqual(['1548266448']);
  });

  it('uses Oregon when nothing can be plotted', () => {
    expect(plottable([])).toEqual([]);
    expect(oregonView.zoom).toBe(6);
    expect(oregonView.lat).toBeGreaterThan(42);
    expect(oregonView.lat).toBeLessThan(46);
  });

  it('builds a popup from the fields a person can use', () => {
    expect(popupLines(salem)).toEqual([
      'Neda Lynne Grant',
      'Counselor',
      '123 State St, Salem 97301',
      '(503) 555-0100',
      '1 mi',
    ]);
    expect(popupLines({ ...salem, distanceMiles: 0.2 })).toContain('under 1 mi');
  });

  it('escapes popup text', () => {
    expect(escapeHtml(`A & B <"'>`)).toBe('A &amp; B &lt;&quot;&#39;&gt;');
  });
});
