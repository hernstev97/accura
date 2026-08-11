# ADR 0006: Provider, Selektoren und View-Model

> **Zielgruppe:** Frontend- und Finance-Entwickler.
> **Zweck und Lernziel:** Trennung von I/O, Fachlogik und Darstellung begründen.
> **Voraussetzungen:** [Frontend](../architektur/frontend.md), [Finanz-Domäne](../architektur/finanz-domaene.md)
> **Kanonisch für:** Begründung von Provider-, Selektor- und View-Model-Schichten.
> **Verwandte Dokumente:** [TypeScript und React](../grundlagen/typescript-und-react.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Sitzung/Sync sind zustandsbehaftet, Finanzberechnungen sollen dagegen rein und unabhängig von React testbar bleiben.

## Entscheidung

`FinanceDataProvider` koordiniert I/O und Zustände. Reine Cent-Selektoren berechnen die Domäne; ein gemeinsames View-Model bereitet Screenwerte auf. Screens komponieren diese Daten.

## Begründung

Die Schichten vermeiden doppelte Formeln, vereinfachen Tests und halten Race-Schutz aus Komponenten heraus.

## Erwogene Alternativen

Fetch und Berechnungen pro Screen, globaler externer Store oder serverseitig berechnete UI-Payloads.

## Konsequenzen

### Positiv

Eine Berechnungsquelle, klare Tests, zentraler Connection-State.

### Negativ

Zusätzliche Abstraktionen und bewusste Providerreihenfolge; das View-Model kann bei unkontrolliertem Wachstum breit werden.

## Implementierung und Tests

- Implementierung: [src/data/FinanceDataProvider.tsx](../../src/data/FinanceDataProvider.tsx), [src/finance/viewModel.ts](../../src/finance/viewModel.ts)
- Tests: [src/data/FinanceDataProvider.test.ts](../../src/data/FinanceDataProvider.test.ts), [src/finance/selectors.test.ts](../../src/finance/selectors.test.ts)
