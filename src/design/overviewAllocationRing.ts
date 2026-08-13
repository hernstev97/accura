import type { AllocationRingSegment } from './layeredAllocationRing';

export type OverviewAllocationSector = AllocationRingSegment & {
  endAngle: number;
  gapAngle: number;
  path: string;
  share: number;
  startAngle: number;
};

export const OVERVIEW_RING_GEOMETRY = Object.freeze({
  center: 80,
  cornerRadius: 4,
  gapAngle: 2.4,
  innerRadius: 48,
  outerRadius: 76,
  startAngle: -90,
  viewBoxSize: 160,
});

const precision = (value: number) => Number(value.toFixed(3));
const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

function polarPoint(angle: number, radius: number) {
  const radians = degreesToRadians(angle);
  return {
    x: precision(OVERVIEW_RING_GEOMETRY.center + radius * Math.cos(radians)),
    y: precision(OVERVIEW_RING_GEOMETRY.center + radius * Math.sin(radians)),
  };
}

function fullRingPath() {
  const { center, innerRadius, outerRadius } = OVERVIEW_RING_GEOMETRY;
  return [
    `M ${center} ${center - outerRadius}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${center} ${center + outerRadius}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${center} ${center - outerRadius}`,
    `M ${center} ${center - innerRadius}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center + innerRadius}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center - innerRadius}`,
    'Z',
  ].join(' ');
}

/** Builds a clockwise annular sector with four modestly rounded corners. */
function roundedSectorPath(startAngle: number, endAngle: number) {
  const { cornerRadius, innerRadius, outerRadius } = OVERVIEW_RING_GEOMETRY;
  const span = endAngle - startAngle;
  const outerCornerAngle = Math.min((cornerRadius / outerRadius) * (180 / Math.PI), span / 4);
  const innerCornerAngle = Math.min((cornerRadius / innerRadius) * (180 / Math.PI), span / 4);
  const largeArc = span > 180 ? 1 : 0;

  const outerStart = polarPoint(startAngle + outerCornerAngle, outerRadius);
  const outerEnd = polarPoint(endAngle - outerCornerAngle, outerRadius);
  const outerEndControl = polarPoint(endAngle, outerRadius);
  const outerEndEdge = polarPoint(endAngle, outerRadius - cornerRadius);
  const innerEndEdge = polarPoint(endAngle, innerRadius + cornerRadius);
  const innerEndControl = polarPoint(endAngle, innerRadius);
  const innerEnd = polarPoint(endAngle - innerCornerAngle, innerRadius);
  const innerStart = polarPoint(startAngle + innerCornerAngle, innerRadius);
  const innerStartControl = polarPoint(startAngle, innerRadius);
  const innerStartEdge = polarPoint(startAngle, innerRadius + cornerRadius);
  const outerStartEdge = polarPoint(startAngle, outerRadius - cornerRadius);
  const outerStartControl = polarPoint(startAngle, outerRadius);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `Q ${outerEndControl.x} ${outerEndControl.y} ${outerEndEdge.x} ${outerEndEdge.y}`,
    `L ${innerEndEdge.x} ${innerEndEdge.y}`,
    `Q ${innerEndControl.x} ${innerEndControl.y} ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    `Q ${innerStartControl.x} ${innerStartControl.y} ${innerStartEdge.x} ${innerStartEdge.y}`,
    `L ${outerStartEdge.x} ${outerStartEdge.y}`,
    `Q ${outerStartControl.x} ${outerStartControl.y} ${outerStart.x} ${outerStart.y}`,
    'Z',
  ].join(' ');
}

export function createOverviewAllocationSectors(
  segments: readonly AllocationRingSegment[],
  totalCents: number,
): OverviewAllocationSector[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return [];

  const visible = segments.filter(({ amountCents }) => Number.isSafeInteger(amountCents) && amountCents > 0);
  const sourceTotal = visible.reduce((sum, { amountCents }) => sum + amountCents, 0);
  if (!Number.isSafeInteger(sourceTotal) || sourceTotal <= 0) return [];

  if (visible.length === 1) {
    return [{
      ...visible[0],
      endAngle: OVERVIEW_RING_GEOMETRY.startAngle + 360,
      gapAngle: 0,
      path: fullRingPath(),
      share: 1,
      startAngle: OVERVIEW_RING_GEOMETRY.startAngle,
    }];
  }

  let consumedShare = 0;
  let nominalStart = OVERVIEW_RING_GEOMETRY.startAngle;

  return visible.map((segment, index) => {
    const share = index === visible.length - 1
      ? 1 - consumedShare
      : segment.amountCents / sourceTotal;
    consumedShare += share;
    const nominalSpan = share * 360;
    const gapAngle = Math.min(OVERVIEW_RING_GEOMETRY.gapAngle, nominalSpan * 0.2);
    const startAngle = nominalStart + gapAngle / 2;
    const endAngle = nominalStart + nominalSpan - gapAngle / 2;
    nominalStart += nominalSpan;

    return {
      ...segment,
      endAngle: precision(endAngle),
      gapAngle: precision(gapAngle),
      path: roundedSectorPath(startAngle, endAngle),
      share,
      startAngle: precision(startAngle),
    };
  });
}
