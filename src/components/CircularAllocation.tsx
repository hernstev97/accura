import { createCircularArcSegments, describeCircularAllocation, type CircularAllocationSegment } from '../design/circularAllocation';

type CircularAllocationProps = {
  centerLabel: string;
  centerSupporting?: string;
  centerValue: string;
  className?: string;
  detailed: boolean;
  interactiveLabel?: string;
  onDetailedChange?: (detailed: boolean) => void;
  segments: CircularAllocationSegment[];
  totalCents: number;
};

const PATH_TOTAL = 100;

export function CircularAllocation({
  centerLabel,
  centerSupporting,
  centerValue,
  className = '',
  detailed,
  interactiveLabel,
  onDetailedChange,
  segments,
  totalCents,
}: CircularAllocationProps) {
  const detailedArcs = createCircularArcSegments(segments, totalCents);
  const freeCents = segments.find(({ id }) => id === 'free')?.amountCents ?? 0;
  const plannedCents = Math.max(0, totalCents - freeCents);
  const summaryArcs = createCircularArcSegments([
    { id: 'planned', label: 'Verplant', amountCents: plannedCents, color: 'var(--color-system-accent)' },
    { id: 'free-track', label: 'Frei', amountCents: Math.max(0, freeCents), color: 'transparent' },
  ], totalCents).filter(({ id }) => id === 'planned');
  const summary = describeCircularAllocation(segments, totalCents);
  const interactive = Boolean(onDetailedChange);

  const ring = (
    <>
      <svg aria-hidden="true" className="circular-allocation__svg" focusable="false" viewBox="0 0 132 132">
        <circle className="circular-allocation__track" cx="66" cy="66" pathLength={PATH_TOTAL} r="51" />
        <g className={`circular-allocation__summary-arcs ${detailed ? 'is-hidden' : ''}`}>
          {summaryArcs.map((segment) => (
            <circle
              className="circular-allocation__arc"
              cx="66"
              cy="66"
              key={segment.id}
              pathLength={PATH_TOTAL}
              r="51"
              style={{ stroke: segment.color }}
              strokeDasharray={`${segment.dashLength} ${PATH_TOTAL - segment.dashLength}`}
              strokeDashoffset={segment.offset}
            />
          ))}
        </g>
        <g className={`circular-allocation__detail-arcs ${detailed ? '' : 'is-hidden'}`}>
          {detailedArcs.map((segment) => (
            <circle
              className="circular-allocation__arc"
              cx="66"
              cy="66"
              data-allocation-id={segment.id}
              data-amount-cents={segment.amountCents}
              key={segment.id}
              pathLength={PATH_TOTAL}
              r="51"
              style={{ stroke: segment.color }}
              strokeDasharray={`${segment.dashLength} ${PATH_TOTAL - segment.dashLength}`}
              strokeDashoffset={segment.offset}
            />
          ))}
        </g>
      </svg>
      <span className="circular-allocation__center" aria-hidden="true">
        <small>{centerLabel}</small>
        <strong>{centerValue}</strong>
        {centerSupporting ? <span>{centerSupporting}</span> : null}
      </span>
      <span className="sr-only" data-testid="allocation-accessible-summary">{summary}</span>
    </>
  );

  return (
    <div
      className={`circular-allocation ${interactive ? 'circular-allocation--interactive' : ''} ${className}`.trim()}
      data-detailed={detailed}
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
