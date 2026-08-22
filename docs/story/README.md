# Story canon

> Status: working draft — Chapter 1 in design · Last authored update 22 August 2026

The narrative canon of the game: what the world is, who the characters are, and what each chapter is about. Runtime story content under `src/story/content/` derives from these documents and never contradicts them (ADR-053).

English is the canon language. The documents here were split and translated from a French source authored on 22 August 2026; that original is preserved verbatim at commit `e411d03` and is recoverable with:

```bash
git show e411d03:docs/story/scenario-fangame-bible.fr.md
```

## Map

| Document | What it owns |
|---|---|
| [`scenario/01-concept.md`](scenario/01-concept.md) | The premise, the chapter = era structure, the tone and gameplay references |
| [`scenario/02-philosophy.md`](scenario/02-philosophy.md) | The objectivist foundation, hard magic, the per-chapter thesis, the moral trilogy |
| [`scenario/03-world-rules.md`](scenario/03-world-rules.md) | The god axiom, what a conflict is, why Duel Monsters, the duel rules, multi, Shadow Games, cheating, the social status of duelists |
| [`chapters/01-duel-monsters.md`](chapters/01-duel-monsters.md) | Chapter 1: the academy arc, the ZAPS plot, the 20-duel target |
| [`chapters/02-gx.md`](chapters/02-gx.md) | Chapter 2 notes |
| [`characters/README.md`](characters/README.md) | The roster, its status, the missing characters by urgency |
| [`characters/fynn.md`](characters/fynn.md) | The protagonist, complete |
| [`characters/creation-grid.md`](characters/creation-grid.md) | The Egri / Truby / McKee / Rand grid every sheet answers |
| [`open-questions.md`](open-questions.md) | What is still unanswered |

Each fact has one owning document. The others cross-link to it rather than restate it, so there is never a second copy to keep in sync.

## Known gap: the shipped placeholder contradicts this canon

The visual-novel domain currently ships the prototype content it was built with, which predates this canon and is superseded by it:

| Shipped | Canon |
|---|---|
| `PROLOGUE.title = "The Signal Beneath the City"`, characters Rin and Kael (`src/story/content/prologue.ts`) | Fynn, a duel academy, first year |
| `ChoiceId = "trust-rin" \| "challenge-rin" \| "observe-first"` (`src/story/model/story-state.ts`) | No such beat exists in canon |
| `LocationId = "old-arena" \| "archive" \| "hidden-gate" \| "card-shop"` (`src/story/model/story-state.ts`) | Academy grounds, the ZAPS plot |

`src/story/README.md` already declares that content provisional. Realigning it touches the state types, the save envelopes, the encounter ids, the handoff labels and their tests, so it is a round of its own and is not done here.

## How canon becomes content

The approved content pipeline — validated JSON scenes, maps, encounters and characters — is specified in [`../card-game-vn-handoff/04-narrative-and-map-design.md`](../card-game-vn-handoff/04-narrative-and-map-design.md) and is not implemented yet. These documents are the prose upstream of it: canon states what is true, the content pack states what the runtime plays.
