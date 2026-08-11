# ADR 0002: Versionierte Domänengrenze und Integer-Cents

> **Zielgruppe:** Finance- und Backend-Entwickler.
> **Zweck und Lernziel:** Schema-Versionierung und Geldrepräsentation begründen.
> **Voraussetzungen:** [Finanz-Domäne](../architektur/finanz-domaene.md)
> **Kanonisch für:** Begründung von `FinanceDataV1` und Integer-Cents.
> **Verwandte Dokumente:** [Schema v1](../referenz/finance-data-schema-v1.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Spreadsheet-Werte sind untrusted und Gleitkomma-Euro führen bei Summen leicht zu Rundungsartefakten.

## Entscheidung

Der Server validiert einen explizit versionierten Vertrag und normalisiert jeden Geldwert einmal zu sicheren Integer-Cents. `FinanceDataV1` enthält Quellen, keine UI-Totals.

## Begründung

Die Grenze macht Änderungen explizit, Berechnungen deterministisch und Parser-/Clientfehler früh sichtbar.

## Erwogene Alternativen

Euro-Gleitkomma bis zur UI, formatierte Strings oder beliebige Sheet-Formeln. Sie erschweren Rechnen, Validierung und Migration.

## Konsequenzen

### Positiv

Centgenaue Summen, testbare Typen, klare v2-Migrationsschwelle.

### Negativ

Parseraufwand, sicherer Zahlenbereich und explizite Formatierung an der UI-Grenze.

## Implementierung und Tests

- Implementierung: [src/finance/types.ts](../../src/finance/types.ts), [src/finance/parser.ts](../../src/finance/parser.ts)
- Tests: [src/finance/parser.test.ts](../../src/finance/parser.test.ts), [src/finance/selectors.test.ts](../../src/finance/selectors.test.ts)
