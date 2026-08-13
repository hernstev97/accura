# Grundlagen: Datenvalidierung und Speicher

> **Zielgruppe:** Junior-Entwickler und Betreiber.
> **Zweck und Lernziel:** Laufzeitvalidierung sowie Cookie-, Web-Storage- und IndexedDB-Einsatz unterscheiden.
> **Voraussetzungen:** [Web und PWA](web-und-pwa.md), [TypeScript und React](typescript-und-react.md)
> **Kanonisch für:** Allgemeine Validierungs- und Browserspeicherbegriffe.
> **Verwandte Dokumente:** [Finance Data Schema v1](../referenz/finance-data-schema-v1.md), [Synchronisation und Offline](../architektur/synchronisation-und-offline.md)

## Mentales Modell

Jede Systemgrenze liefert zunächst unbekannte Daten: Google Sheets, HTTP-Antworten, `localStorage` und IndexedDB können fehlen, veraltet oder manipuliert sein. TypeScript kann dies zur Laufzeit nicht prüfen. Parser und Zod-Schemas verwandeln unbekannte Werte erst nach erfolgreicher Prüfung in vertrauenswürdig typisierte Daten.

„Normalisieren“ bedeutet, mehrere mögliche Eingabeformen in eine eindeutige interne Form zu überführen. `accura` wandelt Euro-Zahlen etwa in sichere ganzzahlige Cents um und behält Datumswerte als ISO-Strings. „Last-known-good“ bedeutet, dass nur ein vollständig validierter Stand den vorherigen Cache ersetzt.

## Speicherarten

| Speicher | Geeignet für | Lebensdauer/Grenze in accura |
| --- | --- | --- |
| signiertes `HttpOnly`-Cookie | Sitzung | Browser sendet es same-origin; JavaScript kann es nicht lesen; Logout/Disconnect löschen es |
| kurzlebiges OAuth-Cookie | State, Nonce, PKCE-Verifier | etwa zehn Minuten, nur während Anmeldung |
| `localStorage` | kleine Geräteeinstellungen | Appearance, Privacy und versionierter App-Schutz/PIN-Verifier; bleibt bei Logout/Disconnect |
| `sessionStorage` | Tab-Sitzung | besuchte Screens für einmalige Entrance-Motion |
| IndexedDB | strukturierte größere lokale Daten | ein Finance-Snapshot und optional eine reduzierte Wallpaper-Vorschau in getrennten Datenbanken |
| Service-Worker-Cache | statische App-Shell | keine `/api/*`-Antworten |
| PostgreSQL | serverseitige Google-Verbindung | verschlüsseltes Refresh-Token und gewählte Datei, keine Finanzzeilen |

## Grenzen

Browserdaten sind nicht automatisch verschlüsselt und können durch Gerätezugriff, Browserprofile, DevTools oder Schadsoftware zugänglich sein. Browser dürfen lokalen Speicher löschen. Cookies verhindern nicht allein CSRF; dafür braucht es Origin- und Token-Prüfung. Verschlüsselung eines Refresh-Tokens in PostgreSQL schützt nicht den bereits laufenden Serverprozess mit Schlüsselzugriff.

## Implementierung und Tests

- Sheets-Parser: [src/finance/parser.ts](../../src/finance/parser.ts), [Parser-Tests](../../src/finance/parser.test.ts)
- HTTP-Laufzeitprüfung: [src/data/financeApi.ts](../../src/data/financeApi.ts)
- Finance-Cache: [src/data/financeCache.ts](../../src/data/financeCache.ts), [Cache-Tests](../../src/data/financeCache.test.ts)
- Appearance-Store: [src/appearance/appearanceStore.ts](../../src/appearance/appearanceStore.ts)
- Privacy- und App-Schutz-Stores: [src/privacy/privacyStore.ts](../../src/privacy/privacyStore.ts), [src/privacy/appProtectionStore.ts](../../src/privacy/appProtectionStore.ts)

Primärquellen: [MDN IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API), [MDN Web Storage](https://developer.mozilla.org/docs/Web/API/Web_Storage_API), [MDN Cookies](https://developer.mozilla.org/docs/Web/HTTP/Cookies).
