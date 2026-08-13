# Roadmap

> **Zielgruppe:** Eigentümer, Produktbeteiligte und Entwickler.
> **Zweck und Lernziel:** Priorisierte Vorhaben klar vom aktuellen Produkt trennen.
> **Voraussetzungen:** [Entwicklungsstand](entwicklungsstand.md)
> **Kanonisch für:** Now–Next–Later-Planung.
> **Verwandte Dokumente:** [Produktüberblick](ueberblick.md), [Markt und Positionierung](markt-und-positionierung.md), [Testen und Release](../anleitungen/testen-und-release.md)

Die Roadmap ist eine Absichtserklärung, kein Funktionsversprechen. „Now“ bedeutet aktuell zu validieren oder abzuschließen, nicht automatisch bereits produktiv verfügbar.

## Strategische Leitplanken

- **Kognitive Entlastung vor Funktionsbreite:** Neue Funktionen müssen finanzielle Gewissheit erhöhen und dürfen verfügbare Mittel, unmittelbare Belastungen und Schuldenentwicklung nicht verdrängen.
- **Weniger Überraschungen vor mehr Nutzung:** Erfolg wird nicht durch längere Sitzungen, tägliche Serien oder Gamification definiert.
- **Erklärbarkeit vor scheinbarer Präzision:** Jede zentrale Zahl muss auf Quelldaten, Stichtag und Annahmen zurückführbar sein. Prognosen müssen bestätigt, erwartet und unsicher unterscheidbar machen.
- **Vertrauen vor Monetarisierung:** Die finanzielle Verletzlichkeit der Zielgruppe darf nicht durch Kredit-, Versicherungs-, Vergleichs- oder Affiliate-Verkauf ausgenutzt werden.
- **Aktueller Stand vor Vision:** Marktchancen und langfristige Positionierung machen keine Roadmap-Idee zu einer implementierten oder beschlossenen Funktion.

## Now

- Architektur für den Quellenwechsel verbindlich festlegen und die sheetgebundenen ADRs ersetzen.
- Das heutige `FinanceDataV1` mit internem `owner_id` in PostgreSQL abbilden und ownergebunden wieder als denselben Vertrag lesen.
- Sheet-Parser und PostgreSQL-Lesepfad mit derselben anonymen Fixture auf identische Cents, Fälligkeiten und Snapshot-Auswahl prüfen.
- Den bestehenden privaten Datenstand einmalig importieren und danach eindeutig auf PostgreSQL als einzige produktive Quelle umschalten.
- Einen eng begrenzten In-App-Editor für Stände, Beträge, Fälligkeiten und Aktivstatus bauen.

Kein Teil dieses Schnitts führt Schema v2, öffentliche Registrierung, Mandanten-UI, dauerhaften Sheet-Sync oder Zurückschreiben nach Sheets ein.

## Next

- Erst nachdem die eigene PostgreSQL-Datenhaltung im Alltag trägt: Invite-only-Authentifizierung und strikt getrennte Nutzerkonten umsetzen.
- Danach ein angstfreies geführtes Erst-Onboarding ohne Google-Sheets-Pflicht für die Private Alpha bauen.
- Vor Aufnahme weiterer Personen Isolation, Löschung, Recovery, Rate-Limits und datensparsame Betriebsdiagnose vollständig prüfen.

## Later

- `FinanceDataV1` erst nach dem Quellenwechsel und nur bei konkretem Produktbedarf versioniert erweitern.
- Mehrere Einkommensquellen, vollständige regelmäßige Zahlungen, Sparziele, Zins-/Vertragsdaten und monatliche Ist-Ausgaben jeweils als eigene fachliche Schritte bewerten.
- Historische Trends und Prognosen erst auf einer erklärbaren, migrierten Datengrundlage aufbauen.

## Nicht Teil der Roadmap

Öffentliche Registrierung, öffentlicher SaaS-Betrieb, geteilte Haushalte ohne belegten Bedarf, Banktransaktionen und stilles Bearbeiten externer Quellen sind keine geplanten Erweiterungen. Ebenso sind Depot-/Investmentanalyse, Gesamtvermögensverwaltung, Finanzproduktvermittlung, Steuer-/Buchhaltungsfunktionen und Wachstum allein zur Konkurrenz mit universellen Finanzplattformen keine strategischen Ziele.
