# accura

Accura schafft finanzielle Klarheit für Menschen, die unter engem Budget, Schulden oder mentaler Überforderung leiden. Statt Vermögen zu optimieren, zeigt die App, was wirklich verfügbar ist, was als Nächstes fällig wird und wie sich finanzielle Belastungen entwickeln. Der [Produktüberblick](docs/produkt/ueberblick.md) beschreibt dieses Versprechen und seine bewussten Grenzen.

Heute ist `accura` eine private, deutschsprachige Finanzübersicht als installierbare Web-App (PWA). Genau eine freigegebene Person meldet sich mit Google an. Der Finanzstand liegt in PostgreSQL. Ein zuletzt erfolgreich geladener Datenstand bleibt lokal offline verfügbar.

Die vier Ansichten zeigen verfügbare Mittel, anstehende Zahlungen bis zum nächsten Gehalt, Monatsbudget und Schuldenverlauf. Ein lokaler Privacy-Modus maskiert sichtbare Geldbeträge; er ist ausdrücklich keine Verschlüsselung.

## Dokumentation

- [Dokumentationsindex und Themenmatrix](docs/README.md)
- [Produktüberblick](docs/produkt/ueberblick.md)
- [Funktionen und Bedienung](docs/produkt/funktionen.md)
- [Produktions-Setup](docs/anleitungen/produktions-setup.md)
- [Lokale Entwicklung](docs/anleitungen/lokale-entwicklung.md)
- [Architekturüberblick](docs/architektur/ueberblick.md)
- [Finance Data Schema v1](docs/referenz/finance-data-schema-v1.md)
- [Entwicklungsstand](docs/produkt/entwicklungsstand.md) und [Roadmap](docs/produkt/roadmap.md)

## Schnellstart ohne externe Dienste

Voraussetzung ist eine aktuelle Node.js-Version gemäß `package.json` und npm.

```bash
npm install
npm run dev:mock
```

Der Mock-Modus verwendet ausschließlich anonyme Repository-Daten. Für Google OAuth, PostgreSQL und Vercel Functions gilt die [Produktions-Setup-Anleitung](docs/anleitungen/produktions-setup.md).

Der Integrationsstand auf `develop` ist unter [accura-preview.kiumu.app](https://accura-preview.kiumu.app/) mit derselben anonymen, bereits angemeldeten Mock-Sitzung verfügbar. Pull Requests zielen standardmäßig auf `develop`; `master` bleibt der bewusst freizugebende Produktionsstand.

## Prüfen

```bash
npm run docs:check
npm test
npm run lint
npm run licenses:check
npm run build
```

Die Dokumentationsprüfung ist ein lokales Hilfsmittel und kein CI- oder Release-Gate. Lizenzhinweise zur eingebetteten Schrift stehen unter [docs/fonts](docs/fonts/README.md).

## Lizenz

Der Accura-eigene Code und die eigene Dokumentation stehen, soweit nicht ausdrücklich anders gekennzeichnet, unter der [GNU Affero General Public License Version 3](LICENSE), ausschließlich Version 3 (`AGPL-3.0-only`). Drittanbieterbestandteile bleiben unter ihren jeweiligen Lizenzen; die ausgelieferten Lizenztexte und Hinweise stehen in [THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt).

Das Accura-Logo-, Icon- und Brand-Design ist separat von der Softwarelizenz ausgenommen. Einzelheiten stehen in den [Brand- und Kennzeichenhinweisen](TRADEMARKS.md). Diese Brand-Ausnahme schränkt keine Rechte an dem unter `AGPL-3.0-only` lizenzierten Code ein.
