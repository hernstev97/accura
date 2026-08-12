import { describe, expect, it } from 'vitest';
import { createPaddedChartDomain } from './chartScale';

describe('createPaddedChartDomain', () => {
  it('contains the minimum and maximum with rounded breathing room', () => {
    const domain = createPaddedChartDomain([150, 300, 450]);
    expect(domain[0]).toBeLessThan(150);
    expect(domain[1]).toBeGreaterThan(450);
    expect(domain).toEqual([100, 500]);
  });

  it('does not force positive datasets below zero', () => {
    const domain = createPaddedChartDomain([8, 10]);
    expect(domain[0]).toBeGreaterThanOrEqual(0);
    expect(domain[0]).toBeLessThan(8);
    expect(domain[1]).toBeGreaterThan(10);
  });

  it('returns a deterministic fallback for missing values', () => {
    expect(createPaddedChartDomain([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([0, 1]);
  });
});
