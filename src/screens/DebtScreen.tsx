import { useReducedMotion } from 'motion/react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { AppButton } from '../components/AppButton';
import { ChartFrame } from '../components/ChartFrame';
import { DataList, DataListItem } from '../components/DataList';
import { FinanceChartTooltip } from '../components/FinanceChartTooltip';
import { FinancialHero } from '../components/FinancialHero';
import { Icon } from '../components/Icon';
import { InlineNotice } from '../components/InlineNotice';
import { MetricCard } from '../components/MetricCard';
import { MetricGrid } from '../components/MetricGrid';
import { MoneyValue } from '../components/MoneyValue';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { ScreenHeader } from '../components/ScreenHeader';
import { SurfaceSection } from '../components/SurfaceSection';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import { createPaddedChartDomain } from '../design/chartScale';
import { useChartAnimation } from '../design/useChartAnimation';
import { compactCurrencyFormatter, formatCurrencyCentsValue, maskMoneyShape } from '../lib/format';
import { usePrivacy } from '../privacy/PrivacyProvider';

export function DebtScreen() {
  const data = useFinanceViewModel();
  const { privacyMode } = usePrivacy();
  const [progressExpanded, setProgressExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const balanceChartAnimationActive = useChartAnimation(reduceMotion, progressExpanded ? 'expanded' : 'collapsed', 360);
  const reliefChartAnimationActive = useChartAnimation(reduceMotion, 'initial', 360);
  const currentDebt = data.debtBalanceMilestones[0];
  const payoffMilestone = data.debtBalanceMilestones.at(-1);
  const hasDebtProgress = data.debtBalanceMilestones.length > 0;
  const hasFutureRelief = data.debtReliefMilestones.some(({ event }) => event !== null);
  const targetLabel = payoffMilestone ? `Planmäßig schuldenfrei im ${payoffMilestone.label}` : 'Aktuelle Schuldenübersicht';
  const reliefTargetLabel = data.debtReliefMilestones.at(-1)?.monthLabel ?? 'später';
  const remainingPaymentLabel = `${data.meta.remainingPaymentCount} ${data.meta.remainingPaymentCount === 1 ? 'verbleibende Rate' : 'verbleibende Raten'}`;
  const reliefValues = data.debtReliefMilestones.map(({ freeAmount }) => freeAmount);
  const reliefDomain = createPaddedChartDomain(reliefValues);
  const reliefValueMin = reliefValues.length ? Math.min(...reliefValues) : 0;
  const reliefValueMax = reliefValues.length ? Math.max(...reliefValues) : 0;

  const openDebtProgress = () => {
    setProgressExpanded(true);
    requestAnimationFrame(() => document.getElementById('debt-progress')?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    }));
  };

  if (data.debts.length === 0) {
    return (
      <ScreenEntrance className="debt-screen" destination="debt" labelledBy="debt-title">
        <ScreenHeader id="debt-title" supporting="Aktueller Datenstand" title="Dein Weg auf null" />
        <InlineNotice icon={<Icon name="check" size={22} />} title="Keine aktiven Schulden" tone="positive">
          <p>Im aktuellen Datenstand sind keine aktiven Schulden hinterlegt.</p>
        </InlineNotice>
      </ScreenEntrance>
    );
  }

  return (
    <ScreenEntrance className="debt-screen" destination="debt" labelledBy="debt-title">
      <ScreenHeader id="debt-title" supporting={targetLabel} title="Dein Weg auf null" />

      <FinancialHero
        action={hasDebtProgress ? <AppButton onClick={openDebtProgress} size="small" variant="tonal">Restschuldverlauf öffnen</AppButton> : undefined}
        className="financial-hero--allocation"
        id="debt-hero"
        label="Ablösesumme heute"
        supporting="Summe der dargestellten Gläubiger"
        tone="attention"
        value={<MoneyValue valueCents={data.totals.payoffTodayCents} />}
        visual={(
          <div className="debt-hero-status" aria-label={targetLabel} role="img">
            <span className="debt-hero-status__icon"><Icon name="trend" size={26} /></span>
            <span>Ziel</span>
            <strong>{payoffMilestone?.shortLabel ?? 'Aktuell'}</strong>
          </div>
        )}
      />

      <MetricGrid label="Schuldenkennzahlen">
        <MetricCard label="Noch planmäßig zu zahlen" supporting={remainingPaymentLabel} value={<MoneyValue valueCents={data.totals.remainingScheduledTotalCents} />} />
        <MetricCard label="Zukünftige Mehrkosten" tone="attention" value={<MoneyValue valueCents={data.totals.futureDebtCostCents} />} />
      </MetricGrid>

      <SurfaceSection className="creditors-section" id="creditors" supporting="Aktuelle Ablösebeträge" title="Gläubiger">
        <DataList label="Gläubiger">
          {data.debts.map((creditor) => (
            <DataListItem
              icon={<Icon name="debt" size={20} />}
              key={creditor.id}
              supporting={creditor.supportingText}
              title={creditor.name}
              value={<MoneyValue valueCents={creditor.payoffBalanceCents} />}
            />
          ))}
        </DataList>
        <p className="supporting-note">Die Beträge entsprechen dem letzten Snapshot bis zum Datenstand.</p>
      </SurfaceSection>

      <ChartFrame
        action={hasDebtProgress ? (
          <AppButton
            aria-controls="debt-progress-details"
            aria-expanded={progressExpanded}
            onClick={() => setProgressExpanded((expanded) => !expanded)}
            size="small"
            trailingIcon={<Icon className={progressExpanded ? 'is-rotated' : undefined} name="chevron" size={18} />}
            variant="tonal"
          >
            {progressExpanded ? 'Verlauf schließen' : 'Verlauf anzeigen'}
          </AppButton>
        ) : undefined}
        className={`debt-progress ${progressExpanded ? 'is-expanded' : ''}`}
        id="debt-progress"
        subtitle="Bei planmäßiger Zahlung"
        title="Restschuld"
      >
        {hasDebtProgress ? (
          <>
            <div className="debt-progress__summary">
              <div><span>Heute</span><strong className="financial-value"><MoneyValue valueCents={currentDebt?.balanceCents ?? data.totals.payoffTodayCents} /></strong></div>
              <span className="debt-progress__direction" aria-hidden="true"><Icon name="trend" size={22} /></span>
              <div><span>Ziel</span><strong>{payoffMilestone?.shortLabel}</strong></div>
            </div>

            <div
              aria-describedby="debt-progress-summary"
              aria-labelledby="debt-progress-title"
              className="debt-chart"
              data-animation-active={balanceChartAnimationActive}
              role="img"
              style={{ height: progressExpanded ? 292 : 144 }}
            >
              <AreaChart
                accessibilityLayer
                data={data.debtBalanceMilestones}
                margin={progressExpanded ? { top: 14, right: 8, bottom: 8, left: 0 } : { top: 8, right: 4, bottom: 0, left: 4 }}
                responsive
                style={{ width: '100%', maxWidth: '100%', height: '100%' }}
              >
                <defs>
                  <linearGradient id="debtArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                {progressExpanded ? <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} /> : null}
                {progressExpanded ? (
                  <XAxis axisLine={false} dataKey="shortLabel" interval="preserveStartEnd" minTickGap={18} tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }} tickLine={false} />
                ) : <XAxis dataKey="shortLabel" hide />}
                {progressExpanded ? (
                  <YAxis axisLine={false} tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }} tickFormatter={(value) => privacyMode ? maskMoneyShape(compactCurrencyFormatter.format(Number(value))) : compactCurrencyFormatter.format(Number(value))} tickLine={false} width={68} />
                ) : <YAxis hide />}
                <Tooltip
                  content={(props) => (
                    <FinanceChartTooltip
                      {...props}
                      centsDataKey="balanceCents"
                      formatTitle={(_, payload) => String((payload[0]?.payload as { label?: string } | undefined)?.label ?? '')}
                      valueLabel="Restschuld"
                    />
                  )}
                  isAnimationActive={balanceChartAnimationActive}
                />
                <Area
                  animationDuration={reduceMotion ? 0 : 360}
                  dataKey="balance"
                  fill="url(#debtArea)"
                  isAnimationActive={!reduceMotion}
                  name="Restschuld"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  type="monotone"
                />
              </AreaChart>
            </div>

            <div className="debt-milestones" hidden={!progressExpanded} id="debt-progress-details">
              {data.debtBalanceMilestones.map((milestone) => (
                <div key={milestone.date}><span>{milestone.label}</span><strong className="financial-value"><MoneyValue valueCents={milestone.balanceCents} /></strong></div>
              ))}
            </div>
            <p className="sr-only" id="debt-progress-summary">
              Restschuldverlauf: {data.debtBalanceMilestones.map((milestone) => `${milestone.label}: ${formatCurrencyCentsValue(milestone.balanceCents, privacyMode)}. `)}
            </p>
          </>
        ) : (
          <InlineNotice title="Kein Restschuldverlauf hinterlegt" tone="info">
            <p>Für die aktiven Schulden sind im aktuellen Datenstand keine Restschuldmeilensteine hinterlegt.</p>
          </InlineNotice>
        )}
      </ChartFrame>

      <ChartFrame
        className="relief-flow"
        footer={hasFutureRelief ? (
          <InlineNotice icon={<Icon name="calendar" size={22} />} title="Planungsannahme" tone="info">
            <p>Einkommen und alle anderen Ausgaben bleiben unverändert.</p>
          </InlineNotice>
        ) : undefined}
        id="debt-relief"
        subtitle={`Stufenweise bis ${reliefTargetLabel}`}
        title="Mehr frei durch auslaufende Raten"
      >
        {hasFutureRelief ? <>
          <div
          aria-describedby="relief-summary"
          aria-labelledby="debt-relief-title"
          className="relief-chart"
          data-animation-active={reliefChartAnimationActive}
          data-domain-max={privacyMode ? undefined : reliefDomain[1]}
          data-domain-min={privacyMode ? undefined : reliefDomain[0]}
          data-value-max={privacyMode ? undefined : reliefValueMax}
          data-value-min={privacyMode ? undefined : reliefValueMin}
          role="img"
        >
          <LineChart
            accessibilityLayer
            data={data.debtReliefMilestones}
            margin={{ top: 14, right: 8, bottom: 2, left: -8 }}
            responsive
            style={{ width: '100%', maxWidth: '100%', height: '100%' }}
          >
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
            <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }} tickFormatter={(label: string) => label.replace('Ab ', '').replace(/ (\d{2})(\d{2})$/, ' $2')} tickLine={false} />
            <YAxis axisLine={false} domain={[reliefDomain[0], reliefDomain[1]]} tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }} tickFormatter={(value) => privacyMode ? maskMoneyShape(compactCurrencyFormatter.format(Number(value))) : compactCurrencyFormatter.format(Number(value))} tickLine={false} width={62} />
            <Tooltip content={(props) => <FinanceChartTooltip {...props} centsDataKey="freeAmountCents" valueLabel="Frei pro Monat" />} isAnimationActive={!reduceMotion} />
            <Line
              animationDuration={reduceMotion ? 0 : 360}
              dataKey="freeAmount"
              dot={{ r: 4, fill: 'var(--color-positive-container)', strokeWidth: 2 }}
              isAnimationActive={reliefChartAnimationActive}
              name="Frei pro Monat"
              stroke="var(--chart-free)"
              strokeWidth={3}
              type="stepAfter"
            />
          </LineChart>
          </div>
          <p className="sr-only" id="relief-summary">
            Stufendiagramm des monatlich frei verfügbaren Gelds von aktuell bis {reliefTargetLabel}: {data.debtReliefMilestones.map((milestone) => `${milestone.label}: ${formatCurrencyCentsValue(milestone.freeAmountCents, privacyMode)} frei. `)}
          </p>

          <div className="milestone-flow entrance-group" aria-label="Auslaufende Raten">
            {data.debtReliefMilestones.filter((milestone) => milestone.event).map((milestone, index) => (
              <article className="milestone-row" key={milestone.date}>
                <span className="milestone-row__marker"><Icon name="milestone" size={18} /><small>{index + 1}</small></span>
                <div>
                  <span>{milestone.eventDetail}</span>
                  <strong>{milestone.event}</strong>
                </div>
                <p><strong className="financial-value"><MoneyValue valueCents={milestone.freeAmountCents} /></strong><span>frei · {milestone.label}</span></p>
              </article>
            ))}
          </div>
        </> : (
          <InlineNotice title="Keine künftige Entlastung hinterlegt" tone="info">
            <p>Im aktuellen Datenstand sind keine zukünftigen Entlastungsereignisse hinterlegt.</p>
          </InlineNotice>
        )}
      </ChartFrame>
    </ScreenEntrance>
  );
}
