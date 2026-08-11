# Privacy-Modus

> **Zielgruppe:** Nutzer, Accessibility- und Frontend-Entwickler.
> **Zweck und Lernziel:** Wirkung, Persistenz und bewusste Sicherheitsgrenze des Privacy-Modus korrekt erklären.
> **Voraussetzungen:** [Produktüberblick](../produkt/ueberblick.md)
> **Kanonisch für:** Lokale Privacy-Maskierung, Speicherformat und Tab-Synchronisierung.
> **Verwandte Dokumente:** [Frontend](frontend.md), [Synchronisation und Offline](synchronisation-und-offline.md), [ADR 0011](../entscheidungen/0011-lokaler-privacy-modus.md)

## Mentales Modell

Privacy ist ein schneller Sichtschutz gegen Shoulder Surfing, also beiläufiges Mitlesen. Der Umschalter lässt Geldwerte unkenntlich erscheinen und ersetzt zugängliche Geldtexte durch eine neutrale Beschreibung. Die zugrunde liegenden React-Daten bleiben unverändert.

## Umsetzung

Vor dem ersten Render liest `initializePrivacyBeforeRender()` den String `true` aus `localStorage` unter `finance-privacy-v1` und setzt `data-privacy-mode="true"` am Dokument. `PrivacyProvider` stellt `isPrivacyMode`, `togglePrivacy` und `setPrivacyMode` per Context bereit. Ein `storage`-Listener übernimmt Änderungen anderer Tabs desselben Origins. Speicherfehler fallen sicher auf „aus“ beziehungsweise rein flüchtigen Zustand zurück.

`MoneyValue` kontrolliert sichtbare Darstellung und Accessibility-Text. CSS reagiert auf das Dokumentattribut. Die Einstellung ist geräte-/browserprofilbezogen, unabhängig von der Google-Sitzung und bleibt bei Logout sowie Disconnect erhalten.

## Sicherheitsgrenze

Der Modus:

- maskiert sichtbare Geldbeträge und deren Accessibility-Texte;
- reduziert beiläufiges Mitlesen;
- verschlüsselt weder JavaScript-Arbeitsspeicher noch DOM-/React-Daten, IndexedDB, Netzwerkantworten oder Screenshots aus einem unmaskierten Zustand;
- versteckt nicht automatisch alle indirekten Finanzinformationen wie Namen, Diagrammformen oder Kategorien;
- ersetzt weder Gerätesperre, Browserprofil-Trennung noch Betriebssystemschutz.

## Fehlerfälle und Accessibility

Blockiertes `localStorage` verhindert dauerhafte oder tabübergreifende Einstellung, nicht die aktuelle UI-Aktion. Eine Maskierung darf Screenreadern nicht weiterhin den Betrag vorlesen; darum muss jeder neue Geldwert die gemeinsame `MoneyValue`-Abstraktion verwenden. Reine CSS-Unschärfe ohne zugängliche Textanpassung wäre unzureichend.

## Begründung und Nachweis

Siehe [ADR 0011](../entscheidungen/0011-lokaler-privacy-modus.md).

- Implementierung: [src/privacy/PrivacyProvider.tsx](../../src/privacy/PrivacyProvider.tsx), [src/privacy/privacyStore.ts](../../src/privacy/privacyStore.ts), [src/components/MoneyValue.tsx](../../src/components/MoneyValue.tsx), [src/components/PrivacyToggle.tsx](../../src/components/PrivacyToggle.tsx)
- Tests: [src/privacy/privacy.test.tsx](../../src/privacy/privacy.test.tsx), [src/branding.test.ts](../../src/branding.test.ts)
