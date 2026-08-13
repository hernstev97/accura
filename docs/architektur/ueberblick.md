# Architekturüberblick

> **Zielgruppe:** Entwickler und technische Betreiber.
> **Zweck und Lernziel:** Systemteile, Vertrauensgrenzen und Hauptdatenflüsse schnell einordnen.
> **Voraussetzungen:** [Web und PWA](../grundlagen/web-und-pwa.md), [Web-Sicherheit und OAuth](../grundlagen/web-sicherheit-und-oauth.md)
> **Kanonisch für:** Systemkontext, Vertrauensgrenzen und Architektur-Gesamtbild.
> **Verwandte Dokumente:** [Frontend](frontend.md), [Backend und Sicherheit](backend-und-sicherheit.md), [Quellcode-Karte](../referenz/quellcode-karte.md)

## Mentales Modell

`accura` besteht aus einer React-PWA im Browser, same-origin Vercel Functions, PostgreSQL und Google-Diensten. Die Tabelle ist die Finanzquelle; PostgreSQL speichert nur die Verbindung. Der Server bildet die Sicherheits- und Validierungsgrenze. Der Browser erhält ausschließlich normalisierte Finanzdaten und zeigt daraus abgeleitete View-Models.

## Systemkontext und Vertrauensgrenzen

```mermaid
flowchart LR
  U[Freigegebene Person] -->|bedient| B[Browser / React-PWA]
  B -->|HTTPS, Session-Cookie, CSRF| V[Vercel Functions]
  V -->|OAuth / kurzlebige Access-Token| G[Google OAuth, Drive, Picker, Sheets]
  V -->|verschlüsseltes Refresh-Token + Dateireferenz| P[(PostgreSQL)]
  G -->|zehn Tabellenbereiche| V
  V -->|FinanceDataV1| B
  B -->|Last-known-good| I[(IndexedDB)]
  B -->|Appearance / Privacy / App-Schutz| L[(localStorage)]

  subgraph Geraet[Vertrauensbereich: Gerät und Browserprofil]
    B
    I
    L
  end
  subgraph Server[Vertrauensbereich: Betreiber und Vercel]
    V
    P
  end
```

Implementierung und Tests: [src/main.tsx](../../src/main.tsx), [api/_lib/http.ts](../../api/_lib/http.ts), [api/_lib/financeService.ts](../../api/_lib/financeService.ts), [scripts/auth-sw-smoke.mjs](../../scripts/auth-sw-smoke.mjs).

## Startvorgang

1. `index.html` stellt Root-Element, Manifest und frühe Theme-Metadaten bereit.
2. `src/main.tsx` registriert den Service Worker und liest Appearance, Privacy und App-Schutz vor dem ersten React-Render, damit weder Theme noch eine konfigurierte Sperre sichtbar nachladen.
3. React mountet unter `StrictMode` die Provider in der Reihenfolge Privacy → Appearance → FinanceData.
4. `FinanceDataProvider` lädt parallel fachlich zuerst den Cache und prüft danach die Sitzung. Eine vorhandene Auswahl löst einen Sync aus.
5. `App` zeigt eine Connection-State-Seite oder die vier Ziele. Nur die Übersicht ist initial geladen; weitere Ziele werden lazy importiert.

## Hauptdatenfluss

Google Sheets → Vercel Function → Tabellenparser → `FinanceDataV1` → Provider → Selektoren/View-Model → React-Screen. Nur eine vollständig gültige Antwort ersetzt den Browsercache. Schreibende App-Aktionen betreffen ausschließlich Verbindung, Tabellenauswahl und Sitzung, nicht die Finanzzeilen.

## Architekturentscheidungen

Die Gründe sind in [ADRs](../entscheidungen/README.md) festgehalten. Besonders zentral sind Google Sheets als Quelle, versionierte Integer-Cent-Domäne, serverseitiger Google-Zugriff, Single-User-Sicherheit und Last-known-good-Offline.

## Grenzen und Sicherheitsannahmen

Das Modell setzt ein vertrauenswürdiges Betreiberkonto, korrekte Secrets, HTTPS sowie ein geschütztes Endgerät/Browserprofil voraus. Lokale Finance-Daten sind weder durch Privacy, App-Schutz noch Appearance verschlüsselt. Es gibt keine Mandantentrennung, weil nur eine Identität erlaubt ist.
