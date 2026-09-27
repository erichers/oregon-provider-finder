import { chevronDir, nextSnap, phoneKey, phoneTap, sheetExpanded, sheetLabel, snapHeights, toggleLabel } from './drawer-state';

describe('drawer snaps', () => {
  const snaps = snapHeights(844);

  it('offers peek, half, and full', () => {
    expect(snaps.peek).toBe(64);
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
    expect(sheetLabel(false, 12)).toBe('12 providers');
    expect(sheetLabel(false, 1)).toBe('1 provider');
    expect(toggleLabel(true)).toBe('Hide provider list');
    expect(toggleLabel(false)).toBe('Show provider list');
    expect(chevronDir(true, true)).toBe('left');
    expect(chevronDir(true, false)).toBe('right');
    expect(chevronDir(false, true)).toBe('down');
    expect(chevronDir(false, false)).toBe('up');
    expect(sheetExpanded(true, false, 64, 64)).toBe(true);
    expect(sheetExpanded(false, false, 64, 64)).toBe(false);
    expect(sheetExpanded(false, false, 388, 64)).toBe(true);
  });

  it('tapping an open phone sheet returns to the peek', () => {
    expect(phoneTap(snaps.peek, snaps)).toBe(snaps.half);
    expect(phoneTap(snaps.half, snaps)).toBe(snaps.peek);
    expect(phoneTap(snaps.full, snaps)).toBe(snaps.peek);
    expect(phoneKey(snaps.peek, 'up', snaps)).toBe(snaps.half);
    expect(phoneKey(snaps.half, 'up', snaps)).toBe(snaps.full);
    expect(phoneKey(snaps.full, 'down', snaps)).toBe(snaps.half);
    expect(phoneKey(snaps.half, 'down', snaps)).toBe(snaps.peek);
  });
});
