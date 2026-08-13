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

Der Datenstichtag `_Meta.as_of` und der Projektionstag sind getrennt. `_Meta.as_of` begrenzt ausschließlich die Auswahl gespeicherter Snapshots. Für wiederkehrende Fälligkeiten übergibt die Anwendung explizit den aktuellen Kalendertag in der IANA-Zeitzone des Nutzers. `salary_day` bestimmt Gehalt, `due_day` die nächste Fälligkeit; ungültige Monatstage werden auf Monatsende begrenzt. Berücksichtigt wird `projectionDate <= dueDate < nextSalaryDate`. Der Gehaltstag selbst ist ausgeschlossen. Sieben Tage davor gelten als kurzfristig.

Bis ein Nutzerprofil existiert, wird die IANA-Zeitzone im Browser über `Intl` ermittelt; wenn sie nicht verfügbar ist, gilt der lokale Gerätekalender. Mit dem Onboarding wird die vom Nutzer bestätigte Heimatzeitzone im Profil gespeichert. Die Gerätezeitzone darf sie initial vorschlagen, ändert sie auf Reisen aber nicht automatisch. Die Projektion wird nach dem lokalen Tageswechsel in der maßgeblichen Zeitzone und beim erneuten Sichtbarwerden der App aktualisiert. Reine Selektoren und Tests erhalten den Projektionstag als Parameter und greifen nicht selbst auf die Uhr zu.

## Begründung

Das halboffene Intervall entspricht „bis zum Gehalt“: Gleichzeitige Zahlungen gehören in den neuen Einkommenszyklus. Die Trennung verhindert, dass ein älterer, weiterhin gültiger Finanz-Snapshot eine bereits vergangene Fälligkeit offen hält. Explizite Projektionstage machen Domain- und Screenshot-Tests weiterhin deterministisch.

## Erwogene Alternativen

Erwogen wurden `_Meta.as_of` als gemeinsamer Stichtag, eine volatile `TODAY()`-Formel in der Tabelle, ein inklusiver Gehaltstag, feste 30-Tage-Monate und freie Datumslisten. Der gemeinsame Stichtag erzeugt bei älteren Datenständen falsche offene Zahlungen. `TODAY()` würde den Datenstichtag künstlich fortschreiben, ohne neue Snapshots zu erzeugen. Die übrigen Varianten wären fachlich missverständlich oder eine größere Schemaänderung.

Für eine spätere PostgreSQL-Datenquelle werden fachliche Kalendertage als `date`, Ereigniszeitpunkte als `timestamptz` und die Heimatzeitzone als validierter IANA-Zonenname gespeichert. Welche Schicht den Projektionstag ableitet, wird erst mit der Datenbankarchitektur entschieden. Er bleibt jedoch ein expliziter Eingabewert der Finanz-Domäne und wird nicht implizit aus Datenbankuhr oder Session-Zeitzone bestimmt. Damit bleibt die Semantik testbar, ohne heute eine noch nicht beschlossene Serverarchitektur vorzugeben.

## Konsequenzen

### Positiv

Tagesaktuelle und deterministisch testbare Projektion, korrekte kurze Monate/Schaltjahre, klare verfügbare Summe und ein migrationsfähiges Zeitmodell.

### Negativ

Nur monatliche Wiederholung; keine Feiertags-/Bankarbeitstaglogik oder einmaligen Termine. Eine falsche Gerätezeitzone kann die Projektion bis zur Einführung einer serverseitig gespeicherten Nutzerzeitzone verschieben. Fehlende Tage liefern keine Projektion.

## Implementierung und Tests

- Implementierung: [src/lib/calendarDate.ts](../../src/lib/calendarDate.ts), [src/data/FinanceDataProvider.tsx](../../src/data/FinanceDataProvider.tsx), [src/finance/upcoming.ts](../../src/finance/upcoming.ts), [src/screens/UpcomingScreen.tsx](../../src/screens/UpcomingScreen.tsx)
- Tests: [src/lib/calendarDate.test.ts](../../src/lib/calendarDate.test.ts), [src/finance/upcoming.test.ts](../../src/finance/upcoming.test.ts), [src/screens/UpcomingScreen.test.ts](../../src/screens/UpcomingScreen.test.ts), [tests/visual/finance-ui.spec.ts](../../tests/visual/finance-ui.spec.ts)
