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

- SSOT-Dokumentation und lokalen manuellen Dokumentationscheck fertigstellen.
- Reale Produktionsabläufe für OAuth, Picker, Sheets, PostgreSQL, Offline-Start, Trennen und Wiederverbinden durch den Eigentümer abnehmen.
- Golden- und Axe-Abdeckung für Demnächst und Privacy-Modus schließen.
- Bestehende Qualitätsprüfungen dauerhaft grün halten.

Appearance-Grundimplementierung, Accessibility-Pass, Branding, CI, Demnächst und Privacy-Modus sind erreicht und deshalb keine allgemeinen offenen Arbeitspakete.

## Next

- Datensparsames Monitoring und strukturierte Betriebsdiagnose.
- Rate-Limits und Missbrauchsschutz für den privaten Betrieb bewerten.
- Workbook-Onboarding durch ein anonymes Template und Vorabvalidierung verbessern.
- PWA-Updates, Cache-Zustand und lokale Löschaktionen transparenter machen.
- Visuelle und barrierefreie Abdeckung seltener Paletten- und Fehlerzustände ergänzen.

## Later

- Historische Trends und Prognosen.
- Finance Data Schema v2 nur bei konkretem Bedarf und expliziter Migration.
- Optionale Hinweise auf geänderte oder veraltete Daten ohne Polling.
- Weitere lokale Datenschutzkontrollen für Offline-Daten.

## Nicht Teil der Roadmap

Multi-User, Mandantenverwaltung, öffentlicher SaaS-Betrieb, Banktransaktionen und stilles Bearbeiten der Finanzquelle sind keine geplanten Erweiterungen. Ebenso sind Depot-/Investmentanalyse, Gesamtvermögensverwaltung, Finanzproduktvermittlung, Steuer-/Buchhaltungsfunktionen und Wachstum allein zur Konkurrenz mit universellen Finanzplattformen keine strategischen Ziele.
