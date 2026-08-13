# Lokale Entwicklung

> **Zielgruppe:** Entwickler, die `accura` lokal ausführen oder ändern.
> **Zweck und Lernziel:** Mock- und Realmodus starten und typische Entwicklungsprüfungen ausführen.
> **Voraussetzungen:** Node.js 20.19 oder neuer, npm und Git; für Realmodus zusätzlich Vercel CLI und konfigurierte Dienste.
> **Kanonisch für:** Lokalen Entwicklungsstart.
> **Verwandte Dokumente:** [Produktions-Setup](produktions-setup.md), [Testen und Release](testen-und-release.md), [Konfiguration](../referenz/konfiguration.md)

## Anonymer Mock-Modus

```bash
npm install
npm run dev:mock
```

Vite nennt die lokale URL. Dieser Modus lädt ausschließlich anonyme Daten aus `src/mocks`, simuliert Sitzung/API und Picker und benötigt weder Google noch PostgreSQL. Die Umschaltung ist nur aktiv, wenn Vite im Entwicklungsmodus läuft und `VITE_USE_MOCK_API=true` gesetzt ist. Ein Produktionsbuild verwendet den Mock nicht.

## Develop- und Vercel-Preview

Der dauerhafte Integrationsbranch `develop` wird unter `https://accura-preview.kiumu.app/` als Vercel Preview bereitgestellt. Alle Vercel-Preview-Deployments verwenden automatisch dieselbe anonyme, bereits angemeldete Mock-Sitzung wie `npm run dev:mock`. Damit benötigen weder `develop` noch Pull-Request-Previews Google- oder PostgreSQL-Secrets.

Die Trennung ist fail-closed: Nur Vercels exakte Umgebung `preview` aktiviert den Build-Mock automatisch. `production` verwendet unabhängig von `VITE_USE_MOCK_API` immer die reale API. Production und Preview besitzen außerdem verschiedene Origins und dadurch getrennte Cookies, IndexedDB- und Service-Worker-Speicher.

## Realer lokaler Serverfluss

Plain `npm run dev` startet nur Vite und stellt `api/` nicht bereit. Für echte Vercel Functions:

```bash
npm install
npx vercel link
npx vercel env pull .env.local --environment=development
npx vercel dev --listen 3000
```

Öffne `http://localhost:3000`. Google OAuth-Origin und Redirect müssen exakt darauf konfiguriert sein. Verwende eine Kopie der Tabelle, niemals die einzige produktive Quelle für erste Versuche. Die externen Schritte stehen im [Produktions-Setup](produktions-setup.md).

## Arbeitsablauf

1. Betroffene kanonische Dokumentation und ADR lesen.
2. Änderung eng halten und keine Secrets/Finanzwerte committen.
3. Passende Unit-Tests während der Entwicklung mit `npm run test:watch` ausführen.
4. Vor Übergabe mindestens `npm run docs:check`, `npm test`, `npm run lint` und `npm run build` ausführen.
5. Bei UI/PWA-Änderungen zusätzlich Visual- und Smoke-Suiten gemäß [Testen und Release](testen-und-release.md) ausführen.

## Häufige Stolpersteine

- Node-Version zu alt: Vite kann schon beim Installieren/Starten fehlschlagen.
- `/api/session` liefert im reinen Vite-Modus HTML/404: Realmodus benötigt `vercel dev` oder Mock-Modus.
- `.env.local` darf nicht committed werden; Browserwerte mit `VITE_` sind öffentlich.
- Ein Service Worker aus einem früheren Preview kann alte Assets halten; DevTools/Application kontrollieren und Site-Daten nur bewusst löschen.

## Implementierung und Tests

- npm-Skripte: [package.json](../../package.json)
- Vite/PWA: [vite.config.ts](../../vite.config.ts)
- Mock-API: [src/mocks/mockFinanceApi.ts](../../src/mocks/mockFinanceApi.ts)
- Modusauflösung: [build/financeRuntimeMode.ts](../../build/financeRuntimeMode.ts)
- Mock-Workbook: [src/mocks/anonymousWorkbook.ts](../../src/mocks/anonymousWorkbook.ts)
