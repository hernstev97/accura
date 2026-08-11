# ADR 0004: Single-User-Sicherheitsmodell

> **Zielgruppe:** Security-Reviewer und Betreiber.
> **Zweck und Lernziel:** Harte Single-User-Grenze und ihre Folgen nachvollziehen.
> **Voraussetzungen:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md)
> **Kanonisch für:** Begründung der serverseitigen E-Mail-Allowlist.
> **Verwandte Dokumente:** [Produktüberblick](../produkt/ueberblick.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

`accura` ist eine private App, kein Registrierungs- oder Mandantenprodukt.

## Entscheidung

Genau eine konfigurierte, im Google-ID-Token verifizierte E-Mail darf OAuth abschließen und jede Sitzung verwenden. Callback und authentifizierte Requests prüfen die Allowlist serverseitig.

## Begründung

Dies entspricht dem Produktumfang und vermeidet ein unvollständiges Rollen-/Mandantenmodell.

## Erwogene Alternativen

Offene Google-Anmeldung, Benutzerliste in der UI oder vollständiges Multi-Tenant-Modell. Alle erweitern Risiko und Produktumfang erheblich.

## Konsequenzen

### Positiv

Kleine Zugriffspolitik, einfache Datenzuordnung, keine öffentliche Registrierung.

### Negativ

Kein Teilen, keine zweite Person, E-Mail-Wechsel erfordert Konfigurations- und Verbindungsarbeit; Datenbankschema allein ist keine Mandantengrenze.

## Implementierung und Tests

- Implementierung: [api/auth/google/callback.ts](../../api/auth/google/callback.ts), [api/_lib/http.ts](../../api/_lib/http.ts)
- Tests: [src/server/security.test.ts](../../src/server/security.test.ts), [src/server/config.test.ts](../../src/server/config.test.ts)
