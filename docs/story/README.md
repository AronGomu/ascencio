# Story canon

> Status: working draft — Chapter 1 in design

Narrative canon lives here. It describes the world, eras, chapters, arcs and characters. Runtime story content under `src/story/content/` derives from these documents and never contradicts them, per [ADR-053](../ADR/053_ADR_story_canon_ownership.md).

## Structure

| Path | Owns |
|---|---|
| [`00_Global_Scenario/`](00_Global_Scenario/) | Shared universe, chapter model, philosophy, world rules and sheet method |
| [`01_DM_Era/`](01_DM_Era/) | Duel Monsters Era: Chapter 1 scenario, cast and arcs |
| [`02_GX_Era/`](02_GX_Era/) | GX Era: Chapter 2 scenario scaffold |
| [`archive/`](archive/) | Superseded story decisions; historical only |

Gameplay structures and asset rules are not story canon. They live in [`../game/`](../game/).

## Naming

- Era folders use `NN_Name_Era`: `01_DM_Era`, `02_GX_Era`, `03_5Ds_Era`, `04_ZEXAL_Era`, `05_ARC_V_Era`, `06_VRAINS_Era`.
- Arc folders do not receive numeric prefixes until their order is approved.
- Each arc owns `scenario.md` and `dialog.md`.
- Dialogue revisions use explicit suffixes such as `dialog.v2.md` or `dialog.alt-a.md`.
- Character files live inside the era where the character appears.

## Canon rules

- One fact has one owning document.
- Chapter scenario files own chapter-wide structure and vibe.
- Arc scenario files own arc beats, duels, outcomes and unlocks.
- Character sheets own personal history, personality, motivation, relationships and arc development.
- `dialog.md` owns approved dialogue for its arc. Draft dialogue remains labelled as draft.
- Unknown details stay marked `TBD`; no implementation detail becomes canon by implication.
- Archived material records past decisions but cannot override current canon.

## Runtime gap

The shipped visual-novel content remains provisional and does not yet implement this canon. Realignment is a separate runtime task involving story state, saves, encounter ids, handoff labels and tests.

## Provenance

The previous French source remains recoverable at commit `e411d03`:

```bash
git show e411d03:docs/story/scenario-fangame-bible.fr.md
```
