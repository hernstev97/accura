# Dokumentation von accura

> **Zielgruppe:** Produktinteressierte, Nutzer, Betreiber sowie Entwickler aller Erfahrungsstufen.
> **Zweck und Lernziel:** Den passenden Lesepfad und die einzige kanonische Seite für ein Thema finden.
> **Voraussetzungen:** Keine.
> **Kanonisch für:** Dokumentationsstruktur, Themenverantwortung und Linkkonvention.
> **Verwandte Dokumente:** [Produktüberblick](produkt/ueberblick.md), [Quellcode-Karte](referenz/quellcode-karte.md), [Glossar](referenz/glossar.md)

Diese Seite ist der zentrale Index und damit die Single Source of Truth (SSOT) für die Dokumentationsstruktur. „Kanonisch“ bedeutet: Nur die genannte Seite beschreibt einen Vertrag vollständig. Andere Seiten geben Orientierung und verlinken hierher.

## Lesepfade

- **Produktinteressierte:** [Überblick](produkt/ueberblick.md) → [Funktionen](produkt/funktionen.md) → [Markt und Positionierung](produkt/markt-und-positionierung.md) → [Roadmap](produkt/roadmap.md)
- **Nutzer:** [Funktionen](produkt/funktionen.md) → [Abläufe und Zustände](produkt/ablaeufe-und-zustaende.md) → [Fehlerdiagnose](anleitungen/fehlerdiagnose.md)
- **Junior-Entwickler:** [Web und PWA](grundlagen/web-und-pwa.md) → [TypeScript und React](grundlagen/typescript-und-react.md) → [Architekturüberblick](architektur/ueberblick.md)
- **Erfahrene Entwickler:** [Backend und Sicherheit](architektur/backend-und-sicherheit.md) → [Finanz-Domäne](architektur/finanz-domaene.md) → [ADRs](entscheidungen/README.md)
- **Betreiber:** [Produktions-Setup](anleitungen/produktions-setup.md) → [Konfiguration](referenz/konfiguration.md) → [Testen und Release](anleitungen/testen-und-release.md)

## Themenmatrix

| Thema | Kanonische Seite |
| --- | --- |
| Zweck, Zielgruppe, Produktgrenze | [Produktüberblick](produkt/ueberblick.md) |
| Bedienbare Funktionen | [Funktionen](produkt/funktionen.md) |
| Datierte Marktaufnahme und subjektive Wettbewerbsbewertung | [Markt und Positionierung](produkt/markt-und-positionierung.md) |
| Sitzungs-, Sync-, Privacy- und Appearance-Zustände | [Abläufe und Zustände](produkt/ablaeufe-und-zustaende.md) |
| Erreichter Stand | [Entwicklungsstand](produkt/entwicklungsstand.md) |
| Now–Next–Later | [Roadmap](produkt/roadmap.md) |
| Browser, HTTP, PWA und Service Worker | [Web und PWA](grundlagen/web-und-pwa.md) |
| TypeScript, React, Provider und Hooks | [TypeScript und React](grundlagen/typescript-und-react.md) |
| Laufzeitvalidierung und Speicherarten | [Datenvalidierung und Speicher](grundlagen/daten-validierung-und-speicher.md) |
| OAuth, PKCE, CSRF und Web-Sicherheit | [Web-Sicherheit und OAuth](grundlagen/web-sicherheit-und-oauth.md) |
| Systemkontext und Vertrauensgrenzen | [Architekturüberblick](architektur/ueberblick.md) |
| Komponenten, Navigation, Dialoge und Layout | [Frontend](architektur/frontend.md) |
| Cent-Berechnungen, Selektoren, View-Model und Demnächst | [Finanz-Domäne](architektur/finanz-domaene.md) |
| Synchronisierung, Race-Schutz und Offline-Cache | [Synchronisation und Offline](architektur/synchronisation-und-offline.md) |
| Vercel Functions, Google und Sicherheitsverträge | [Backend und Sicherheit](architektur/backend-und-sicherheit.md) |
| Tokens, Paletten, Bildanalyse und Fonts | [Appearance und Designsystem](architektur/appearance-und-designsystem.md) |
| Visuelle Maskierung und lokale Privacy-Persistenz | [Privacy-Modus](architektur/privacy-modus.md) |
| Testpyramide, Golden Screenshots, Axe und CI | [Tests und Qualität](architektur/tests-und-qualitaet.md) |
| Lokaler Start | [Lokale Entwicklung](anleitungen/lokale-entwicklung.md) |
| Google-, Postgres- und Vercel-Einrichtung | [Produktions-Setup](anleitungen/produktions-setup.md) |
| Prüfen und Freigeben | [Testen und Release](anleitungen/testen-und-release.md) |
| Fehlerbilder | [Fehlerdiagnose](anleitungen/fehlerdiagnose.md) |
| HTTP-Endpunkte | [API-Referenz](referenz/api.md) |
| Tabellenvertrag | [Finance Data Schema v1](referenz/finance-data-schema-v1.md) |
| Umgebungsvariablen | [Konfiguration](referenz/konfiguration.md) |
| Tabelle `google_connections` | [Datenbank](referenz/datenbank.md) |
| Verzeichnis- und Modulzuständigkeiten | [Quellcode-Karte](referenz/quellcode-karte.md) |
| Begriffe | [Glossar](referenz/glossar.md) |
| Begründete Architekturentscheidungen | [ADR-Index](entscheidungen/README.md) |
| Seiten- und ADR-Form | [Dokumentationsvorlage](vorlagen/dokumentationsseite.md), [ADR-Vorlage](vorlagen/adr.md) |
| Schriftquelle und Lizenz | [Fonts](fonts/README.md) |

## Vollständiger Seitenindex

### Produkt

- [Überblick](produkt/ueberblick.md)
- [Funktionen](produkt/funktionen.md)
- [Markt und Positionierung](produkt/markt-und-positionierung.md)
- [Abläufe und Zustände](produkt/ablaeufe-und-zustaende.md)
- [Entwicklungsstand](produkt/entwicklungsstand.md)
- [Roadmap](produkt/roadmap.md)

### Grundlagen

- [Web und PWA](grundlagen/web-und-pwa.md)
- [TypeScript und React](grundlagen/typescript-und-react.md)
- [Datenvalidierung und Speicher](grundlagen/daten-validierung-und-speicher.md)
- [Web-Sicherheit und OAuth](grundlagen/web-sicherheit-und-oauth.md)

### Architektur

- [Überblick](architektur/ueberblick.md)
- [Frontend](architektur/frontend.md)
- [Finanz-Domäne](architektur/finanz-domaene.md)
- [Synchronisation und Offline](architektur/synchronisation-und-offline.md)
- [Backend und Sicherheit](architektur/backend-und-sicherheit.md)
- [Appearance und Designsystem](architektur/appearance-und-designsystem.md)
- [Privacy-Modus](architektur/privacy-modus.md)
- [Tests und Qualität](architektur/tests-und-qualitaet.md)

### Anleitungen und Referenz

- [Lokale Entwicklung](anleitungen/lokale-entwicklung.md), [Produktions-Setup](anleitungen/produktions-setup.md), [Testen und Release](anleitungen/testen-und-release.md), [Fehlerdiagnose](anleitungen/fehlerdiagnose.md)
- [API](referenz/api.md), [Schema v1](referenz/finance-data-schema-v1.md), [Konfiguration](referenz/konfiguration.md), [Datenbank](referenz/datenbank.md), [Quellcode-Karte](referenz/quellcode-karte.md), [Glossar](referenz/glossar.md)

### Entscheidungen, Vorlagen und historische Pfade

- [ADR-Index](entscheidungen/README.md), [0001](entscheidungen/0001-google-sheets-als-datenquelle.md), [0002](entscheidungen/0002-versionierte-domaenengrenze-und-integer-cents.md), [0003](entscheidungen/0003-serverseitiger-google-zugriff-und-drive-file.md), [0004](entscheidungen/0004-single-user-sicherheitsmodell.md), [0005](entscheidungen/0005-last-known-good-und-offline.md), [0006](entscheidungen/0006-provider-selektoren-und-view-model.md), [0007](entscheidungen/0007-vite-pwa-und-vercel-functions.md), [0008](entscheidungen/0008-material-design-und-dynamische-farben.md), [0009](entscheidungen/0009-ereignisgesteuerte-aktualisierung.md), [0010](entscheidungen/0010-gehaltsbezogene-faelligkeitsprojektion.md), [0011](entscheidungen/0011-lokaler-privacy-modus.md)
- [Dokumentationsseite](vorlagen/dokumentationsseite.md), [ADR](vorlagen/adr.md), [Fonts](fonts/README.md)
- Historische Einstiegspunkte: [Designsystem](design-system.md), [Sicherheit und Datenfluss](security-and-data-flow.md), [Schema](finance-data-schema-v1.md), [Google-Setup](google-oauth-vercel-setup.md)

## Schreib- und Linkkonvention

Jede reguläre Seite besitzt genau eine H1 und direkt danach den fünfzeiligen Metablock. Repository-Links sind relativ. Ein vollständiger Vertrag, eine Formel oder Tabelle wird nur auf der kanonischen Seite gepflegt. Implementierungslinks zeigen auf Dateien im Repository; optionale `#L<n>`-Anker müssen auf eine existierende Zeile zeigen. Mermaid-Diagramme ersetzen keine textuelle Erklärung und erhalten darunter normale Implementierungs- und Testlinks.

Prüfen lässt sich die Struktur lokal mit `npm run docs:check`; externe Links optional mit `npm run docs:check:external`. Der Checker verändert keine Dateien und ist nicht Teil von GitHub Actions.
