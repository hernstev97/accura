import { useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ExpandableSurface } from '../components/ExpandableSurface';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { PressableSurface } from '../components/PressableSurface';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { SectionHeading } from '../components/SectionHeading';
import { Squiggle } from '../components/Squiggle';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import { compactCurrencyFormatter, formatCurrency } from '../lib/format';

const tooltipStyle = {
  background: 'var(--color-surface-bright)',
  border: 0,
  borderRadius: 18,
  boxShadow: '0 8px 28px rgb(0 0 0 / 0.16)',
  color: 'var(--color-on-surface)',
};

export function DebtScreen() {
  const data = useFinanceViewModel();
  const [progressExpanded, setProgressExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const currentDebt = data.debtBalanceMilestones[0];
  const payoffMilestone = data.debtBalanceMilestones.at(-1);
  const targetLabel = payoffMilestone ? `Planmäßig schuldenfrei im ${payoffMilestone.label}` : 'Aktuelle Schuldenübersicht';
  const reliefTargetLabel = data.debtReliefMilestones.at(-1)?.monthLabel ?? 'später';
  const remainingPaymentLabel = `${data.meta.remainingPaymentCount} ${data.meta.remainingPaymentCount === 1 ? 'verbleibende Rate' : 'verbleibende Raten'}`;

  return (
    <ScreenEntrance className="debt-screen" destination="debt" labelledBy="debt-title">
      <header className="screen-heading">
        <h1 id="debt-title">Dein Weg auf null</h1>
        <p>{targetLabel}</p>
      </header>

      <section className="payoff-group" aria-label="Schuldenkennzahlen">
        <div className="payoff-group__primary">
          <span>Ablösesumme heute</span>
          <strong>{formatCurrency(data.totals.payoffToday)}</strong>
          <p>Summe der dargestellten Gläubiger</p>
        </div>
        <div className="payoff-group__metrics">
          <MetricCard
            label="Noch planmäßig zu zahlen"
            supporting={remainingPaymentLabel}
            value={formatCurrency(data.totals.remainingScheduledTotal)}
          />
          <MetricCard label="Zukünftige Mehrkosten" tone="attention" value={formatCurrency(data.totals.futureDebtCost)} />
        </div>
      </section>

      <section className="content-section creditors-section" aria-label="Gläubiger">
        <SectionHeading compact subtitle="Aktuelle Ablösebeträge" title="Gläubiger" />
        <div className="grouped-list creditor-list entrance-group">
          {data.debts.map((creditor, index) => (
            <article className="grouped-row creditor-row" key={creditor.id}>
              <span className="creditor-sequence" aria-hidden="true">0{index + 1}</span>
              <span className="grouped-row__body">
                <strong>{creditor.name}</strong>
                <small>{creditor.supportingText}</small>
              </span>
              <strong className="money-value">{formatCurrency(creditor.payoffBalance)}</strong>
              <span className="creditor-link" aria-hidden="true" />
            </article>
          ))}
        </div>
        <p className="supporting-note">Die Beträge entsprechen dem letzten Snapshot bis zum Datenstand.</p>
      </section>

      <ExpandableSurface className="debt-progress" expanded={progressExpanded} label="Projizierte Restschuld">
        <SectionHeading
          action={
            <PressableSurface
              aria-controls="debt-progress-details"
              aria-expanded={progressExpanded}
              className="extended-action"
              onClick={() => setProgressExpanded((expanded) => !expanded)}
            >
              {progressExpanded ? 'Weniger' : 'Verlauf'}
              <span className={`disclosure-icon ${progressExpanded ? 'is-rotated' : ''}`}><Icon name="chevron" size={18} /></span>
            </PressableSurface>
          }
          compact
          subtitle="Bei planmäßiger Zahlung"
          title="Restschuld"
        />
        <div className="debt-progress__summary">
          <div><span>Heute</span><strong>{formatCurrency(currentDebt?.balance ?? data.totals.payoffToday)}</strong></div>
          <span className="debt-progress__arrow"><Squiggle /></span>
          <div><span>Ziel</span><strong>{payoffMilestone?.shortLabel}</strong></div>
        </div>

        <div
          className="debt-chart"
          style={{ height: progressExpanded ? 292 : 126 }}
        >
          <AreaChart
            accessibilityLayer
            data={data.debtBalanceMilestones}
            margin={progressExpanded ? { top: 14, right: 8, bottom: 8, left: -12 } : { top: 8, right: 4, bottom: 0, left: 4 }}
            responsive
            style={{ width: '100%', maxWidth: '100%', height: '100%' }}
          >
            <defs>
              <linearGradient id="debtArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.38} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {progressExpanded ? <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 6" vertical={false} /> : null}
            {progressExpanded ? (
              <XAxis axisLine={false} dataKey="shortLabel" interval="preserveStartEnd" minTickGap={18} tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10 }} tickLine={false} />
            ) : <XAxis dataKey="shortLabel" hide />}
            {progressExpanded ? (
              <YAxis axisLine={false} tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10 }} tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))} tickLine={false} width={58} />
            ) : <YAxis hide />}
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [formatCurrency(Number(value)), 'Restschuld']}
              labelFormatter={(_, payload) => payload[0]?.payload.label ?? ''}
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

        {progressExpanded ? (
          <div className="debt-milestones" id="debt-progress-details">
            {data.debtBalanceMilestones.map((milestone) => (
              <div key={milestone.date}><span>{milestone.label}</span><strong>{formatCurrency(milestone.balance)}</strong></div>
            ))}
          </div>
        ) : null}
        <p className="sr-only">
          {data.debtBalanceMilestones.map((milestone) => `${milestone.label}: ${formatCurrency(milestone.balance)}. `)}
        </p>
      </ExpandableSurface>

      <section className="relief-flow" aria-labelledby="relief-title">
        <SectionHeading compact subtitle={`Stufenweise bis ${reliefTargetLabel}`} title="Mehr frei durch auslaufende Raten" />
        <div className="relief-chart" role="img" aria-labelledby="relief-title">
          <LineChart
            accessibilityLayer
            data={data.debtReliefMilestones}
            margin={{ top: 14, right: 8, bottom: 2, left: -18 }}
            responsive
            style={{ width: '100%', maxWidth: '100%', height: '100%' }}
          >
            <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 6" vertical={false} />
            <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10 }} tickFormatter={(label: string) => label.replace('Ab ', '').replace(/ (\d{2})(\d{2})$/, ' $2')} tickLine={false} />
            <YAxis axisLine={false} domain={[100, 400]} tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10 }} tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))} tickLine={false} width={58} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), 'Frei pro Monat']} />
            <Line
              animationDuration={reduceMotion ? 0 : 360}
              dataKey="freeAmount"
              dot={{ r: 3, fill: 'var(--color-positive-container)', strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
              name="Frei pro Monat"
              stroke="var(--chart-free)"
              strokeWidth={3}
              type="stepAfter"
            />
          </LineChart>
        </div>
        <p className="sr-only" id="relief-title">Stufendiagramm des monatlich frei verfügbaren Gelds von aktuell bis {reliefTargetLabel}.</p>

        <div className="milestone-flow entrance-group" aria-label="Auslaufende Raten">
          {data.debtReliefMilestones.filter((milestone) => milestone.event).map((milestone, index) => (
            <article className="milestone-row" key={milestone.date}>
              <span className="milestone-row__marker"><Icon name="milestone" size={18} /><small>0{index + 1}</small></span>
              <div>
                <span>{milestone.eventDetail}</span>
                <strong>{milestone.event}</strong>
              </div>
              <p><strong>{formatCurrency(milestone.freeAmount)}</strong><span>frei · {milestone.label}</span></p>
            </article>
          ))}
        </div>
      </section>

      <aside className="projection-note">
        <Icon name="calendar" size={22} />
        <p><strong>Planungsannahme</strong><span>Einkommen und alle anderen Ausgaben bleiben unverändert.</span></p>
      </aside>
    </ScreenEntrance>
  );
}
