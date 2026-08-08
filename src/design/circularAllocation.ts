import { formatCurrency } from '../lib/format';

export type CircularAllocationSegment = {
  amountCents: number;
  color: string;
  id: string;
  label: string;
};

export type CircularArcSegment = CircularAllocationSegment & {
  dashLength: number;
  offset: number;
  share: number;
};

const PATH_TOTAL = 100;
const GAP = 3.8;

export function createCircularArcSegments(segments: CircularAllocationSegment[], totalCents: number): CircularArcSegment[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return [];
  const visible = segments.filter(({ amountCents }) => Number.isSafeInteger(amountCents) && amountCents > 0);
  let consumedCents = 0;
  return visible.map((segment, index) => {
    const remaining = totalCents - consumedCents;
    const representedCents = index === visible.length - 1 ? remaining : Math.min(segment.amountCents, remaining);
    const start = (consumedCents * PATH_TOTAL) / totalCents;
    const share = Math.max(0, representedCents) / totalCents;
    consumedCents += Math.max(0, representedCents);
    return {
      ...segment,
      dashLength: Math.max(0, share * PATH_TOTAL - Math.min(GAP, share * PATH_TOTAL * 0.36)),
      offset: -start,
      share,
    };
  });
}

export function describeCircularAllocation(segments: CircularAllocationSegment[], totalCents: number) {
  const parts = segments.map(({ amountCents, label }) => `${label}: ${formatCurrency(amountCents / 100)}`);
  return `Monatseinkommen ${formatCurrency(totalCents / 100)}. ${parts.join('. ')}.`;
}
