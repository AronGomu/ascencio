# ADR-010: In-Field Phase Navigation And The Retired Status Pills

> Status: accepted; planned
> Decided: 2026-08-09
> Owners: field presentation architecture
> Plan: [`../../ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`](../../ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md) — T3, T11

## Context

The field currently reports its state through two absolutely positioned pills in the top-right corner: `Choose Action` / `Waiting Opponent`, and the current phase. Phase *changes* happen somewhere else entirely — the `End turn` button pinned to the bottom of the field, and `Enter Battle Phase` / `Enter Main Phase 2` buttons buried in the field action bar's global-choice row.

The product owner wants the six phases laid out across the middle of the board, split by the shared extra monster zones, with the current phase haloed and the legal transitions clickable; the `End turn` button moved to the far right between the two banished zones; and the corner pills gone.

Overlaying anything on this board is not free. The previous overhaul lost a working session to a field action bar that painted over card targets and swallowed 344 retried Playwright clicks. The board's geometry is fixed by `duel-field-layout.ts` and has exactly one free horizontal band.

## Geometry

Zone extents as percentages of the board:

| Zone | x | y |
| --- | --- | --- |
| p1 main monster row | 34.4% – 74.2% | 34.7% – 50.6% |
| p0 main monster row | 34.4% – 74.2% | 65.3% – 81.1% |
| shared extra monster left | 46.1% – 52.5% | 50.0% – 65.8% |
| shared extra monster right | 53.9% – 60.3% | 50.0% – 65.8% |
| p1 banished | 88.3% – 94.7% | 34.7% – 50.6% |
| p0 banished | 88.3% – 94.7% | 65.3% – 81.1% |

The band **y 51% – 64%** is free of every zone except the two extra monster zones, which occupy **x 46.1% – 60.3%** within it. That leaves two usable pockets: `x < 46.1%` and `x > 60.3%`.

## Decision

1. `PhaseStrip.svelte` renders six chips inside the band: `Draw`, `Standby`, `Main 1` right-aligned in the left pocket; `Battle`, `Main 2`, `End` left-aligned in the right pocket. The extra monster zones are the divider the product owner described.
2. The strip container is `pointer-events: none`. Only a chip that is currently a `<button>` gets `pointer-events: auto`.
3. A chip is a `<button>` only when the engine is offering that transition — `battlePhase` → `Battle`, `mainPhase2` → `Main 2`, `endPhase` → `End`. Everything else renders as a `<span>`. `Draw` and `Standby` are therefore never clickable, because ocgcore never offers them as a target.
4. The current phase carries a blue halo (`box-shadow` in `--accent`); available chips are full-contrast; the rest are muted.
5. Phase families collapse onto one chip: `battleStart`, `battleStep`, `damage`, `damageCalculation` and `battle` all light `Battle`. `unknown` lights nothing.
6. `End turn` moves to `right: 1%; top: 57.5%`, inside the same band and vertically between the two banished zones. It stays alongside the strip's `End` chip; the product owner asked for both.
7. `FieldStatusPills.svelte` and `LifePointsPill.svelte` are deleted. Life points move to the duel header; the priority state moves to the card preview panel's status line, which also carries the chain question from ADR-009's sibling change.
8. `hasDuelPriority` survives the deletion of the pill that used it. The preview panel consumes it as a `hasPriority` prop and exposes `data-has-priority="true"`, keeping a stable hook for the browser suite.

## Alternatives rejected

- **Centre the strip on y 50%.** Overlaps the bottom edge of the p1 monster row by ~3.6% and puts a button over `p1:mainMonster:1`. This is the exact failure mode that cost the previous run a session.
- **A full-width strip across the band.** Would sit on top of the extra monster zones. The product owner specifically asked for the split around them, and the split is also what keeps the zones clickable.
- **Keep the phase pill as well.** Two phase readouts in one viewport, one of them redundant. Item 15 asked for it to go.
- **Make every phase clickable and let the engine reject illegal ones.** The engine does not offer them, so there is no response to send; a click would either be inert or fabricate a phase change the rules layer never authorised.
- **Move the priority pill into the header.** The header already carries two avatars and two life-point readouts; the status belongs next to the card the player is looking at.

## Consequences

- The field gains a fourth absolutely positioned overlay. Every one of them now lives in the y 51% – 64% band or outside the board's zone extents, and the chromium suite's responsive composition test is the gate that keeps it that way.
- `DuelField` and `DuelFieldErrorBoundary` drop their `hasPriority` and `lifePoints` props. `DuelField`'s public surface shrinks.
- Phase transitions become discoverable without opening the action bar, and the action bar's global-choice row keeps them too — the same choice reachable two ways, which is acceptable for a navigation control.
- `PHASE_SLOT_LABELS` is a second label table beside `DUEL_PHASE_LABELS`. They answer different questions (six navigation slots versus eleven engine phases) and are deliberately not merged.
</content>
