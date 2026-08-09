import { useState } from 'react';
import { AllocationLegend } from '../components/AllocationLegend';
import { AppButton } from '../components/AppButton';
import { DataList, DataListItem } from '../components/DataList';
import { FinancialHero } from '../components/FinancialHero';
import { Icon } from '../components/Icon';
import { InlineNotice } from '../components/InlineNotice';
import { LayeredAllocationRing } from '../components/LayeredAllocationRing';
import { MetricCard } from '../components/MetricCard';
import { MetricGrid } from '../components/MetricGrid';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { ScreenHeader } from '../components/ScreenHeader';
import { SurfaceSection } from '../components/SurfaceSection';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import type { AllocationRingSegment } from '../design/layeredAllocationRing';
import { formatCurrency, percentFormatter } from '../lib/format';

export function OverviewScreen() {
  const data = useFinanceViewModel();
  const [allocationDetailed, setAllocationDetailed] = useState(false);
  const [showEmptyPockets, setShowEmptyPockets] = useState(false);
  const freeMoney = data.totals.freeMoney;
  const freePercentage = data.totals.freePercentage;
  const allocation = data.allocations.overview;
  const segments: AllocationRingSegment[] = [
    { id: 'expenses', label: 'Ausgaben', amountCents: allocation.expensesCents, color: 'var(--color-system-accent)' },
    { id: 'reserves', label: 'Rücklagen', amountCents: allocation.reservesCents, color: 'var(--color-tertiary)' },
    { id: 'free', label: 'Frei', amountCents: allocation.freeCents, color: 'var(--chart-free)' },
  ];
  const visiblePockets = showEmptyPockets ? data.pockets : data.pockets.filter((pocket) => pocket.balance !== 0);
  const visiblePocketCount = data.pockets.filter((pocket) => pocket.balance !== 0).length;

  return (
    <ScreenEntrance className="overview-screen" destination="overview" labelledBy="overview-title">
      <ScreenHeader id="overview-title" supporting={`Dein ${data.meta.monthLabel} auf einen Blick.`} title="Guten Morgen" />

      <FinancialHero
        action={(
          <AppButton
            aria-pressed={allocationDetailed}
            onClick={() => setAllocationDetailed((detailed) => !detailed)}
            size="small"
            variant="tonal"
          >
            {allocationDetailed ? 'Kompakte Aufteilung' : 'Aufteilung umschalten'}
          </AppButton>
        )}
        footer={(
          <AllocationLegend items={segments.map((segment) => ({
            color: segment.color,
            id: segment.id,
            label: segment.label,
            value: formatCurrency(segment.amountCents / 100),
          }))} />
        )}
        id="overview-hero"
        label="Frei verfügbar"
        supporting={`von ${formatCurrency(data.meta.monthlyIncome)} Einkommen im Monat`}
        tone="positive"
        value={<>{formatCurrency(freeMoney)} <span className="financial-hero__value-unit">frei</span></>}
        visual={(
          <LayeredAllocationRing
            centerLabel="Frei"
            centerSupporting="vom Einkommen"
            centerValue={`${percentFormatter.format(freePercentage)} %`}
            detailed={allocationDetailed}
            interactiveLabel={allocationDetailed ? 'Kompakte Aufteilung anzeigen' : 'Ausgaben, Rücklagen und freien Betrag anzeigen'}
            onDetailedChange={setAllocationDetailed}
            segments={segments}
            totalCents={allocation.incomeCents}
          />
        )}
      />

      <MetricGrid label="Schnellübersicht">
        <MetricCard label="Jetzt verfügbar" value={formatCurrency(data.totals.currentCash)} tone="accent" />
        <MetricCard label="Rücklagen geplant" supporting="Bewusst für später reserviert" value={formatCurrency(data.totals.plannedReserves)} />
      </MetricGrid>

      <InlineNotice className="next-relief-notice" icon={<Icon name="trend" size={22} />} title="Nächster Spielraum" tone="positive">
        {data.nextDebtRelief ? (
          <>
            <p>{data.nextDebtRelief.eventLabel} {data.nextDebtRelief.eventCount === 1 ? 'endet' : 'enden'} im {data.nextDebtRelief.monthLabel}.</p>
            <strong className="inline-notice__financial">Danach voraussichtlich {formatCurrency(data.nextDebtRelief.freeAfter)} frei</strong>
            <p>{formatCurrency(data.nextDebtRelief.monthlyRelief)} mehr pro Monat.</p>
          </>
        ) : (
          <>
            <p>Keine weitere Entlastung geplant.</p>
            <strong className="inline-notice__financial">Aktuell {formatCurrency(freeMoney)} frei</strong>
          </>
        )}
      </InlineNotice>

      <SurfaceSection id="accounts" supporting="Zusammen verfügbar" title="Konten">
        <DataList
          footer={<><span>Gesamt</span><strong className="financial-value">{formatCurrency(data.totals.currentCash)}</strong></>}
          label="Konten"
        >
          {data.accounts.map((account) => (
            <DataListItem
              icon={<Icon name={account.kind === 'bank' ? 'account' : 'wallet'} size={20} />}
              key={account.id}
              supporting={account.kind === 'bank' ? 'Bankkonto' : account.kind === 'cash' ? 'Bargeld' : 'Zahlungskonto'}
              title={account.name}
              value={formatCurrency(account.balance)}
            />
          ))}
        </DataList>
      </SurfaceSection>

      <SurfaceSection
        action={(
          <AppButton
            aria-controls="pocket-list"
            aria-expanded={showEmptyPockets}
            onClick={() => setShowEmptyPockets((visible) => !visible)}
            size="small"
            trailingIcon={<Icon className={showEmptyPockets ? 'is-rotated' : undefined} name="chevron" size={18} />}
            variant="tonal"
          >
            {showEmptyPockets ? 'Leere ausblenden' : 'Alle zeigen'}
          </AppButton>
        )}
        className={`pocket-collection ${showEmptyPockets ? 'is-expanded' : ''}`}
        id="pockets"
        supporting={showEmptyPockets ? 'Alle aktiven Pockets' : `${visiblePocketCount} Pockets mit Guthaben`}
        title="Pockets"
        variant="tonal"
      >
        <div className="pocket-grid entrance-group" id="pocket-list">
          {visiblePockets.map((pocket) => (
            <article className={`pocket ${pocket.balance === 0 ? 'pocket--empty' : ''}`} key={pocket.id}>
              <span>{pocket.name}</span>
              <strong className="financial-value">{formatCurrency(pocket.balance)}</strong>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </ScreenEntrance>
  );
}
