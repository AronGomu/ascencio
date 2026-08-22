# ADR-053: Story canon lives in `docs/story/`

Status: accepted · 2026-08-22 · Source import: `e411d03`
Relates: ADR-022 (domain boundaries), ADR-027 (story duel handoff)

## Context

The narrative was, until now, whatever the prototype happened to contain. `src/story/content/prologue.ts` holds an authored prologue that `src/story/README.md` itself labels "provisional English-only samples": characters Rin and Kael, a title, three choice ids and four map locations, none of which came from a design document.

A scenario bible now exists — the world's rules, the philosophical foundation, the protagonist, the chapter architecture, the casting. It is prose, it is evolving, and it has open questions. Left unplaced, it would have had two plausible homes with opposite lifecycles: `artifacts/`, which is deleted when a round ends, or `src/story/content/`, which is runtime data rather than the reasoning behind it. Either choice leaves the next round with two candidate sources of story truth and no rule saying which wins.

## Decision

Narrative canon lives in **`docs/story/`**, organised by concern: `scenario/`, `chapters/`, `characters/`, plus `open-questions.md`.

- Canon is **prose and durable**. It states what is true about the world, the characters and the chapters. It is edited in place as the story is designed.
- Runtime story content under `src/story/content/` — and, later, the validated JSON packs of the approved content pipeline — **derives from canon and never contradicts it**. Where the two disagree, canon is right and the content is a bug.
- Canon is **English**. The bible was authored in French; the original is preserved verbatim at `e411d03` and recoverable with `git show e411d03:docs/story/scenario-fangame-bible.fr.md`, so the translation has an auditable source rather than a second copy on disk to keep in sync.
- Each fact has **one owning document**. Other documents cross-link to it. A restated fact is a fact that will drift.
- Canon carries no implementation claim. A character with a sheet is not a character in the build.

## Consequences

- A story question has one address. `docs/story/README.md` routes to the document that owns the answer, and `AGENTS.md` routes to that README.
- The shipped prologue is now formally superseded rather than merely provisional. Realigning it touches the state types, the save envelopes, the encounter ids and the handoff labels, so it is scheduled as its own round; the gap is recorded in `docs/story/README.md` until then.
- Answering an open question means editing the owning canon file and ticking the line in `open-questions.md`, not accumulating answers in a separate log.
- Translation is interpretation. One genuinely ambiguous line is marked inline in `docs/story/scenario/03-world-rules.md` rather than silently smoothed; further ambiguities get the same treatment.
