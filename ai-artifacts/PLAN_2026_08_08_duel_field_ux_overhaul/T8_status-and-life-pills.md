# T8: Priority, phase and life pills

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T4, T7
**Commit outcome:** The field's top-right corner shows `prio-pill - phase-pill`, green `Choose Action` when it is your decision and orange `Waiting Opponent` otherwise, and both players' life points show as pills inside the field.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback item 14, plus the life-point pills agreed as assumption A15 because hiding `duel-hud` (T5) removed the only LP readout.
- This slice: two tiny presentational components, two pure helpers, and prop plumbing from `App.svelte` through `DuelFieldErrorBoundary.svelte` into `DuelField.svelte`.
- Out of scope here: chips (T9), drag (T10), preview (T11). Do not change any interaction behaviour.
- Assumptions in force: A15.

## Requirements

- Pills render at the top-right of `section.duel-field`, in the order priority pill, a literal `-` separator, phase pill.
- Priority pill: green background, text `Choose Action`, when a prompt is waiting on the player and no response is in flight. Otherwise orange background, text `Waiting Opponent`.
- Phase pill shows a human phase name: `Draw`, `Standby`, `Main 1`, `Battle Start`, `Battle Step`, `Damage`, `Damage Calculation`, `Battle`, `Main 2`, `End`, `Unknown`.
- Life pills: opponent top-left, player bottom-left, formatted with thousands separators and the suffix `LP`.
- Pills never intercept pointer events (`pointer-events: none`) so they cannot block a card underneath.
- Pills are announced once, not on every re-render: the pill group is one `aria-live="polite"` region.
- No change to `DuelHud`'s own turn/phase header.

## Inputs

- Create: `src/app/presentation/duel-phase-label.ts`, `src/app/prompts/duel-priority.ts`, `src/app/components/duel-field/FieldStatusPills.svelte`, `src/app/components/duel-field/LifePointsPill.svelte`, `tests/unit/duel-phase-label.test.ts`, `tests/unit/duel-priority.test.ts`, `tests/component/FieldStatusPills.test.ts`.
- Edit: `src/app/App.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/components/DuelField.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- **From Depends (T4):** `.duel-field-board` is `width: 100%` and `.duel-field` no longer scrolls, so absolute corners inside the field are stable. **From Depends (T7):** `.field-end-turn` already occupies `right: .75rem; bottom: .75rem` of the field; the new pills must not use that corner.
- Read only: `src/duel/contracts/public-duel-state.ts` (`DuelPhase` union with exactly eleven members, `PublicDuelState.phase`, `players[n].lifePoints`, `PlayerIndex`), `src/app/stores/duel-store.ts` (`DuelViewState.prompt`, `DuelViewState.responsePending`, `DuelViewState.snapshot`).

## Exact API to create

```ts
// src/app/presentation/duel-phase-label.ts
import type { DuelPhase } from "../../duel/contracts/public-duel-state.ts";

export const DUEL_PHASE_LABELS: Readonly<Record<DuelPhase, string>> = Object.freeze({
  draw: "Draw",
  standby: "Standby",
  main1: "Main 1",
  battleStart: "Battle Start",
  battleStep: "Battle Step",
  damage: "Damage",
  damageCalculation: "Damage Calculation",
  battle: "Battle",
  main2: "Main 2",
  end: "End",
  unknown: "Unknown",
});

export function duelPhaseLabel(phase: DuelPhase): string;
```

```ts
// src/app/prompts/duel-priority.ts
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";

export function hasDuelPriority(
  prompt: PlayerPrompt | null,
  responsePending: boolean,
): boolean;
```

Returns `prompt !== null && !responsePending`.

```svelte
<!-- src/app/components/duel-field/FieldStatusPills.svelte -->
export let hasPriority = false;
export let phase: DuelPhase = "unknown";
```

```svelte
<!-- src/app/components/duel-field/LifePointsPill.svelte -->
export let player: PlayerIndex;
export let lifePoints: number;
```

New `DuelField.svelte` props, all optional so existing component tests keep compiling:

```ts
export let phase: DuelPhase = "unknown";
export let hasPriority = false;
export let lifePoints: readonly [number, number] | null = null;
```

## data-cy contract added here

`field-status-pills`, `prio-pill`, `field-status-pills-separator`, `phase-pill`, `life-pill-p0`, `life-pill-p1`.

## TDD

1. **Red** — write the three test files first; record failures.
2. **Green** — helpers, components, plumbing, CSS.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `every phase has a label` | `Object.keys(DUEL_PHASE_LABELS)` | length 11, and every `DuelPhase` member is a key |
| `phase label maps main1` | `duelPhaseLabel("main1")` | `Main 1` |
| `phase label maps damageCalculation` | `duelPhaseLabel("damageCalculation")` | `Damage Calculation` |
| `priority requires a prompt` | `hasDuelPriority(null, false)` | `false` |
| `priority requires no pending response` | `hasDuelPriority(prompt, true)` | `false` |
| `priority granted` | `hasDuelPriority(prompt, false)` | `true` |
| `priority pill reads Choose Action` | render `FieldStatusPills` with `hasPriority: true` | `[data-cy="prio-pill"]` text is `Choose Action` and its `classList` contains `is-priority` |
| `priority pill reads Waiting Opponent` | `hasPriority: false` | text is `Waiting Opponent`, no `is-priority` class |
| `phase pill reads the phase` | `phase: "battle"` | `[data-cy="phase-pill"]` text is `Battle` |
| `separator renders between the pills` | any | `[data-cy="field-status-pills-separator"]` text is `-` |
| `pill group is a live region` | any | `[data-cy="field-status-pills"]` has `aria-live="polite"` |
| `life pill formats thousands` | `LifePointsPill` with `lifePoints: 8000, player: 0` | `[data-cy="life-pill-p0"]` text is `8,000 LP` |
| `field mounts pills and both life pills` | render `DuelField` with `lifePoints: [8000, 7500]` | `[data-cy="field-status-pills"]`, `[data-cy="life-pill-p0"]` and `[data-cy="life-pill-p1"]` all inside `[data-cy="duel-field"]` |
| `field omits life pills without a snapshot` | `lifePoints: null` | neither life pill is present |
| e2e `field shows priority and phase` | production build, own turn | `[data-cy="prio-pill"]` reads `Choose Action` and `[data-cy="phase-pill"]` matches `/Main 1|Draw|Standby/` |
| e2e `field shows both life totals` | production build | `[data-cy="life-pill-p0"]` and `[data-cy="life-pill-p1"]` both read `8,000 LP` at duel start |

## Impl steps

- [ ] 1. Create `tests/unit/duel-phase-label.test.ts` and `tests/unit/duel-priority.test.ts` with rows one to six; record failures.
- [ ] 2. Create `src/app/presentation/duel-phase-label.ts` and `src/app/prompts/duel-priority.ts` exactly as specified; re-run to green.
- [ ] 3. Create `tests/component/FieldStatusPills.test.ts` (`// @vitest-environment jsdom`) with rows seven to twelve; record failures.
- [ ] 4. Create `src/app/components/duel-field/FieldStatusPills.svelte`: `div.field-status-pills[data-cy="field-status-pills"][aria-live="polite"][aria-atomic="true"]` containing `span.prio-pill[data-cy="prio-pill"]` with `class:is-priority={hasPriority}`, `span[data-cy="field-status-pills-separator"][aria-hidden="true"]` holding `-`, and `span.field-phase-pill[data-cy="phase-pill"]` holding `duelPhaseLabel(phase)`.
- [ ] 5. Create `src/app/components/duel-field/LifePointsPill.svelte`: `p.life-pill[data-cy={`life-pill-p${player}`}]` with `class:is-opponent={player === 1}`, `class:is-self={player === 0}`, `aria-label={`${player === 0 ? "Your" : "Opponent"} life points, ${lifePoints}`}`, text `` `${lifePoints.toLocaleString()} LP` ``.
- [ ] 6. In `src/styles/app.css`, add `--success: #7ee2a8;` to the `:root` token block next to `--warning`.
- [ ] 7. In `src/styles/app.css`, add `.field-status-pills { position: absolute; z-index: var(--duel-field-layer-control); top: .75rem; right: .75rem; display: flex; align-items: center; gap: .4rem; pointer-events: none; }`.
- [ ] 8. In `src/styles/app.css`, add `.prio-pill, .field-phase-pill { padding: .25rem .6rem; border-radius: 999px; font-size: .72rem; font-weight: 800; white-space: nowrap; }`, `.prio-pill { color: #2b1d00; background: var(--warning); }`, `.prio-pill.is-priority { color: #04210f; background: var(--success); }`, `.field-phase-pill { color: #08101f; background: #cfe0f5; }`.
- [ ] 9. In `src/styles/app.css`, add `.life-pill { position: absolute; z-index: var(--duel-field-layer-control); left: .75rem; margin: 0; padding: .3rem .7rem; border: 1px solid var(--border); border-radius: 999px; background: rgb(8 16 31 / .82); color: var(--warning); font-weight: 800; pointer-events: none; }`, `.life-pill.is-opponent { top: .75rem; }`, `.life-pill.is-self { bottom: .75rem; }`.
- [ ] 10. In `src/app/components/DuelField.svelte`, add the three new exported props with their defaults, import both new components, and render `<FieldStatusPills {hasPriority} {phase} />` plus, when `lifePoints !== null`, `<LifePointsPill player={1} lifePoints={lifePoints[1]} />` and `<LifePointsPill player={0} lifePoints={lifePoints[0]} />` as children of `section.duel-field`.
- [ ] 11. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, add the same three props with the same defaults and forward them to `<DuelField … />`.
- [ ] 12. In `src/app/App.svelte`, import `hasDuelPriority`, add `$: fieldLifePoints = $duel.snapshot === null ? null : ([$duel.snapshot.players[0].lifePoints, $duel.snapshot.players[1].lifePoints] as const);` and pass `phase={$duel.snapshot?.phase ?? "unknown"}`, `hasPriority={hasDuelPriority($duel.prompt, $duel.responsePending)}`, `lifePoints={fieldLifePoints}` to `<DuelFieldErrorBoundary … />`.
- [ ] 13. Run `npx vitest run tests/component/FieldStatusPills.test.ts` to green.
- [ ] 14. Add the two DuelField rows to `tests/component/DuelField.test.ts` and run it.
- [ ] 15. In `e2e/duel-smoke.spec.ts`, extend the `production bundle initializes …` test with the two e2e rows; the pre-existing `page.getByText("8,000 LP").first()` assertion may now resolve to a life pill, which is correct — leave it but scope it to `[data-cy="life-pill-p0"]`.
- [ ] 16. Run `npm run test:e2e` to green.
- [ ] 17. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green.

## Outputs

- Files created: `src/app/presentation/duel-phase-label.ts`, `src/app/prompts/duel-priority.ts`, `src/app/components/duel-field/FieldStatusPills.svelte`, `src/app/components/duel-field/LifePointsPill.svelte`, three test files.
- Files edited: `src/app/App.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/components/DuelField.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `duelPhaseLabel`, `DUEL_PHASE_LABELS`, `hasDuelPriority`; three new `DuelField` props consumed again by T9 and T10.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/duel-phase-label.test.ts tests/unit/duel-priority.test.ts tests/component/FieldStatusPills.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run test:e2e` passes
- [ ] manual check: `npm run dev`, confirm the top-right reads `Choose Action - Main 1` on your turn and flips to an orange `Waiting Opponent` while the opponent acts, and confirm both LP pills update when damage is dealt
- [ ] app functional — pills never block a click on the card beneath them
- [ ] commit msg draft: `feat(field): show priority, phase and life points on the field`
