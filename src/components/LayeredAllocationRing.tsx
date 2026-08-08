import {
  createLayeredArcSegments,
  describeAllocationRing,
  LAYERED_RING_GEOMETRY,
  type AllocationRingSegment,
  type LayeredArcSegment,
} from '../design/layeredAllocationRing';

type LayeredAllocationRingProps = {
  centerLabel: string;
  centerSupporting?: string;
  centerValue: string;
  className?: string;
  detailed: boolean;
  interactiveLabel?: string;
  onDetailedChange?: (detailed: boolean) => void;
  segments: AllocationRingSegment[];
  totalCents: number;
};

const precision = (value: number) => Number(value.toFixed(4));

function Arc({ segment, exposeData }: { exposeData: boolean; segment: LayeredArcSegment }) {
  return (
    <circle
      className={`circular-allocation__arc ${segment.isTiny ? 'circular-allocation__arc--tiny' : ''}`.trim()}
      cx="66"
      cy="66"
      data-allocation-id={exposeData ? segment.id : undefined}
      data-amount-cents={exposeData ? segment.amountCents : undefined}
      data-cap-extension={exposeData ? precision(segment.capExtension) : undefined}
      data-dash-length={exposeData ? precision(segment.dashLength) : undefined}
      data-draw-order={exposeData ? segment.drawOrder : undefined}
      data-normalization-factor={exposeData ? precision(segment.normalizationFactor) : undefined}
      data-overlap-after={exposeData ? precision(segment.overlapAfter) : undefined}
      data-overlap-before={exposeData ? precision(segment.overlapBefore) : undefined}
      data-share={exposeData ? precision(segment.share) : undefined}
      data-tiny={exposeData ? String(segment.isTiny) : undefined}
      data-visible-span={exposeData ? precision(segment.visibleSpan) : undefined}
      pathLength={LAYERED_RING_GEOMETRY.pathTotal}
      r={LAYERED_RING_GEOMETRY.radius}
      strokeDasharray={`${precision(segment.dashLength)} ${precision(segment.dashGap)}`}
      strokeDashoffset={precision(segment.offset)}
      strokeWidth={segment.strokeWidth}
      style={{ stroke: segment.color }}
    />
  );
}

export function LayeredAllocationRing({
  centerLabel,
  centerSupporting,
  centerValue,
  className = '',
  detailed,
  interactiveLabel,
  onDetailedChange,
  segments,
  totalCents,
}: LayeredAllocationRingProps) {
  const detailedArcs = createLayeredArcSegments(segments, totalCents);
  const freeCents = segments.find(({ id }) => id === 'free')?.amountCents ?? 0;
  const plannedCents = Math.max(0, totalCents - freeCents);
  const summaryArcs = createLayeredArcSegments([
    { id: 'planned', label: 'Verplant', amountCents: plannedCents, color: 'var(--color-system-accent)' },
    { id: 'free-track', label: 'Frei', amountCents: Math.max(0, freeCents), color: 'transparent' },
  ], totalCents).filter(({ id }) => id === 'planned');
  const summary = describeAllocationRing(segments, totalCents);
  const interactive = Boolean(onDetailedChange);
  const compactCenterValue = centerValue.replace(/\s/g, '');
  const centerSize = compactCenterValue.length >= 12 ? 'long' : compactCenterValue.length >= 9 ? 'medium' : 'default';

  const ring = (
    <>
      <svg aria-hidden="true" className="circular-allocation__svg" focusable="false" viewBox="0 0 132 132">
        <circle
          className="circular-allocation__track"
          cx="66"
          cy="66"
          pathLength={LAYERED_RING_GEOMETRY.pathTotal}
          r={LAYERED_RING_GEOMETRY.radius}
        />
        <g className={`circular-allocation__summary-arcs ${detailed ? 'is-hidden' : ''}`}>
          {summaryArcs.map((segment) => <Arc exposeData={false} key={segment.id} segment={segment} />)}
        </g>
        <g className={`circular-allocation__detail-arcs ${detailed ? '' : 'is-hidden'}`}>
          {detailedArcs.map((segment) => <Arc exposeData key={segment.id} segment={segment} />)}
        </g>
      </svg>
      <span className="circular-allocation__center" data-center-size={centerSize} aria-hidden="true">
        <small>{centerLabel}</small>
        <strong data-testid="allocation-center-value">{centerValue}</strong>
        {centerSupporting ? <span>{centerSupporting}</span> : null}
      </span>
      <span className="sr-only" data-testid="allocation-accessible-summary">{summary}</span>
    </>
  );

  return (
    <div
      className={`layered-allocation-ring circular-allocation ${interactive ? 'circular-allocation--interactive' : ''} ${className}`.trim()}
      data-detailed={detailed}
      data-geometry="layered-overlap"
      data-path-radius={LAYERED_RING_GEOMETRY.radius}
      data-stroke-width={LAYERED_RING_GEOMETRY.strokeWidth}
      data-summary-planned-cents={plannedCents}
      data-total-cents={totalCents}
    >
      {interactive ? (
        <button
          aria-label={`${interactiveLabel ?? 'Einkommensaufteilung'}. ${summary}`}
          aria-pressed={detailed}
          className="circular-allocation__button"
          onClick={() => onDetailedChange?.(!detailed)}
          type="button"
        >
          {ring}
        </button>
      ) : (
        <figure aria-label={summary} className="circular-allocation__figure" role="img">
          {ring}
        </figure>
      )}
    </div>
  );
}
