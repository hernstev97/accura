# Funktionen und Bedienung

> **Zielgruppe:** Nutzer und Produktinteressierte.
> **Zweck und Lernziel:** Alle aktuell erreichbaren Ansichten und globalen Aktionen sicher unterscheiden.
> **Voraussetzungen:** [Produktüberblick](ueberblick.md)
> **Kanonisch für:** Bedienbare Produktfunktionen.
> **Verwandte Dokumente:** [Abläufe und Zustände](ablaeufe-und-zustaende.md), [Privacy-Modus](../architektur/privacy-modus.md), [Appearance](../architektur/appearance-und-designsystem.md)

## Hauptansichten

Die vier Hauptansichten sind direkt über `/`, `/demnaechst`, `/budget` und `/schulden` adressierbar. Navigation und Browser-/PWA-Zurück/Vorwärts aktualisieren URL und sichtbaren Screen gemeinsam; Reload und Deep Links behalten die adressierte Ansicht.

### Übersicht

Die Übersicht zeigt verfügbare Mittel, die Aufteilung des Monatseinkommens, aktive Konten, zugehörige Pockets, den Datenstand und die nächste planmäßige Entlastung. Detail- und Standarddarstellung lassen sich umschalten. Werte stammen aus dem normalisierten Snapshot, nicht aus live berechneten Google-Zellen.

### Demnächst

Demnächst zeigt den nächsten Gehaltstag, aktive wiederkehrende Budget- und Schuldzahlungen vor diesem Tag, deren chronologische Reihenfolge und den danach sicher verfügbaren Betrag. Monatstage werden für kurze Monate auf den letzten gültigen Kalendertag begrenzt. Zahlungen direkt am Gehaltstag zählen nicht mehr zur offenen Summe davor. Ein Hinweis markiert Fälligkeiten in den sieben Kalendertagen vor dem Gehalt. Verbindliche Formeln stehen in der [Finanz-Domäne](../architektur/finanz-domaene.md).

### Budget

Budget gruppiert aktive Ausgaben nach Notwendigkeit (`essential`, `necessary`, `worthwhile`, `optional`, `unnecessary`) und trennt Ausgaben von Rücklagen. Kennzahlen, Ring- und Balkendarstellungen helfen, Monatsplanung und Einkommensverwendung zu lesen.

### Schulden

Schulden stellt Ablösesumme, planmäßige Gesamtkosten, daraus abgeleitete Mehrkosten, Gläubiger beziehungsweise Schuldpositionen, Restschuldverlauf und auslaufende Raten dar. Snapshot- und Meilensteindaten werden nicht vermischt.

## Globale Aktionen

- **Aktualisieren:** liest die gewählte Tabelle erneut. Automatisch wird außerdem beim Start, nach einer Auswahl, bei Rückkehr der Verbindung und nach mehr als zehn Minuten im Hintergrund aktualisiert.
- **Tabelle wechseln:** öffnet Google Picker für genau eine Google-Sheets-Datei; gespeichert wird sie erst nach Drive- und Schemaprüfung.
- **Abmelden:** beendet die App-Sitzung. Google-Verbindung, ausgewählte Tabelle und lokaler Finance-Cache bleiben bestehen.
- **Google-Verbindung trennen:** versucht den Google-Grant zu widerrufen, löscht die Postgres-Verbindung, beendet die Sitzung und entfernt den Finance-Cache auf diesem Gerät.
- **Darstellung:** System-, Hell- und Dunkelmodus; Browser-/Systemfarbe, kuratierte Presets oder lokal analysiertes Bild. Entwürfe werden erst durch Anwenden dauerhaft.
- **Privacy:** maskiert oder zeigt Geldbeträge; die Einstellung bleibt lokal über Logout und Disconnect hinweg erhalten und wird zwischen Tabs synchronisiert.
- **Begrüßung:** Die Übersicht wählt abhängig von der lokalen Uhr „Guten Morgen“, „Guten Tag“ oder „Guten Abend“ und kombiniert dies mit dem `accura`-Branding.

## Offline-Nutzung

Beim ersten Start ohne vorherigen erfolgreichen Sync gibt es keinen Finanzstand. Nach einem erfolgreichen Sync zeigt ein Offline-Start den Last-known-good-Stand mit sichtbarer Offline-/Veraltet-Markierung. Anmeldung, Picker und Aktualisierung benötigen das Netzwerk.

## Implementierung und Tests

- Ansichten: [src/screens](../../src/screens)
- Navigation und Aktionen: [src/App.tsx](../../src/App.tsx), [src/components/SettingsDialog.tsx](../../src/components/SettingsDialog.tsx)
- Begrüßung: [src/lib/timeOfDayGreeting.ts](../../src/lib/timeOfDayGreeting.ts), [src/lib/timeOfDayGreeting.test.ts](../../src/lib/timeOfDayGreeting.test.ts)
- Visuelle Abnahme: [tests/visual/finance-ui.spec.ts](../../tests/visual/finance-ui.spec.ts)
