# Grundlagen: Web und PWA

> **Zielgruppe:** Junior-Entwickler und technisch interessierte Betreiber.
> **Zweck und Lernziel:** Browser, Server, HTTP, PWA, Service Worker und Offline-Grenzen einordnen.
> **Voraussetzungen:** Grundlegende Computerkenntnisse.
> **Kanonisch für:** Allgemeine Web- und PWA-Grundbegriffe dieser Dokumentation.
> **Verwandte Dokumente:** [Architekturüberblick](../architektur/ueberblick.md), [Synchronisation und Offline](../architektur/synchronisation-und-offline.md)

## Mentales Modell

Der Browser lädt HTML, CSS und JavaScript vom Server. JavaScript baut daraus die Oberfläche und sendet HTTP-Anfragen an `/api/*`. Diese Endpunkte laufen nicht im Browser, sondern als Vercel Functions. Dadurch können Server-Secrets und Google-Refresh-Token außerhalb des Geräts bleiben.

HTTP ist ein Anfrage-Antwort-Protokoll. Eine Methode wie `GET` liest, `PUT` ersetzt oder setzt eine Ressource und `POST` löst eine Aktion aus. Statuscodes wie 200, 401, 409, 422 und 500 beschreiben das Ergebnis. HTTPS verschlüsselt den Transport, aber nicht automatisch lokale Browserdaten.

## Progressive Web App

Eine Progressive Web App (PWA) ist eine Webanwendung mit Manifest und Service Worker. Das Manifest beschreibt Namen, Icons und Startverhalten. Der Service Worker kann statische App-Dateien zwischenspeichern und einen Offline-Start ermöglichen. In `accura` werden `/api/*`-Anfragen absichtlich mit `NetworkOnly` behandelt: Der Service Worker erfindet keine Finanzantwort und speichert sie nicht in seinem HTTP-Cache.

Der App-Shell-Cache und der fachliche Finance-Cache sind verschiedene Dinge. Erstgenannter hält Code und Gestaltung startfähig; letzterer enthält den separat validierten Last-known-good-Snapshot in IndexedDB.

## Browser-Lebenszyklen

Tabs können in den Hintergrund wechseln, Netzwerkstatus kann ungenau oder verzögert sein, und der Browser darf Speicher unter Druck löschen. Daher ist „offline verfügbar“ eine robuste Komfortfunktion, keine garantierte Sicherung. `visibilitychange`, `online` und `offline` sind Ereignisse, keine unfehlbaren Zustandsquellen.

## Umsetzung in accura

- `index.html` stellt das Root-Element und frühe Theme-Metadaten bereit.
- [src/main.tsx](../../src/main.tsx) registriert den Service Worker und mountet React.
- [vite.config.ts](../../vite.config.ts) erzeugt Manifest und Workbox-Konfiguration.
- [api](../../api) enthält same-origin Vercel Functions.
- [src/data/financeCache.ts](../../src/data/financeCache.ts) verwaltet den fachlichen IndexedDB-Snapshot.

Weiterführende Primärquellen: [MDN zu HTTP](https://developer.mozilla.org/docs/Web/HTTP), [MDN zu Service Workern](https://developer.mozilla.org/docs/Web/API/Service_Worker_API), [Web App Manifests](https://developer.mozilla.org/docs/Web/Manifest).

## Fehlerfälle und Grenzen

Installierbarkeit hängt von Browser, HTTPS und Plattform ab. Ein erfolgreich registrierter Service Worker garantiert nicht, dass lokale Daten dauerhaft vorhanden bleiben. API-Aufrufe benötigen Netzwerk und eine gültige Sitzung. Private Browsermodi oder Speicherrestriktionen können IndexedDB und `localStorage` verhindern.
