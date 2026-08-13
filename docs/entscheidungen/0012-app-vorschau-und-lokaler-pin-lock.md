# ADR 0012: App-Vorschau und lokaler PIN-Lock

> **Zielgruppe:** Produkt-, Frontend- und Security-Entwickler.
> **Zweck und Lernziel:** Lifecycle-Sichtschutz, lokale PIN-Prüfung und Recovery-Grenze begründen.
> **Voraussetzungen:** [Privacy-Modus und App-Schutz](../architektur/privacy-modus.md)
> **Kanonisch für:** Begründung des optionalen App-Vorschau-Schutzes und PIN-Locks.
> **Verwandte Dokumente:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Finanzdaten können in der Betriebssystem-App-Vorschau oder unmittelbar nach der Rückkehr aus dem Hintergrund sichtbar werden. Nutzer sollen diesen Übergang optional verdecken und den erneuten Zugriff auf Wunsch mit einer PIN erschweren können, ohne dass eine Online-Anmeldung für jeden normalen Unlock nötig wird.

## Entscheidung

Accura bietet zwei standardmäßig deaktivierte Einstellungen: einen Lifecycle-gesteuerten App-Vorschau-Schutz und einen darauf aufbauenden sechsstelligen PIN-Lock. `visibilitychange` zu `hidden` und `pagehide` verdecken die App synchron; der reine Sichtschutz verlangt eine bewusste Freigabe. Ein PIN sperrt zusätzlich Kaltstart und Reload.

Gespeichert wird ausschließlich ein versionierter PBKDF2-HMAC-SHA-256-Verifier mit zufälligem Salt, 600.000 Iterationen, Fehlversuchszähler und exponentieller Sperrfrist. PIN und Finance-Daten werden nicht gemeinsam verschlüsselt. Eine vergessene PIN kann nur online zurückgesetzt werden: vorhandene Google-Verbindung und Sitzung werden bereinigt, der lokale Finance-Cache wird gelöscht und erst danach fällt die lokale Sperre. Die Google-Sheets-Datei wird nicht verändert.

Der Lockscreen verwendet eine einzelne flächige Theme-Hintergrundfarbe ohne Logo und eine Android-orientierte Ziffernanordnung. Noch nicht eingegebene PIN-Stellen bleiben unsichtbar. Neue Stellen erscheinen aus der Mitte als zufällige Material-3-Expressive-Formen der MIT-lizenzierten Bibliothek [`shape-morph`](https://github.com/Thereallo1026/shape-morph), morphen kurz zum Kreis und enden bei 16 × 16 Pixeln; Reduced Motion und Forced Colors besitzen explizite Fallbacks.

## Begründung

Die Trennung lässt Nutzer zwischen schneller Hintergrundabdeckung und einer stärkeren lokalen Zugriffshürde wählen. Frühe Dokumentattribute vermeiden einen sichtbaren Daten-Flash. Ein abgeleiteter Verifier verhindert Klartext-PINs; persistierte Wartezeiten erschweren triviales Durchprobieren. Die Recovery-Reihenfolge verhindert, dass das Entfernen der Sperre einen weiterhin lokal verfügbaren Finance-Snapshot offenlegt.

## Erwogene Alternativen

Erwogen wurden ein verpflichtender PIN, biometrische WebAuthn-Anmeldung, Verschlüsselung des gesamten Finance-Caches, ausschließliches CSS-Blur und ein Offline-Reset ohne Datenlöschung. Sie verändern Onboarding, Schlüsselverwaltung oder Sicherheitsmodell deutlich beziehungsweise würden Daten weiterhin zugänglich machen. Native Android-Screenshot-Flags sind für die installierbare Web-PWA nicht verlässlich verfügbar.

## Konsequenzen

### Positiv

Optionaler Schutz ohne Server-Roundtrip beim normalen Entsperren, konsistente Theme-/Accessibility-Ausgabe, kein Klartext-PIN und fail-closed Recovery.

### Negativ

Best-effort-App-Switcher-Schutz statt Betriebssystemgarantie; keine Verschlüsselung oder Geräteeigentümerprüfung. Browserdatenlöschung entfernt die Sperre zusammen mit lokalen Daten. PBKDF2 verursacht bewusst messbare Rechenzeit bei Einrichtung und Prüfung.

## Implementierung und Tests

- Implementierung: [src/privacy/appProtectionStore.ts](../../src/privacy/appProtectionStore.ts), [src/privacy/PrivacyProvider.tsx](../../src/privacy/PrivacyProvider.tsx), [src/components/AppLockScreen.tsx](../../src/components/AppLockScreen.tsx), [src/components/PinManagementDialog.tsx](../../src/components/PinManagementDialog.tsx), [src/data/FinanceDataProvider.tsx](../../src/data/FinanceDataProvider.tsx)
- Tests: [src/privacy/appProtectionStore.test.ts](../../src/privacy/appProtectionStore.test.ts), [src/components/PinPad.test.tsx](../../src/components/PinPad.test.tsx), [tests/visual/finance-ui.spec.ts](../../tests/visual/finance-ui.spec.ts), [scripts/browser-smoke.mjs](../../scripts/browser-smoke.mjs)
