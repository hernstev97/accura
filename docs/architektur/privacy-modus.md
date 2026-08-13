# Privacy-Modus und App-Schutz

> **Zielgruppe:** Nutzer, Accessibility-, Frontend- und Security-Entwickler.
> **Zweck und Lernziel:** Wirkung, Persistenz und bewusste Sicherheitsgrenzen der lokalen Sichtschutzfunktionen korrekt erklären.
> **Voraussetzungen:** [Produktüberblick](../produkt/ueberblick.md)
> **Kanonisch für:** Geldmaskierung, App-Vorschau-Schutz, lokaler PIN-Lock und Tab-Synchronisierung.
> **Verwandte Dokumente:** [Frontend](frontend.md), [Synchronisation und Offline](synchronisation-und-offline.md), [ADR 0011](../entscheidungen/0011-lokaler-privacy-modus.md), [ADR 0012](../entscheidungen/0012-app-vorschau-und-lokaler-pin-lock.md)

## Mentales Modell

Accura trennt drei lokale Schutzebenen:

- **Privacy-Modus:** maskiert Geldbeträge in der laufenden App gegen beiläufiges Mitlesen.
- **App-Vorschau schützen:** verdeckt die gesamte App nach `visibilitychange` zu `hidden` oder `pagehide`; nach der Rückkehr muss der Nutzer die Inhalte bewusst wieder anzeigen.
- **Mit PIN entsperren:** erweitert den App-Vorschau-Schutz um eine sechsstellige lokale PIN und sperrt zusätzlich jeden Kaltstart und Reload.

Beide App-Schutz-Schalter liegen unter **Einstellungen → App-Schutz** und sind standardmäßig aus. Ein eingerichteter PIN-Lock hält den App-Vorschau-Schutz zwingend aktiv. Der manuelle Privacy-Modus bleibt davon unabhängig: Nach dem Entsperren gilt wieder genau dessen vorheriger Zustand.

## Umsetzung und Lebenszyklus

Vor dem ersten React-Render lesen `index.html` und `src/main.tsx` die validierten lokalen Präferenzen. Bei einem PIN oder beschädigten App-Schutz-Daten wird `data-app-covered="true"` synchron gesetzt; CSS verbirgt die App-Shell, bevor vertrauliche Inhalte aufblitzen können. `PrivacyProvider` koordiniert Dokumentattribute, Lifecycle-Ereignisse und Tab-Synchronisierung. Eine neue oder geänderte PIN sperrt andere Tabs sofort; ein Recovery-Reset lädt sie neu, damit kein alter Finance-Zustand im Arbeitsspeicher offenbleibt. Während der Sperre ist die App-Shell unsichtbar, `inert` und `aria-hidden`; nur der modale Lockscreen bleibt fokussierbar.

Der Lockscreen übernimmt eine einzelne flächige Hintergrundfarbe und alle weiteren Rollen aus dem aktiven Theme; er verwendet weder Verlauf noch Logo. Seine Anordnung orientiert sich an einem Android-PIN-Screen. Vor der Eingabe sind keine leeren PIN-Slots sichtbar. Jede eingegebene Ziffer erscheint aus der Mitte kurz als zufällig ausgewählte Material-3-Expressive-Form aus [`shape-morph`](https://github.com/Thereallo1026/shape-morph), morpht klar zum Kreis und landet bei 16 × 16 Pixeln. Reduced Motion zeigt den Kreis ohne Eingangsanimation; Forced Colors erhält sichtbare Begrenzungen und native Kontraste.

Der bestehende Privacy-Modus liegt als String unter `finance-privacy-v1`. Der versionierte App-Schutz liegt unter `finance-app-protection-v1` und enthält nur Schalter, PIN-Verifier, Fehlversuchszähler und Sperrfrist. Die PIN selbst wird nie gespeichert: Web Crypto leitet mit PBKDF2-HMAC-SHA-256, zufälligem 128-Bit-Salt und 600.000 Iterationen einen 256-Bit-Verifier ab. Nach fünf Fehlversuchen beginnt eine persistierte, exponentiell steigende Wartezeit von 30 Sekunden bis höchstens 15 Minuten.

## Vergessene PIN

Der Reset bleibt ohne Netzwerk bewusst gesperrt. Online wird eine vorhandene Google-Verbindung serverseitig getrennt, die Sitzung zurückgesetzt und der lokale Finance-Cache gelöscht; erst danach entfernt Accura PIN und App-Schutz. Die Google-Sheets-Datei selbst bleibt unverändert. Schlägt ein Schritt fehl, bleibt die Sperre aktiv. Als äußerste lokale Alternative kann der Nutzer sämtliche Accura-Sitedaten über Browser- oder Android-Einstellungen löschen.

## Sicherheitsgrenze

Die Funktionen reduzieren Shoulder Surfing und verdecken die App beim Hintergrundwechsel best effort. Eine Web-PWA kann jedoch kein natives Android-`FLAG_SECURE` setzen und deshalb weder Betriebssystem-Screenshots noch die Darstellung im App-Switcher auf jedem Gerät und Browser garantieren.

Der lokale PIN ist eine Zugriffshürde innerhalb desselben Browserprofils, keine Verschlüsselung. Er schützt weder JavaScript-Arbeitsspeicher, DOM-/React-Daten, IndexedDB, Netzwerkantworten noch ein bereits kompromittiertes Gerät. Nutzer mit DevTools-, Dateisystem- oder Profilzugriff können lokale Daten lesen oder löschen. App-Schutz und Privacy ersetzen daher weder Gerätesperre, getrennte Browserprofile noch Betriebssystemschutz.

## Fehlerfälle und Accessibility

Beschädigte App-Schutz-Daten fallen geschlossen auf den Recovery-Screen zurück. Kann eine Schutzänderung oder ein Fehlversuch nicht dauerhaft gespeichert werden, wird nicht entsperrt. Blockiertes `localStorage` verhindert die PIN-Einrichtung. Screenreader erhalten PIN-Länge und Fehlerstatus, niemals die eingegebenen Ziffern; die numerischen Tasten bleiben echte Buttons und die Eingabe ist zusätzlich per Tastatur bedienbar.

Bei der Geldmaskierung kontrolliert `MoneyValue` sichtbare Darstellung und Accessibility-Text gemeinsam. Neue Geldausgaben müssen diese Abstraktion verwenden; reine CSS-Unschärfe würde zugängliche Texte weiter preisgeben.

## Begründung und Nachweis

Siehe [ADR 0011](../entscheidungen/0011-lokaler-privacy-modus.md) und [ADR 0012](../entscheidungen/0012-app-vorschau-und-lokaler-pin-lock.md).

- Implementierung: [src/privacy/PrivacyProvider.tsx](../../src/privacy/PrivacyProvider.tsx), [src/privacy/privacyStore.ts](../../src/privacy/privacyStore.ts), [src/privacy/appProtectionStore.ts](../../src/privacy/appProtectionStore.ts), [src/components/AppLockScreen.tsx](../../src/components/AppLockScreen.tsx), [src/components/PinManagementDialog.tsx](../../src/components/PinManagementDialog.tsx), [src/components/MoneyValue.tsx](../../src/components/MoneyValue.tsx)
- Tests: [src/privacy/privacy.test.tsx](../../src/privacy/privacy.test.tsx), [src/privacy/appProtectionStore.test.ts](../../src/privacy/appProtectionStore.test.ts), [src/privacy/expressivePinShapes.test.ts](../../src/privacy/expressivePinShapes.test.ts), [tests/visual/finance-ui.spec.ts](../../tests/visual/finance-ui.spec.ts), [scripts/browser-smoke.mjs](../../scripts/browser-smoke.mjs)
