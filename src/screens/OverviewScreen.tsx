import { useState } from 'react';
import { CircularAllocation } from '../components/CircularAllocation';
import { ExpandableSurface } from '../components/ExpandableSurface';
import { Icon } from '../components/Icon';
import { MetricCard } from '../components/MetricCard';
import { PressableSurface } from '../components/PressableSurface';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { SectionHeading } from '../components/SectionHeading';
import { Squiggle } from '../components/Squiggle';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import type { CircularAllocationSegment } from '../design/circularAllocation';
import { formatCurrency, percentFormatter } from '../lib/format';

export function OverviewScreen() {
  const data = useFinanceViewModel();
  const [allocationDetailed, setAllocationDetailed] = useState(false);
  const [showEmptyPockets, setShowEmptyPockets] = useState(false);
  const freeMoney = data.totals.freeMoney;
  const freePercentage = data.totals.freePercentage;
  const allocation = data.allocations.overview;
  const segments: CircularAllocationSegment[] = [
    { id: 'expenses', label: 'Ausgaben', amountCents: allocation.expensesCents, color: 'var(--color-system-accent)' },
    { id: 'reserves', label: 'Rücklagen', amountCents: allocation.reservesCents, color: 'var(--color-tertiary)' },
    { id: 'free', label: 'Frei', amountCents: allocation.freeCents, color: 'var(--chart-free)' },
  ];
  const visiblePockets = showEmptyPockets ? data.pockets : data.pockets.filter((pocket) => pocket.balance !== 0);
  const visiblePocketCount = data.pockets.filter((pocket) => pocket.balance !== 0).length;

  return (
    <ScreenEntrance className="overview-screen" destination="overview" labelledBy="overview-title">
      <header className="screen-heading">
        <h1 id="overview-title">Guten Morgen</h1>
        <p>Dein {data.meta.monthLabel} auf einen Blick.</p>
      </header>

      <section className="status-card" aria-label="Frei verfügbares Monatsbudget">
        <div className="status-card__topline">
          <span className="status-card__label">Einkommen im Überblick</span>
          <span className="status-card__action">{allocationDetailed ? 'Drei Bereiche' : 'Geplant & frei'}</span>
        </div>
        <div className="status-card__composition">
          <CircularAllocation
            centerLabel="Frei"
            centerSupporting={`${percentFormatter.format(freePercentage)} %`}
            centerValue={formatCurrency(freeMoney)}
            detailed={allocationDetailed}
            interactiveLabel={allocationDetailed ? 'Zusammenfassung anzeigen' : 'Ausgaben, Rücklagen und freien Betrag anzeigen'}
            onDetailedChange={setAllocationDetailed}
            segments={segments}
            totalCents={allocation.incomeCents}
          />
          <div className="status-card__summary-copy">
            <strong>{formatCurrency(freeMoney)} frei</strong>
            <span>von {formatCurrency(data.meta.monthlyIncome)} im Monat</span>
            <small>Ring antippen für {allocationDetailed ? 'die Zusammenfassung' : 'alle drei Bereiche'}.</small>
          </div>
        </div>
        <div className="allocation-metrics" aria-label="Werte der Einkommensaufteilung">
          {segments.map((segment) => (
            <div className="allocation-metric" data-allocation-id={segment.id} key={segment.id}>
              <span><i aria-hidden="true" style={{ background: segment.color }} />{segment.label}</span>
              <strong>{formatCurrency(segment.amountCents / 100)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-group quick-metrics" aria-label="Schnellübersicht">
        <MetricCard label="Jetzt verfügbar" value={formatCurrency(data.totals.currentCash)} tone="primary" />
        <MetricCard label="Datenstand" supporting="Google Sheets" value={data.meta.asOfLabel} />
      </section>

      <section className="content-section" aria-label="Konten">
        <SectionHeading compact subtitle="Zusammen verfügbar" title="Konten" />
        <div className="grouped-list account-list entrance-group">
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
        <div className="pocket-grid entrance-group" id="pocket-list">
          {visiblePockets.map((pocket) => (
            <article className={`pocket ${pocket.balance === 0 ? 'pocket--empty' : ''}`} key={pocket.id}>
              <span>{pocket.name}</span>
              <strong>{formatCurrency(pocket.balance)}</strong>
            </article>
          ))}
        </div>
      </ExpandableSurface>

      <aside className="forecast-callout" aria-labelledby="forecast-title">
        <Squiggle className="forecast-callout__squiggle" />
        <span className="forecast-callout__mark"><Icon name="trend" size={22} /></span>
        <div>
          <p>Dein nächster Spielraum</p>
          {data.nextDebtRelief ? (
            <>
              <span>{data.nextDebtRelief.eventLabel} {data.nextDebtRelief.eventCount === 1 ? 'endet' : 'enden'} im {data.nextDebtRelief.monthLabel}</span>
              <h2 id="forecast-title">Danach voraussichtlich {formatCurrency(data.nextDebtRelief.freeAfter)} frei</h2>
              <span>{formatCurrency(data.nextDebtRelief.monthlyRelief)} mehr pro Monat</span>
            </>
          ) : (
            <>
              <span>Keine weitere Entlastung geplant</span>
              <h2 id="forecast-title">Aktuell {formatCurrency(freeMoney)} frei</h2>
              <span>Im Datenstand gibt es keine zukünftigen Ratenenden.</span>
            </>
          )}
        </div>
      </aside>
    </ScreenEntrance>
  );
}
