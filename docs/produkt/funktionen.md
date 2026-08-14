# Funktionen und Bedienung

> **Zielgruppe:** Nutzer und Produktinteressierte.
> **Zweck und Lernziel:** Alle aktuell erreichbaren Ansichten und globalen Aktionen sicher unterscheiden.
> **Voraussetzungen:** [Produktüberblick](ueberblick.md)
> **Kanonisch für:** Bedienbare Produktfunktionen.
> **Verwandte Dokumente:** [Abläufe und Zustände](ablaeufe-und-zustaende.md), [Privacy-Modus](../architektur/privacy-modus.md), [Appearance](../architektur/appearance-und-designsystem.md)

## Hauptansichten

Die vier Hauptansichten sind direkt über `/`, `/demnaechst`, `/budget` und `/schulden` adressierbar. Navigation und Browser-/PWA-Zurück/Vorwärts aktualisieren URL und sichtbaren Screen gemeinsam; Reload und Deep Links behalten die adressierte Ansicht.

### Übersicht

Die Übersicht zeigt verfügbare Mittel, die Aufteilung des Monatseinkommens, aktive Konten, zugehörige Pockets, den Datenstand und die nächste planmäßige Entlastung. Detail- und Standarddarstellung lassen sich umschalten. Zunächst erscheinen höchstens fünf Konten und sechs nicht leere Pockets; „Alle zeigen“ legt alle aktiven Einträge einschließlich leerer Pockets offen, ohne Summen zu verändern. Negative Stände und ein überzogenes Budget werden mit Vorzeichen und erklärendem Hinweis dargestellt. Fehlende Konten oder Pockets erhalten einen beschriebenen Leerzustand statt einer leeren Liste. Werte stammen aus dem normalisierten Snapshot, nicht aus live berechneten Google-Zellen.

### Demnächst

Demnächst zeigt den nächsten Gehaltstag, aktive wiederkehrende Budget- und Schuldzahlungen vor diesem Tag, deren chronologische Reihenfolge und den danach sicher verfügbaren Betrag. Monatstage werden für kurze Monate auf den letzten gültigen Kalendertag begrenzt. Zahlungen direkt am Gehaltstag zählen nicht mehr zur offenen Summe davor. Ein Hinweis markiert Fälligkeiten in den sieben Kalendertagen vor dem Gehalt. Verbindliche Formeln stehen in der [Finanz-Domäne](../architektur/finanz-domaene.md).

### Budget

Budget gruppiert aktive Ausgaben nach Notwendigkeit (`essential`, `necessary`, `worthwhile`, `optional`, `unnecessary`) und trennt Ausgaben von Rücklagen. Kennzahlen, Ring- und Balkendarstellungen helfen, Monatsplanung und Einkommensverwendung zu lesen. Eine Überziehung bleibt als negativer Budgetsaldo und tatsächliche Auslastung über 100 Prozent sichtbar; der geometrisch negative Ringanteil wird nicht gezeichnet, aber als Fehlbetrag erklärt. Ohne aktive Budgetpositionen ersetzt ein Leerzustand das Diagramm.

### Schulden

Schulden stellt Ablösesumme, planmäßige Gesamtkosten, daraus abgeleitete Mehrkosten, Gläubiger beziehungsweise Schuldpositionen, Restschuldverlauf und auslaufende Raten dar. Snapshot- und Meilensteindaten werden nicht vermischt. Ohne aktive Schulden zeigt der Screen ausschließlich einen positiven Leerzustand; fehlen bei aktiven Schulden Restschuld- oder Entlastungsmeilensteine, werden die betroffenen Diagramme jeweils durch eine konkrete Erklärung ersetzt.

## Globale Aktionen

- **Aktualisieren:** liest den gespeicherten PostgreSQL-Stand erneut. Automatisch wird außerdem beim Start, bei Rückkehr der Verbindung und beim Sichtbarwerden des Tabs aktualisiert, wenn der letzte erfolgreiche Sync mehr als zehn Minuten zurückliegt. In ausgeblendeten Tabs gibt es kein Polling.
- **Abmelden:** beendet die App-Sitzung und blendet lokale Finanzdaten aus. Der gespeicherte Finanzstand in PostgreSQL und der ownergebundene lokale Finance-Cache bleiben bestehen; erst die erneute verifizierte Anmeldung derselben Identität aktiviert ihn wieder.
- **Darstellung:** System-, Hell- und Dunkelmodus; Browser-/Systemfarbe, kuratierte Presets oder lokal analysiertes Bild. Entwürfe werden erst durch Anwenden dauerhaft.
- **Privacy:** maskiert oder zeigt Geldbeträge; die Einstellung bleibt lokal über Logout hinweg erhalten und wird zwischen Tabs synchronisiert.
- **App-Schutz:** verdeckt Accura optional nach einem Hintergrundwechsel. Eine zusätzliche sechsstellige lokale PIN sperrt außerdem Start und Reload; beide Schalter liegen in den Einstellungen.
- **Begrüßung:** Die Übersicht wählt abhängig von der lokalen Uhr „Guten Morgen“, „Guten Tag“ oder „Guten Abend“ und kombiniert dies mit dem `accura`-Branding.

## Offline-Nutzung

Beim ersten Start ohne vorherigen erfolgreichen Sync gibt es keinen Finanzstand. Nach einem erfolgreichen Sync zeigt ein Offline-Start den Last-known-good-Stand mit sichtbarer Offline-/Veraltet-Markierung. Anmeldung und Aktualisierung benötigen das Netzwerk.

## Implementierung und Tests

- Ansichten: [src/screens](../../src/screens)
- Navigation und Aktionen: [src/App.tsx](../../src/App.tsx), [src/components/SettingsDialog.tsx](../../src/components/SettingsDialog.tsx)
- Begrüßung: [src/lib/timeOfDayGreeting.ts](../../src/lib/timeOfDayGreeting.ts), [src/lib/timeOfDayGreeting.test.ts](../../src/lib/timeOfDayGreeting.test.ts)
- Visuelle Abnahme: [tests/visual/finance-ui.spec.ts](../../tests/visual/finance-ui.spec.ts)
