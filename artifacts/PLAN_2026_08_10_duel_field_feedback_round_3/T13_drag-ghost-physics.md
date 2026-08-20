# T13: Drag ghost physics

**Plan:** `./artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T12
**Commit outcome:** A dragged hand card floats under the cursor above the field, tilts with horizontal velocity, carries lift scale/shadow, highlights candidate zones green, then springs to a valid target or home — with no animation dependency.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers items 18 and 19.
- Round 2 already implements pointer capture, 8 px drag threshold, presentation-only placement candidates, hit testing and authoritative `dropChoiceForZone`; `moveCardDrag` is deliberately inert. Add visuals without changing command authority.
- Out of scope: drag/drop as a new input protocol; arbitrary field-card movement; touch gesture redesign; external physics/animation lib.
- Assumptions **A11/A9**: tier-2 ghost, velocity tilt, lift, spring settle, hand-rolled `requestAnimationFrame`; reduced motion disables tilt/spring. Drop candidate uses T12 green filled state.

## Requirements

- Existing 8 px threshold differentiates click from drag. No ghost before threshold.
- First drag frame clones current rendered art/back, dimensions and pointer grab offset into one `aria-hidden`, pointer-transparent fixed-position ghost.
- Ghost follows latest pointer sample through one coalescing rAF loop; pointermove never starts multiple frame callbacks.
- Horizontal filtered velocity controls tilt: right positive, left negative, clamp ±10°. Lift scale = 1.08 and deep shadow.
- Ghost z-layer is above cards, action chips and floating field windows but below app-level modal/backdrop. It never participates in `elementFromPoint`.
- Source card stays in layout/focus order and is dimmed while dragging; it is never moved.
- Valid release uses existing zone hit-test/candidate/`dropChoiceForZone`. It dispatches one placement intent + one `chooseChoice` immediately, then ghost springs to target centre. Animation never delays/authorizes submission.
- Invalid release/pointer cancel submits nothing and springs home to source top-left/centre.
- Gameplay drag state/drop candidates clear on release; ghost-only settle may continue ≤600 ms.
- Prompt/session replacement, new drag, component destruction or timeout cancels pending rAF and removes ghost.
- `prefers-reduced-motion`: cursor follows with zero tilt/no lift transition; release removes ghost immediately, no spring.
- No changes to `package.json` or lockfile.

## Inputs

- **From Depends (T12), as shipped in `69ef913`:** drop candidates are green outline + translucent green fill; selected is orange; feedback teal; focus neutral. Card hover/focus zoom is `scale(1.35)` over `120ms ease-out`, and hovered/focused/pinned card parents are raised so action chips stay hit-testable. **Zoom is deliberately scoped `:not(.is-pinned)`** — a pinned card pushed its focused chip outside the non-scrolling viewport, and a `:has()`-based alternative slowed the keyboard e2e walker toward its timeout. Do not re-enable zoom while pinned. `--ink` is now defined in `:root`. Your ghost layer must be explicit and sit above cards, chips and field windows, below app modals.
- **From T8 (`3f0e437`), which is where the dragged cards live:** hand cards are normal-flow `.is-hand-item` `CardControl`s at a fixed `4.5rem` inside `HandBand.svelte`'s `overflow-x:auto` viewport (`field-hand-p{player}-viewport`). The source card you dim stays inside that scroll container, so its rect can move if the viewport scrolls — snapshot the home target at release time, as Impl step 7 already says. The band root uses `data-feedback-zone-id`, not `data-zone-id`, so a hand chip still resolves to no zone in the hit test; `src/app/presentation/dom-feedback-controller.ts` holds that fallback.
- **From T9 (`eb431e9`):** the duel is a fixed `100svh` shell — `<main>.is-duel-viewport` is `overflow:hidden` and `.duel-field` may be `overflow:auto`. A `position:fixed` ghost is correct here precisely because the page cannot scroll; keep it fixed-positioned in viewport coordinates.
- **From T10 (`c8e007b`) / T11 (`033af59`):** the End turn button now lives inside the phase strip's right group, anchored `right:1%`; the strip renders continuous when `extraMonsterZones` is false. In link-free mode (all six bundled decks) there are 32 zones and **no `shared:extraMonster:*` drop targets** — any drag e2e must pick a target that exists in the active profile.
- **From T6 (`ced9383`):** a known face-down card renders `hidden: true` with back art. The ghost clones the *rendered* art, so it must clone the back for such a card, never the known face.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here (`playwright.config.ts` includes an unsupported `webkit-smoke` project). Use `npm run check:headless` plus the explicit Chromium invocation.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing. Note the existing drag e2e can runtime-skip when the random seed yields no draggable/actionable hand card — if it skips, re-run rather than assuming coverage.
- `src/app/components/duel-field/CardControl.svelte:122-167` — pointer capture, threshold, `ondragstart()`, move/end callbacks; private `renderedImageUrl` and article rect available.
- `src/app/components/duel-field/FieldBoard.svelte:44-46,217-219` — forwards drag callbacks.
- `src/app/components/DuelField.svelte:103-105` — `dragCard`, `dropCandidates`; `:356-398` — start/inert move/end; `:400-408` — hit test.
- `src/styles/app.css:970-988` — candidate/source/chip drag rules.
- `tests/component/DuelField.test.ts:1435-1570` — drag/preview tests; helpers already dispatch pointer events.
- Existing e2e pointer-drag test verifies card + target are in viewport and one response occurs; extend it rather than replace.
- `docs/ADR/005_ADR_optimistic_card_movement.md` (if present) owns gameplay intent; ADR-016 references it and keeps command flow.

## Pure physics API

New `src/app/presentation/drag-ghost-physics.ts`:

```ts
export interface DragPointerSample {
  readonly x: number;
  readonly y: number;
  readonly timeMs: number;
}

export interface CardDragOrigin {
  readonly pointer: DragPointerSample;
  readonly sourceLeft: number;
  readonly sourceTop: number;
  readonly width: number;
  readonly height: number;
  readonly pointerOffsetX: number;
  readonly pointerOffsetY: number;
  readonly imageUrl: string;
}

export interface DragGhostFrame {
  readonly x: number; // ghost top-left viewport px
  readonly y: number;
  readonly velocityX: number; // px/s
  readonly velocityY: number;
  readonly tiltDegrees: number;
}

export const DRAG_GHOST_MAX_TILT_DEGREES = 10;
export const DRAG_GHOST_LIFT_SCALE = 1.08;
export const DRAG_SPRING_STIFFNESS = 180;
export const DRAG_SPRING_DAMPING = 24;
export const DRAG_FRAME_DELTA_CAP_MS = 32;
export const DRAG_SETTLE_TIMEOUT_MS = 600;

export function dragFrameForPointer(
  previous: DragGhostFrame,
  previousSample: DragPointerSample,
  sample: DragPointerSample,
  origin: CardDragOrigin,
): DragGhostFrame;

export function settleDragGhostFrame(
  frame: DragGhostFrame,
  target: { readonly x: number; readonly y: number },
  elapsedMs: number,
): DragGhostFrame;

export function dragGhostSettled(
  frame: DragGhostFrame,
  target: { readonly x: number; readonly y: number },
): boolean;
```

`dragFrameForPointer`: top-left = sample − grab offset; `dt=max(1,time delta)/1000`; instant velocity from pointer delta; filtered velocity = `0.65 * previous + 0.35 * instant`; tilt = clamp(`velocityX * 0.012`, ±10). Never return NaN for same/backward timestamp.

`settleDragGhostFrame`: semi-implicit spring integration with `dt=min(max(elapsedMs,0),32)/1000`; acceleration per axis = `180*(target-position) - 24*velocity`; update velocity then position; tilt damps toward zero with same factor. `dragGhostSettled` requires distance ≤0.5 px **and** speed ≤8 px/s.

## Component API

New `src/app/components/duel-field/DragGhost.svelte` props: `frame`, `origin`, `settling`. Root `data-cy="drag-ghost"`, image `data-cy="drag-ghost-image"`; inline style only fixed x/y/width/height/rotation. CSS owns scale/shadow/layer.

Change `CardControl.ondragstart` to `(origin: CardDragOrigin) => void`. At threshold crossing, read `article.getBoundingClientRect()`, calculate pointer offset from original pointerdown, use `performance.now()`/event time, pass `renderedImageUrl`. FieldBoard forwards unchanged.

## TDD

1. **Red** — pure deterministic physics tests, then fake-rAF component lifecycle.
2. **Green** — pure module/ghost + one rAF owner in DuelField.
3. **Refactor** — no layout reads inside animation loop.

## Test plan

New `tests/unit/drag-ghost-physics.test.ts`:

- cursor minus grab offset gives exact x/y;
- right/left velocity gives positive/negative tilt;
- extreme velocity clamps ±10;
- same/backward timestamp returns finite values;
- 32 ms cap prevents huge tab-resume step;
- spring reduces distance over repeated frames and does not grow amplitude;
- settled false for near position/high velocity; true only below both tolerances;
- all returned objects frozen if project convention requires.

New/extend component tests with stubbed `requestAnimationFrame`/`cancelAnimationFrame`:

- crossing 8 px mounts ghost using dragged image/size and source gets `data-dragging=true`;
- sub-threshold move/click never mounts;
- three pointer moves before flush schedule one rAF and last sample wins;
- valid release target centre becomes settle target, existing intent/choice each fire once;
- invalid release/pointercancel settles home, no intent/choice;
- repeated settle frames unmount at tolerance; hard timeout also unmounts;
- reduced motion zero tilt, no spring, immediate remove;
- prompt key change/unmount cancels frame/removes ghost;
- candidate zone retains `data-drop-candidate=true` during active drag.

Update `tests/unit/global-styles.test.ts`: ghost fixed, pointer-events none, layer above field menu/window, lift scale 1.08 and shadow; reduced-motion removes lift transform.

E2E existing drag path:

- ghost appears after travel and its centre stays within 8 px of cursor accounting grab offset;
- source remains at original rect/dimmed;
- candidate computed border/fill green;
- `elementFromPoint(ghost centre)` resolves underlying field element;
- valid drop still sends exactly one command; ghost disappears within 650 ms;
- reduced-motion project/emulation sees no tilt/settle linger.

## Impl steps

- [x] 1. Add pure tests and module with exact constants/formulas. Evidence: `src/app/presentation/drag-ghost-physics.ts` + `tests/unit/drag-ghost-physics.test.ts`, 15/15 passing.
- [x] 2. Add `DragGhost.svelte` plus CSS/static tests. Evidence: `src/app/components/duel-field/DragGhost.svelte`, `.drag-ghost` rules in `src/styles/app.css`, 2 new `tests/unit/global-styles.test.ts` cases passing.
- [x] 3. Widen `CardControl` drag-start callback; bind article element; construct origin at first threshold crossing. Preserve preview/pointer capture/click suppression. Evidence: `CardControl.svelte` `buildDragOrigin`/`pointerMove`; `npm run typecheck` clean; existing drag component tests still green.
- [x] 4. Widen FieldBoard/DuelField callback typing. Evidence: `FieldBoard.svelte`, `HandBand.svelte` `oncarddragstart` now `(card, origin) => void`; `npm run typecheck` clean.
- [x] 5. In DuelField add ghost origin/frame/latest sample/phase/rAF/settle target/start time. `moveCardDrag` stores latest sample and schedules only when no frame pending. Evidence: `DuelField.svelte` `moveCardDrag`/`scheduleGhostFrame`; component test "coalesces a burst of pointer moves into a single pending frame" passing.
- [x] 6. rAF handler updates pointer frame while dragging or spring frame while settling, reschedules only while active, clears at tolerance/600 ms. Evidence: `tickGhostFrame`; component tests "dispatches the single intent/choice immediately, then springs the ghost..." and "springs a cancelled drag home..." passing.
- [x] 7. Refactor `endCardDrag`: snapshot card/candidates/origin, resolve hit once, clear gameplay drag/candidates, submit valid choice immediately, then choose target top-left = zone rect centre minus half ghost dimensions; miss/cancel target = source left/top. Evidence: `DuelField.svelte` `endCardDrag`; existing "drops on a candidate zone with one intent and one dispatch" test plus new settle tests passing.
- [x] 8. Use live DOM zone rect only on release, not every frame. Ghost pointer-events none keeps existing hit test valid. Evidence: zone/source `getBoundingClientRect` reads only inside `endCardDrag`; `.drag-ghost { pointer-events: none }`; e2e `elementFromPoint` check confirms ghost never intercepts.
- [x] 9. Add reactive prompt/session change cleanup and `onDestroy` cancellation. New drag first cancels prior settle. Evidence: `cancelDragGhostOnPromptChange`, `onDestroy(removeGhost)`, `cancelGhostFrame()` in `startCardDrag`; component tests "cancels the pending frame and removes the ghost on a prompt replacement" and "...on unmount" passing.
- [x] 10. Branch on existing `effectiveReducedMotion` for zero tilt/immediate release cleanup. Evidence: `tickGhostFrame`/`startCardDrag`/`endCardDrag` reduced-motion branches; component test "reduced motion follows the pointer with zero tilt..." and e2e "reduced motion drags follow the pointer with no tilt and settle with no lingering ghost" passing.
- [x] 11. Extend e2e; run all focused/full checks. Evidence: extended `e2e/duel-smoke.spec.ts` "dragging a hand card onto a highlighted zone plays it" + new reduced-motion test; full `--project=chromium` run 26/26 passed.
- [x] 12. Create ADR-016; reference ADR-005/T12, record no dependency and constants. Evidence: `docs/ADR/016_ADR_dependency_free_drag_physics.md` pre-existed from planning and its constants/flow match the shipped implementation exactly (verified line-by-line); no edit needed.

## Outputs

- Files created: `src/app/presentation/drag-ghost-physics.ts`, `src/app/components/duel-field/DragGhost.svelte`, `tests/unit/drag-ghost-physics.test.ts`.
- Files edited: `CardControl.svelte`, `FieldBoard.svelte`, `DuelField.svelte`, `src/styles/app.css`, component/style/e2e tests.
- Public component API: drag-start callback carries `CardDragOrigin`.
- Dependencies/config: none; package files unchanged.

## Validation

- [x] `npm run test:unit -- drag-ghost-physics global-styles` passes — evidence: full `npm run test:unit` run, 707/707 passing, including `drag-ghost-physics.test.ts` (15) and `global-styles.test.ts` (19).
- [x] `npm run test:component -- DuelField` passes with fake rAF cleanup — evidence: `npm run test:component -- DuelField`, 242/242 passing, including stubbed-rAF ghost lifecycle tests.
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass — evidence: all three ran clean (0 errors/warnings) after final edits.
- [x] `npm run build` succeeds — evidence: `vite build --mode private` + `build:verify` both succeeded (see command output, snapshotId `a562f5ad...`).
- [x] `git diff --exit-code -- package.json package-lock.json` — evidence: exit code 0, no dependency added.
- [x] full chromium e2e passes using pinned command from T5 — evidence: `PLAYWRIGHT_BROWSERS_PATH=.../pw-browsers npx playwright test --project=chromium`, 26/26 passed.
- [ ] manual fast left/right drag visibly tilts; valid release springs target; invalid springs home — moved to manual checklist (visual/subjective, not measured by an automated assertion).
- [x] reduced motion has no tilt/spring — evidence: component test asserts `--drag-ghost-rotate: 0deg` and immediate removal on release; e2e "reduced motion drags follow the pointer with no tilt and settle with no lingering ghost" asserts the same in a real browser.
- [x] app functional — drop authority/one-response contract unchanged — evidence: existing "drops on a candidate zone with one intent and one dispatch" component test and e2e "dragging a hand card onto a highlighted zone plays it" (one gesture, two responses) both still pass unmodified in assertion intent.
- [x] commit msg draft: `feat(field): animate hand drags with dependency-free physics` — used verbatim as the commit subject.
