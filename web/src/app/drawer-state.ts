export interface SnapHeights {
  peek: number;
  half: number;
  full: number;
}

export function snapHeights(viewport: number, reserve = 132): SnapHeights {
  const peek = 64;
  const full = Math.max(280, viewport - reserve);
  let half = Math.round(viewport * 0.46);
  if (half > full - 48) {
    half = Math.max(peek + 48, Math.round((peek + full) / 2));
  }
  return { peek, half, full };
}

export function rowFade(scrollLeft: number, clientWidth: number, scrollWidth: number): 'none' | 'left' | 'right' | 'both' {
  if (scrollWidth - clientWidth <= 1) {
    return 'none';
  }
  const left = scrollLeft > 2;
  const right = scrollLeft + clientWidth < scrollWidth - 2;
  if (left && right) {
    return 'both';
  }
  if (left) {
    return 'left';
  }
  if (right) {
    return 'right';
  }
  return 'none';
}

export function sheetLabel(loading: boolean, total: number): string {
  if (loading) {
    return 'Searching';
  }
  return total === 1 ? '1 provider' : `${total} providers`;
}

export function toggleLabel(expanded: boolean): string {
  return expanded ? 'Hide provider list' : 'Show provider list';
}

export function chevronDir(wide: boolean, expanded: boolean): 'left' | 'right' | 'up' | 'down' {
  if (wide) {
    return expanded ? 'left' : 'right';
  }
  return expanded ? 'down' : 'up';
}

export function sheetExpanded(wide: boolean, closed: boolean, height: number, peek: number): boolean {
  if (wide) {
    return !closed;
  }
  return height > peek + 8;
}

export function phoneTap(current: number, snaps: SnapHeights): number {
  if (current > snaps.peek + 8) {
    return snaps.peek;
  }
  return snaps.half;
}

export function phoneKey(current: number, direction: 'up' | 'down', snaps: SnapHeights): number {
  const points = [snaps.peek, snaps.half, snaps.full];
  const nearest = points.reduce((best, point) => Math.abs(point - current) < Math.abs(best - current) ? point : best);
  if (direction === 'up') {
    return points.find((point) => point > nearest + 8) ?? snaps.full;
  }
  return [...points].reverse().find((point) => point < nearest - 8) ?? snaps.peek;
}

export function nextSnap(current: number, velocity: number, snaps: SnapHeights): number {
  const points = [snaps.peek, snaps.half, snaps.full];
  if (velocity > 0.45) {
    return points.find((point) => point > current + 8) ?? snaps.full;
  }
  if (velocity < -0.45) {
    return [...points].reverse().find((point) => point < current - 8) ?? snaps.peek;
  }
  return points.reduce((best, point) => Math.abs(point - current) < Math.abs(best - current) ? point : best);
}
