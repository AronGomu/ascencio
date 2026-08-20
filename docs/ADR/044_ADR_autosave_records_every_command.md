# ADR-044: The Autosave Log Records Every Accepted Command

> Status: accepted; planned
> Decided: 2026-08-20
> Owners: decks storage architecture
> Amends: ADR-037 §3 (position-blind history), ADR-038 §3 (autosave log)
> Plan: [`../../ai-artifact/PLAN_2026_08_20_decks_feedback_round_2.md`](../../ai-artifact/PLAN_2026_08_20_decks_feedback_round_2.md) — T7

## Context

ADR-037 §3 made history membership-only and, in the same rule, said `reorder` and `sort` "append nothing to the autosave log". Feedback round 2 asks the opposite of the second half: "auto save on each update of the deck, extra and side (card position movements included)".

The two halves were never the same requirement. Undo answers "put back the card I just removed"; a position in the undo stack fills it with noise and makes `Ctrl+Z` fight the player's manual ordering — that reasoning still holds. The log answers "what did this deck look like a moment ago", and a deck the player spent ten minutes ordering *is* a different deck when the order is gone.

The deck itself was already saved on every accepted command; only the log entry was suppressed.

## Decision

1. `DeckBuilderController.mutate` appends one autosave entry for **every** accepted command, including `reorder` and `sort`.
2. `DeckHistory` is unchanged: `pushDeckUpdate` still compares zone lists as multisets, positional commands still push nothing, and undo/redo still restore membership only. ADR-037 §1, §2 and §4 stand; §3's autosave sentence is superseded here.
3. Appending stays best-effort and un-awaited, and the 100-entry cap (`MAXIMUM_DECK_AUTOSAVES`) is unchanged: a log that is slow, full or broken must never fail or delay the edit it describes.
4. Restoring a logged entry replays its exact lists, so a restore brings back the recorded order as well as the recorded cards.

## Consequences

- The 100-entry window covers less wall-clock time for a player who reorders a lot. That is the trade the feedback asked for: the log is now a truthful record of the deck, not a filtered one.
- No schema change. Entries already carry the full `main` / `extra` / `side` lists.

## Alternatives rejected

- Record positions in history too: `Ctrl+Z` would undo a drag the player made on purpose, which ADR-037 rejected for good reasons that have not changed.
- Coalesce consecutive reorders into one entry: cheap to describe, hard to bound (how long is "consecutive"?), and it makes the log lie about when the deck looked how.
</content>
