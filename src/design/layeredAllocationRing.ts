import { formatCurrencyCentsValue } from '../lib/format';

export type AllocationRingSegment = {
  amountCents: number;
  color: string;
  id: string;
  label: string;
};

export type LayeredArcSegment = AllocationRingSegment & {
  capExtension: number;
  dashGap: number;
  dashLength: number;
  drawOrder: number;
  fullCircle: boolean;
  isTiny: boolean;
  normalizationFactor: number;
  normalizedAmountCents: number;
  offset: number;
  overlapAfter: number;
  overlapBefore: number;
  share: number;
  start: number;
  strokeWidth: number;
  visibleSpan: number;
};

export const LAYERED_RING_GEOMETRY = Object.freeze({
  boundaryOverlapFraction: 0.58,
  maxBoundaryOverlap: 3.4,
  minimumDashLength: 0.35,
  pathTotal: 100,
  radius: 49,
  strokeWidth: 18,
  tinyShareThreshold: 0.025,
  tinyStrokeWidth: 6.5,
});

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const normalizePathPosition = (value: number) => ((value % LAYERED_RING_GEOMETRY.pathTotal) + LAYERED_RING_GEOMETRY.pathTotal) % LAYERED_RING_GEOMETRY.pathTotal;

function capExtensionFor(strokeWidth: number) {
  const circumference = 2 * Math.PI * LAYERED_RING_GEOMETRY.radius;
  return ((strokeWidth / 2) / circumference) * LAYERED_RING_GEOMETRY.pathTotal;
}

/**
 * Builds clockwise, intentionally overlapping capsules on one circular path.
 * Each desired visible span includes half of the shared overlap at either end;
 * the round-cap extension is then removed from the SVG dash length. The renderer
 * adds each segment's trailing cap in a second pass so it rests on the beginning
 * of the next segment, including across the circular closing boundary.
 */
export function createLayeredArcSegments(segments: AllocationRingSegment[], totalCents: number): LayeredArcSegment[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return [];

  const visible = segments.filter(({ amountCents }) => Number.isSafeInteger(amountCents) && amountCents > 0);
  const sourceTotal = visible.reduce((sum, { amountCents }) => sum + amountCents, 0);
  if (!Number.isSafeInteger(sourceTotal) || sourceTotal <= 0) return [];

  if (visible.length === 1) {
    const [segment] = visible;
    return [{
      ...segment,
      capExtension: 0,
      dashGap: 0,
      dashLength: LAYERED_RING_GEOMETRY.pathTotal,
      drawOrder: 0,
      fullCircle: true,
      isTiny: false,
      normalizationFactor: totalCents / sourceTotal,
      normalizedAmountCents: totalCents,
      offset: 0,
      overlapAfter: 0,
      overlapBefore: 0,
      share: 1,
      start: 0,
      strokeWidth: LAYERED_RING_GEOMETRY.strokeWidth,
      visibleSpan: LAYERED_RING_GEOMETRY.pathTotal,
    }];
  }

  let consumedShare = 0;
  const shares = visible.map(({ amountCents }, index) => {
    const share = index === visible.length - 1 ? 1 - consumedShare : amountCents / sourceTotal;
    const safeShare = clamp(Number.isFinite(share) ? share : 0, 0, 1);
    consumedShare += safeShare;
    return safeShare;
  });
  const spans = shares.map((share) => share * LAYERED_RING_GEOMETRY.pathTotal);
  const boundaryOverlaps = spans.map((span, index) => {
    const nextSpan = spans[(index + 1) % spans.length];
    return clamp(
      Math.min(
        LAYERED_RING_GEOMETRY.maxBoundaryOverlap,
        span * LAYERED_RING_GEOMETRY.boundaryOverlapFraction,
        nextSpan * LAYERED_RING_GEOMETRY.boundaryOverlapFraction,
      ),
      0,
      LAYERED_RING_GEOMETRY.maxBoundaryOverlap,
    );
  });
  const normalizationFactor = totalCents / sourceTotal;

  let nominalStart = 0;
  return visible.map((segment, index) => {
    const nominalSpan = spans[index];
    const overlapBefore = boundaryOverlaps[(index - 1 + visible.length) % visible.length];
    const overlapAfter = boundaryOverlaps[index];
    const isTiny = shares[index] < LAYERED_RING_GEOMETRY.tinyShareThreshold;
    const strokeWidth = isTiny ? LAYERED_RING_GEOMETRY.tinyStrokeWidth : LAYERED_RING_GEOMETRY.strokeWidth;
    const capExtension = capExtensionFor(strokeWidth);
    const desiredVisibleSpan = nominalSpan + (overlapBefore + overlapAfter) / 2;
    const minimumVisibleSpan = capExtension * 2 + LAYERED_RING_GEOMETRY.minimumDashLength;
    const visibleSpan = clamp(
      Math.max(desiredVisibleSpan, minimumVisibleSpan),
      minimumVisibleSpan,
      LAYERED_RING_GEOMETRY.pathTotal - 0.01,
    );
    const dashLength = clamp(
      visibleSpan - capExtension * 2,
      LAYERED_RING_GEOMETRY.minimumDashLength,
      LAYERED_RING_GEOMETRY.pathTotal - 0.01,
    );
    const desiredCenter = nominalStart + nominalSpan / 2 + (overlapAfter - overlapBefore) / 4;
    const dashStart = normalizePathPosition(desiredCenter - visibleSpan / 2 + capExtension);
    const start = nominalStart;
    nominalStart += nominalSpan;

    return {
      ...segment,
      capExtension,
      dashGap: Math.max(0, LAYERED_RING_GEOMETRY.pathTotal - dashLength),
      dashLength,
      drawOrder: index,
      fullCircle: false,
      isTiny,
      normalizationFactor,
      normalizedAmountCents: shares[index] * totalCents,
      offset: -dashStart,
      overlapAfter,
      overlapBefore,
      share: shares[index],
      start,
      strokeWidth,
      visibleSpan: dashLength + capExtension * 2,
    };
  });
}

export function describeAllocationRing(segments: AllocationRingSegment[], totalCents: number, privacyMode = false) {
  const parts = segments
    .filter(({ amountCents }) => Number.isSafeInteger(amountCents))
    .map(({ amountCents, label }) => `${label}: ${formatCurrencyCentsValue(amountCents, privacyMode)}`);
  return `Monatseinkommen ${formatCurrencyCentsValue(totalCents, privacyMode)}. ${parts.join('. ')}.`;
}
