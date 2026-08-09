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

## Appearance and Material You colors

The Appearance domain under `src/appearance/` separates Material color generation, persistence, browser probing, local image processing, DOM application, and React state. It uses the official Apache-2.0 [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities) distribution. HCT, Celebi quantization, Material Color Score, Material Dynamic Colors, and the Tonal Spot, Neutral, Vibrant, Expressive, and Monochrome scheme implementations are used with standard `contrastLevel: 0`; no custom HSL approximation stands in for Material You.

Three sources are available:

- **System** probes the concrete CSS `AccentColor` value supplied to web content and uses it as a Tonal Spot seed. If syntactic support, computed-value resolution, or parsing fails, `#2F667A` is the deliberate fallback.
- **Hintergrundbild** analyzes only an image explicitly selected through the file picker. It cannot and does not read the current Android wallpaper.
- **Andere Farben** provides nine curated Tonal Spot seeds: Petrol, Blau, Indigo, Violett, Rosa, Grün, Bernstein, Koralle, and Neutral.

`AccentColor` is only a progressive enhancement. Chrome may use Android Dynamic Color in browser chrome without exposing the actual wallpaper color to a web page or installed PWA. A concrete computed CSS color therefore means only “the browser supplied an accent”; it is not reliable wallpaper detection. Product copy must never claim “Wallpaper erkannt”, “Android-Systemfarbe erkannt”, or automatic synchronization with the current background.

### Token mapping and cascade

Each palette stores a complete light/dark pair under the versioned `finance-appearance-v1` local-storage key. Invalid, incomplete, future-version, or inaccessible storage falls back safely. A small allowlisted bootstrap in `index.html` restores saved tokens before the React entry point, while CSS retains deterministic light/dark values through `prefers-color-scheme` before JavaScript initializes. After initialization, `<html>` owns the unambiguous state:

```text
data-theme-mode="system|light|dark"
data-theme-resolved="light|dark"
data-color-source="browser|wallpaper|preset"
```

Explicit light/dark always overrides the OS. System mode listens to `prefers-color-scheme`; other tabs synchronize through the `storage` event. The active page token also updates the unscoped `theme-color` meta element, while manifest and media-qualified meta colors remain installation/pre-JavaScript fallbacks.

| App role | Material Dynamic Color role |
| --- | --- |
| `--color-page` | background |
| `--color-container-low` | surface container low |
| `--color-container` | surface container |
| `--color-container-high` | surface container high |
| `--color-surface-bright` | surface bright |
| `--color-on-surface` / `--color-on-surface-variant` | on surface / on surface variant |
| `--color-primary` / `--color-on-primary` | primary / on primary |
| `--color-primary-container` / `--color-on-primary-container` | primary container pair |
| secondary and secondary-container pairs | corresponding secondary roles |
| tertiary and tertiary-container pairs | corresponding tertiary roles |
| outline and outline-variant | corresponding outline roles |
| scrim | scrim |

Public accent aliases remain stable: `--color-system-accent`, its foreground/container/state roles, `--color-selected-indicator`, and `--color-focus-ring` derive from the active Primary/Primary Container pair. `color-mix()` supplies only restrained state/subtle tones. Native form controls use `accent-color: auto`; there is no fixed global `accent-color` that can feed back into the system probe.

Financial semantics never participate in generated token sets. Frei/positive remains green, attention/debt remains pink-red, reserves remain recognizable, and budget/chart categories retain their domain colors in both resolved modes. A theme changes the surrounding Material surfaces, not the meaning of financial data.

### Selected-image processing and local storage

JPEG, PNG, and WebP files up to 20 MB are decoded locally with image orientation, rejected at defensive decoded-dimension limits, and downscaled to at most 192 × 192 analysis pixels. A module worker runs Celebi quantization and Material Color Score, then deduplicates up to three seeds using HCT hue/chroma/tone distance. The best seed produces Tonal Spot, Neutral, Vibrant, Expressive, and Monochrome; sufficiently distinct secondary seeds add up to two Tonal Spot choices, for five to seven candidates total. Generation IDs and abort signals prevent an older analysis or a closed dialog from committing late results.

The original image is neither uploaded nor persisted. A separate `finance-appearance-v1` IndexedDB database may store only a WebP thumbnail under `assets / wallpaper-preview`, at most approximately 480 px on its longest edge and targeted below 250 KB. If IndexedDB is unavailable, the generated theme still works in memory and local storage; only durable image preview is lost. Applying System/Andere Farben or confirming image removal deletes the thumbnail. Draft changes do not delete the active asset before Apply.

### Dialog and swatch contract

The top app bar opens **Einstellungen**, whose Darstellung group opens the independent **Farben** modal. The underlying app is inert; when Farben is stacked above Einstellungen, the settings surface is also inert and hidden from assistive technology. Both dialogs trap focus, close only the top layer on Escape, restore focus to their trigger, prevent body scroll leakage, and keep every interaction target at least 48 px.

The Farben dialog keeps draft mode/source/palette state local. Close, Escape, or scrim discards it; Apply atomically activates the full pair and optional thumbnail. The preview is a private-data-free miniature of this finance app on real draft tokens—not an Android home-screen imitation. Wallpaper imagery remains in a clearly labeled source crop and never becomes the app surface.

Palette choices are a named native radio group. Every 62 px circular swatch uses concrete generated Primary, Secondary, Tertiary, and neutral-container colors in a four-part `conic-gradient`. Selection has both a fixed outer ring and check mark, so color is not the only signal and row geometry does not move. System/Bild/Farben and System/Hell/Dunkel use the same pill-shaped native-radio segmented-control contract at 320 px and wider.

## Decorative roles

`Squiggle` is a reusable static, pointer-transparent SVG with horizontal and vertical paths. It is always decorative and `aria-hidden`, uses a 3.5 px rounded semantic stroke, and never loops. The vertical green path connects debt-relief milestones, the directional path reinforces the debt target summary, and one compact horizontal path separates context from the projected value in the next-relief callout. These are compositional progression cues, not card wallpaper.
