# Finanzen

„Finanzen“ ist eine mobile-first persönliche Finanzübersicht. Die installierbare PWA zeigt auf einen Blick frei verfügbares Geld, Konten, Pockets, das Monatsbudget und den prognostizierten Schuldenverlauf. Alle sichtbaren Texte sind deutsch; die Oberfläche folgt Material Design 3 und passt sich automatisch an helles oder dunkles Systemdesign an.

## Stack

- React und TypeScript mit Vite
- Motion für geteilte Indikatoren, Layout- und Containertransformationen
- zentralisierte MD3-Expressive-Tokens mit lokal gebündeltem Roboto Flex
- `@material/web` bleibt als kompatible Komponentenbasis und Token-Ziel erhalten
- Recharts für responsive Diagramme
- `vite-plugin-pwa` für Manifest, Service Worker und Offline-App-Shell
- Vitest für die Finanzberechnungen
- ESLint für statische Codeprüfung

## Lokal starten

Voraussetzung ist eine aktuelle Node.js-Version (empfohlen: Node.js 20.19 oder neuer).

```bash
npm install
npm run dev
```

Vite nennt nach dem Start die lokale Adresse, üblicherweise `http://localhost:5173`.

## Prüfen und bauen

```bash
npm test
npm run lint
npm run build
npm run preview
```

Der Produktions-Build liegt anschließend in `dist/`.

Auf großen Viewports bleibt die Anwendung bewusst ein zentrierter, vergrößerter Android-Feed mit derselben persistenten Bottom Navigation; es gibt keine separate Desktop-Dashboard-Navigation.

Für die reproduzierbare Browser-Abnahme einmalig Chromium für Playwright installieren und bei laufendem Entwicklungs- beziehungsweise Preview-Server prüfen:

```bash
npx playwright install chromium
npm run smoke:browser
SMOKE_URL=http://127.0.0.1:4173 npm run smoke:offline
```

## Installation als PWA

1. Den Produktions-Build über HTTPS bereitstellen oder lokal über `npm run preview` öffnen.
2. Die Seite in Chrome auf Android aufrufen.
3. Im Browsermenü **„App installieren“** beziehungsweise **„Zum Startbildschirm hinzufügen“** wählen.

Manifest, Icons (einschließlich Maskable Icon) und Service Worker werden beim Build erzeugt beziehungsweise eingebunden. Nach dem ersten vollständigen Laden bleibt die Anwendungsshell offline nutzbar. Die Safe Areas moderner Geräte und der Standalone-Modus werden berücksichtigt.

## Daten und spätere Google-Sheets-Anbindung

Alle Finanzdaten der v0.1 liegen ausschließlich in [`src/data/financeFixture.ts`](src/data/financeFixture.ts). Die Datei exportiert ein vollständig typisiertes `FinanceFixture`; Komponenten enthalten keine verteilten Finanzkonstanten. Ableitungen wie Summen, freier Betrag, Prozentsatz und zukünftige Mehrkosten leben in [`src/domain/calculations.ts`](src/domain/calculations.ts).

Diese Fixture ist die vorgesehene Integrationsgrenze: Eine spätere Google-Sheets-Anbindung soll die externe Tabelle in dieselbe `FinanceFixture`-Struktur überführen. Präsentation und Berechnungen können dadurch unverändert bleiben. v0.1 baut absichtlich noch keine Verbindung zu Google Sheets, Banken, Authentifizierung oder einer Datenbank auf.
