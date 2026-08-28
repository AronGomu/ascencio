# T7 — One source for the acceptance scenario list (audit F20, issue #20)

## Context

`acceptance-scenario.ts` (find it with `git ls-files | grep acceptance-scenario.ts`) writes the same 21 ids
twice: a union type at `:1`–`:21` and a `ReadonlySet` at `:24`–`:45`.

`Set ⊂ union` is compile-checked (`new Set<AcceptanceScenarioId>([...])`), but the other direction is not.
An id present in the type and missing from the set makes `acceptanceScenarioId()` return `null`, the harness
renders nothing, and the acceptance spec fails as a selector timeout naming a `data-cy` that was never
mounted — a misleading failure a long way from its cause.

Audit proof: deleting `"card-list-stale"` from the set only keeps `tsc` green and makes the spec time out.

## Requirements

- R1. One declaration: `const SCENARIO_IDS = [...] as const`, with the type derived from it and the set built
  from it. Net effect ≈ −21 lines.
- R2. Removing an id becomes a compile error at its consumers, not a runtime null.
- R3. Exported names and their public shapes stay as they are — `AcceptanceScenarioId` stays a usable type,
  `acceptanceScenarioId()` keeps its signature and null-for-unknown behaviour.
- R4. Same 21 ids, same spelling, same order. This is a refactor; any id change is out of scope.

## Inputs

- the `acceptance-scenario.ts` file and its consumers (`grep -rn "AcceptanceScenarioId\|acceptanceScenarioId"`)
- `tests/unit/` card-list-dialog-model tests (the spec's named validation)
- `e2e-acceptance/` specs that pass scenario ids through the URL

## TDD

Refactor with existing coverage as the net, plus one new guard:

- A test asserting every id in the exported type/list resolves through `acceptanceScenarioId()` (the direction
  that was unguarded). Derive it from the single list so it cannot go stale.

## Test plan

- `npm run typecheck` (the compile-error property is the point).
- `npm run test:unit` green, card-list-dialog-model tests included.
- Prove the new direction: delete one id from the single list, confirm consumers fail to compile, restore.

## Impl steps

- [x] Collapse to `SCENARIO_IDS` + derived type + derived set. verify: typecheck
- [x] Add the coverage guard test. verify: green
- [x] Deletion probe: remove one id, run tsc, quote the error, restore. verify: error quoted in report

## Outputs

- Single-source scenario list; report quotes the deletion-probe compile error and the line delta.

## Validation

- [x] `npm run typecheck` exit 0
- [x] `npm run test:unit` exit 0
- [x] `npm run check:headless` exit 0
- [x] `git diff` shows the same 21 ids before and after (no id added, renamed or dropped)
