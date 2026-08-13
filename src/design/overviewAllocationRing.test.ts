import { describe, expect, it } from 'vitest';
import type { AllocationRingSegment } from './layeredAllocationRing';
import { createOverviewAllocationSectors, OVERVIEW_RING_GEOMETRY } from './overviewAllocationRing';

const segment = (id: string, amountCents: number): AllocationRingSegment => ({
  amountCents,
  color: id,
  id,
  label: id,
});

describe('overview allocation ring geometry', () => {
  it('builds separated clockwise sectors in source order', () => {
    const sectors = createOverviewAllocationSectors([
      segment('expenses', 215_000),
      segment('reserves', 30_000),
      segment('free', 14_132),
    ], 259_132);

    expect(sectors.map(({ id }) => id)).toEqual(['expenses', 'reserves', 'free']);
    expect(sectors.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1, 12);
    expect(sectors.every(({ gapAngle, path }) => gapAngle > 0 && path.endsWith('Z'))).toBe(true);
    sectors.forEach((sector, index) => {
      const next = sectors[(index + 1) % sectors.length];
      const nextStart = index === sectors.length - 1 ? next.startAngle + 360 : next.startAngle;
      expect(nextStart - sector.endAngle).toBeGreaterThan(0);
    });
  });

  it('keeps tiny positive sectors visible while reducing their local gap', () => {
    const sectors = createOverviewAllocationSectors([segment('major', 9_999), segment('tiny', 1)], 10_000);
    const tiny = sectors.find(({ id }) => id === 'tiny');

    expect(tiny).toBeDefined();
    expect((tiny?.endAngle ?? 0) - (tiny?.startAngle ?? 0)).toBeGreaterThan(0);
    expect(tiny?.gapAngle).toBeLessThan(OVERVIEW_RING_GEOMETRY.gapAngle);
  });

  it('omits zero and negative values without reordering the survivors', () => {
    const sectors = createOverviewAllocationSectors([
      segment('expenses', 100),
      segment('zero', 0),
      segment('deficit', -20),
      segment('reserves', 20),
    ], 100);

    expect(sectors.map(({ id }) => id)).toEqual(['expenses', 'reserves']);
    expect(sectors.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1, 12);
  });

  it('renders one positive allocation as a complete donut', () => {
    const [sector] = createOverviewAllocationSectors([segment('free', 100)], 100);

    expect(sector.share).toBe(1);
    expect(sector.gapAngle).toBe(0);
    expect(sector.path.match(/A /g)).toHaveLength(4);
  });

  it('returns no geometry for non-positive or invalid income', () => {
    expect(createOverviewAllocationSectors([segment('free', 100)], 0)).toEqual([]);
    expect(createOverviewAllocationSectors([segment('free', 100)], -100)).toEqual([]);
    expect(createOverviewAllocationSectors([segment('free', 100)], Number.NaN)).toEqual([]);
  });
});
