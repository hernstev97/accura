# ADR 0010: Gehaltsbezogene Fälligkeitsprojektion

> **Zielgruppe:** Produkt- und Finance-Entwickler.
> **Zweck und Lernziel:** Stichtag, Monatsprojektion und Ausschluss des Gehaltstags begründen.
> **Voraussetzungen:** [Finanz-Domäne](../architektur/finanz-domaene.md)
> **Kanonisch für:** Begründung der Demnächst-Projektionsregeln.
> **Verwandte Dokumente:** [Schema v1](../referenz/finance-data-schema-v1.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Nutzer brauchen eine nachvollziehbare Summe wiederkehrender Zahlungen, die vor dem nächsten Gehalt noch aus dem aktuellen Guthaben abgehen.

## Entscheidung

`_Meta.as_of` ist Berechnungsstichtag. `salary_day` bestimmt Gehalt, `due_day` die nächste Fälligkeit; ungültige Monatstage werden auf Monatsende begrenzt. Berücksichtigt wird `asOf <= dueDate < nextSalaryDate`. Der Gehaltstag selbst ist ausgeschlossen. Sieben Tage davor gelten als kurzfristig.

## Begründung

Das halboffene Intervall entspricht „bis zum Gehalt“: Gleichzeitige Zahlungen gehören in den neuen Einkommenszyklus. Ein gespeicherter Stichtag macht Screenshots und Tests deterministisch.

## Erwogene Alternativen

Browser-„heute“, inklusiver Gehaltstag, feste 30-Tage-Monate oder freie Datumslisten. Sie wären instabil, fachlich missverständlich oder eine größere Schemaänderung.

## Konsequenzen

### Positiv

Deterministische Projektion, korrekte kurze Monate/Schaltjahre, klare verfügbare Summe.

### Negativ

Nur monatliche Wiederholung; keine Feiertags-/Bankarbeitstaglogik oder einmaligen Termine. Fehlende Tage liefern keine Projektion.

## Implementierung und Tests

- Implementierung: [src/finance/upcoming.ts](../../src/finance/upcoming.ts), [src/screens/UpcomingScreen.tsx](../../src/screens/UpcomingScreen.tsx)
- Tests: [src/finance/upcoming.test.ts](../../src/finance/upcoming.test.ts), [src/screens/UpcomingScreen.test.ts](../../src/screens/UpcomingScreen.test.ts)
