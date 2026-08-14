# Grundlagen: Web und PWA

> **Zielgruppe:** Junior-Entwickler und technisch interessierte Betreiber.
> **Zweck und Lernziel:** Browser, Server, HTTP, PWA, Service Worker und Offline-Grenzen einordnen.
> **Voraussetzungen:** Grundlegende Computerkenntnisse.
> **Kanonisch für:** Allgemeine Web- und PWA-Grundbegriffe dieser Dokumentation.
> **Verwandte Dokumente:** [Architekturüberblick](../architektur/ueberblick.md), [Synchronisation und Offline](../architektur/synchronisation-und-offline.md)

## Mentales Modell

Der Browser lädt HTML, CSS und JavaScript vom Server. JavaScript baut daraus die Oberfläche und sendet HTTP-Anfragen an `/api/*`. Diese Endpunkte laufen nicht im Browser, sondern als Vercel Functions. Dadurch bleiben Client-Secret, Session-Secret und Datenbankzugang außerhalb des Geräts; Google-Tokens werden nicht dauerhaft gespeichert.

HTTP ist ein Anfrage-Antwort-Protokoll. Eine Methode wie `GET` liest, `PUT` ersetzt oder setzt eine Ressource und `POST` löst eine Aktion aus. Statuscodes wie 200, 401, 409, 422 und 500 beschreiben das Ergebnis. HTTPS verschlüsselt den Transport, aber nicht automatisch lokale Browserdaten.

## Progressive Web App

Eine Progressive Web App (PWA) ist eine Webanwendung mit Manifest und Service Worker. Das Manifest beschreibt Namen, Icons und Startverhalten. Der Service Worker kann statische App-Dateien zwischenspeichern und einen Offline-Start ermöglichen. In `accura` werden `/api/*`-Anfragen absichtlich mit `NetworkOnly` behandelt: Der Service Worker erfindet keine Finanzantwort und speichert sie nicht in seinem HTTP-Cache.

Der App-Shell-Cache und der fachliche Finance-Cache sind verschiedene Dinge. Erstgenannter hält Code und Gestaltung startfähig; letzterer enthält den separat validierten Last-known-good-Snapshot in IndexedDB.

Direkte App-Pfade benötigen zwei Fallbacks: Vercel schreibt Nicht-API-Navigationen auf `index.html` um, damit ein erster Online-Deep-Link die SPA erreicht. Ein bereits kontrollierender Service Worker verwendet denselben Shell-Fallback offline. Beide Grenzen schließen `/api` aus; API-Navigationen dürfen niemals die HTML-Shell als vermeintliche Antwort erhalten.

## Installation, Systemflächen und App-Updates

Chrome übernimmt die Installation über seinen nativen PWA-Dialog; `accura` bietet bewusst keinen eigenen Installationsbutton an. Das Manifest besitzt mit `/` eine stabile App-ID. Sein Startpfad `/?app-launch=pwa` kennzeichnet ausschließlich einen frischen PWA-Start: Die App ersetzt ihn vor dem Rendern mit dem zuletzt tatsächlich verwendeten Hauptscreen. Normale Aufrufe von `/`, Deep Links, Reload und History lesen diese Präferenz nicht.

Ein opaker blauer Marken-Hintergrund, Standard-, Maskable- und Monochrome-Icon bilden den Android-Launcher und den automatisch erzeugten Splash ab. Dieser Splash ist absichtlich in Hell und Dunkel identisch, weil das Manifest nur eine statische `background_color` bereitstellt. Nach dem Dokumentstart übernimmt das aktive Appearance-Theme: Die `theme-color`-Metadaten folgen Systemmodus, explizitem Hell/Dunkel und der gewählten Palette.

Eine neue Service-Worker-Version aktiviert sich nicht ungefragt. Sie bleibt im Zustand `waiting`, bis der globale Hinweis „Neue Version verfügbar“ entweder mit „Jetzt neu laden“ bestätigt oder für die aktuelle Seitensitzung mit „Später“ ausgeblendet wird. Erst die Bestätigung sendet `SKIP_WAITING`; nach der Kontrollübernahme lädt die Seite genau einmal neu. Ein verschobenes Update wird beim nächsten App-Start wieder angeboten.

## Browser-Lebenszyklen

Tabs können in den Hintergrund wechseln, Netzwerkstatus kann ungenau oder verzögert sein, und der Browser darf Speicher unter Druck löschen. Daher ist „offline verfügbar“ eine robuste Komfortfunktion, keine garantierte Sicherung. `visibilitychange`, `online` und `offline` sind Ereignisse, keine unfehlbaren Zustandsquellen.

## Umsetzung in accura

- `index.html` stellt das Root-Element und frühe Theme-Metadaten bereit.
- [src/main.tsx](../../src/main.tsx) mountet React; die globale PWA-Komponente registriert den Service Worker.
- [src/components/PwaUpdateNotice.tsx](../../src/components/PwaUpdateNotice.tsx) bindet den Service-Worker-Lebenszyklus an den verständlichen Update-Hinweis.
- [vite.config.ts](../../vite.config.ts) erzeugt Manifest und Workbox-Konfiguration.
- [vercel.json](../../vercel.json) stellt Nicht-API-Deep-Links an die SPA-Shell zu.
- [src/navigation/appNavigation.ts](../../src/navigation/appNavigation.ts) löst Pfade und den PWA-Startmarker auf.
- [api](../../api) enthält same-origin Vercel Functions.
- [src/data/financeCache.ts](../../src/data/financeCache.ts) verwaltet den fachlichen IndexedDB-Snapshot.

Weiterführende Primärquellen: [MDN zu HTTP](https://developer.mozilla.org/docs/Web/HTTP), [MDN zu Service Workern](https://developer.mozilla.org/docs/Web/API/Service_Worker_API), [Web App Manifests](https://developer.mozilla.org/docs/Web/Manifest).

## Fehlerfälle und Grenzen

Installierbarkeit hängt von Browser, HTTPS und Plattform ab. Ein erfolgreich registrierter Service Worker garantiert nicht, dass lokale Daten dauerhaft vorhanden bleiben. API-Aufrufe benötigen Netzwerk und eine gültige Sitzung. Private Browsermodi oder Speicherrestriktionen können IndexedDB und `localStorage` verhindern.

Die automatisierten Chromium-Prüfungen können Manifest, Installierbarkeitsregeln, Worker-Wechsel, Farben und Icon-Pixelverträge beweisen. Sie rendern jedoch nicht den Android-Launcher, Task-Switcher, nativen Installationsdialog oder den tatsächlichen OS-Splash; dafür wäre eine separate Geräte- oder Emulatorabnahme nötig.
