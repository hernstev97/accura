# ADR 0011: Lokaler Privacy-Modus

> **Zielgruppe:** Produkt-, Frontend- und Security-Entwickler.
> **Zweck und Lernziel:** Visuelle Privacy-Wirkung und bewusste Grenze begründen.
> **Voraussetzungen:** [Privacy-Modus](../architektur/privacy-modus.md)
> **Kanonisch für:** Begründung des lokalen Sichtschutzes.
> **Verwandte Dokumente:** [Produktüberblick](../produkt/ueberblick.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Geldbeträge sollen in gemeinsam genutzten oder einsehbaren Umgebungen schnell gegen beiläufiges Mitlesen geschützt werden, ohne Sitzung oder Daten zu verändern.

## Entscheidung

Ein lokaler Umschalter maskiert Geldwerte in sichtbarer UI und Accessibility-Text. Die boolesche Einstellung liegt als String unter `finance-privacy-v1` in `localStorage`, synchronisiert Tabs und bleibt bei Logout.

## Begründung

Die Aktion ist sofort, offlinefähig und unabhängig von Google. Die gemeinsame Geldkomponente hält visuelle und zugängliche Ausgabe konsistent.

## Erwogene Alternativen

Nur CSS-Blur, automatische Maskierung bei Inaktivität, Session-Persistenz oder Verschlüsselung des Finance-Caches. CSS allein leakt Accessibility-Text; die übrigen Optionen sind andere Produkt-/Sicherheitsaufgaben.

## Konsequenzen

### Positiv

Schneller Shoulder-Surfing-Schutz, geringe Komplexität, Cross-Tab-Konsistenz.

### Negativ

Keine Verschlüsselung; Namen, Formen und Speicher bleiben potenziell informativ. Neue Geldausgaben müssen `MoneyValue` nutzen.

## Implementierung und Tests

- Implementierung: [src/privacy/PrivacyProvider.tsx](../../src/privacy/PrivacyProvider.tsx), [src/components/MoneyValue.tsx](../../src/components/MoneyValue.tsx)
- Tests: [src/privacy/privacy.test.tsx](../../src/privacy/privacy.test.tsx)
