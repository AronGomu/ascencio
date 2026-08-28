# T6 — Remove the unreachable `supportedCodes` gate that widened the frozen battle API (audit F19, issue #19)

## Context

`src/battle/decks/selectable-decks.ts:45`:

```ts
    if (!codes.every((code) => supportedCodes.has(code))) continue;
```

runs only after `resolveDeck` returned `"ready"`. `validateDeckDraft` inside that resolution already errors on
any code absent from the catalog it was handed. Both production callers build the catalog and the supported
set from **one** `runtimeCatalog()` read:

- `src/battle/app/App.svelte:926`+`:940`
- `src/shell/screens/free-play-deck-listing.ts:36`–`:46`

so every code that survives `resolveDeck` is necessarily in `supportedCodes` and the branch never fires.

What the dead branch costs: an export on the frozen public battle API (`src/battle/index.ts:20`, frozen list
in `tests/unit/domain-boundaries.test.ts:206`), a field on the shell loader contract
(`src/shell/domain-loaders.ts:11`,`:60`), an extra awaited call on the listing path, and a docstring
(`selectable-decks.ts:19`–`:29`) claiming a protection it cannot give. The real defence against a partial
catalog is per-shard digest pinning, which is elsewhere.

Decision for this ticket (parent's, already made): **remove** the gate — parameter, export, frozen-list entry,
loader field, and both call sites' extra read. Widening the frozen API is a deliberate edit in the other
direction, so the domain-boundaries test changes on purpose.

**Reachability gate, check this first.** Re-derive at HEAD that no production path can pass `supportedCodes`
built from a *different* read than the catalog. Read both call sites above. If you find one that can diverge
(a fallback catalog, a cached read, a second source), the removal is wrong: stop the removal, take the
fallback instead — keep the gate and correct the docstring to state what it actually protects — and say in
the report which call site forced that choice.

## Requirements

- R1. `listSelectableDecks` loses the `supportedCodes` parameter (removal path).
- R2. `supportedDuelCardCodes` stops being exported from `src/battle/index.ts`; the frozen export list in
  `tests/unit/domain-boundaries.test.ts` is edited to match, deliberately.
- R3. `BattleDeckModule`'s `supportedDuelCardCodes` field is removed (`src/shell/domain-loaders.ts:11`,`:60`),
  and both call sites stop awaiting it.
- R4. `supportedDuelCardCodes` itself: keep the function if `src/decks/` or tests still use it meaningfully;
  delete it if the export was its only consumer. State which, with the grep that proves it.
- R5. The docstring at `selectable-decks.ts:19`–`:29` no longer claims snapshot-support filtering it no longer
  does. Keep the paragraph about not writing; rewrite only the claim that became false.
- R6. Behaviour for players is unchanged: the same decks are offered.

## Inputs

- `src/battle/decks/selectable-decks.ts`
- `src/battle/index.ts` (`:20`)
- `src/battle/app/App.svelte` (`:81`, `:926`, `:940`)
- `src/shell/domain-loaders.ts` (`:11`, `:60`)
- `src/shell/screens/free-play-deck-listing.ts` (`:36`–`:46`)
- `src/decks/catalog/runtime-catalog.ts` (`:68`, `:160` docstrings that mention the function)
- `tests/unit/domain-boundaries.test.ts` (`:206` frozen list)
- `tests/unit/battle/selectable-decks.test.ts`, `tests/unit/decks/runtime-catalog.test.ts`
- `tests/component/AppShell.test.ts` (`:56`), `tests/component/FreePlayMatchSetup.test.ts` (`:74`, `:209`)
- `AGENTS.md` "Boundary rules" — how the frozen list is meant to change

## TDD

This is a deliberate narrowing, so the tests move with it rather than a new red test leading:

- Update `tests/unit/battle/selectable-decks.test.ts` to the new signature; keep every case that still has
  meaning, delete only the cases that existed to exercise the removed gate.
- Edit the frozen export list in `tests/unit/domain-boundaries.test.ts` and confirm it fails before the
  `index.ts` edit and passes after — that is the proof the freeze is real.

## Test plan

- `npm run test:unit`, `npm run test:component` green.
- `npm run typecheck` green (the removed field is a contract change; tsc is the real gate here).
- `npm run check:headless` green.

## Impl steps

- [x] Reachability gate: read both production call sites, decide remove vs keep+docstring. verify: decision + evidence in report
- [x] (Removal path) drop the parameter and the gate in `selectable-decks.ts`. verify: tsc names every caller
- [x] Update both call sites to stop reading supported codes. verify: typecheck
- [x] Remove the export + frozen-list entry + loader field. verify: domain-boundaries test green after the intentional edit
- [x] Resolve `supportedDuelCardCodes` per R4. verify: grep quoted in report
- [x] Fix the docstring. verify: diff
- [x] Update the component test doubles that stub the removed field. verify: component suite green

## Outputs

- Narrower battle public API; report states removal-vs-keep decision, the grep for R4, and confirms the
  offered deck list is unchanged.

## Validation

- [x] `npm run typecheck` exit 0
- [x] `npm run test:unit` exit 0
- [x] `npm run test:component` exit 0
- [x] `npm run check:headless` exit 0
- [x] `grep -rn "supportedCodes\|supportedDuelCardCodes" src/ tests/` output in the report matches the chosen path
