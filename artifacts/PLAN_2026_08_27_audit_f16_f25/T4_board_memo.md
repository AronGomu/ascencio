# T4 — Rebuild the field view-model per state change, not per Worker message (audit F17, issue #17)

## Context

`src/battle/worker/duel.worker.ts:86` posts each event as its own message (`for (const message of messages)
post(message)`). Each message replaces `$duel`, and every `$:` block in `src/battle/app/App.svelte` recomputes
— including `mapSnapshotToBoard` at `:269`–`:272`:

```svelte
  $: boardResult =
    $duel.snapshot === null
      ? null
      : mapSnapshotToBoard($duel.snapshot, activeCardTexts, $duel.prompt);
```

Measured at 0.261 ms/call, with `createNavigation` O(4n²) inside it. A batch of N events maps the board N+2
times; N+1 of those produce an identical board. Each recompute allocates a new `duelBoard`, so the field
prop-diffs in full and `boardChanged` reports true once per message.

Validator downgraded this to low: under one 60 Hz frame per action at measured N, real and reproducible, no
observed slowdown. It is worth a memo, not a redesign.

`$duel.snapshot` is frozen and replaced only by a state event, so object identity is a sound memo key.

## Requirements

- R1. `boardResult` recomputes only when one of its real inputs changes identity: `$duel.snapshot`,
  `activeCardTexts`, `$duel.prompt`.
- R2. The event contract is untouched — do not batch, coalesce or reshape Worker messages.
- R3. `duelBoard` keeps referential stability across messages that do not change those inputs (that is what
  removes the downstream prop-diff).
- R4. Behaviour identical: same board for the same inputs, same `layout_profile_conflict` handling at `:277`,
  same prompt gating.
- R5. Memo lives in `App.svelte` beside the reactive statement, in the file's existing commented style.

## Inputs

- `src/battle/app/App.svelte` (`:255`–`:300` region; `mapSnapshotToBoard` import at `:18`)
- `src/battle/field/` — `mapSnapshotToBoard` and its result type
- `src/battle/worker/duel.worker.ts` (`:78`–`:95`, the per-message post)
- `tests/component/` duel app tests, `tests/unit/` field-mapping tests — find the existing coverage first

## TDD

Red first: a test that counts `mapSnapshotToBoard` invocations across one advance carrying N events and
asserts it is called once, not N+2. Spy/counter probe on the mapping function. The test must fail on the
current code with a count > 1 — quote both counts in the report.

## Test plan

- The counter test above.
- Existing component + unit suites green (`npm run test:unit`, `npm run test:component`) — the memo must not
  change any rendered output.

## Impl steps

- [x] Locate existing coverage for the App board wiring. verify: file paths quoted
      `tests/component/AppChrome.test.ts` (renders `App.svelte`, mocks `DuelWorkerClient`,
      covers `layout_profile_conflict` gating), `tests/component/AppLocalDecks.test.ts`,
      `tests/component/DuelField.test.ts` + `tests/unit/duel-field.test.ts` (mapping output).
      No existing test counted mapping calls.
- [x] Write the failing counter test. verify: fails with N+2-style count, quote it
      `tests/component/AppBoardMapping.test.ts` — `AssertionError: expected 9 to be 1`
      for an advance of 1 `state` + N=8 `event` messages (N+1 here; the audit's N+2
      counts a trailing `prompt` message, excluded from the measured window).
- [x] Add the identity memo at `App.svelte:269`. verify: counter test green at 1
      `npx vitest run tests/component/AppBoardMapping.test.ts` → `Tests  2 passed (2)`
- [x] Confirm prompt/conflict paths still derive from the memoised result. verify: existing tests green
      `boardResult` stays the sole source of `duelBoard`, `layoutProfileConflict` and
      `effectivePrompt`; those three statements are byte-identical. `npm run test:unit`
      `Tests  1694 passed (1694)`, `npm run test:component` `Tests  917 passed (917)`.

## Outputs

- Memoised `boardResult`; report quotes before/after call counts.

## Validation

- [x] `npm run test:unit` exit 0 — `Test Files  146 passed (146)` / `Tests  1694 passed (1694)`, `UNIT_EXIT:0`
- [x] `npm run test:component` exit 0 — `Test Files  102 passed (102)` / `Tests  917 passed (917)`, `COMPONENT_EXIT:0`
- [x] `npm run check:headless` exit 0 — format/lint/typecheck/legacy/unit/integration/vendor/assets/snapshot all ok, `EXIT:0`
- [x] Counter test fails when the memo is reverted (prove non-vacuous)
      `git checkout -- src/battle/app/App.svelte` with the test kept →
      `AssertionError: expected 9 to be 1 // Object.is equality` on both cases,
      `Tests  2 failed (2)`. Memo restored, `Tests  2 passed (2)`.
