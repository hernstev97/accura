import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartFrame } from '../components/ChartFrame';
import { Icon } from '../components/Icon';
import { MorphingSegmentedControl } from '../components/MorphingSegmentedControl';
import { SectionHeading } from '../components/SectionHeading';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import { emphasizedTransition, spatialSpring } from '../design/motion';
import { formatCurrency } from '../lib/format';

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
];

export function BudgetScreen() {
  const data = useFinanceViewModel();
  const [chartView, setChartView] = useState<ChartView>('categories');
  const reduceMotion = useReducedMotion();
  const categoryData = [...data.budgetCategories].sort((a, b) => b.amount - a.amount);
  const freeMoney = data.totals.freeMoney;
  const plannedReserveAmount = data.totals.plannedReserves;
  const stackedSegments = [
    ...data.necessityGroups,
    { id: 'free', label: 'Frei', amount: freeMoney, colorToken: '--chart-free' },
  ];
  const chartData: ChartItem[] = chartView === 'categories'
    ? categoryData.map(({ id, label, amount, kind }) => ({ id, label, amount, kind }))
    : data.necessityGroups.map(({ id, label, amount, colorToken }) => ({ id, label, amount, colorToken }));
  const chartTitle = chartView === 'categories' ? 'Ausgaben nach Kategorie' : 'Budget nach Notwendigkeit';
  const chartHeight = chartView === 'categories' ? Math.max(300, categoryData.length * 45 + 20) : 310;

  return (
    <div className="screen budget-screen" aria-labelledby="budget-title">
      <header className="screen-heading">
        <h1 id="budget-title">Dein Budget</h1>
        <p>{data.meta.monthLabel} · vollständig aufgeteilt</p>
      </header>

      <section className="allocation-group" aria-label="Aufteilung des Monatseinkommens">
        <SectionHeading compact subtitle="im Monat" title="Einkommen" />
        <p className="allocation-group__income">{formatCurrency(data.meta.monthlyIncome)}</p>
        <div className="stacked-bar" role="img" aria-label="Monatseinkommen nach Notwendigkeit und freiem Betrag aufgeteilt">
          {stackedSegments.map((segment) => (
            <motion.span
              key={segment.id}
              layout
              style={{ background: `var(${segment.colorToken})`, width: `${(segment.amount / data.meta.monthlyIncome) * 100}%` }}
              title={`${segment.label}: ${formatCurrency(segment.amount)}`}
              transition={spatialSpring}
            />
          ))}
        </div>
        <div className="allocation-legend">
          {stackedSegments.map((segment) => (
            <div className="legend-item" key={segment.id}>
              <span className="legend-item__dot" style={{ background: `var(${segment.colorToken})` }} aria-hidden="true" />
              <span>{segment.label}</span>
              <strong>{formatCurrency(segment.amount)}</strong>
            </div>
          ))}
        </div>
        <div className="reserve-row">
          <span className="row-icon"><Icon name="reserve" size={20} /></span>
          <p><strong>{formatCurrency(plannedReserveAmount)} Rücklagen</strong><span>Bewusst für spätere Ausgaben eingeplant.</span></p>
        </div>
      </section>

      <ChartFrame
        action={<span className="position-count">{chartData.length} Positionen</span>}
        className="budget-chart-frame"
        subtitle="Monatlich geplant · absteigend"
        title={chartTitle}
      >
        <MorphingSegmentedControl
          label="Budgetdiagramm auswählen"
          onSelectionChange={(id) => setChartView(id as ChartView)}
          options={modeOptions}
          selectedId={chartView}
        />

        <motion.div
          animate={{ height: chartHeight }}
          className="budget-chart"
          data-chart-mode={chartView}
          initial={false}
          transition={reduceMotion ? { duration: 0 } : spatialSpring}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ top: 12, right: 86, bottom: 8, left: 0 }}
            responsive
            style={{ width: '100%', maxWidth: '100%', height: '100%' }}
          >
            <CartesianGrid horizontal={false} stroke="var(--color-outline-variant)" strokeDasharray="3 6" />
            <XAxis domain={[0, 'dataMax']} hide type="number" />
            <YAxis
              axisLine={false}
              dataKey="label"
              interval={0}
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 560 }}
              tickLine={false}
              type="category"
              width={96}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface-bright)',
                border: 0,
                borderRadius: 18,
                boxShadow: '0 8px 28px rgb(0 0 0 / 0.16)',
                color: 'var(--color-on-surface)',
              }}
              cursor={{ fill: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}
              formatter={(value) => [formatCurrency(Number(value)), 'Monatlich']}
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
                  fill={
                    item.kind === 'reserve'
                      ? 'var(--color-tertiary)'
                      : chartView === 'necessity' && item.colorToken
                        ? `var(${item.colorToken})`
                        : 'var(--color-primary)'
                  }
                  key={item.id}
                />
              ))}
              <LabelList
                dataKey="amount"
                fill="var(--color-on-surface)"
                fontSize={11}
                fontWeight={650}
                formatter={(value) => formatCurrency(Number(value))}
                position="right"
              />
            </Bar>
          </BarChart>
        </motion.div>

        <motion.div
          animate={{ opacity: 1 }}
          className="sr-only"
          key={chartView}
          role="list"
          transition={reduceMotion ? { duration: 0.1 } : emphasizedTransition}
        >
          {chartData.map((item) => <span key={item.id} role="listitem">{item.label}: {formatCurrency(item.amount)}. </span>)}
        </motion.div>
      </ChartFrame>
    </div>
  );
}
