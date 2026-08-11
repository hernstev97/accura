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
import { MoneyValue } from '../components/MoneyValue';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { ScreenHeader } from '../components/ScreenHeader';
import { SurfaceSection } from '../components/SurfaceSection';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import type { AllocationRingSegment } from '../design/layeredAllocationRing';
import { percentFormatter } from '../lib/format';
import { useTimeOfDayGreeting } from '../lib/timeOfDayGreeting';

const ACCOUNT_PREVIEW_LIMIT = 5;
const POCKET_PREVIEW_LIMIT = 6;

export function OverviewScreen() {
  const data = useFinanceViewModel();
  const greeting = useTimeOfDayGreeting();
  const [allocationDetailed, setAllocationDetailed] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [showAllPockets, setShowAllPockets] = useState(false);
  const freeMoney = data.totals.freeMoney;
  const freePercentage = data.totals.freePercentage;
  const overdrawnBudgetStatus = data.budgetStatus.kind === 'overdrawn' ? data.budgetStatus : null;
  const budgetOverdrawn = overdrawnBudgetStatus !== null;
  const allocation = data.allocations.overview;
  const segments: AllocationRingSegment[] = [
    { id: 'expenses', label: 'Ausgaben', amountCents: allocation.expensesCents, color: 'var(--color-system-accent)' },
    { id: 'reserves', label: 'Rücklagen', amountCents: allocation.reservesCents, color: 'var(--color-tertiary)' },
    {
      id: 'free',
      label: budgetOverdrawn ? 'Fehlbetrag' : 'Frei',
      amountCents: allocation.freeCents,
      color: budgetOverdrawn ? 'var(--chart-deficit)' : 'var(--chart-free)',
    },
  ];
  const fundedPockets = data.pockets.filter((pocket) => pocket.balance !== 0);
  const visibleAccounts = showAllAccounts ? data.accounts : data.accounts.slice(0, ACCOUNT_PREVIEW_LIMIT);
  const visiblePockets = showAllPockets ? data.pockets : fundedPockets.slice(0, POCKET_PREVIEW_LIMIT);
  const hasHiddenAccounts = data.accounts.length > ACCOUNT_PREVIEW_LIMIT;
  const hasHiddenPockets = data.pockets.length > visiblePockets.length || showAllPockets;
  const hasNegativeBalance = data.accounts.some(({ balance }) => balance < 0) || data.pockets.some(({ balance }) => balance < 0);
  const ringCenterValue = budgetOverdrawn
    ? overdrawnBudgetStatus.utilizationBasisPoints === null
      ? '–'
      : `${percentFormatter.format(overdrawnBudgetStatus.utilizationBasisPoints / 100)} %`
    : `${percentFormatter.format(freePercentage)} %`;
  const accountsSupporting = data.accounts.length === 0
    ? 'Keine aktiven Konten'
    : hasHiddenAccounts && !showAllAccounts
      ? `${visibleAccounts.length} von ${data.accounts.length} aktiven Konten · zusammen verfügbar`
      : `${data.accounts.length} aktive Konten · zusammen verfügbar`;
  const pocketsSupporting = data.pockets.length === 0
    ? 'Keine aktiven Pockets'
    : showAllPockets
      ? `Alle ${data.pockets.length} aktiven Pockets`
      : `${visiblePockets.length} von ${data.pockets.length} aktiven Pockets angezeigt`;

  return (
    <ScreenEntrance className="overview-screen" destination="overview" labelledBy="overview-title">
      <ScreenHeader id="overview-title" supporting={`Dein ${data.meta.monthLabel} auf einen Blick.`} title={greeting} />

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
        className="financial-hero--allocation"
        footer={(
          <AllocationLegend items={segments.map((segment) => ({
            color: segment.color,
            id: segment.id,
            label: segment.label,
            value: <MoneyValue value={segment.amountCents / 100} />,
          }))} />
        )}
        id="overview-hero"
        label={budgetOverdrawn ? 'Budgetsaldo' : 'Frei verfügbar'}
        supporting={budgetOverdrawn
          ? 'Geplante Beträge übersteigen das Monatseinkommen'
          : <>von <MoneyValue value={data.meta.monthlyIncome} /> Einkommen im Monat</>}
        tone={budgetOverdrawn ? 'attention' : 'positive'}
        value={<MoneyValue value={freeMoney} />}
        visual={(
          <LayeredAllocationRing
            centerLabel={budgetOverdrawn ? 'verplant' : 'Frei'}
            centerSupporting="vom Einkommen"
            centerValue={ringCenterValue}
            detailed={allocationDetailed}
            interactiveLabel={allocationDetailed ? 'Kompakte Aufteilung anzeigen' : 'Ausgaben, Rücklagen und freien Betrag anzeigen'}
            onDetailedChange={setAllocationDetailed}
            segments={segments}
            totalCents={allocation.incomeCents}
          />
        )}
      />

      <MetricGrid label="Schnellübersicht">
        <MetricCard label="Jetzt verfügbar" tone={data.totals.currentCash < 0 ? 'attention' : 'accent'} value={<MoneyValue value={data.totals.currentCash} />} />
        <MetricCard label="Rücklagen geplant" supporting="Bewusst für später reserviert" value={<MoneyValue value={data.totals.plannedReserves} />} />
      </MetricGrid>

      {budgetOverdrawn ? (
        <InlineNotice icon={<Icon name="info" size={22} />} title="Budget liegt über dem Einkommen" tone="danger">
          <p>Geplante Ausgaben und Rücklagen übersteigen das Monatseinkommen um <MoneyValue value={overdrawnBudgetStatus.deficit} />.</p>
        </InlineNotice>
      ) : null}

      {hasNegativeBalance ? (
        <InlineNotice icon={<Icon name="info" size={22} />} title="Negative Kontostände berücksichtigt" tone="warning">
          <p>Konten oder Pockets mit negativem Stand werden mit Minuszeichen angezeigt und fließen unverändert in die Summen ein.</p>
        </InlineNotice>
      ) : null}

      <InlineNotice className="next-relief-notice" icon={<Icon name="trend" size={22} />} title="Nächster Spielraum" tone="positive">
        {data.nextDebtRelief ? (
          <>
            <p>{data.nextDebtRelief.eventLabel} {data.nextDebtRelief.eventCount === 1 ? 'endet' : 'enden'} im {data.nextDebtRelief.monthLabel}.</p>
            <strong className="inline-notice__financial">
              Danach voraussichtlich <MoneyValue value={data.nextDebtRelief.freeAfter} /> {data.nextDebtRelief.freeAfter < 0 ? 'Budgetsaldo' : 'frei'}
            </strong>
            <p><MoneyValue value={data.nextDebtRelief.monthlyRelief} /> mehr pro Monat.</p>
          </>
        ) : (
          <>
            <p>Keine weitere Entlastung geplant.</p>
            <strong className="inline-notice__financial">Aktuell <MoneyValue value={freeMoney} /> {freeMoney < 0 ? 'Budgetsaldo' : 'frei'}</strong>
          </>
        )}
      </InlineNotice>

      <SurfaceSection
        action={hasHiddenAccounts ? (
          <AppButton
            aria-controls="account-list"
            aria-expanded={showAllAccounts}
            onClick={() => setShowAllAccounts((visible) => !visible)}
            size="small"
            trailingIcon={<Icon className={showAllAccounts ? 'is-rotated' : undefined} name="chevron" size={18} />}
            variant="tonal"
          >
            {showAllAccounts ? 'Weniger zeigen' : `Alle ${data.accounts.length} zeigen`}
          </AppButton>
        ) : undefined}
        id="accounts"
        supporting={accountsSupporting}
        title="Konten"
      >
        <div id="account-list">
          {data.accounts.length > 0 ? (
            <DataList
              footer={<><span>Gesamt</span><strong className="financial-value"><MoneyValue value={data.totals.currentCash} /></strong></>}
              label="Konten"
            >
              {visibleAccounts.map((account) => (
                <DataListItem
                  icon={<Icon name={account.kind === 'bank' ? 'account' : 'wallet'} size={20} />}
                  key={account.id}
                  supporting={account.kind === 'bank' ? 'Bankkonto' : account.kind === 'cash' ? 'Bargeld' : 'Zahlungskonto'}
                  title={account.name}
                  value={<MoneyValue value={account.balance} />}
                />
              ))}
            </DataList>
          ) : (
            <InlineNotice title="Noch keine Konten" tone="info">
              <p>Im aktuellen Datenstand sind keine aktiven Konten hinterlegt.</p>
            </InlineNotice>
          )}
        </div>
      </SurfaceSection>

      <SurfaceSection
        action={hasHiddenPockets ? (
          <AppButton
            aria-controls="pocket-list"
            aria-expanded={showAllPockets}
            onClick={() => setShowAllPockets((visible) => !visible)}
            size="small"
            trailingIcon={<Icon className={showAllPockets ? 'is-rotated' : undefined} name="chevron" size={18} />}
            variant="tonal"
          >
            {showAllPockets ? 'Weniger zeigen' : `Alle ${data.pockets.length} zeigen`}
          </AppButton>
        ) : undefined}
        className={`pocket-collection ${showAllPockets ? 'is-expanded' : ''}`}
        id="pockets"
        supporting={pocketsSupporting}
        title="Pockets"
        variant="tonal"
      >
        <div className="pocket-grid entrance-group" id="pocket-list">
          {data.pockets.length === 0 ? (
            <InlineNotice title="Noch keine Pockets" tone="info">
              <p>Im aktuellen Datenstand sind keine aktiven Pockets hinterlegt.</p>
            </InlineNotice>
          ) : visiblePockets.length === 0 ? (
            <InlineNotice title="Alle Pockets sind leer" tone="info">
              <p>Sie werden auf Wunsch trotzdem vollständig angezeigt.</p>
            </InlineNotice>
          ) : visiblePockets.map((pocket) => (
              <article className={`pocket ${pocket.balance === 0 ? 'pocket--empty' : ''}`} key={pocket.id}>
                <span>{pocket.name}</span>
                <strong className="financial-value"><MoneyValue value={pocket.balance} /></strong>
              </article>
            ))}
        </div>
      </SurfaceSection>
    </ScreenEntrance>
  );
}
