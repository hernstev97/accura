import { describe, expect, it } from 'vitest';
import {
  createLayeredArcSegments,
  describeAllocationRing,
  LAYERED_RING_GEOMETRY,
  type AllocationRingSegment,
} from './layeredAllocationRing';

const segment = (id: string, amountCents: number): AllocationRingSegment => ({ id, amountCents, label: id, color: id });

const expectValidGeometry = (arcs: ReturnType<typeof createLayeredArcSegments>) => {
  expect(arcs.length).toBeGreaterThan(0);
  for (const arc of arcs) {
    for (const value of [
      arc.capExtension,
      arc.dashGap,
      arc.dashLength,
      arc.normalizationFactor,
      arc.normalizedAmountCents,
      arc.offset,
      arc.overlapAfter,
      arc.overlapBefore,
      arc.share,
      arc.start,
      arc.strokeWidth,
      arc.visibleSpan,
    ]) expect(Number.isFinite(value)).toBe(true);
    expect(arc.dashLength).toBeGreaterThanOrEqual(0);
    expect(arc.dashGap).toBeGreaterThanOrEqual(0);
    expect(arc.dashLength).toBeLessThanOrEqual(LAYERED_RING_GEOMETRY.pathTotal);
    expect(arc.visibleSpan).toBeGreaterThan(0);
    expect(arc.visibleSpan).toBeLessThanOrEqual(LAYERED_RING_GEOMETRY.pathTotal);
    expect(arc.offset).toBeLessThanOrEqual(0);
    expect(arc.offset).toBeGreaterThan(-LAYERED_RING_GEOMETRY.pathTotal);
  }
};

describe('layered allocation ring geometry', () => {
  it('builds three normal clockwise capsules with cap-corrected overlap and stable draw order', () => {
    const arcs = createLayeredArcSegments([
      segment('expenses', 215_000),
      segment('reserves', 30_000),
      segment('free', 14_132),
    ], 259_132);

    expect(arcs.map(({ id }) => id)).toEqual(['expenses', 'reserves', 'free']);
    expect(arcs.map(({ drawOrder }) => drawOrder)).toEqual([0, 1, 2]);
    expect(arcs.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1, 12);
    for (const arc of arcs) {
      expect(arc.dashLength + arc.capExtension * 2).toBeCloseTo(arc.visibleSpan, 10);
      expect(arc.visibleSpan).toBeCloseTo(
        arc.share * 100 + (arc.overlapBefore + arc.overlapAfter) / 2,
        10,
      );
    }
    expectValidGeometry(arcs);
  });

  it('keeps several detailed budget layers complete and in input order', () => {
    const amounts = [160_000, 40_000, 30_000, 10_000, 5_000, 14_132];
    const arcs = createLayeredArcSegments(amounts.map((amount, index) => segment(`group-${index}`, amount)), 259_132);

    expect(arcs).toHaveLength(amounts.length);
    expect(arcs.map(({ drawOrder }) => drawOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(arcs.reduce((sum, { normalizedAmountCents }) => sum + normalizedAmountCents, 0)).toBeCloseTo(259_132, 6);
    expectValidGeometry(arcs);
  });

  it('omits a zero-value segment without changing the surviving clockwise progression', () => {
    const arcs = createLayeredArcSegments([segment('a', 50), segment('zero', 0), segment('b', 50)], 100);
    expect(arcs.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(arcs.reduce((sum, { share }) => sum + share, 0)).toBe(1);
    expectValidGeometry(arcs);
  });

  it('uses a visibly smaller capsule for a very small non-zero segment', () => {
    const arcs = createLayeredArcSegments([segment('major', 9_999), segment('tiny', 1)], 10_000);
    const tiny = arcs.find(({ id }) => id === 'tiny');
    const major = arcs.find(({ id }) => id === 'major');

    expect(tiny?.isTiny).toBe(true);
    expect(tiny?.strokeWidth).toBe(LAYERED_RING_GEOMETRY.tinyStrokeWidth);
    expect(tiny?.visibleSpan).toBeGreaterThan(0);
    expect(tiny?.visibleSpan).toBeLessThan(major?.visibleSpan ?? 0);
    expectValidGeometry(arcs);
  });

  it('absorbs cent-rounding residue without leaving a floating-point gap', () => {
    const arcs = createLayeredArcSegments([segment('a', 1), segment('b', 1), segment('c', 1)], 3);
    expect(arcs.map(({ share }) => share)).toEqual([1 / 3, 1 / 3, 1 - 2 / 3]);
    expect(arcs.at(-1)?.start).toBeCloseTo(66.6667, 3);
    expect(arcs.reduce((sum, { share }) => sum + share, 0)).toBe(1);
    expectValidGeometry(arcs);
  });

  it('normalizes mismatched source totals while preserving source proportions', () => {
    const arcs = createLayeredArcSegments([segment('a', 40), segment('b', 40)], 100);
    expect(arcs.map(({ share }) => share)).toEqual([0.5, 0.5]);
    expect(arcs.every(({ normalizationFactor }) => normalizationFactor === 1.25)).toBe(true);
    expect(arcs.reduce((sum, { normalizedAmountCents }) => sum + normalizedAmountCents, 0)).toBe(100);
    expectValidGeometry(arcs);
  });

  it('never returns NaN, negative lengths, overflow, or invalid SVG-ready values', () => {
    for (const [segments, total] of [
      [[segment('a', 1)], 1],
      [[segment('a', 1), segment('b', 9_999_999)], 10_000_000],
      [[segment('negative', -1), segment('a', 10)], 10],
      [[segment('nan', Number.NaN), segment('a', 10)], 10],
    ] as const) expectValidGeometry(createLayeredArcSegments([...segments], total));

    expect(createLayeredArcSegments([segment('a', 0)], 0)).toEqual([]);
    expect(createLayeredArcSegments([segment('a', 1)], Number.NaN)).toEqual([]);
  });

  it('builds localized accessible text from the authoritative cent values', () => {
    expect(describeAllocationRing([segment('Frei', 14_132)], 259_132)).toMatch(/Monatseinkommen 2\.591,32\s*€.*Frei: 141,32\s*€/);
  });
});
