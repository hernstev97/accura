# ADR 0007: Vite-PWA und Vercel Functions

> **Zielgruppe:** Plattform- und PWA-Entwickler.
> **Zweck und Lernziel:** Build-, Hosting- und Serverfunktionswahl begründen.
> **Voraussetzungen:** [Web und PWA](../grundlagen/web-und-pwa.md), [Architekturüberblick](../architektur/ueberblick.md)
> **Kanonisch für:** Begründung von Vite, `vite-plugin-pwa` und root-`api/` Functions.
> **Verwandte Dokumente:** [Lokale Entwicklung](../anleitungen/lokale-entwicklung.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Die kleine React-App benötigt schnellen statischen Build, installierbaren Offline-App-Shell und wenige same-origin Serverendpunkte.

## Entscheidung

Vite baut das Frontend, `vite-plugin-pwa` erzeugt Manifest/Service Worker, und Vercel hostet root-`api/` TypeScript Functions sowie statische Assets.

Neue Worker verwenden den Prompt-Modus. Sie bleiben wartend, bis die Person das sichtbare Update bestätigt; erst dann folgen `SKIP_WAITING`, Kontrollübernahme und genau ein Reload. API-Routen bleiben unabhängig davon `NetworkOnly`.

## Begründung

Die Kombination ist repositorynah, benötigt keinen separaten Serverprozess und hält Browser/API unter einer Origin.

## Erwogene Alternativen

Separates Express-Backend, Next.js oder reine Client-App. Sie erhöhen Betriebsfläche oder können langlebige Server-Secrets nicht angemessen schützen.

## Konsequenzen

### Positiv

Kleine Deploymentstruktur, same-origin Cookies/CSRF, PWA-Buildintegration und kontrollierte Versionswechsel ohne ungefragte Unterbrechung.

### Negativ

Lokal ist `vercel dev` für den Realfluss nötig; Functions sind kurzlebig und nicht für Hintergrundpolling gedacht.

## Implementierung und Tests

- Implementierung: [vite.config.ts](../../vite.config.ts), [PwaUpdateNotice](../../src/components/PwaUpdateNotice.tsx), [api](../../api)
- Tests: [scripts/pwa-smoke.mjs](../../scripts/pwa-smoke.mjs), [scripts/auth-sw-smoke.mjs](../../scripts/auth-sw-smoke.mjs), [scripts/server-esm.test.mjs](../../scripts/server-esm.test.mjs)
