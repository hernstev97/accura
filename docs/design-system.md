# Interface design system

The interface keeps a compact Material Design 3 composition and uses expressive details only where they carry state or progression. React owns financial and interaction state; CSS owns stable geometry, entrance timing, system-accent fallback, and reduced-motion behavior.

## Typography contract

The application uses the official Google Fonts distribution of Google Sans Flex v22, bundled as full-axis Latin and Latin Extended WOFF2 files for the offline app shell. Source, version, and the retained SIL OFL 1.1 license are documented in [`docs/fonts/`](./fonts/README.md). The application does not use an unofficial “Google Sans Rounded” face: `ROND: 100`, `wdth: 100`, automatic optical sizing, and role-specific weights produce the rounded treatment.

`src/design/tokens.css` owns the screen, section, primary-value, financial-value, label, and supporting-copy roles. The family and variation settings inherit through every route and lazy-loaded screen, while Material Web typeface variables and Recharts text are explicitly mapped to the same source. Tabular lining numerals are the default so all money and date columns remain stable.

## Motion contract

Every destination uses `ScreenEntrance`. A destination is considered visited when its first committed screen mounts. The visited set is stored under `finance-screen-visits-v1` in `sessionStorage`, with an in-memory fallback for blocked storage. A first visit animates only opacity and a `translateY(18px)` transform for meaningful top-level sections: 300 ms emphasized easing with a 36 ms stagger. Immediately visible grouped children use a capped four-item, 32 ms stagger. Revisit, data refresh, theme change, expansion, and chart selection do not claim another entrance. Reduced motion renders the final state without an animation.

Destination switching has no exit transition or layout projection. Expandable surfaces and chart frames use normal document layout without broad layout springs. Direct indicators use a 200 ms emphasized transform and immediately retarget on repeated input.

## Concentric shape contract

Nested surfaces follow one geometric rule:

```text
inner radius = max(0px, outer radius - actual inset distance)
```

The actual inset includes padding and border thickness between visible boundaries. `src/design/tokens.css` exposes the outer role, section, grouped-list, shared-edge, inset, calculated-inner, and pill roles. Components set `--shape-current-outer` and `--shape-current-inset` to their real geometry, then consume the centralized `max()/calc()` relationship. Examples:

| Relationship | Outer | Inset | Inner |
| --- | ---: | ---: | ---: |
| Overview hero → allocation metric | 36 px | 20 px | 16 px |
| Section group → paired metric | 28 px | 8 px | 20 px |
| Pockets section → pocket tile | 28 px | 16 px | 12 px |
| Expanded Pockets → pocket tile | 36 px | 16 px | 20 px |
| Allocation section → reserve row | 28 px | 16 px | 12 px |
| Grouped list → exposed row corners | 26 px | 2 px | 24 px |
| Segmented shell → selected indicator | 28 px | 4 px | 24 px |
| Bottom navigation → selected indicator | 28 px | 7 px | 21 px / pill |

Adjacent grouped rows use `--shape-grouped-list-shared-inner` on shared edges; only the exposed first and last corners use the concentric outer-minus-inset radius.

## Layered allocation-ring contract

`LayeredAllocationRing` receives integer-cent segments and a cent total. The overview uses the canonical selector roles Ausgaben, Rücklagen, and Frei; Budget uses the existing necessity groups plus Frei. Zero segments are omitted only from SVG geometry. Positive source values are normalized only for drawing when their sum and the supplied total differ, preserving source proportions while the textual legend remains authoritative.

All segments share one clockwise circle and input order is the draw order: every later segment rests on top of the previous one. The geometry assigns a small shared overlap at each boundary, then subtracts the visible extension of both round caps from the centerline dash. This produces deliberate capsule layering without random gaps or swollen contiguous-dash intersections. The final share absorbs floating-point residue. Segments below the tiny-share threshold use a narrower rounded capsule and a bounded minimum dash so they remain visible without reading as a major category. A thick neutral tonal track remains underneath in light and dark mode.

The SVG remains mounted when the overview switches between its planned/free summary and detailed three-role state. The native button exposes `aria-pressed`, a localized accessible summary generated from the same cents, and keyboard activation.

## Color and decorative roles

Petrol/teal tokens are deterministic fallbacks. The fallback, resolved source, and public accent roles are separate custom properties so tests can inject a source color without rewriting component styles. No global fixed `accent-color` is declared; native controls use `accent-color: auto`. Inside `@supports (color: AccentColor)`, `AccentColor` and `AccentColorText` become the sources. Containers and state layers are derived with `color-mix()` from the resolved role.

The resolved system accent is limited to focus rings, primary interactive states, navigation and segmented-control indicators, the overview’s selected expense/allocation emphasis, and small expressive highlights. Financial roles remain independent: Frei/positive is green, Rücklagen is tertiary purple, debt/attention remains pink-red, and Budget chart groups retain their category colors.

Unsupported and regular browsers deliberately retain the teal fallback. The real Android wallpaper/system accent must be verified manually in the installed PWA on Chrome 150’s initial Chrome profile; secondary profiles and ordinary browser tabs are not authoritative for that platform behavior.

`Squiggle` is a reusable static, pointer-transparent SVG with horizontal and vertical paths. It is always decorative and `aria-hidden`, uses a 3.5 px rounded semantic stroke, and never loops. The vertical green path connects debt-relief milestones, the directional path reinforces the debt target summary, and one compact horizontal path separates context from the projected value in the next-relief callout. These are compositional progression cues, not card wallpaper.
