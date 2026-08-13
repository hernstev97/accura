import type { CSSProperties } from 'react';
import type { AllocationRingSegment } from '../design/layeredAllocationRing';
import { describeAllocationRing } from '../design/layeredAllocationRing';
import { createOverviewAllocationSectors, OVERVIEW_RING_GEOMETRY } from '../design/overviewAllocationRing';
import { formatCurrencyCents, maskMoneyShape } from '../lib/format';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { MoneyValue } from './MoneyValue';

type OverviewAllocationHeroProps = {
  centerLabel: string;
  centerValue: string;
  id: string;
  incomeCents: number;
  segments: readonly AllocationRingSegment[];
};

type BarStyle = CSSProperties & {
  '--overview-allocation-color': string;
  '--overview-allocation-fill': string;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function fillRatio(amountCents: number, incomeCents: number) {
  if (incomeCents <= 0 || !Number.isSafeInteger(amountCents) || !Number.isSafeInteger(incomeCents)) return 0;
  return clamp(Math.abs(amountCents) / incomeCents, 0, 1);
}

export function OverviewAllocationHero({ centerLabel, centerValue, id, incomeCents, segments }: OverviewAllocationHeroProps) {
  const { privacyMode } = usePrivacy();
  const sectors = privacyMode
    ? createOverviewAllocationSectors([{
        amountCents: 1,
        color: 'var(--color-system-accent)',
        id: 'private',
        label: 'Aufteilung ausgeblendet',
      }], 1)
    : createOverviewAllocationSectors(segments, incomeCents);
  const hasDeficit = segments.some(({ amountCents }) => amountCents < 0);
  const summary = describeAllocationRing([...segments], incomeCents, privacyMode);
  const formattedIncome = formatCurrencyCents(incomeCents);
  const visibleIncome = privacyMode ? maskMoneyShape(formattedIncome) : formattedIncome;
  const visibleCenterValue = privacyMode ? maskMoneyShape(centerValue) : centerValue;
  const incomeSize = formattedIncome.length >= 19 ? 'long' : formattedIncome.length >= 14 ? 'medium' : 'default';
  const incomePathId = `${id}-income-path`;

  return (
    <section aria-label="Einkommensaufteilung" className="overview-allocation-hero" id={id}>
      <div className="overview-allocation-hero__layout">
        <figure
          aria-label={summary}
          className={`overview-allocation-ring ${hasDeficit ? 'overview-allocation-ring--deficit' : ''}`.trim()}
          role="img"
        >
          <svg
            aria-hidden="true"
            className="overview-allocation-ring__svg"
            focusable="false"
            viewBox={`0 0 ${OVERVIEW_RING_GEOMETRY.viewBoxSize} ${OVERVIEW_RING_GEOMETRY.viewBoxSize}`}
          >
            <g className="overview-allocation-ring__sectors">
              {sectors.map((sector) => (
                <path
                  className="overview-allocation-ring__sector"
                  d={sector.path}
                  data-allocation-id={sector.id}
                  data-end-angle={privacyMode ? undefined : sector.endAngle}
                  data-gap-angle={privacyMode ? undefined : sector.gapAngle}
                  data-share={privacyMode ? undefined : Number(sector.share.toFixed(6))}
                  data-start-angle={privacyMode ? undefined : sector.startAngle}
                  fillRule="evenodd"
                  key={sector.id}
                  style={{ fill: sector.color }}
                />
              ))}
            </g>
            <path
              className="overview-allocation-ring__income-path"
              d="M 41.477 94.023 A 41 41 0 0 0 118.523 94.023"
              fill="none"
              id={incomePathId}
            />
            <text
              className={`overview-allocation-ring__income ${privacyMode ? 'overview-allocation-ring__income--masked' : ''}`.trim()}
              data-income-size={incomeSize}
            >
              <textPath href={`#${incomePathId}`} startOffset="50%" textAnchor="middle">
                von {visibleIncome}
              </textPath>
            </text>
          </svg>
          <span aria-hidden="true" className="overview-allocation-ring__center">
            <strong
              className={privacyMode ? 'overview-allocation-ring__center-value--masked' : undefined}
              data-testid="overview-allocation-center-value"
            >
              {visibleCenterValue}
            </strong>
            <small>{centerLabel}</small>
          </span>
          <span className="sr-only" data-testid="overview-allocation-accessible-summary">{summary}</span>
        </figure>

        <div aria-label="Werte der Einkommensaufteilung" className="overview-allocation-bars" role="list">
          {segments.map((segment) => {
            const ratio = privacyMode ? 1 : fillRatio(segment.amountCents, incomeCents);
            const style: BarStyle = {
              '--overview-allocation-color': segment.color,
              '--overview-allocation-fill': `${ratio * 100}%`,
            };
            return (
              <div
                className={`overview-allocation-bar ${segment.amountCents < 0 ? 'overview-allocation-bar--deficit' : ''}`.trim()}
                data-allocation-id={segment.id}
                data-fill-ratio={privacyMode ? undefined : Number(ratio.toFixed(6))}
                key={segment.id}
                role="listitem"
                style={style}
              >
                <span aria-hidden="true" className="overview-allocation-bar__fill" />
                <span className="overview-allocation-bar__content">
                  <span className="overview-allocation-bar__label">{segment.label}</span>
                  <strong className="overview-allocation-bar__value financial-value">
                    <MoneyValue valueCents={segment.amountCents} />
                  </strong>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
