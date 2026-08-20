# R1: Review repairs

**Plan:** `./artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** T1-T12 (all shipped)
**Commit outcome:** The blocker and should-fix defects found by the post-implementation reviewer fanout are fixed: clicking inside the zone list dialog no longer answers the live prompt, deck-located prompt choices attach to the correct deck slot, a chain prompt stays answerable when the field fails to render, Escape closes a mouse-opened zone list, and the two weakened test gates are restored.

## Context (self-contained)

Four fresh-context reviewers audited `git diff b5702e2..HEAD` at deep tier. Findings below are theirs, already triaged by the orchestrator; every one is in scope and confirmed against the code. Fix exactly these. Do not refactor anything else.

## Requirements

### 1. [BLOCKER] A click inside the zone list dialog answers the live prompt

`src/app/components/DuelField.svelte:316` — `INTERACTIVE_SELECTOR` is
`"[data-field-target], .card-action-chips, .field-action-bar, .field-phase-strip, .field-end-turn"`.
`ZoneListDialog` renders inside `<section class="duel-field">` with root class `.zone-list-dialog`, which matches none of those, and nothing in the dialog stops propagation. So `dismissOnOutsideClick` (line ~326, handler wired at line ~454) treats any click in the dialog that misses a `.card-action-chips` button as an outside click and dispatches a real duel response.

Reproduced against the real components in jsdom:

| Input | Wrongly dispatched |
| --- | --- |
| chain prompt with a `pass` choice → click GY pile → click `zone-list-dialog-close-button` | `{ type: "chooseChoice", choiceId: "c-pass" }` |
| chain prompt → click GY pile → click the entry tile (including the haloed, actionable one) | `{ type: "chooseChoice", choiceId: "c-pass" }` |
| cancelable `selectCard` with GY targets → click GY pile → click `zone-list-dialog-header` | `{ type: "cancel" }` |

Severity: T8 made the dialog the only way to answer a stack-located choice, so the natural gesture — clicking the glowing card tile — passes the chain instead. The dismissal is an irreversible duel action. Reachable today with the shipped preset decks via any optional chain window (`Trap Hole`, `Reinforcements`) plus the player opening a pile.

Fix: add `.zone-list-dialog` to `INTERACTIVE_SELECTOR` so clicks inside the dialog are never treated as outside clicks. Keep the existing outside-click-to-pass behaviour for genuine empty-field clicks.

### 2. [MAJOR] Deck-located prompt choices attach to the wrong deck slot

Found independently by the correctness and security reviewers; same root cause.

- `src/worker/projection/DuelStateProjector.ts:1367-1374` — `projectDeck` writes `sequence: offset`, a **top-relative** offset (index 0 = top of deck, per T9 requirement 2 / ADR-008).
- `src/worker/protocol/PromptRegistry.ts:1088-1094` — `toPromptCard` passes the **raw engine** `current.sequence` through unchanged. The engine's deck convention is the opposite direction: sequence 0 = bottom, sequence `count-1` = top (measured against the vendored core: `queryLocation(LOCATION_DECK)` returns bottom-first).
- `src/app/components/duel-field/ZoneListDialog.svelte:19-27` — `entryChoices` matches `choice.cardAddress.sequence === entry.sequence`, silently assuming one coordinate space.

Failure: a choice for the card at top-relative offset `k` of an `n`-card deck carries `sequence = n-1-k`, so its chip and `is-actionable` halo attach to list position `n-k` — the mirrored slot. The correct `choiceId` is still sent, so there is no illegal answer and no deadlock, but the player is shown the action on the wrong card. Where that mirrored slot is an unrevealed slot, a chip's `title` / `aria-label` (`CardActionChips.svelte:64-65`) prints a real card name onto a tile the projection marked face-down and whose own label is `Face-down card` — asserting an identity at a deck position the projector never recorded as revealed.

Not reachable with the shipped presets (22 vanilla LOB-era cards, no searcher, no excavation), so it is latent — but it is a contract defect between two shipped modules and it violates the T9 rule that the projection may forget a reveal but never invent one.

Every other zone list is unaffected: `zone-list.ts:117` copies the projector's own engine-aligned `card.sequence` for graveyard/banished/extra.

Fix: convert the engine deck sequence into the projector's top-relative offset space at exactly one boundary, so `entryChoices` compares like with like. Prefer converting in the worker (where the deck count is authoritative) over patching the matcher in the component; if you convert in the UI, the deck size must come from the same snapshot as the entry list. Add a named helper with a comment stating both conventions explicitly — this mismatch cost two reviewers real effort to find, and the next reader must not have to rediscover it.

Cover with a unit test that fails against the current mirrored behaviour: a deck of `n` cards, a choice at engine sequence `n-1-k`, expect the chip on list position `k+1` (1-based). Do not weaken the test to match whatever the code currently does.

### 3. [SHOULD-FIX] A chain prompt is unanswerable when the field is not rendered

`src/app/prompts/prompt-surface.ts:13` returns `"field"` for every chain prompt regardless of `spec.fieldCapable`. `src/app/App.svelte:862` only renders the field when `duelBoard !== null`, and line ~900 only renders `PromptDialog` when the surface is `"dialog"`.

Failure: when `mapSnapshotToBoard` returns an error result (its designed failure path, which renders `app-field-error-panel`), `duelBoard` is `null`, every choice routes to `globalChoices`, and `fieldCapable` is `false`. Before this branch that yielded `"dialog"` and the chain was answerable. After T11 it yields `"field"`, nothing is mounted that can answer, and the duel deadlocks under a panel whose copy reads "Prompt controls remain available."

Fix: a chain prompt must fall back to the dialog surface when nothing can answer it on the field. Keep T11's inline behaviour for the normal case — this is strictly a fallback for the field-not-rendered path. Add a test that a chain prompt with `fieldCapable === false` resolves to a surface that is actually mounted.

Note: the same class of gap was logged as a residual risk in the previous round's handoff (`promptSurface` reporting `"field"` while the boundary has swallowed the field). Fixing it for chains does not fix it for every prompt kind; anything you do not fix here stays a logged residual risk, do not expand scope to chase it.

### 4. [SHOULD-FIX] Escape does not close a mouse-opened zone list

`src/app/components/duel-field/ZoneListDialog.svelte:32` — the `keydown` handler sits on the dialog root, which has `tabindex="-1"` and is never focused. Opening the list clicks the `StackControl` `<button>`, which keeps focus, so the keydown fires on a sibling subtree and never reaches the dialog. The T8 test passes only because it dispatches the keydown on the dialog element directly.

Fix: make Escape close the dialog regardless of where focus sits while it is open, without breaking the existing keyboard path or hijacking Escape from other surfaces (chips unpin, dialogs) when the zone list is closed. Update the T8 test so it exercises the real path — dispatch on `document`/`window` or drive it through a click-to-open first — rather than on the dialog node.

### 5. [MAJOR] Restore the e2e field-action-bar geometry gate

`e2e/duel-smoke.spec.ts:1189` — the bar's `toBeVisible` + `assertRectInsideViewport` + "must clear the duel board" assertions were wrapped in `if ((await dock.count()) > 0)`. The comment deleted at that spot warned against exactly this: *"A `count() > 0` guard here would silently delete the geometry gate below instead of failing when the bar goes missing."* Line 1211 is the codebase's only "must clear the duel board" check, and the regression it guards — the bar re-entering the board box and swallowing clicks meant for the hand — is the exact failure that sank a previous round.

The replacement comment claims the gate "is exercised instead by `dragging a hand card onto a highlighted zone plays it`". That is false: that test contains no geometry assertion. Fix the comment too.

Because T4 removed `Shuffle Deck` and turn-1 Battle Phase is illegal, the opening `idleCommand` deterministically has only `endPhase` as a global choice, so the bar is reliably absent at that point and `dock.count()` is 0 on every run at every viewport.

Fix: restore an unconditional geometry gate by driving the walker to a state where the bar is genuinely required (`fieldActionBarRequired` true — e.g. a multi-select prompt) and asserting there, rather than asserting at a point where the bar is deterministically absent. Do not reinstate a bare unconditional assertion at the current line if the bar cannot appear there — that would just fail. Replace the false comment with an accurate one naming wherever the gate now lives.

### 6. [MINOR] Stale test name asserting the opposite of the shipped contract

`tests/component/DuelField.test.ts:1565` — the case is named `stack stays non-interactive` and asserts `tagName === "DIV"` + `role="group"`. T8 requirement 6 deliberately made non-empty stacks `<button>`s; the test only still passes because its fixture's `p0:graveyard` is empty, making it a silent duplicate of `an empty pile is not clickable` (`:1748`) under a name that now states the opposite of the shipped contract. Rename it to state what it actually pins (an empty pile stays a non-interactive div), or delete it as a duplicate. Do not change the shipped behaviour.

## Inputs

- `src/app/components/DuelField.svelte` — `INTERACTIVE_SELECTOR` (~316), `dismissOnOutsideClick` (~326), handler wiring (~454), `ZoneListDialog` render site (~485).
- `src/app/components/duel-field/ZoneListDialog.svelte` — `entryChoices` (19-27), keydown handler (~32).
- `src/app/components/duel-field/ZoneListEntryTile.svelte`, `src/app/components/duel-field/CardActionChips.svelte` (~64-65) — chip `title`/`aria-label`.
- `src/worker/projection/DuelStateProjector.ts` — `projectDeck` (1362-1386).
- `src/worker/protocol/PromptRegistry.ts` — `toPromptCard` (1088-1094).
- `src/field/zone-list.ts` — `sourcedEntry` (~117), deck branch.
- `src/app/prompts/prompt-surface.ts` — chain branch (~13).
- `src/app/App.svelte` — field render condition (~862), `PromptDialog` condition (~900).
- `e2e/duel-smoke.spec.ts` — 1176-1215.
- `tests/component/DuelField.test.ts` — 1565, 1748.
- **From Depends:** all of T1-T12 is shipped and green at `4822ecb`.

## TDD

1. **Red** — write a failing test for each of requirements 1, 2, 3, 4 before fixing it. Requirement 1's three rows are three separate cases. Requirement 2's test must fail against the current mirrored behaviour.
2. **Green** — fix each, keeping every other test green.
3. **Refactor** — only if needed.

## Impl steps

- [x] 1. Add the three failing dialog-dismissal cases from requirement 1 to `tests/component/DuelField.test.ts` — validate: all three fail before the fix
- [x] 2. Fix `INTERACTIVE_SELECTOR` per requirement 1 — validate: the three new cases pass, existing outside-click-to-pass cases stay green
- [x] 3. Add the failing deck-slot mapping test from requirement 2 — validate: fails against current mirrored behaviour
- [x] 4. Implement the sequence-space conversion with a named, commented helper — validate: new test passes, `npm run test:unit` green
- [x] 5. Add the failing chain-surface test from requirement 3 — validate: fails before the fix
- [x] 6. Fix the chain surface fallback — validate: new test passes, T11's inline chain tests stay green
- [x] 7. Fix Escape handling per requirement 4 and rewrite the T8 Escape test to exercise the real path — validate: test fails against the old handler, passes after
- [x] 8. Restore the e2e geometry gate per requirement 5 and correct the false comment — validate: chromium e2e green, gate demonstrably runs
- [x] 9. Rename or delete the stale test per requirement 6 — validate: `npm run test:component` green
- [x] 10. Update `artifacts/manual_test_checklist.md` with an `## R1 review-repairs` section — validate: section exists with unchecked human steps

## Outputs

- Edited: `src/app/components/DuelField.svelte`, `src/app/components/duel-field/ZoneListDialog.svelte`, `src/app/prompts/prompt-surface.ts`, `e2e/duel-smoke.spec.ts`, `tests/component/DuelField.test.ts`, `artifacts/manual_test_checklist.md`, plus whichever of `DuelStateProjector.ts` / `PromptRegistry.ts` / `zone-list.ts` / `ZoneListDialog.svelte` carries the requirement-2 conversion.
- Behaviour change: clicks inside the zone list dialog no longer answer prompts; deck chips land on the correct slot; chain prompts keep a mounted surface; Escape closes a mouse-opened list.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0 (baseline 557)
- [x] `npm run test:component` exits 0 (baseline 183)
- [x] `npm run test:integration` exits 0 (baseline 20)
- [x] `npm run test:legacy` exits 0 (baseline 21)
- [x] chromium e2e exits 0, run twice:
  ```bash
  cd /home/aron/projects/ascencio
  timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
    libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
    alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
  export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
  npx playwright test --project=chromium
  '
  ```
  Run FOREGROUND and BLOCKING. `libglib-2.0.so.0: cannot open shared object file` means the `PLAYWRIGHT_BROWSERS_PATH` override went missing, not that the nix `-p` list is wrong. The seed is random per run.
- [ ] app functional — a full duel is still playable start to finish
- [x] commit msg draft: `fix(field): stop dialog clicks answering prompts and repair review findings`
