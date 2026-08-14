# ADR 0014: Google OAuth nur als Identität

> **Zielgruppe:** Backend-, Security- und Authentifizierungsentwickler.
> **Zweck und Lernziel:** Die verbleibende Rolle von Google nach dem Quellenwechsel und die erforderlichen Berechtigungen festlegen.
> **Voraussetzungen:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md), [ADR 0004](0004-single-user-sicherheitsmodell.md)
> **Kanonisch für:** Google OAuth als Identitätsanbieter ohne Picker-, Drive- oder Sheets-Laufzeitzugriff.
> **Verwandte Dokumente:** [ADR 0013](0013-postgresql-als-finanzquelle.md), [Web-Sicherheit und OAuth](../grundlagen/web-sicherheit-und-oauth.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Der implementierte OAuth-Fluss fordert `drive.file`, erzwingt ein Refresh-Token und speichert es verschlüsselt, weil der Server die ausgewählte Tabelle bei jedem Finance-Read erneut lesen muss. Mit PostgreSQL als Finanzquelle entfällt dieser Zweck. Die bestehende verifizierte Google-Anmeldung und die serverseitige E-Mail-Allowlist können für den privaten Betrieb dennoch bestehen bleiben.

## Entscheidung

Google OAuth dient ausschließlich der Authentifizierung. Der Authorization-Code-Fluss mit State, Nonce und PKCE verwendet `openid email profile`. ID-Token-Signatur, Issuer, Audience, Nonce, verifizierte E-Mail und Allowlist werden serverseitig geprüft.

Google `sub` identifiziert die externe Anmeldung und wird eindeutig einem internen `owners.id` zugeordnet. Die signierte Sitzung trägt weiterhin die verifizierte Identität; Finanzzugriffe lösen daraus serverseitig den Owner auf. ADR 0004 bleibt für diesen Schnitt unverändert: Genau eine konfigurierte Identität darf eine Sitzung erhalten.

Picker, `drive.file`, Drive-/Sheets-Laufzeitzugriff, Spreadsheet-Zustände und dauerhaft gespeicherte Refresh-Tokens sind entfernt. Ein beim OAuth-Tausch erhaltenes kurzlebiges Access-Token wird nicht für Finance persistiert.

Der einmalige Import aus ACC-66 ist ein kontrollierter Operator-Pfad außerhalb der normalen Produktnutzung. Er kann eine lokale oder einmalig gelesene Tabellenrepräsentation an den bestehenden `validateFinanceWorkbook()`-Parser übergeben, speichert aber keinen dauerhaften Google-Grant und führt keinen Hintergrundsync ein.

Logout beendet die Sitzung und deaktiviert den lokalen Cache-Owner, löscht aber weder den ownergebundenen Browser-Cache noch PostgreSQL-Finanzdaten. Eine erneute verifizierte Anmeldung derselben Identität kann den Cache wieder zuordnen. Die PIN-Recovery beendet die Sitzung und löscht den lokalen Finance-Cache; Löschung oder Export der serverseitigen Finanzdaten benötigen eine eigene ausdrückliche Aktion.

## Übergang

Diese ADR ist umgesetzt: OAuth fordert nur noch `openid email profile`, Picker und persistierte Refresh-Tokens sind entfernt, `/api/finance` liest PostgreSQL. Der einmalige Import bleibt ein Operator-Pfad.

## Begründung

Die Trennung folgt Least Privilege: Eine Anmeldung benötigt keinen Zugriff auf Drive-Dateien. Sie reduziert gespeicherte Secrets, externe Fehlerfälle und die Reichweite eines kompromittierten Grants. Gleichzeitig vermeidet sie einen vorgezogenen Wechsel des Identitätsanbieters, solange die harte Single-User-Allowlist dem aktuellen Produktumfang entspricht.

## Erwogene Alternativen

`drive.file` vorsorglich zu behalten hätte nach dem Import keinen aktuellen Zweck. Google vollständig zu entfernen würde unnötig gleichzeitig Authentifizierung und Datenquelle umbauen. Ein dauerhafter Import- oder Sync-Grant würde Google Sheets faktisch als zweite Quelle erhalten. Eine offene Google-Anmeldung bleibt durch ADR 0004 ausgeschlossen.

## Konsequenzen

### Positiv

Keine dauerhaften Google-Refresh-Tokens für Finance, keine Picker-Abhängigkeit und deutlich kleinere OAuth-Berechtigung. Identität und Finanzquelle besitzen getrennte Verantwortungen.

### Negativ

Der einmalige Import benötigt einen bewusst betriebenen Pfad. Der spätere Invite-only-Betrieb braucht über die Allowlist hinaus eine vollständige Authentifizierungs- und Isolationsprüfung in ACC-64.

## Implementierung und Tests

- Identitätsfluss: [Google-Client](../../api/_lib/google.ts), [OAuth-Callback](../../api/auth/google/callback.ts)
- Spätere Invite-only-Erweiterung: ACC-64
