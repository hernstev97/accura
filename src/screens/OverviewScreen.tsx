import { useState } from 'react';
import { AppButton } from '../components/AppButton';
import { DataList, DataListItem } from '../components/DataList';
import { Icon } from '../components/Icon';
import { InlineNotice } from '../components/InlineNotice';
import { MetricCard } from '../components/MetricCard';
import { MetricGrid } from '../components/MetricGrid';
import { MoneyValue } from '../components/MoneyValue';
import { OverviewAllocationHero } from '../components/OverviewAllocationHero';
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
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [showAllPockets, setShowAllPockets] = useState(false);
  const freeMoneyCents = data.totals.freeMoneyCents;
  const freePercentage = data.totals.freePercentage;
  const budgetEmpty = data.budgetStatus.kind === 'empty';
  const budgetHasDeficit = data.budgetStatus.balanceCents < 0;
  const budgetDeficitCents = budgetHasDeficit ? -data.budgetStatus.balanceCents : 0;
  const allocation = data.allocations.overview;
  const segments: AllocationRingSegment[] = [
    { id: 'expenses', label: 'Ausgaben', amountCents: allocation.expensesCents, color: 'var(--color-system-accent)' },
    { id: 'reserves', label: 'Rücklagen', amountCents: allocation.reservesCents, color: 'var(--color-tertiary)' },
    {
      id: 'free',
      label: budgetHasDeficit ? 'Fehlbetrag' : 'Frei',
      amountCents: allocation.freeCents,
      color: budgetHasDeficit ? 'var(--chart-deficit)' : 'var(--chart-free)',
    },
  ];
  const fundedPockets = data.pockets.filter((pocket) => pocket.balanceCents !== 0);
  const visibleAccounts = showAllAccounts ? data.accounts : data.accounts.slice(0, ACCOUNT_PREVIEW_LIMIT);
  const visiblePockets = showAllPockets ? data.pockets : fundedPockets.slice(0, POCKET_PREVIEW_LIMIT);
  const hasHiddenAccounts = data.accounts.length > ACCOUNT_PREVIEW_LIMIT;
  const hasHiddenPockets = data.pockets.length > visiblePockets.length || showAllPockets;
  const hasNegativeBalance = data.accounts.some(({ balanceCents }) => balanceCents < 0) || data.pockets.some(({ balanceCents }) => balanceCents < 0);
  const ringCenterValue = budgetHasDeficit
    ? data.budgetStatus.utilizationBasisPoints === null
      ? '–'
      : `${percentFormatter.format(data.budgetStatus.utilizationBasisPoints / 100)} %`
    : freePercentage === null ? '–' : `${percentFormatter.format(freePercentage)} %`;
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

      <OverviewAllocationHero
        centerLabel={budgetHasDeficit ? budgetEmpty ? 'Saldo' : 'verplant' : 'Frei'}
        centerValue={ringCenterValue}
        id="overview-hero"
        incomeCents={allocation.incomeCents}
        segments={segments}
      />

      <MetricGrid label="Schnellübersicht">
        <MetricCard label="Jetzt verfügbar" tone={data.totals.currentCashCents < 0 ? 'attention' : 'accent'} value={<MoneyValue valueCents={data.totals.currentCashCents} />} />
        <MetricCard label="Rücklagen geplant" supporting="Bewusst für später reserviert" value={<MoneyValue valueCents={data.totals.plannedReservesCents} />} />
      </MetricGrid>

      {budgetHasDeficit ? (
        <InlineNotice icon={<Icon name="info" size={22} />} title={budgetEmpty ? 'Monatseinkommen ist negativ' : 'Budget liegt über dem Einkommen'} tone="danger">
          <p>{budgetEmpty
            ? <>Das Monatseinkommen liegt um <MoneyValue valueCents={budgetDeficitCents} /> unter null. Es sind noch keine Budgetpositionen hinterlegt.</>
            : <>Geplante Ausgaben und Rücklagen übersteigen das Monatseinkommen um <MoneyValue valueCents={budgetDeficitCents} />.</>}</p>
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
              Danach voraussichtlich <MoneyValue valueCents={data.nextDebtRelief.freeAfterCents} /> {data.nextDebtRelief.freeAfterCents < 0 ? 'Budgetsaldo' : 'frei'}
            </strong>
            <p><MoneyValue valueCents={data.nextDebtRelief.monthlyReliefCents} /> mehr pro Monat.</p>
          </>
        ) : (
          <>
            <p>Keine weitere Entlastung geplant.</p>
            <strong className="inline-notice__financial">Aktuell <MoneyValue valueCents={freeMoneyCents} /> {freeMoneyCents < 0 ? 'Budgetsaldo' : 'frei'}</strong>
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
              footer={<><span>Gesamt</span><strong className="financial-value"><MoneyValue valueCents={data.totals.currentCashCents} /></strong></>}
              label="Konten"
            >
              {visibleAccounts.map((account) => (
                <DataListItem
                  icon={<Icon name={account.kind === 'bank' ? 'account' : 'wallet'} size={20} />}
                  key={account.id}
                  supporting={account.kind === 'bank' ? 'Bankkonto' : account.kind === 'cash' ? 'Bargeld' : 'Zahlungskonto'}
                  title={account.name}
                  value={<MoneyValue valueCents={account.balanceCents} />}
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
              <article className={`pocket ${pocket.balanceCents === 0 ? 'pocket--empty' : ''}`} key={pocket.id}>
                <span>{pocket.name}</span>
                <strong className="financial-value"><MoneyValue valueCents={pocket.balanceCents} /></strong>
              </article>
            ))}
        </div>
      </SurfaceSection>
    </ScreenEntrance>
  );
}
