# Produktüberblick

> **Zielgruppe:** Produktinteressierte, Nutzer, Betreiber und alle, die Produktentscheidungen treffen.
> **Zweck und Lernziel:** Zielgruppe, Kernproblem, Produktversprechen, heutigen Umfang und strategische Nicht-Ziele von `accura` erklären können.
> **Voraussetzungen:** Keine.
> **Kanonisch für:** Zeitlose Produktpositionierung, Zielgruppe, Produktversprechen und Produktgrenze.
> **Verwandte Dokumente:** [Funktionen](funktionen.md), [Markt und Positionierung](markt-und-positionierung.md), [Entwicklungsstand](entwicklungsstand.md), [Roadmap](roadmap.md)

## Grundverständnis

Accura ist kein universeller Finanzmanager und kein Werkzeug zur Vermögensoptimierung. Es ist ein ruhiges Finanz-Cockpit für Menschen, die unter finanziellem Druck stehen oder von ihrer Geldverwaltung mental überfordert sind. Accura beantwortet verständlich, was tatsächlich noch verfügbar ist, welche Belastungen bis zum nächsten Gehalt bevorstehen und wie sich bestehende Schulden entwickeln.

Der zentrale Produktgrundsatz lautet:

> **Kognitive Entlastung durch finanzielle Gewissheit.**

Der Wert liegt nicht darin, möglichst viele Finanzfunktionen zu sammeln oder eine einzelne Funktion als neu zu beanspruchen. Accura übersetzt verstreute Daten in wenige unmittelbar verständliche und handlungsrelevante Aussagen.

## Für wen Accura gebaut wird

Accura richtet sich insbesondere an Menschen, die:

- von Gehalt zu Gehalt leben oder monatlich nur wenig finanziellen Spielraum haben;
- mehrere Raten oder Schulden überblicken müssen;
- kommende Abbuchungen leicht übersehen;
- mit klassischen Budgetmethoden nicht gut zurechtkommen;
- unter Stress, Scham oder allgemeiner Überforderung möglichst wenig zusätzliche Denkarbeit benötigen;
- etwa durch ADHS von einer besonders ruhigen, vorhersehbaren und reizarm aufgebauten Finanzübersicht profitieren können.

Diese Merkmale sind keine Defizitbeschreibung und keine Diagnose. Menschen geraten aus sehr unterschiedlichen persönlichen und strukturellen Gründen unter finanziellen Druck. Accura soll respektvoll unterstützen, ohne zu moralisieren, zu beschämen oder finanzielles Wissen vorauszusetzen.

## Produktversprechen

Accura soll mit möglichst wenig Finanzwissen und Pflege verständlich beantworten:

1. Was habe ich wirklich noch zur Verfügung?
2. Was wird vor dem nächsten Gehalt noch fällig?
3. Wie viel davon kann ich sicher ausgeben?
4. Welche Schulden bestehen und wie entwickeln sie sich?
5. Wann endet eine Belastung und wie viel Geld wird danach frei?

Die App soll keine komplexe Budgetmethode lehren. Informationshierarchie, ruhige Sprache, erklärbare Berechnungen und sichtbarer Datenstand sind deshalb Teil des Produkts – nicht bloß Gestaltung.

## Heutiger Repository-Stand

Aktuell ist `accura` eine private Single-User-PWA für genau eine serverseitig freigegebene Google-E-Mail-Adresse. Der Finanzstand liegt in PostgreSQL und wird in vier Ansichten zusammengeführt: Übersicht, Demnächst, Budget und Schulden. Es gibt weder öffentliche Registrierung noch Rollen, Mandanten, geteilte Haushalte oder SaaS-Betrieb.

Die implementierten Funktionen stehen ausschließlich unter [Funktionen](funktionen.md), der überprüfte Stand unter [Entwicklungsstand](entwicklungsstand.md). Die langfristige Positionierung beschreibt, woran künftige Entscheidungen gemessen werden; sie behauptet keine heute noch nicht implementierte Funktion.

Accura ist derzeit kein öffentlich angebotenes Fintech, keine regulierte Finanzberatung und kein Ersatz für professionelle Schuldner-, Insolvenz-, Steuer- oder Rechtsberatung.

## Nutzen und Datenhoheit

PostgreSQL ist die fachliche Datenquelle. `accura` liest den ownergebundenen Stand als [Finance Data Schema v1](../referenz/finance-data-schema-v1.md) und liefert eine normalisierte, versionierte Darstellung an den Browser. Google Sheets ist nur noch ein einmaliges Importformat. Die Produkt-UI schreibt noch keine Finanzzeilen; das erledigt der kontrollierte Operator-Import.

Ein erfolgreich validierter Stand wird auf dem Gerät in IndexedDB gespeichert. So kann die App nach einem späteren Offline-Start den zuletzt bekannten guten Stand zeigen. Sichtbarer Datenstand und Warnhinweise machen deutlich, wenn eine Aktualisierung fehlt. Weil eine falsche verfügbare Summe bei engem Spielraum besonders schädlich wäre, sind Centgenauigkeit, Laufzeitvalidierung und nachvollziehbare Annahmen zentrale Sicherheitsanforderungen.

## Datenschutzmodell

Google-Client-Secret, Datenbank-URL und Session-Secret bleiben auf dem Server. Der Browser erhält nur die Finanzantwort. Details und Vertrauensgrenzen stehen unter [Backend und Sicherheit](../architektur/backend-und-sicherheit.md).

Der [Privacy-Modus und App-Schutz](../architektur/privacy-modus.md) maskiert wahlweise Geldbeträge und kann die gesamte App nach einem Hintergrundwechsel verdecken oder mit einer lokalen PIN sperren. Diese Funktionen reduzieren beiläufiges Mitlesen, verschlüsseln jedoch weder Arbeitsspeicher noch IndexedDB und ersetzen keine Gerätesperre oder getrennte Browserprofile.

## Strategische Nicht-Ziele

Accura soll nicht zum universellen All-in-one-Finanzprodukt werden. Nicht zum Produktkern gehören:

- Depot-, Aktien-, ETF-, Krypto- oder Investmentanalyse;
- Immobilien- und Gesamtvermögensverwaltung;
- Versicherungs- und Kreditvergleiche oder Finanzproduktvermittlung;
- Steuer-, Buchhaltungs- oder Zahlungsverkehrsfunktionen;
- Gamification mit dem Ziel, Nutzungsdauer oder tägliche Interaktion zu maximieren;
- Funktionswachstum allein, um mit großen Finanzplattformen gleichzuziehen;
- öffentliche Registrierung, Multi-User- oder Mandantenverwaltung im heutigen Produktmodell.

Diese Grenzen sind strategisch. Eine zusätzliche Funktion ist nur dann sinnvoll, wenn sie finanzielle Gewissheit erhöht, erklärbar bleibt und die existenziell relevanten Informationen nicht aus der ersten Wahrnehmung verdrängt. Finanzielle Verletzlichkeit darf nicht durch Kredit-, Versicherungs- oder Affiliate-Verkauf ausgenutzt werden.

## Technische und operative Ausschlüsse

- kein Zurückschreiben nach Google Sheets;
- keine Bankanbindung, Überweisung oder automatische Kategorisierung im aktuellen Produkt;
- kein garantierter Echtzeitstand und kein Hintergrund-Polling;
- keine Verschlüsselung lokaler Finance-Daten durch Privacy- oder App-Schutz;
- keine produktive persönliche Fixture im Repository.

## Produkt, Vision und Markt getrennt halten

- **Heute verfügbar:** nur, was unter [Funktionen](funktionen.md) und [Entwicklungsstand](entwicklungsstand.md) belegt ist.
- **Langfristige Positionierung:** Zielgruppe, Produktversprechen und Nicht-Ziele dieser Seite.
- **Mögliche Zukunft:** ausschließlich als nicht beschlossen gekennzeichnete Vorhaben der [Roadmap](roadmap.md).
- **Externe Marktbeobachtung:** die datierte und veränderliche Analyse unter [Markt und Positionierung](markt-und-positionierung.md).

## Implementierung und Tests

- Produkt-Shell: [src/App.tsx](../../src/App.tsx)
- Server-Datenfluss: [api/_lib/financeRepository.ts](../../api/_lib/financeRepository.ts)
- Finanzberechnungen: [src/finance/selectors.ts](../../src/finance/selectors.ts), [src/finance/upcoming.ts](../../src/finance/upcoming.ts)
- Anonyme Testdaten: [scripts/fixtures/anonymous-finance-data.mjs](../../scripts/fixtures/anonymous-finance-data.mjs)
- Browser-Smoke-Tests: [scripts/browser-smoke.mjs](../../scripts/browser-smoke.mjs)
