# T9 — Annotate the stale free-play-menu steps in the manual test checklist (audit F23, issue #23)

## Context

`FreePlayMenuScreen` was deleted in commit `6922f84` (ADR-054): `#/free-play` now opens the deck seats
directly, with no menu step and no "Start a match" button. That commit backfilled the R6 corrections but left
a set of earlier steps instructing a tester to exercise the deleted menu.

`artifacts/manual_test_checklist.md` is durable (never retired with a plan) and is the human-facing record, so
a step that cannot be performed is a real defect in it.

The stale set is wider than one section. Audit-identified hits (line numbers as of the audit; the file has
grown since — locate by text, not by line):

- T14: the `#/duel` redirect step ("the free-play menu loads (T16 put it on that route)")
- T15: the wide-window step pressing "Start a match" then "Start the duel"
- T16: the whole "The menu" block, plus the surviving "Start a match" steps after it
- T17: every step opening with "Start a match"

Sections written after ADR-054 (the R5 section that describes the seats opening directly, and steps already
carrying a "Corrected by…" note naming R5/ADR-054) are already correct — leave them.

## Requirements

- R1. Every stale step gains an inline annotation in the file's existing style, e.g.
  `(Corrected by R5 / ADR-054: #/free-play opens the deck seats directly.)`
- R2. Annotate; do not delete or rewrite the historical step text. The file records what each ticket asked a
  human to check — the corrections are additive, exactly as the existing `(Corrected by T17: …)` notes are.
- R3. A step that is still accurate keeps its text untouched. Judge per step, not per line match.
- R4. Do not touch other tickets' sections beyond the annotation, and do not reflow or reformat the file.
- R5. `ai-artifact/manual_test_checklist.md` is a separate divergent file — out of scope, do not open it for
  editing.

## Inputs

- `artifacts/manual_test_checklist.md` (T14–T17 sections; grep `free-play menu` and `Start a match`)
- `docs/ADR/054*` (the decision being cited — check the real filename and title before citing it)
- `git show 6922f84 --stat` (what was deleted; context only)

## TDD

Documentation. Evidence is the grep sweep below.

## Test plan

- `grep -n "free-play menu\|Start a match" artifacts/manual_test_checklist.md` — every hit is either annotated
  or is itself a correction note / a post-ADR-054 step that is already right. Report the classification for
  every hit; there were 28 at plan time.

## Impl steps

- [x] Sweep the grep hits and classify each: stale / already-corrected / accurate. verify: classification table in report
- [x] Annotate each stale hit inline. verify: diff shows annotation-only additions
- [x] Re-run the sweep. verify: no unannotated stale hit remains

## Outputs

- Annotated checklist; report carries the per-hit classification table.

## Validation

- [x] Grep sweep output in the report, every hit accounted for
- [x] `git diff --stat` touches `artifacts/manual_test_checklist.md` only
- [x] `git diff` contains no deleted step lines (additions and in-line appends only)
- [x] `npm run check:headless` exit 0
