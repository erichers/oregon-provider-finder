import { nextSnap, sheetExpanded, sheetLabel, snapHeights } from './drawer-state';

describe('drawer snaps', () => {
  const snaps = snapHeights(844);

  it('offers peek, half, and full', () => {
    expect(snaps.peek).toBe(112);
    expect(snaps.half).toBe(388);
    expect(snaps.full).toBe(712);
  });

  it('follows a fast drag and otherwise picks the nearest stop', () => {
    expect(nextSnap(200, 0.8, snaps)).toBe(snaps.half);
    expect(nextSnap(500, -0.8, snaps)).toBe(snaps.half);
    expect(nextSnap(140, 0, snaps)).toBe(snaps.peek);
    expect(nextSnap(600, 0, snaps)).toBe(snaps.full);
  });

  it('names the peek and whether the list is open', () => {
    expect(sheetLabel(false, false, false, 12)).toBe('12 providers');
    expect(sheetLabel(false, false, false, 1)).toBe('1 provider');
    expect(sheetLabel(true, true, false, 12)).toBe('Show providers');
    expect(sheetExpanded(true, false, 112, 112)).toBe(true);
    expect(sheetExpanded(false, false, 112, 112)).toBe(false);
    expect(sheetExpanded(false, false, 388, 112)).toBe(true);
  });
});
