# T5: Preview on every hover, opponent art inverted

**Plan:** `./artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T1
**Commit outcome:** Hovering or focusing any card surface updates the persistent preview; face-down cards no longer carry a visible "Hidden card" caption; opponent pile art is rotated 180°.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers item 1's broken hover and label part plus item 3. Item 1's known face-down identity requires worker knowledge tracking and is isolated in T6.
- Root cause: `CardControl.svelte` already has `onpointerenter={reportPreview}` on the article, but `.duel-field-card { pointer-events: none; }` disables that article unless `.is-actionable` restores pointer events. A passive field/opponent hand card can never receive a real pointer hover; jsdom's synthetic event tests miss the CSS failure.
- Out of scope: projector identity state (T6), hover magnification (T12), halo colours (T12), preview layout (T9), any click/drag behaviour.
- Assumptions: item 3 means art for opponent stacks **and their open list entries** rotates 180°, matching opponent field cards. Labels and action chips remain readable/upright.

## Requirements

- Every `.duel-field-card`, actionable or passive, receives pointer hit testing. Existing target buttons and chips keep their z-order and click behaviour.
- Pointer enter, keyboard focus and pointer down still report the current card through `onpreview` exactly once per event.
- Hidden cards retain their accessible article label but render no `.duel-field-card__label` caption. Visible cards keep their caption.
- `StackControl` marks player-1 stacks as opponent-facing; only its art image rotates 180°.
- `ZoneListEntryTile` marks player-1 entries as opponent-facing; only its image rotates 180°.
- Player-0 stacks/list entries stay upright. Text, count, position badge, halo and chips stay upright on both sides.
- No preview is cleared on pointer leave; existing persistent-preview behaviour remains.

## Inputs

- `src/app/components/duel-field/CardControl.svelte:115-120` — `reportPreview`; `:181-205` — article has `onpointerenter`, `onfocusin`; `:217-223` — label always renders and substitutes `"Hidden card"`.
- `src/styles/app.css:1160-1166` — `.duel-field-card { pointer-events: none; }`; `:1228-1230` — only `.is-actionable` restores `pointer-events: auto`.
- `src/app/components/duel-field/StackControl.svelte:61-99` — root has `data-player={stack.player}` and hover/focus preview; `:100-114` — optional art.
- `src/app/components/duel-field/ZoneListEntryTile.svelte:52-60` — entry root; `:61-68` — image; `entry.controller` is available but not exposed as a class/data attr.
- `src/app/App.svelte:600-625` — `previewFieldCard`, `previewStackCard`, `previewZoneListEntry`; these already update `previewCard` and need no change.
- `src/field/zone-list.ts:19-30` — `ZoneListEntry.controller` identifies player 0/1.
- `tests/component/DuelField.test.ts:1540-1637` — synthetic preview tests; `:1572` and `:1606` cover hidden previews.
- `tests/component/ZoneListDialog.test.ts:139-147` — list hover preview.
- `e2e/duel-smoke.spec.ts:1001-1030` — existing real-browser hand-card hover test, but its selected hand card can be actionable and therefore does not expose the root bug.
- **From Depends (T1):** all round-2 components/tests/CSS are present on `plan/duel-field-feedback-round-3`; current pushed terminal before T5 is `c459bf059b633513f5e73dafb3413956e6e5fc9e`.

## TDD

1. **Red** — add structural component tests plus one real-browser passive-card hover check. The browser check fails against `pointer-events: none`.
2. **Green** — one pointer-events declaration, two opponent classes, one hidden-label conditional, CSS transforms.
3. **Refactor** — none expected.

## Test plan

Extend `tests/component/DuelField.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `does not render a visible caption for a hidden card` | board fixture with a face-down card | hidden article exists; its accessible name still contains `Hidden card`; `querySelector(".duel-field-card__label")` within it is null |
| `keeps the caption for a visible card` | face-up fixture | visible article contains `.duel-field-card__label` with card label |
| `marks only opponent stacks as opponent-facing` | standard board with p0/p1 stacks | p1 root has `.is-opponent` and `data-player="1"`; p0 lacks class |

Extend `tests/component/ZoneListDialog.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `marks only opponent list entries as opponent-facing` | entries with controller 0 and 1 | controller-1 root has `.is-opponent` and `data-controller="1"`; controller-0 root lacks class |

Extend `e2e/duel-smoke.spec.ts` near the existing preview test:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `a passive opponent hand card receives a real hover` | start default duel; locator `.duel-field-card[data-card-zone-id="p1:hand"]:not(.is-actionable)` first; call Playwright `.hover()` without `{ force: true }` | hover succeeds; preview panel switches from empty to existing runtime label `card-preview-name === "Face-down card"`; computed `pointerEvents` for article is `"auto"` |

The e2e helper from T3 starts the selected default duel before locating the card. Wait for opponent hand count/card to exist; do not skip the assertion.

## Impl steps

- [x] 1. Add the three `DuelField`/`ZoneListDialog` component tests. Run `npm run test:component -- DuelField ZoneListDialog` — hidden-label/opponent-class checks fail.
- [x] 2. Add the passive opponent-hand e2e test. Run it alone with the chromium command in Validation and `-g "a passive opponent hand card"` — expect Playwright hover failure or unchanged preview because the root computes `pointer-events: none`.
- [x] 3. In `CardControl.svelte`, wrap lines 217-223 in `{#if !card.hidden}` and render `card.label` directly. Do not change `aria-label`, image `alt`, `aria-hidden`, preview handlers or target button.
- [x] 4. In `StackControl.svelte`, add `class:is-opponent={stack.player === 1}` to the root.
- [x] 5. In `ZoneListEntryTile.svelte`, add `class:is-opponent={entry.controller === 1}` and `data-controller={entry.controller}` to the root.
- [x] 6. In `src/styles/app.css`, change `.duel-field-card` from `pointer-events: none` to `pointer-events: auto`; delete the now-redundant `pointer-events: auto` declaration from `.duel-field-card.is-actionable` but keep the selector if other declarations remain.
- [x] 7. Add `.duel-field-stack.is-opponent .duel-field-stack__art img, .zone-list-entry.is-opponent > img { transform: rotate(180deg); }`. Apply transform to image only, never root.
- [x] 8. Re-run focused component and e2e tests. Verify action-chip hover, click and drag tests remain green — enabling the article must not intercept its child controls.

## Outputs

- Files edited: `src/app/components/duel-field/CardControl.svelte`, `StackControl.svelte`, `ZoneListEntryTile.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/component/ZoneListDialog.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: none.
- Behaviour: passive cards now receive hover; hidden visual caption removed; opponent pile/list art inverted.
- Migration / config: none.

## Validation

- [x] `npm run test:component -- DuelField ZoneListDialog` passes
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [x] `npm run build` succeeds
- [x] focused chromium e2e passes, then full chromium project passes:
      ```bash
      cd /home/aron/projects/ascencio
      timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
        libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
        alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
      export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
      npx playwright test --project=chromium
      '
      ```
- [ ] manual check: hover one passive field card, one player stack, one opponent stack and one card in each list; preview changes every time
- [ ] manual check: opponent stack/list art is upside down while labels/chips remain upright
- [ ] manual check: no face-down card shows a `Hidden card` caption on the board
- [x] app functional — no broken path from this slice
- [x] commit msg draft: `fix(field): restore passive card hover previews`
