# Grundlagen: TypeScript und React

> **Zielgruppe:** Junior-Entwickler.
> **Zweck und Lernziel:** Die in `accura` verwendeten React- und TypeScript-Muster lesen können.
> **Voraussetzungen:** Grundkenntnisse in JavaScript und HTML.
> **Kanonisch für:** Allgemeine TypeScript-, JSX- und React-Begriffe dieser Dokumentation.
> **Verwandte Dokumente:** [Frontend](../architektur/frontend.md), [Quellcode-Karte](../referenz/quellcode-karte.md)

## Mentales Modell

TypeScript ergänzt JavaScript um statisch geprüfte Typen. Diese Typen helfen beim Entwickeln, existieren aber nach dem Build nicht mehr. Daten aus Netzwerk oder Speicher müssen deshalb zusätzlich zur Laufzeit validiert werden.

React beschreibt die Oberfläche als Baum aus Komponenten. JSX ist eine Syntax, mit der HTML-ähnliche Elemente in TypeScript stehen. Eine Komponente erhält **Props** (Eingaben) und kann **State** (veränderlichen lokalen Zustand) halten. Ändert sich State oder Context, berechnet React den betroffenen UI-Baum neu.

## Hooks und Context

- `useState` und `useReducer` halten Zustand; Reducer machen viele explizite Übergänge nachvollziehbar.
- `useEffect` synchronisiert React mit Browserereignissen, Netzwerk oder Speicher. Cleanup beendet Listener und laufende Arbeiten.
- `useMemo`, `useCallback` und `useRef` stabilisieren abgeleitete Werte, Funktionen oder veränderliche Referenzen; sie sind keine fachliche Persistenz.
- Context und Provider stellen Werte für viele Nachfahren bereit, ohne Props durch jede Ebene zu reichen.

`StrictMode` führt in der Entwicklung zusätzliche Prüfzyklen aus. Effekte müssen deshalb bereinigbar und wiederholbar sein. `lazy` verschiebt den Download nicht initialer Screens; `Suspense` zeigt bis dahin einen Fallback. Portals rendern Dialoge an einem geeigneten DOM-Ort, ohne ihre React-Zugehörigkeit zu verlieren.

## Umsetzung in accura

Die Providerreihenfolge lautet Privacy → Appearance → FinanceData. `FinanceDataProvider` verwendet einen Reducer für Sitzungs- und Synczustände, Context für Konsumenten und Effects für Start, Online-Rückkehr und Sichtbarkeit. Selektoren und View-Model bleiben außerhalb Reacts als testbare Funktionen.

Die Übersicht wird direkt importiert; Demnächst, Budget und Schulden werden lazy geladen. Navigation geschieht absichtlich durch lokalen Destination-State und nicht über React Router. Dialoge verwenden gemeinsame Fokus-, Inertheits- und Portalmechanismen.

## Kontrolle und Datenfluss

```text
Props/Context → Komponente → JSX
       ↑             ↓
  State/Reducer ← Ereignis
```

TypeScript verhindert viele interne Formfehler, Zod schützt die Laufzeitgrenzen, und Tests prüfen Verhalten. Keine der drei Ebenen ersetzt die anderen.

## Implementierung und Tests

- Einstieg und Provider: [src/main.tsx](../../src/main.tsx)
- Destination-State und Lazy Loading: [src/App.tsx](../../src/App.tsx)
- Reducer/Effects: [src/data/FinanceDataProvider.tsx](../../src/data/FinanceDataProvider.tsx)
- Dialog-Hook: [src/components/useModalDialog.ts](../../src/components/useModalDialog.ts)

Primärquellen: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html), [React: Describing the UI](https://react.dev/learn/describing-the-ui), [React Hooks](https://react.dev/reference/react/hooks).
