import { useReducedMotion } from 'motion/react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { AllocationLegend } from '../components/AllocationLegend';
import { AppButton } from '../components/AppButton';
import { ChartFrame } from '../components/ChartFrame';
import { FinanceChartTooltip } from '../components/FinanceChartTooltip';
import { FinancialHero } from '../components/FinancialHero';
import { InlineNotice } from '../components/InlineNotice';
import { LayeredAllocationRing } from '../components/LayeredAllocationRing';
import { MetricCard } from '../components/MetricCard';
import { MetricGrid } from '../components/MetricGrid';
import { MoneyValue } from '../components/MoneyValue';
import { MorphingSegmentedControl } from '../components/MorphingSegmentedControl';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { ScreenHeader } from '../components/ScreenHeader';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import type { AllocationRingSegment } from '../design/layeredAllocationRing';
import { useChartAnimation } from '../design/useChartAnimation';
import { compactCurrencyFormatter, formatCurrencyValue, maskMoneyShape, percentFormatter } from '../lib/format';
import { usePrivacy } from '../privacy/PrivacyProvider';

type ChartView = 'categories' | 'necessity';
type ChartItem = {
  id: string;
  label: string;
  amount: number;
  colorToken?: string;
  kind?: 'expense' | 'reserve';
};

const modeOptions = [
  { id: 'categories', label: 'Kategorien' },
  { id: 'necessity', label: 'Notwendigkeit' },
] as const;

export function BudgetScreen() {
  const data = useFinanceViewModel();
  const { privacyMode } = usePrivacy();
  const [chartView, setChartView] = useState<ChartView>('categories');
  const reduceMotion = useReducedMotion();
  const chartAnimationActive = useChartAnimation(reduceMotion, chartView, 280);
  const categoryData = [...data.budgetCategories].sort((a, b) => b.amount - a.amount);
  const freeMoney = data.totals.freeMoney;
  const budgetEmpty = data.budgetStatus.kind === 'empty';
  const overdrawnBudgetStatus = data.budgetStatus.kind === 'overdrawn' ? data.budgetStatus : null;
  const budgetOverdrawn = overdrawnBudgetStatus !== null;
  const stackedSegments = [
    ...data.necessityGroups,
    {
      id: 'free',
      label: budgetOverdrawn ? 'Fehlbetrag' : 'Frei',
      amount: freeMoney,
      amountCents: data.allocations.budget.freeCents,
      colorToken: budgetOverdrawn ? '--chart-deficit' : '--chart-free',
    },
  ];
  const ringSegments: AllocationRingSegment[] = stackedSegments.map((segment) => ({
    amountCents: segment.amountCents,
    color: `var(${segment.colorToken})`,
    id: segment.id,
    label: segment.label,
  }));
  const chartData: ChartItem[] = chartView === 'categories'
    ? categoryData.map(({ id, label, amount, kind }) => ({ id, label, amount, kind }))
    : data.necessityGroups.map(({ id, label, amount, colorToken }) => ({ id, label, amount, colorToken }));
  const chartTitle = chartView === 'categories' ? 'Ausgaben nach Kategorie' : 'Budget nach Notwendigkeit';
  const chartHeight = chartView === 'categories' ? Math.max(320, categoryData.length * 48 + 24) : 320;
  const hasChartValues = chartData.some(({ amount }) => amount > 0);
  const utilizationLabel = data.budgetStatus.utilizationBasisPoints === null
    ? '–'
    : `${percentFormatter.format(data.budgetStatus.utilizationBasisPoints / 100)} %`;
  const headerSupporting = budgetEmpty
    ? `${data.meta.monthLabel} · noch keine Positionen`
    : budgetOverdrawn
      ? `${data.meta.monthLabel} · über dem Einkommen geplant`
      : `${data.meta.monthLabel} · vollständig aufgeteilt`;

  const focusChartSelection = () => {
    document.getElementById(`budget-chart-tab-${chartView}`)?.focus({ preventScroll: true });
    document.getElementById('budget-breakdown')?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <ScreenEntrance className="budget-screen" destination="budget" labelledBy="budget-title">
      <ScreenHeader id="budget-title" supporting={headerSupporting} title="Dein Budget" />

      <FinancialHero
        action={budgetEmpty ? undefined : <AppButton onClick={focusChartSelection} size="small" variant="tonal">Diagrammansicht wählen</AppButton>}
        className="financial-hero--allocation"
        footer={(
          <AllocationLegend items={stackedSegments.map((segment) => ({
            color: `var(${segment.colorToken})`,
            id: segment.id,
            label: segment.label,
            value: <MoneyValue value={segment.amount} />,
          }))} />
        )}
        id="budget-hero"
        label="Einkommen"
        supporting={budgetEmpty
          ? 'Im Monat · noch keine Budgetpositionen'
          : budgetOverdrawn
            ? `Im Monat · ${utilizationLabel} verplant`
            : 'Im Monat · vollständig verplant'}
        tone={budgetOverdrawn ? 'attention' : 'accent'}
        value={<MoneyValue value={data.meta.monthlyIncome} />}
        visual={(
          <LayeredAllocationRing
            centerLabel={budgetOverdrawn || budgetEmpty ? 'verplant' : 'Budget'}
            centerSupporting="verteilt"
            centerValue={budgetOverdrawn ? utilizationLabel : budgetEmpty ? '0 %' : '100 %'}
            detailed
            segments={ringSegments}
            totalCents={data.allocations.budget.incomeCents}
          />
        )}
      />

      <MetricGrid label="Budgetkennzahlen">
        <MetricCard label="Rücklagen" supporting="Für spätere Ausgaben eingeplant" tone="neutral" value={<MoneyValue value={data.totals.plannedReserves} />} />
        <MetricCard
          label={budgetOverdrawn ? 'Budgetsaldo' : 'Frei'}
          supporting={budgetOverdrawn ? 'Geplante Beträge über Einkommen' : 'Ohne feste Zuordnung'}
          tone={budgetOverdrawn ? 'attention' : 'positive'}
          value={<MoneyValue value={freeMoney} />}
        />
      </MetricGrid>

      {budgetOverdrawn ? (
        <InlineNotice title="Budget liegt über dem Einkommen" tone="danger">
          <p>Geplante Ausgaben und Rücklagen übersteigen das Monatseinkommen um <MoneyValue value={overdrawnBudgetStatus.deficit} />.</p>
        </InlineNotice>
      ) : null}

      <ChartFrame
        action={<span className="position-count" role="status">{chartData.length} Positionen</span>}
        className="budget-chart-frame"
        id="budget-breakdown"
        subtitle="Monatlich geplant · absteigend"
        title={chartTitle}
      >
        <MorphingSegmentedControl
          controlsId="budget-chart"
          label="Budgetdiagramm auswählen"
          onSelectionChange={setChartView}
          options={modeOptions}
          selectedId={chartView}
        />

        {modeOptions.map((option) => (
          <div
            aria-labelledby={`budget-chart-tab-${option.id}`}
            className="budget-chart-panel"
            hidden={chartView !== option.id}
            id={`budget-chart-${option.id}`}
            key={option.id}
            role="tabpanel"
            tabIndex={0}
          >
            {chartView === option.id ? (hasChartValues ? (
              <div
                aria-describedby={`budget-chart-summary-${option.id}`}
                aria-label={chartTitle}
                className="budget-chart"
                data-animation-active={chartAnimationActive}
                data-chart-mode={chartView}
                role="img"
                style={{ height: chartHeight }}
              >
                <BarChart
                  accessibilityLayer
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 12, right: 94, bottom: 8, left: 0 }}
                  responsive
                  style={{ width: '100%', maxWidth: '100%', height: '100%' }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="3 6" />
                  <XAxis domain={[0, 'dataMax']} hide type="number" />
                  <YAxis
                    axisLine={false}
                    dataKey="label"
                    interval={0}
                    tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 560 }}
                    tickLine={false}
                    type="category"
                    width={104}
                  />
                  <Tooltip
                    content={(props) => <FinanceChartTooltip {...props} valueLabel="Monatlich" />}
                    cursor={{ fill: 'var(--chart-cursor)' }}
                    isAnimationActive={chartAnimationActive}
                  />
                  <Bar
                    animationDuration={reduceMotion ? 0 : 280}
                    dataKey="amount"
                    isAnimationActive={!reduceMotion}
                    maxBarSize={22}
                    name="Monatlich"
                    radius={[0, 11, 11, 0]}
                  >
                    {chartData.map((item) => (
                      <Cell
                        fill={item.kind === 'reserve'
                          ? 'var(--color-tertiary)'
                          : chartView === 'necessity' && item.colorToken
                            ? `var(${item.colorToken})`
                            : 'var(--color-primary)'}
                        key={item.id}
                      />
                    ))}
                    <LabelList
                      dataKey="amount"
                      fill="var(--color-on-surface)"
                      fontSize={12}
                      fontWeight={650}
                      formatter={(value) => privacyMode
                        ? maskMoneyShape(compactCurrencyFormatter.format(Number(value)))
                        : compactCurrencyFormatter.format(Number(value))}
                      position="right"
                    />
                  </Bar>
                </BarChart>
              </div>
            ) : (
              <InlineNotice title={budgetEmpty ? 'Noch keine Budgetpositionen' : 'Noch keine Werte'} tone="info">
                <p>{budgetEmpty
                  ? 'Im aktuellen Datenstand sind keine aktiven Budgetpositionen hinterlegt.'
                  : 'Für diese Ansicht sind im aktuellen Datenstand keine positiven Beträge vorhanden.'}</p>
              </InlineNotice>
            )) : null}

            <div className="sr-only" id={`budget-chart-summary-${option.id}`} role="list">
              {chartData.map((item) => <span key={item.id} role="listitem">{item.label}: {formatCurrencyValue(item.amount, privacyMode)}. </span>)}
            </div>
          </div>
        ))}
      </ChartFrame>
    </ScreenEntrance>
  );
}
