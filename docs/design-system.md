# Interface design system

The interface keeps a compact Material Design 3 composition and uses expressive details only where they carry state or progression. React owns financial and interaction state; CSS owns stable geometry, entrance timing, system-accent fallback, and reduced-motion behavior.

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
| Section group → paired metric | 24 px | 8 px | 16 px |
| Pockets section → pocket tile | 24 px | 16 px | 8 px |
| Expanded Pockets → pocket tile | 32 px | 16 px | 16 px |
| Allocation section → reserve row | 24 px | 16 px | 8 px |
| Grouped list → exposed row corners | 24 px | 2 px | 22 px |
| Segmented shell → selected indicator | 26 px | 4 px | 22 px |
| Bottom navigation → selected indicator | 24 px | 7 px | 17 px / pill |

Adjacent grouped rows use `--shape-grouped-list-shared-inner` on shared edges; only the exposed first and last corners use the concentric outer-minus-inset radius.

## Circular allocation contract

`CircularAllocation` receives integer-cent segments and a cent total. The overview uses the canonical selector roles Ausgaben, Rücklagen, and Frei; Budget uses the existing necessity groups plus Frei. Zero segments are omitted only from SVG geometry. Segment starts are calculated from cumulative cents, while the final visible segment absorbs harmless floating rendering residue. A tonal track remains behind the rounded arcs, and gaps are intentional rather than percentage-rounding artifacts.

The SVG remains mounted when the overview switches between its planned/free summary and detailed three-role state. The native button exposes `aria-pressed`, a localized accessible summary generated from the same cents, and keyboard activation.

## Color and decorative roles

Petrol/teal tokens are deterministic fallbacks. When CSS system colors are supported, `AccentColor` and `AccentColorText` feed the app accent, selected indicator, focus ring, and subtle mixed containers. Financial roles remain independent: Frei/positive is green, Rücklagen is tertiary purple, debt/attention remains pink-red, and Budget chart groups retain their category colors.

`Squiggle` is a static, pointer-transparent, `currentColor` SVG. It is always decorative and `aria-hidden`; opacity stays between 10% and 14% in the two progression placements.
