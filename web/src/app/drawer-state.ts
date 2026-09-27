export interface SnapHeights {
  peek: number;
  half: number;
  full: number;
}

export function snapHeights(viewport: number): SnapHeights {
  return {
    peek: 64,
    half: Math.round(viewport * 0.46),
    full: Math.max(280, viewport - 132),
  };
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
