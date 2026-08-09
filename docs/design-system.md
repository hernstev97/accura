# Interface design system

ACC-2 defines one calm-expressive Material 3 grammar for the complete finance PWA. Expression is reserved for the primary amount, progress, semantic notices, selection, and the next useful action. Supporting copy, lists, metadata, and ordinary surfaces stay deliberately quiet. React owns finance and interaction state; CSS owns role geometry, typography, color, motion, safe areas, and adaptive presentation.

The UI is implemented with native React, HTML, CSS, and Recharts primitives. `@material/web` is not part of the client: there is no second component theme or hidden typography system to keep in sync.

## Source and ownership contract

`src/styles.css` is only an ordered import manifest:

| File | Responsibility |
| --- | --- |
| `styles/base.css` | reset, local typeface, focus, scrolling, and document defaults |
| `styles/shell.css` | top bar, sync banner, Bottom Navigation, and Navigation Rail |
| `styles/primitives.css` | buttons, heroes, metrics, sections, lists, notices, charts, and dialogs |
| `styles/screens.css` | screen composition only; no new token values |
| `styles/states.css` | connection, loading, setup, offline, and error states |
| `styles/responsive.css` | breakpoints, container queries, safe areas, Reduced Motion, and Forced Colors |

Shared React roles are `ScreenHeader`, `FinancialHero`, `AllocationLegend`, `MetricGrid`/`MetricCard`, `SurfaceSection`, `DataList`/`DataListItem`, `InlineNotice`, `AppButton`, `AdaptiveNavigation`, `AdaptiveDialog`, `FinanceChartTooltip`, and `LoadingIndicator`. Overview, Budget, and Debt compose these roles; they do not create screen-local card dialects.

## Typography contract

The application uses the official Google Fonts distribution of Google Sans Flex v22, bundled as full-axis Latin and Latin Extended WOFF2 files for the offline app shell. Source, version, and the retained SIL OFL 1.1 license are documented in [`docs/fonts/`](./fonts/README.md). Optical sizing stays automatic. Every visible type role uses the fully rounded `ROND: 100` cut; role hierarchy continues to come from size, weight, width, color, and spacing.

| Role | Size / line height | Weight | `ROND` / `wdth` | Use |
| --- | --- | ---: | --- | --- |
| Screen title | `clamp(32px, 7vw, 40px) / 1.05` | 720 | 100 / 100 | destination and central state titles |
| Hero numeral | `clamp(32px, 10cqi, 48px) / 1` | 690 | 100 / 96 | one primary finance amount per screen |
| Section title | `22px / 28px` | 680 | 100 / 100 | content sections |
| Component title | `16px / 22px` | 650 | 100 / 100 | cards and list rows |
| Body | `14px / 20px` | 450 | 100 / 100 | explanatory copy |
| Label | `12px / 16px` | 620 | 100 / 100 | fields and statuses |
| Compact chart | `11px / 16px` | 560 | 100 / 100 | chart helpers only |
| Metric numeral | `20–24px / 1.1` | 660 | 100 / 98 | secondary finance values |

Visible product information never renders below 12 px. Currency values use tabular lining numerals, never ellipsis, and never wrap. Hero and metric numerals use container-relative clamps so 320 px reflow remains complete.

## Color and elevation contract

Petrol/teal `#2F667A` remains the deterministic product fallback. The active system/browser palette drives focus, primary actions, selected navigation, and segmented selection. It never replaces financial semantics: positive/free is green, reserves are tertiary violet, and debt/attention is pink-red. Semantic hero tones share the same saturation and geometry contracts.

Normal content surfaces use tonal elevation (`page`, `container-low`, `container`, `container-high`, and `surface-bright`). Shadows are restricted to adaptive navigation and modal surfaces. Dark mode does not use pure-black content surfaces. Static token pairs target 4.5:1 for normal text and 3:1 for large text and non-text UI.

## Spacing and shape contract

The layout uses a 4 px grid. Compact screen inset is 16 px, medium is 24 px, and expanded is 32 px. Main-section gaps are 24 px compact and 32 px from 600 px. Surface padding is 20 px compact and 24 px from 600 px. List rows are at least 64 px (72 px when supporting copy is present); actions are at least 48 px and central state actions are 56 px.

Nested surfaces follow one geometric rule:

```text
inner radius = max(0px, outer radius - actual inset distance)
```

The actual inset includes padding and border thickness between visible boundaries. Canonical outer roles are Hero 36 px, Section 28 px, nested card 20 px, and grouped list 24 px with 6 px shared edges. Components set `--shape-current-outer` and `--shape-current-inset` before consuming the centralized `max()/calc()` relationship.

| Relationship | Outer | Inset | Inner |
| --- | ---: | ---: | ---: |
| Financial Hero → allocation legend item | 36 px | 20 px | 16 px |
| Metric grid → Metric Card | 28 px | 8 px | 20 px |
| Pockets section → pocket tile, compact | 28 px | 20 px | 8 px |
| Expanded Pockets → pocket tile, compact | 36 px | 20 px | 16 px |
| Chart section → debt milestone group, compact | 28 px | 20 px | 8 px |
| Grouped list → exposed row corners | 24 px | 2 px | 22 px |
| Segmented shell → selected indicator | 28 px | 4 px | 24 px |
| Bottom Navigation → selected indicator | 28 px | 8 px | 20 px |

Adjacent grouped rows use 6 px corners on shared edges. The asymmetric contextual shape is reserved for positive/progressive notices and marks.

## Motion contract

Effects use 120 ms fast, 180 ms default, and 240 ms slow durations with `cubic-bezier(0.2, 0, 0, 1)`. Spatial indicator movement uses the bounded spatial easing tokens; color, opacity, and scrims never overshoot.

Every destination uses `ScreenEntrance`. A destination is considered visited when its first committed screen mounts. The visited set is stored under `finance-screen-visits-v1` in `sessionStorage`, with an in-memory fallback for blocked storage. A first visit animates opacity and `translateY(12px)` for at most four top-level children over 260 ms with a 28 ms stagger. Revisit, data refresh, theme change, expansion, and chart selection do not replay the entrance. There is no exit transition, broad layout projection, or animated finance numeral.

With `prefers-reduced-motion: reduce`, translation, stagger, indicator movement, chart motion, and shape morphing render immediately in their final state.

## Adaptive layout contract

- Below 600 px, a safe-area-aware sticky top bar and sync banner lead a single-column flow. One fixed Bottom Navigation occupies the bottom edge; document scroll padding keeps focused and final content above it.
- From 600–839 px, the same reading order and Bottom Navigation remain. The content lane grows to at most 760 px and grids may add columns.
- From 840 px, `.app-content--connected` is a 96 px Navigation Rail plus one main column. The same single `nav` element becomes sticky inside the app canvas; no duplicate navigation landmark exists. The app canvas is at most 1120 px and the content lane at most 880 px.
- From 1200 px, heroes, legends, metrics, and lists may widen without introducing a separate dashboard information architecture or masonry ordering.

The semantic DOM order is identical at every breakpoint. The browser smoke matrix covers 320, 360, 412, 768, 840, and 1440 px.

## Shared finance-screen contract

All three destinations use this top-level rhythm: `ScreenHeader` → `FinancialHero` → `MetricGrid` → ordered content sections. The hero always owns exactly one primary amount, the same geometry and numeral role, a contextual visual, and a 48 px follow-up action zone.

| Role | Overview | Budget | Debt |
| --- | --- | --- | --- |
| Primary amount | free money | monthly income | payoff today |
| Hero tone | positive | accent | attention |
| Visual | interactive allocation ring | static allocation ring | debt target status |
| Metrics | current cash, planned reserves | reserves, free | scheduled total, future cost |
| Follow-up | toggle allocation | choose chart view | open debt progress |

Overview and Budget share `AllocationLegend`. Accounts and creditors share `DataList`. Budget and both debt charts share `ChartFrame`/`SurfaceSection` and `FinanceChartTooltip`.

## Global state and dialog contract

`SyncStatusBanner` has one stable location and one targeted live region across all destinations. Healthy/syncing is low-priority tonal UI; stale, offline, reconnect, and validation use warning or danger tokens. Refresh remains a 48 px action, and linked details stay within the banner.

`ConnectionStateLayout` owns signed-out, no-spreadsheet, disconnected, reconnect, validation, offline-without-cache, loading, and picker-validation composition. Tone and content vary; width, mark, title, copy, and the 56 px action zone do not. `ValidationIssues` is a grouped disclosure whose readable copy is at least 12 px.

`AdaptiveDialog` uses native `<dialog>`/`showModal()`. It is a bottom sheet below 600 px and a centered surface above it; the color editor uses the same basis with a fullscreen compact presentation. The app background is inert, body scrolling is locked, Escape and scrim close only the topmost layer, and focus returns to the exact trigger. Disconnect confirmation stays in the Information dialog with tonal cancel and destructive confirmation actions.

## Layered allocation-ring contract

`LayeredAllocationRing` receives integer-cent segments and a cent total. The overview uses the canonical selector roles Ausgaben, Rücklagen, and Frei; Budget uses the existing necessity groups plus Frei. Zero segments are omitted only from SVG geometry. Positive source values are normalized only for drawing when their sum and the supplied total differ, preserving source proportions while the textual legend remains authoritative.

All segments share one clockwise circle. The geometry assigns a small shared overlap at each boundary, then subtracts the visible extension of both round caps from the centerline dash. Rendering uses a second end-cap pass: the complete trailing round cap of every segment rests above the beginning of the next segment, including from the final segment back to the first. Full circles keep the overlap completely covered without exposed crescents. A subtle depth shadow makes this clockwise cascade legible in the same way at every theme and breakpoint. This produces deliberate capsule layering without random gaps, reversed joints, or swollen contiguous-dash intersections. The final share absorbs floating-point residue. Segments below the tiny-share threshold use a narrower rounded capsule and a bounded minimum dash so they remain visible without reading as a major category. A thick neutral tonal track remains underneath in light and dark mode. On Pixel-class compact widths the ring remains beside the hero copy; only narrower reflow widths stack it below the copy.

The SVG remains mounted when the overview switches between its planned/free summary and detailed three-role state. The native button exposes `aria-pressed`, a localized accessible summary generated from the same cents, and keyboard activation.

## Chart contract

Recharts remains the rendering layer. `ChartFrame` supplies the same section heading/action surface for Budget, remaining debt, and debt relief. `FinanceChartTooltip` owns localized currency formatting and the tonal tooltip surface; chart components do not carry inline tooltip themes.

Axis color, grid color, cursor color, label size, bar radius, line width, and padding consume central tokens. Every visible bar row retains its label and formatted Euro amount outside the tooltip. Color is reinforced by labels and a structured text alternative. Empty or all-zero data renders an `InlineNotice` rather than an empty plot.

`src/design/chartScale.ts` calculates finite, padded, rounded domains. The debt-relief chart exposes its calculated and source extents for regression checks so neither minimum nor maximum can be clipped by a legacy fixed domain. Unit tests cover ordinary, flat, negative, invalid, and empty inputs.

## Accessibility contract

- Visible buttons and other direct actions have at least a 48 × 48 px target; central connection-state actions are 56 px high.
- Keyboard focus uses a 3 px indicator with a 3 px offset and a dedicated contrast token.
- `ScreenHeader`, `SurfaceSection`, and `ChartFrame` provide stable heading IDs and `aria-labelledby` relationships.
- The budget selector is a native tab model with `aria-controls`, roving `tabIndex`, Arrow keys, Home, and End.
- Expandable rings, pockets, validation groups, and debt progress expose state and valid controlled IDs.
- Native dialogs provide modal background inertness; the manual guard only completes focus wrapping and stacked-dialog restoration.
- Destination changes focus the main landmark without a scroll jump. Sync changes use one intentional live region.
- Every chart has visible values plus a structured text alternative. Financial meaning is never encoded by color alone.
- Reduced Motion and Forced Colors render complete content. The 320 px layout is also the reflow contract for 200% text zoom on a 640 CSS-pixel canvas.

Automated Axe checks run without blanket exclusions and fail on serious/critical findings or WCAG 2 A/AA violations.

## Visual-regression contract

`playwright.config.ts` fixes Chromium, locale, timezone, device scale factor 1, local font readiness, explicit accent tokens, hidden carets, and completed motion. `tests/visual/finance-ui.spec.ts` owns full-page Golden Screenshots for financial screens, connection states, native dialogs, Light/Dark, mobile/tablet, and the expanded Navigation Rail. Updates require the explicit `npm run test:visual:update` command; the ordinary `npm run test:visual` command never rewrites baselines.

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

The top app bar opens **Informationen**, whose Darstellung group opens the independent **Farben** modal. The underlying app is inert; when Farben is stacked above Informationen, the information surface is also inert and hidden from assistive technology. Both dialogs trap focus, close only the top layer on Escape, restore focus to their trigger, prevent body scroll leakage, and keep every interaction target at least 48 px.

The Farben dialog keeps draft mode/source/palette state local. Close, Escape, or scrim discards it; Apply atomically activates the full pair and optional thumbnail. The preview is a private-data-free miniature of this finance app on real draft tokens—not an Android home-screen imitation. Wallpaper imagery remains in a clearly labeled source crop and never becomes the app surface.

Palette choices are a named native radio group. Every 62 px circular swatch uses concrete generated Primary, Secondary, Tertiary, and neutral-container colors in a four-part `conic-gradient`. Selection has both a fixed outer ring and check mark, so color is not the only signal and row geometry does not move. System/Bild/Farben and System/Hell/Dunkel use the same pill-shaped native-radio segmented-control contract at 320 px and wider.

## Decorative roles

`Squiggle` is a reusable static, pointer-transparent SVG. It is always decorative and `aria-hidden`, uses a 3.5 px rounded semantic stroke, and never loops. ACC-2 retains it only for the vertical debt-relief milestone sequence, where it explains actual temporal progression. The overview notice and creditor list contain no decorative connector or meaningless numbering.
