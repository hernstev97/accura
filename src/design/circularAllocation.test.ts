import { describe, expect, it } from 'vitest';
import { createCircularArcSegments, describeCircularAllocation, type CircularAllocationSegment } from './circularAllocation';

const segment = (id: string, amountCents: number): CircularAllocationSegment => ({ id, amountCents, label: id, color: id });

describe('circular allocation geometry', () => {
  it('uses cent shares and lets the final segment absorb rendering residue', () => {
    const arcs = createCircularArcSegments([segment('a', 1), segment('b', 1), segment('c', 1)], 3);
    expect(arcs.map(({ share }) => share)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(arcs.reduce((sum, { share }) => sum + share, 0)).toBe(1);
    expect(arcs.every(({ dashLength, share }) => dashLength <= share * 100)).toBe(true);
    expect(arcs.at(-1)?.offset).toBeCloseTo(-66.6667, 3);
  });

  it('omits zero values without creating an accidental remainder gap', () => {
    const arcs = createCircularArcSegments([segment('a', 50), segment('zero', 0), segment('b', 50)], 100);
    expect(arcs.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(arcs.reduce((sum, { share }) => sum + share, 0)).toBe(1);
  });

  it('handles an empty or invalid total without invalid SVG geometry', () => {
    expect(createCircularArcSegments([segment('a', 0)], 0)).toEqual([]);
    expect(createCircularArcSegments([segment('a', 1)], Number.NaN)).toEqual([]);
  });

  it('builds localized accessible text from the same cent values', () => {
    expect(describeCircularAllocation([segment('Frei', 14_132)], 259_132)).toMatch(/Monatseinkommen 2\.591,32\s*€.*Frei: 141,32\s*€/);
  });
});
