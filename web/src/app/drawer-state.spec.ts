import { nextSnap, snapHeights } from './drawer-state';

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
});
