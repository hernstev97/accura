import { DataList, DataListItem } from '../components/DataList';
import { FinancialHero } from '../components/FinancialHero';
import { Icon } from '../components/Icon';
import { InlineNotice } from '../components/InlineNotice';
import { MetricCard } from '../components/MetricCard';
import { MetricGrid } from '../components/MetricGrid';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { ScreenHeader } from '../components/ScreenHeader';
import { SurfaceSection } from '../components/SurfaceSection';
import { useFinanceViewModel } from '../data/FinanceDataProvider';
import { formatCurrency } from '../lib/format';

function getDaysUntilSalaryLabel(dueDateISO: string, nextSalaryDateISO: string): string {
  const [y1, m1, d1] = dueDateISO.split('-').map(Number);
  const [y2, m2, d2] = nextSalaryDateISO.split('-').map(Number);
  const date1 = Date.UTC(y1, m1 - 1, d1);
  const date2 = Date.UTC(y2, m2 - 1, d2);
  const daysDiff = Math.round((date2 - date1) / (1000 * 60 * 60 * 24));
  if (daysDiff === 0) return 'Am Gehaltstag';
  if (daysDiff === 1) return '1 Tag vor Gehalt';
  return `${daysDiff} Tage vor Gehalt`;
}

export function UpcomingScreen() {
  const data = useFinanceViewModel();
  const upcoming = data.upcoming;
  const hasSalaryConfig = upcoming.salaryDay !== null;
  const safeToSpend = upcoming.safeToSpend;
  const isNegativeSafeToSpend = safeToSpend < 0;

  return (
    <ScreenEntrance className="upcoming-screen" destination="upcoming" labelledBy="upcoming-title">
      <ScreenHeader
        id="upcoming-title"
        supporting={upcoming.nextSalaryDateLabel ? `Nächstes Gehalt am ${upcoming.nextSalaryDateLabel}` : 'Fälligkeiten bis zum Gehaltseingang'}
        title="Demnächst"
      />

      <FinancialHero
        className="financial-hero--allocation"
        id="upcoming-hero"
        label="Bis Gehalt verfügbar"
        supporting={upcoming.nextSalaryDateLabel ? `Frei bis zum Gehaltseingang am ${upcoming.nextSalaryDateLabel}` : 'Kein Gehaltstag in der Tabelle hinterlegt'}
        tone={isNegativeSafeToSpend ? 'attention' : 'positive'}
        value={<>{formatCurrency(safeToSpend)} <span className="financial-hero__value-unit">frei</span></>}
        visual={(
          <div className="debt-hero-status" aria-label={`${upcoming.payments.length} ${upcoming.payments.length === 1 ? 'Fälligkeit' : 'Fälligkeiten'}`} role="img">
            <span className="debt-hero-status__icon" aria-hidden="true"><Icon name="calendar" size={26} /></span>
            <span>Offen</span>
            <strong>{upcoming.payments.length}</strong>
          </div>
        )}
      />

      <MetricGrid label="Fälligkeiten im Überblick">
        <MetricCard
          label="Noch fällig"
          supporting={`${upcoming.payments.length} ${upcoming.payments.length === 1 ? 'Zahlung' : 'Zahlungen'} bis Gehalt`}
          tone="neutral"
          value={formatCurrency(upcoming.totalPending)}
        />
        <MetricCard
          label="Nächstes Gehalt"
          supporting={hasSalaryConfig ? `Monatlich am ${upcoming.salaryDay}. Tag` : 'In Google-Tabelle angeben'}
          tone="accent"
          value={upcoming.nextSalaryDateLabel ?? 'Nicht konfiguriert'}
        />
      </MetricGrid>

      {isNegativeSafeToSpend ? (
        <InlineNotice icon={<Icon name="info" size={22} />} title="Ausstehende Zahlungen übersteigen Guthaben" tone="danger">
          <p>
            Bis zum nächsten Gehalt am {upcoming.nextSalaryDateLabel ?? 'Gehaltstag'} stehen {formatCurrency(upcoming.totalPending)} an
            Abzügen an. Das verfügbare Kontoguthaben reicht um {formatCurrency(Math.abs(safeToSpend))} nicht aus.
          </p>
        </InlineNotice>
      ) : null}

      {!hasSalaryConfig ? (
        <InlineNotice className="upcoming-notice" icon={<Icon name="sheet" size={22} />} title="Gehaltstag in Google-Tabelle angeben" tone="info">
          <p>
            Füge im Tab <code>_Meta</code> die Spalte <code>salary_day</code> mit deinem Gehaltstag (z.&nbsp;B. <code>25</code>) ein,
            um deine ausstehenden Zahlungen und den verfügbaren Betrag bis zum nächsten Gehalt automatisch zu berechnen.
          </p>
        </InlineNotice>
      ) : null}

      {hasSalaryConfig && upcoming.payments.length === 0 ? (
        <InlineNotice className="upcoming-notice" icon={<Icon name="check" size={22} />} title="Keine anstehenden Abzüge" tone="positive">
          <p>Bis zum nächsten Gehalt am {upcoming.nextSalaryDateLabel} stehen keine weiteren wiederkehrenden Fälligkeiten an.</p>
        </InlineNotice>
      ) : null}

      {upcoming.payments.length > 0 ? (
        <SurfaceSection
          id="upcoming-payments-section"
          supporting={upcoming.nextSalaryDateLabel ? `Chronologisch sortiert bis ${upcoming.nextSalaryDateLabel}` : undefined}
          title="Anstehende Abzüge"
        >
          <DataList
            footer={<><span>Ausstehende Summe</span><strong className="financial-value">{formatCurrency(upcoming.totalPending)}</strong></>}
            label="Anstehende Abzüge"
          >
            {upcoming.payments.map((payment) => (
              <DataListItem
                icon={<Icon name={payment.source === 'budget' ? 'budget' : 'debt'} size={20} />}
                key={payment.id}
                supporting={(
                  <>
                    Fällig am {payment.dueDateLabel}
                    {payment.isShortlyBeforeSalary && upcoming.nextSalaryDate ? (
                      <span className="pre-salary-chip">{getDaysUntilSalaryLabel(payment.dueDate, upcoming.nextSalaryDate)}</span>
                    ) : null}
                  </>
                )}
                title={payment.name}
                value={formatCurrency(payment.amount)}
              />
            ))}
          </DataList>
        </SurfaceSection>
      ) : null}
    </ScreenEntrance>
  );
}
