# Eingebettete Schrift: Google Sans Flex

> **Zielgruppe:** Entwickler, Designer und Lizenzprüfer.
> **Zweck und Lernziel:** Herkunft, Einbindung und Lizenz der lokalen Schrift nachvollziehen.
> **Voraussetzungen:** Keine.
> **Kanonisch für:** Schriftquelle und Lizenzhinweis.
> **Verwandte Dokumente:** [Appearance und Designsystem](../architektur/appearance-und-designsystem.md), [OFL-Lizenz](Google-Sans-Flex-OFL.txt)

`accura` bindet Google Sans Flex v22 über das npm-Paket `@fontsource-variable/google-sans-flex` lokal ein. Die benötigten WOFF2-Dateien werden beim Build Teil des Offline-App-Shells; es findet kein Laufzeitabruf von Google Fonts statt. Der CSS-Einstieg liegt in [src/design/googleSansFlex.css](../../src/design/googleSansFlex.css).

Die Schrift steht unter der SIL Open Font License 1.1. Der unveränderte Lizenztext liegt in [Google-Sans-Flex-OFL.txt](Google-Sans-Flex-OFL.txt) und muss bei Weiterverteilung erhalten bleiben. Paketversion und Abhängigkeit sind in [package.json](../../package.json) beziehungsweise [package-lock.json](../../package-lock.json) festgehalten.

Alle sichtbaren Rollen verwenden die vollständig gerundete Achseneinstellung `ROND: 100`; optische Größe bleibt automatisch. Typografische Rollen und Accessibility-Grenzen sind kanonisch unter [Appearance und Designsystem](../architektur/appearance-und-designsystem.md#typografie) beschrieben.
