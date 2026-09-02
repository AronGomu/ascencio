# T7: Selection halo suppressed once the answer is submitted

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** none
**Commit outcome:** After a summon (or any prompt answer) is accepted, no card keeps the orange selected halo while the engine resolves; a rejected submission restores the draft untouched.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 9 — Normal Summoned monster keeps orange halo after summon resolves.
- This slice: presentation gating of selection state during `submitting`.
- Out of scope here: overlay rendering of selections (T6), Activate chips (T8 — independent root, red-team disproved the owner's "probably because" causal guess).
- Assumptions in force: A5 + red-team amendment — **suppress, don't clear**: `submissionRejected` returns the session to `editing` (`interaction-session.ts:210-213`); clearing `selectedChoiceIds` on accept would resume a rejected submission with an empty draft.

## Requirements

- While `session.status === "submitting"` (and while the store holds the stale prompt during `responsePending`, `duel-store.ts:187`), `selectedTargets` presented to the field is empty → no `is-selected` halo anywhere.
- Rejection (`submissionRejected` → `editing`) restores the exact previous halo set.
- New prompt (new key) already resets the session (`interaction-session.ts:105-108`) — unchanged.

## Inputs

- `interaction-session.ts:206-208` `submissionAccepted` → `status: "submitting"`, `selectedChoiceIds` intact.
- `duel-store.ts:443-457` `acceptResponse`; `:187` stale-prompt hold during `responsePending`.
- `DuelField.svelte:283-286` `selectedTargets = withPinnedHandTarget(spec === null ? EMPTY_TARGETS : targetSelections(spec, session), pinnedHandTarget)`; `targetSelections` at `:1298-1313`.
- CSS effect: `app.css:1744-1750`.
- Test gap (scout §g Gap 1): no test asserts halo absence while submitting.

## Interface contract (level 5)

- **Produces:** gate in `targetSelections` (exact):
  ```ts
  function targetSelections(spec: ActiveInteractionSpec, session: InteractionSession): ReadonlySet<BoardTargetId> {
    if (session.status === "submitting") return EMPTY_TARGETS;
    /* existing mapping unchanged */
  }
  ```
  `withPinnedHandTarget` still applies afterwards (pin is navigation state, not an answer — pinned halo may remain; assert that explicitly in a test).
- **Consumes:** `InteractionSession { status: "editing" | "submitting", selectedChoiceIds }` — reducer untouched.
- **Errors:** none.
- **Invariants:** `selectedChoiceIds` never mutated by this change; rejection path round-trips to the identical halo set; zone selections (`zoneChoices`) gated identically.
- **Integration links:** trigger summon choice submit → dispatch `client.respond()` (`duel-store.ts:443`) → receive board `state` events while `responsePending` → observe no element carries `is-selected` until next prompt (component-test assertion via DOM class query).

## TDD

1. **Red** — unit test `targetSelections` with `status: "submitting"` → empty; component test DuelField: select + confirm → halo gone before next prompt arrives; reject → halo back.
2. **Green** — one-line gate.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| unit interaction/session read | session submitting | `targetSelections` = ∅ |
| component DuelField | submit answer, stale prompt held | no `.is-selected` in DOM |
| component DuelField | `submissionRejected` after submit | previous halo set restored exactly |
| component DuelField | pinned hand card while submitting | pin halo behavior asserted (kept) |

## Impl steps

- [ ] 1. Red tests (unit + component).
- [ ] 2. Gate in `targetSelections`.
- [ ] 3. Manual Chromium: normal summon → halo drops at resolve.

## Validation

- [ ] `npm run check:headless`; component gate (NOT in check:headless): `npx vitest run tests/component/DuelField.test.ts`
- [ ] manual check: summon monster — no lingering orange halo
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `fix(duel-field): drop selection halo while an answer is in flight`
