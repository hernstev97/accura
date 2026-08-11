# Produktüberblick

> **Zielgruppe:** Produktinteressierte, Nutzer und Betreiber.
> **Zweck und Lernziel:** Zweck, Nutzen, Datenverwendung und bewusste Grenzen von `accura` erklären können.
> **Voraussetzungen:** Keine.
> **Kanonisch für:** Produktzweck, Zielgruppe und Produktgrenze.
> **Verwandte Dokumente:** [Funktionen](funktionen.md), [Abläufe und Zustände](ablaeufe-und-zustaende.md), [Architekturüberblick](../architektur/ueberblick.md)

## Was accura ist

`accura` ist eine private Single-User-PWA für den eigenen Finanzüberblick. Sie fasst eine vom Nutzer gepflegte Google-Tabelle in vier verständlichen Ansichten zusammen: Übersicht, Demnächst, Budget und Schulden. Das Ziel ist Orientierung, nicht Buchhaltung, Zahlungsverkehr oder Anlageberatung.

Die App ist für genau eine serverseitig freigegebene Google-E-Mail-Adresse ausgelegt. Es gibt weder Registrierung noch Rollen, Mandanten, geteilte Haushalte oder SaaS-Betrieb.

## Nutzen und Datenhoheit

Die Google-Tabelle bleibt die vom Nutzer kontrollierte fachliche Datenquelle. `accura` liest ausschließlich die zehn Maschinen-Tabs des [Finance Data Schema v1](../referenz/finance-data-schema-v1.md), validiert sie serverseitig und liefert eine normalisierte, versionierte Darstellung an den Browser. Die App schreibt keine Finanzwerte in die Tabelle.

Ein erfolgreich validierter Stand wird auf dem Gerät in IndexedDB gespeichert. So kann die App nach einem späteren Offline-Start den zuletzt bekannten guten Stand zeigen. Der sichtbare Datenstand und Warnhinweise machen klar, wenn eine Aktualisierung fehlt.

## Datenschutzmodell

Refresh-Token, Google-Client-Secret, Datenbank-URL, Token-Schlüssel und Session-Secret bleiben auf dem Server. Der Browser erhält nur die Finanzantwort sowie beim bewussten Öffnen des Pickers kurzzeitig ein Zugriffstoken. Details und Vertrauensgrenzen stehen unter [Backend und Sicherheit](../architektur/backend-und-sicherheit.md).

Der [Privacy-Modus](../architektur/privacy-modus.md) maskiert Geldbeträge in sichtbarer UI und Accessibility-Texten. Er schützt gegen beiläufiges Mitlesen, verschlüsselt jedoch weder Arbeitsspeicher noch IndexedDB und ersetzt keine Gerätesperre oder getrennte Browserprofile.

## Bewusste Ausschlüsse

- kein Multi-User- oder Mandantenmodell;
- kein Bearbeiten der Google-Tabelle durch die App;
- keine Bankanbindung, Überweisung oder automatische Kategorisierung;
- kein garantierter Echtzeitstand und kein Hintergrund-Polling;
- keine Verschlüsselung lokaler Finance-Daten durch den Privacy-Modus;
- keine produktive persönliche Fixture im Repository.

Aktuell Erreichtes steht im [Entwicklungsstand](entwicklungsstand.md); Vorhaben stehen ausschließlich in der [Roadmap](roadmap.md). Ideen sind damit nicht versehentlich als Produktfunktion beschrieben.

## Implementierung und Tests

- Produkt-Shell: [src/App.tsx](../../src/App.tsx)
- Server-Datenfluss: [api/_lib/financeService.ts](../../api/_lib/financeService.ts)
- Anonyme Testdaten: [scripts/fixtures/anonymous-finance-data.mjs](../../scripts/fixtures/anonymous-finance-data.mjs)
- Browser-Smoke-Tests: [scripts/browser-smoke.mjs](../../scripts/browser-smoke.mjs)
