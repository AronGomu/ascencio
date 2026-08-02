# ADR-001: Semantic DOM Duel-Field Rendering

> Status: accepted; implemented
> Decided: 2026-07-31
> Amended: 2026-03-22 — Chromium PWA product target; automated Chromium evidence only
> Implemented: 2026-08-02 — DF-17 removed Phaser runtime/dependency/bridge
> Owners: presentation architecture
> Supersedes: [`../archive/svelte-phaser-boundary.md`](../archive/svelte-phaser-boundary.md)

## Context

MVP field uses lazy Phaser scene inside Svelte. Svelte separately renders semantic prompt controls because canvas is `aria-hidden`. Split met MVP release gate. Next field UI needs direct card/zone interaction, visible keyboard focus, spatial navigation, anchored action menus, trays, inspector, responsive composition, role-based browser tests.

Current production evidence:

- field model exposes 44 logical zone objects before physical-zone correction;
- normal field workload is bounded set of card, zone, stack, menu, HUD controls;
- Phaser lazy production chunk measures about 1.38 MB raw, 356–361 kB gzip;
- product scope excludes background spectacle, character animation, particles, shaders, large continuously moving sprite sets;
- Phaser duplicates interaction ownership: bitmap controls handle pointer intent, Svelte controls provide complete keyboard/accessibility behavior.

WHATWG defines `<canvas>` as resolution-dependent bitmap and requires equivalent fallback content. Interactive bitmap regions need equivalent focusable descendants plus explicit visual-focus sync. Native HTML controls already provide browser focus, activation, semantics, accessibility mappings.

No benchmark proves DOM universally faster than canvas. Decision follows workload/architecture fit. Representative profiling passed the removal gate for this app.

## Decision

1. Render interactive duel field with Svelte 5 plus semantic HTML.
2. Render every actionable/inspectable card, stack, zone as one visible DOM control. No hidden duplicate controls for canvas regions.
3. Keep rule-correct logical coordinates in typed presentation data. Convert coordinates to CSS custom properties/percentages at view boundary.
4. Use CSS transforms/transitions or Web Animations for bounded card movement, rotation, lift, fade, highlight feedback.
5. Use SVG for non-interactive target/attack/chain lines. SVG stays `aria-hidden`, pointer-transparent.
6. Keep Svelte responsible for focus, spatial navigation, action menus, trays, inspector, HUD, reduced motion, interaction-session state.
7. Keep Worker/`ocgcore` authority unchanged. DOM state never creates legal choices; it renders current public snapshot plus validated prompt-derived interaction spec.
8. Keep no runtime Phaser path after migration. Scene, bridge, dependency, bundle budget, and canvas-specific tests are removed after semantic, visual, performance, and browser parity passes.
9. Permit future canvas only as optional non-interactive FX layer after profiling proves concrete need. Such layer requires separate ADR. It cannot own hit testing, focus, legal state, response submission.

## Required boundaries

- Worker owns engine, raw protocol, response encoding, public projection.
- Duel store owns authoritative snapshot, prompt, result/error, runtime generations, response-pending lifecycle.
- Pure mappers derive physical board view plus prompt interaction spec.
- Interaction session owns only prompt-keyed local selection/allocation/order/menu state.
- Svelte components render board/HUD/overlays, emit opaque choice IDs through existing validation/store path.
- Presentation feedback never delays Worker processing or changes response order.

Detailed design: [`../duel-field-architecture.html`](../duel-field-architecture.html).

## Consequences

### Positive

- Visible field plus accessibility tree become one render tree.
- Native focus/activation plus role/name Playwright locators replace canvas metadata/coordinate tests.
- Menus/inspector anchor from transformed DOM geometry.
- CSS recomposes desktop/narrow layouts without canvas-scale sync.
- Renderer parse/init, scene lifecycle, texture-manager loading, and bridge are absent from current production build.
- Optional decoration can fail without disabling field interaction.

### Negative

- Presentation rewrite has medium cost.
- Spatial keyboard navigation remains custom because physical field is irregular.
- CSS stacking contexts, transformed focus rings, motion need explicit tests.
- Large pile/tray views must virtualize or mount on demand; permanent rendering of every duel card is forbidden.
- DOM animation headroom remains unproven until representative profiling.

### Neutral / unchanged

- `ocgcore` remains sole rules authority.
- Public-state privacy, prompt IDs, choice IDs, Worker generations, diagnostics, assets, image verification boundaries remain.
- Existing semantic `PromptControls` remains fallback/complement for non-spatial prompt families.

## Rejected alternatives

### Retain interactive Phaser canvas

Rejected for field workload. Strong continuous sprite rendering/custom hit testing does not offset duplicated semantics, focus sync, menu-coordinate conversion, bundle/runtime machinery, weak role-based testability.

### Overlay DOM controls on Phaser

Rejected. Keeps two geometries, z-order systems, resize paths, disposal lifecycles. Phaser DOM Elements also cannot interleave freely with canvas objects.

### Replace Phaser with another canvas/WebGL renderer

Rejected. Smaller renderer may reduce bundle cost. Semantic duplication remains.

### Pure CSS without typed layout model

Rejected. Rule/engine slot semantics must remain testable TypeScript data, not selector/position conventions.

## Validation/removal gate

**Supported product browsers:** current Chromium-based desktops with installable PWA support (Chrome, Edge, and Chromium equivalents). Firefox, Safari/WebKit, NVDA, and VoiceOver are **out of product acceptance** for this field migration. Existing non-Chromium CI smoke may remain hygiene-only and never blocks DF-14–DF-17.

Renderer removal gate passed with:

- sparse fixed-zone projection tests green for sequences `0`, `4`, `5`, `6`;
- one shared physical identity per Extra Monster Zone;
- complete pointer plus keyboard flows for every reachable prompt family;
- no duplicate response submission; pending input locked until new prompt, result, recoverable error;
- Chromium full E2E green on Playwright Chromium (PWA-capable engine family), including keyboard-only duel, role/name/state, focus, live regions, 200% zoom focus visibility, and privacy/image nonblocking paths;
- DF-14 a11y gate satisfied by automated Chromium evidence in [`../architecture/05-presentation/duel-field-screen-reader-review.md`](../architecture/05-presentation/duel-field-screen-reader-review.md);
- representative update-to-paint, long-task, animation, heap/object-URL, and bundle measurements recorded on pinned Chromium profile;
- layout/hierarchy checks encoded as automated semantic assertions where feasible; screenshot artifacts never require human visual approval.

Implementation plan: [`../DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md`](../DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md).
Validation references: [`../duel-field-validation-references.html`](../duel-field-validation-references.html).

## Evidence

- WHATWG canvas: https://html.spec.whatwg.org/multipage/canvas.html#the-canvas-element
- WHATWG button: https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element
- WCAG Keyboard: https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html
- WCAG Focus Visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WAI-ARIA APG Grid: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- Svelte keyed each: https://svelte.dev/docs/svelte/each#Keyed-each-blocks
- Svelte transitions/animations: https://svelte.dev/docs/svelte/transition and https://svelte.dev/docs/svelte/animate
- CSS Transforms: https://drafts.csswg.org/css-transforms/
- Phaser DOM Elements: https://docs.phaser.io/phaser/concepts/gameobjects/dom-element
- Playwright locators: https://playwright.dev/docs/locators
