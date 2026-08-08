import { describe, expect, it } from 'vitest';
import { financeFixture } from '../data/financeFixture';
import {
  selectCurrentCash,
  selectDebtReliefGain,
  selectFreeMoney,
  selectFreePercentage,
  selectFutureDebtCost,
  selectPayoffToday,
  selectPlannedAmount,
  selectPlannedReserves,
  selectSortedBudgetCategories,
  selectVisiblePockets,
} from './calculations';

describe('Finanzberechnungen', () => {
  it('summiert den aktuellen Kontostand centgenau', () => {
    expect(selectCurrentCash(financeFixture)).toBe(305.82);
  });

  it('leitet geplanten und freien Monatsbetrag aus den Kategorien ab', () => {
    expect(selectPlannedAmount(financeFixture)).toBe(1906.86);
    expect(selectPlannedReserves(financeFixture)).toBe(145);
    expect(selectFreeMoney(financeFixture)).toBe(141.32);
    expect(selectFreePercentage(financeFixture)).toBeCloseTo(6.9, 1);
  });

  it('leitet Ablösesumme und zukünftige Mehrkosten ab', () => {
    expect(selectPayoffToday(financeFixture)).toBe(14322.93);
    expect(selectFutureDebtCost(financeFixture)).toBe(5049.12);
  });

  it('berechnet die Entlastung durch auslaufende Raten', () => {
    expect(selectDebtReliefGain(financeFixture)).toBe(226.05);
  });

  it('sortiert Kategorien und blendet leere Pockets standardmäßig aus', () => {
    expect(selectSortedBudgetCategories(financeFixture)[0]?.label).toBe('Lebensmittel');
    expect(selectVisiblePockets(financeFixture)).toHaveLength(4);
    expect(selectVisiblePockets(financeFixture, true)).toHaveLength(6);
  });
});
