import type { FinanceUiError } from '../data/FinanceDataProvider';

export function ValidationIssues({ error }: { error: FinanceUiError | null }) {
  if (!error?.issues?.length) return null;
  return (
    <details className="validation-issues">
      <summary>{error.issues.length} Validierungsfehler anzeigen</summary>
      <ul>
        {error.issues.slice(0, 12).map((entry, index) => (
          <li key={`${entry.tab}-${entry.row}-${entry.column}-${index}`}>
            <strong>{entry.tab}</strong>, Zeile {entry.row}, Spalte {entry.column}: {entry.message} Erwartet: {entry.expected}
          </li>
        ))}
      </ul>
    </details>
  );
}
