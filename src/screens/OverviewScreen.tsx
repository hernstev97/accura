import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { ExpandableSurface } from '../components/ExpandableSurface';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { PressableSurface } from '../components/PressableSurface';
import { SectionHeading } from '../components/SectionHeading';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import { spatialSpring } from '../design/motion';
import { formatCurrency, percentFormatter } from '../lib/format';

export function OverviewScreen() {
  const data = useFinanceViewModel();
  const [metricExpanded, setMetricExpanded] = useState(false);
  const [showEmptyPockets, setShowEmptyPockets] = useState(false);
  const reduceMotion = useReducedMotion();
  const freeMoney = data.totals.freeMoney;
  const freePercentage = data.totals.freePercentage;
  const plannedAmount = data.totals.plannedAmount;
  const reserveAmount = data.totals.plannedReserves;
  const expenseAmount = plannedAmount - reserveAmount;
  const projectedFreeMoney = data.debtReliefMilestones.at(-1)?.freeAmount ?? freeMoney;
  const visiblePockets = showEmptyPockets ? data.pockets : data.pockets.filter((pocket) => pocket.balance !== 0);
  const visiblePocketCount = data.pockets.filter((pocket) => pocket.balance !== 0).length;
  const projectedDate = data.debtReliefMilestones.at(-1)?.label ?? 'Später';

  return (
    <div className="screen overview-screen" aria-labelledby="overview-title">
      <header className="screen-heading">
        <h1 id="overview-title">Guten Morgen</h1>
        <p>Dein {data.meta.monthLabel} auf einen Blick.</p>
      </header>

      <ExpandableSurface className="status-card" expanded={metricExpanded} label="Frei verfügbares Monatsbudget">
        <PressableSurface
          aria-expanded={metricExpanded}
          aria-controls="free-money-details"
          broad
          className="status-card__trigger"
          onClick={() => setMetricExpanded((expanded) => !expanded)}
        >
          <span className="status-card__topline">
            <span className="status-card__label">Frei verfügbar</span>
            <span className="status-card__action">
              <span>{metricExpanded ? 'Weniger' : 'Details'}</span>
              <span className={`disclosure-icon ${metricExpanded ? 'is-rotated' : ''}`}><Icon name="chevron" size={20} /></span>
            </span>
          </span>
          <span className="status-card__amount"><AnimatedNumber value={freeMoney} /> <small>frei</small></span>
          <span className="status-card__context">pro Monat · {percentFormatter.format(freePercentage)} % vom Einkommen</span>
          <span className="allocation-track allocation-track--status" aria-hidden="true">
            <span style={{ width: `${100 - freePercentage}%` }} />
            <span style={{ width: `${freePercentage}%` }} />
          </span>
        </PressableSurface>

        <AnimatePresence initial={false}>
          {metricExpanded ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="status-card__details"
              exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
              id="free-money-details"
              initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              transition={reduceMotion ? { duration: 0.1 } : spatialSpring}
            >
              <div className="status-card__detail-grid">
                <div><span>Einkommen</span><strong>{formatCurrency(data.meta.monthlyIncome)}</strong></div>
                <div><span>Verplant</span><strong>{formatCurrency(plannedAmount)}</strong></div>
                <div><span>Frei</span><strong>{formatCurrency(freeMoney)}</strong></div>
              </div>
              <div className="allocation-strip" role="img" aria-label="Einkommen aufgeteilt in Ausgaben, Rücklagen und freien Betrag">
                <span style={{ width: `${(expenseAmount / data.meta.monthlyIncome) * 100}%` }} />
                <span style={{ width: `${(reserveAmount / data.meta.monthlyIncome) * 100}%` }} />
                <span style={{ width: `${freePercentage}%` }} />
              </div>
              <div className="allocation-strip__legend">
                <span>Ausgaben</span><span>Rücklagen</span><span>Frei</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ExpandableSurface>

      <section className="section-group quick-metrics" aria-label="Schnellübersicht">
        <MetricCard label="Jetzt verfügbar" value={formatCurrency(data.totals.currentCash)} tone="primary" />
        <MetricCard label="Datenstand" supporting="Google Sheets" value={data.meta.asOfLabel} />
      </section>

      <section className="content-section" aria-label="Konten">
        <SectionHeading compact subtitle="Zusammen verfügbar" title="Konten" />
        <div className="grouped-list account-list">
          {data.accounts.map((account, index) => (
            <article className="grouped-row" key={account.id}>
              <span className="row-icon"><Icon name={account.kind === 'bank' ? 'account' : 'wallet'} size={20} /></span>
              <span className="grouped-row__body">
                <strong>{account.name}</strong>
                <small>{account.kind === 'bank' ? 'Bankkonto' : account.kind === 'cash' ? 'Bargeld' : 'Zahlungskonto'}</small>
              </span>
              <strong className="money-value">{formatCurrency(account.balance)}</strong>
              <span className="account-sequence" aria-label={`Konto ${index + 1} von ${data.accounts.length}`}>0{index + 1}</span>
            </article>
          ))}
          <div className="grouped-total"><span>Gesamt</span><strong>{formatCurrency(data.totals.currentCash)}</strong></div>
        </div>
      </section>

      <ExpandableSurface className="content-section pocket-collection" expanded={showEmptyPockets} label="Pockets">
        <SectionHeading
          action={
            <PressableSurface
              aria-controls="pocket-list"
              aria-expanded={showEmptyPockets}
              className="extended-action"
              onClick={() => setShowEmptyPockets((visible) => !visible)}
            >
              {showEmptyPockets ? 'Ausblenden' : 'Alle zeigen'}
              <span className={`disclosure-icon ${showEmptyPockets ? 'is-rotated' : ''}`}><Icon name="chevron" size={18} /></span>
            </PressableSurface>
          }
          compact
          subtitle={showEmptyPockets ? 'Alle aktiven Pockets' : `${visiblePocketCount} Pockets mit Guthaben`}
          title="Pockets"
        />
        <motion.div className="pocket-grid" id="pocket-list" layout transition={{ layout: spatialSpring }}>
          <AnimatePresence initial={false}>
            {visiblePockets.map((pocket, index) => (
              <motion.article
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`pocket ${pocket.balance === 0 ? 'pocket--empty' : ''}`}
                exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98, y: reduceMotion ? 0 : -8 }}
                initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98, y: reduceMotion ? 0 : -8 }}
                key={pocket.id}
                layout
                transition={{ ...spatialSpring, delay: reduceMotion ? 0 : Math.min(index, 3) * 0.024 }}
              >
                <span>{pocket.name}</span>
                <strong>{formatCurrency(pocket.balance)}</strong>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </ExpandableSurface>

      <aside className="forecast-callout" aria-labelledby="forecast-title">
        <span className="forecast-callout__mark"><Icon name="trend" size={22} /></span>
        <div>
          <p>Dein nächster Spielraum</p>
          <h2 id="forecast-title">{projectedDate} voraussichtlich {formatCurrency(projectedFreeMoney)} frei</h2>
          <span>{formatCurrency(data.totals.debtReliefGain)} mehr pro Monat durch auslaufende Raten.</span>
        </div>
      </aside>
    </div>
  );
}
