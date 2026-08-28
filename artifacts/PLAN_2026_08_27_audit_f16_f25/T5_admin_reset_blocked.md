# T5 — Admin console must not report "Cleared" for a blocked deletion (audit F18, issue #18)

## Context

`src/shell/admin/admin-actions.ts:89`–`:101`:

```ts
  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(target.name);
    request.onsuccess = () => resolve();
    /* `blocked` means another tab still holds the database open. The delete
       stays queued, so the console reports success rather than hanging. */
    request.onblocked = () => resolve();
```

`AdminConsole.svelte:87` then sets `status = \`Cleared ${target.label}.\``. A blocked delete is *queued*, not
performed — the database is still there until the other tab closes it. The operator is told the reset
happened when it did not.

Resolving on `blocked` is deliberate (the alternative was hanging). The fix is not to hang again: it is to
report what actually happened.

## Requirements

- R1. `resetStorageTarget` returns a discriminated result distinguishing "deleted" from "blocked — still open
  elsewhere". Errors keep throwing as they do today.
- R2. `AdminConsole.runReset` renders the blocked case as its own status telling the operator the database is
  still open in another tab; only the deleted case says "Cleared".
- R3. No hang: the blocked path still settles immediately.
- R4. `localstorage` targets keep their current behaviour and shape a deleted-style result.
- R5. Comment at `:92`–`:93` updated to match the new behaviour (it currently states the wrong conclusion).

## Inputs

- `src/shell/admin/admin-actions.ts` (`resetStorageTarget`, `:77`–`:102`)
- `src/shell/admin/AdminConsole.svelte` (`runReset`, `:81`–`:93`)
- `tests/unit/admin-actions.test.ts`
- `tests/component/AdminConsole.test.ts`
- HTML element contract in `AGENTS.md` if you add any element (`data-cy` required, unique, kebab-case)

## TDD

Red first:

- `tests/unit/admin-actions.test.ts` — `blocked delete reports not-cleared` (fake IDB factory firing
  `onblocked`; assert the returned result, not a throw)
- `tests/component/AdminConsole.test.ts` — blocked reset shows the still-open status, not "Cleared"

## Test plan

- Both tests above.
- Existing admin unit + component tests green (the success and error paths must not change wording).

## Impl steps

- [x] Write both failing tests. verify: fail for the right reason
- [x] Add the discriminated result to `resetStorageTarget`; fix the comment. verify: unit test green
- [x] Branch the status in `runReset`. verify: component test green
- [x] Update every other caller of `resetStorageTarget` if any exists. verify: `grep -rn resetStorageTarget src/ tests/` — only `AdminConsole.svelte` and the two test files

## Outputs

- [x] Blocked deletes reported honestly; report quotes the exact new status string. verify: status string quoted in report
- [x] Append the manual steps for this slice to `artifacts/manual_test_checklist.md` under its own heading
  (two tabs open on the admin console, reset while the other tab holds the DB). verify: new heading present in the file

## Validation

- [x] `npm run test:unit` exit 0 — 146 files, 1695 tests passed
- [x] `npm run test:component` exit 0 — 102 files, 919 tests passed
- [x] `npm run check:headless` exit 0
- [x] New tests fail against the pre-fix behaviour (prove non-vacuous) — red run: 4 failed, blocked component test received `Cleared Free-play deck library.`
