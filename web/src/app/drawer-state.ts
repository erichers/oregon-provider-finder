export interface SnapHeights {
  peek: number;
  half: number;
  full: number;
}

export function snapHeights(viewport: number): SnapHeights {
  return {
    peek: 112,
    half: Math.round(viewport * 0.46),
    full: Math.max(280, viewport - 132),
  };
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
