# ADR 0001: Google Sheets als Datenquelle

> **Zielgruppe:** Produkt- und Architekturverantwortliche.
> **Zweck und Lernziel:** Wahl der nutzerkontrollierten Finanzquelle nachvollziehen.
> **Voraussetzungen:** [Produktüberblick](../produkt/ueberblick.md)
> **Kanonisch für:** Begründung von Google Sheets als Quelldatenspeicher.
> **Verwandte Dokumente:** [Schema v1](../referenz/finance-data-schema-v1.md), [ADR-Index](README.md)

- **Status:** Ersetzt durch [ADR 0013](0013-postgresql-als-finanzquelle.md)

## Kontext

Eine private Person soll Finanzquellen selbst kontrollieren und ohne eigene Verwaltungsoberfläche pflegen können.

## Entscheidung

Eine vom Nutzer ausgewählte native Google-Sheets-Datei ist fachliche Quelle. `accura` liest definierte Maschinen-Tabs und schreibt keine Finanzwerte zurück.

## Begründung

Sheets bietet vertraute Bearbeitung, Versionshistorie und Nutzerhoheit. Der eng definierte Vertrag verhindert, dass UI-Berechnungen von frei gestalteten Zellen abhängen.

## Erwogene Alternativen

Finanzwerte in PostgreSQL, lokale JSON-Datei oder feste Code-Fixture. Sie würden Datenhoheit, Zugänglichkeit oder Produktionssicherheit verschlechtern.

## Konsequenzen

### Positiv

Direkte Pflege, keine eigene CRUD-Oberfläche, klare Leseschnittstelle.

### Negativ

Google-Abhängigkeit, OAuth-Setup, manuelle Schemapflege und keine Transaktionsgarantie über mehrere Zelländerungen.

## Implementierung und Tests

- Implementierung: [api/_lib/google.ts](../../api/_lib/google.ts), [src/finance/parser.ts](../../src/finance/parser.ts)
- Tests: [src/server/google.test.ts](../../src/server/google.test.ts), [src/finance/parser.test.ts](../../src/finance/parser.test.ts)
