# Grill: decks_feedback (assumption audit)

## Round 1 — Duel start · Builder UX · Storage · Process

| # | Question | Answer | Precision |
| --- | --- | --- | --- |
| 1 | Which bundled deck is the opponent's "Shadow deck"? | Shaddoll (`preset:shaddoll`) | — |
| 2 | Opponent seat UI | Fixed static line, no opponent picker | — |
| 3 | Preview pane content | Shared panel only; copies/limit stay on tile badges | — |
| 4 | Reorder/sort undoable? | Not undoable — history is membership-only | — |
| 5 | Keyboard drag path | Retired with the drop buttons; tap menu stays for small screens | — |
| 6 | Restore autosave of deleted deck | Recreate the deck under its logged name, then restore | — |
| 7 | Player seat precedence | Persisted last choice wins; default fills gaps | — |
| 8 | Starter Deck seeding | Reseed whenever no default exists and no deck named "Starter Deck" | — |
| 9 | Branch routing T2/T15 | Split per ADR-022: T2 via `main`, T15 via `duel`, `deck` lane rebases | — |
| 10 | Sort buttons scope | All three zones in one click | — |

## Facts (scout)

- No bundled preset named "Shadow"; catalog = mvp-player, mvp-opponent, burning-abyss, nekroz, shaddoll, spellbook — source: `src/battle/duel/presets/deck-catalog.ts`
- Editor catalog lacks art because `packagedCatalogRecords` never passes `imageUrl`; art served at `runtime/images/{code}.jpg` per `__ACTIVE_IMAGE_MANIFEST__` — source: `src/decks/catalog/packaged-catalog.ts`, `vite.config.ts`
- `CardPreviewPanel` is battle-internal; `src/battle/index.ts` cannot export it without making the duel chunk eager — source: `tests/unit/domain-boundaries.test.ts` ALLOWANCES comment
- Legacy deck-DB migration opens the prototype database with the shared `DECK_DATABASE_VERSION`; a version bump without pinning would delete player decks via the created-husk path — source: `src/decks/deck-database.ts` `openLegacyDatabase`
- Stored-history consistency compares zone lists in exact order (`join(",")`); unrecorded reorders would fail validation without the multiset change — source: `src/decks/indexeddb-deck-repository.ts` `sameHistorySnapshot`

## Shared understanding

- Goal: implement all 24 items of `feedback-decks.md` per `ai-artifact/PLAN_2026_08_16_decks_feedback.md` (15 tickets, T1–T15), each ticket one commit, app green after each.
- Settled: opponent = fixed Shaddoll line; preview = shared duel panel only; history/undo/autosave are membership-only (positions never recorded, reorder/sort not undoable); keyboard drag retired, tap menu stays; deleted-deck autosaves recreate the deck on restore; player seat = persisted choice first, default deck as fallback; Starter Deck reseeds when absent; sort buttons act on all three zones; T2 lands via `main`, T15 via `duel`, rest on `deck`.
- Assumptions: none remaining — all ten promoted to decisions (round 1).
- Out of scope: engine/worker/protocol, duel field, story domain, multiplayer, image-cache pipeline changes, new card data, reopening the opponent picker ("for now" clause logged for a future plan).

**User confirmed** — 2026-08-16. Grill closed; plan execution-ready.
