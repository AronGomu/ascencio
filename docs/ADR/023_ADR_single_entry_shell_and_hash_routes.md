# ADR-023: Single Entry Shell and Hash Routes

> Status: accepted
> Decided: 2026-08-14
> Owners: application-shell architecture
> Plan: [`../../ai-artifact/PLAN_2026_08_14_three_ui_restructure.md`](../../ai-artifact/PLAN_2026_08_14_three_ui_restructure.md) — T2, T5, T6, T7

## Context

Product ships two entry documents: `index.html` (duel, plus deck-builder prototype behind `#/prototype/deck-builder`) and `prototype.html` (visual novel). Two documents mean two bundles, two shells, two storage bootstraps, and a visible seam when moving between parts. ADR-022 accepted one modular monolith; it did not fix the entry, route table or navigation rules.

Hosting is static and offline-capable. Path routing needs server rewrites the deployment does not have.

## Decision

1. One entry document `index.html` → `src/main.ts` → `src/shell/AppShell.svelte`. `prototype.html` deleted.
2. Hash routing, parsed by a pure module `src/shell/routes.ts`:

```text
#/                        home hub
#/duel                    standalone duel
#/duel/session/{handoff}  story duel session
#/decks                   deck library
#/decks/{deckId}          one deck
#/story                   visual novel
#/admin                   hidden testing console
```

3. Unknown, malformed or oversized routes resolve to home. Ids match `/^[A-Za-z0-9_-]{1,128}$/`.
4. Shell owns route parsing, history, mounting, disposal and global recovery. Domains receive props and return intents; they never navigate directly.
5. Every domain root is lazily imported so each becomes its own chunk.
6. `#/admin` ships in the production build, is never linked from player UI, and obeys the `data-cy` contract.
7. `#/` is the product title screen, not the duel. Duel moves to `#/duel`.

## Alternatives rejected

- **Keep two HTML entries.** Duplicate shells/storage/release, visible seam between parts.
- **Path routing `/admin`, `/decks`.** Needs host rewrites; breaks offline/static deployment.
- **Router dependency.** Seven routes do not justify a library or its bundle cost.
- **Domain-owned navigation.** Cross-domain coupling; two domains could both claim a route.
- **Dev-only admin build.** Cannot exercise the packaged production bundle, which is what ships.

## Consequences

- Deep links work for decks and story duels; refresh is deterministic.
- Route table is a single integration-owned file; adding a route is one deliberate commit.
- Existing duel e2e specs move from `./` to `./#/duel`.
- Build verifier loses its prototype-entry checks; correctness gates stay.
- The shell becomes the only place that knows all three domains exist.
