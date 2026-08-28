# Final Implementation Report — deck select screen + duel field / right pane

Round source: `PLAN_2026_08_28_deck_select_and_duel_field` (plan index committed at `e1d6692`, retired at the end of this round per the project's document rules).

Orchestration: `make-parallel-aron`. One git worktree per ticket under `/home/aron/projects/ascencio-wt/<ticket>`, branch `wt/<ticket>`, merged into `main` by the orchestrator. Each worktree reflink-copies `node_modules/` and `generated/` from the primary checkout, so every worker runs the real gates.

## Ticket State List

All 25 planned tickets plus 3 orchestrator-opened follow-ups are merged into `main`. Round range: `e1d6692..7c89a9b`.

| Ticket | Track | Goal | State | Merge SHA |
| ------ | ----- | ---- | ----- | --------- |
| T1 | D | Field chrome CSS | MERGED | `48519bc` |
| T2 | D | Action chips bottom stack | MERGED | `4e7316b` |
| T3 | D | Xyz material stack render | MERGED | `55182c3` |
| T4 | D | Xyz material dialog | MERGED | `a6dd94e` |
| T5 | D | Hand activation drop zone | MERGED | `699b4b1` |
| T6 | D | Selection dashed borders | MERGED | `84e5d04` |
| T7 | D | Summon status panel | MERGED | `6da4b6a` |
| T8 | D | Pile halo actionability | MERGED | `4436175` |
| T9 | D | Rail active player + avatar | MERGED | `f4c9337` |
| T10 | D | Cir trigger diagnostic | MERGED | `5b4b50a` |
| T11 | K | deck-select lib skeleton | MERGED | `1ba254a` |
| T12 | K | DeckTile | MERGED | `1ff7145` |
| T13 | K | Kebab menu | MERGED | `674ca1a` |
| T14 | K | Screen desktop layout | MERGED | `90abb02` |
| T15 | K | Seat panel | MERGED | `e393375` |
| T16 | K | Mobile layout | MERGED | `3cc631a` |
| T17 | K | Hover previews | MERGED | `3c37a6a` |
| T18 | K | SelectableDeck lists + updatedAt | MERGED | `bc0102a` |
| T19 | K | Opponent roster | MERGED | `e3fe632` |
| T20 | K | Free-play duel start swap | MERGED | `cd73bde` |
| T21 | K | Free-play deck management ops | MERGED | `d12ece5` |
| T22 | K | Deck-editor library swap | MERGED | `2f7a6c6` |
| T23 | K | Story save favourites | MERGED | `00b4ea0` |
| T24 | K | Story pre-battle swap | MERGED | `fc297fd` |
| T25 | — | Budgets + checklist + glossary + docs | MERGED | `7c89a9b` |

Follow-up tickets the orchestrator opened for defects the plan did not anticipate (ticket bodies were written to `.tmp/`, which is scratch — the reasoning is reproduced under Assumptions below):

| Ticket | Goal | State | Merge SHA |
| ------ | ---- | ----- | --------- |
| T2b | Repoint the hand-zoom acceptance probe above the bottom-anchored chip stack | MERGED | `27d4e2d` |
| T6b | Suppress the Select chip on the hand-zoom overlay during a selection prompt | MERGED | `962885e` |
| TD1 | Repair the hand-drag regression T2 introduced | MERGED | `bc79588` |

## Gates on merged `main` (`7c89a9b`)

Run by the orchestrator on the integrated trunk, not inherited from a worker's branch:

| Gate | Result |
| ---- | ------ |
| `npm run check:headless` | exit 0 — unit `156 files / 1778 tests`, integration `15 files / 39 tests`, plus format, lint, typecheck, vendor/assets/snapshot verify |
| `npm run test:component` | exit 0 — `110 files / 1049 tests` |
| `npm run build` (incl. `build:verify`) | exit 0 — `"status": "ok"`; chunk bytes shell 93,373 · battle 346,261 · deck-editor 134,769 · story 132,815 |
| `npm run test:e2e` | exit 0 — `91 passed (3.6m)` |
| `npm run test:acceptance` | 43 passed, **1 failed** — `e2e-acceptance/full-height-field.spec.ts:495 "duel colors resolve from tokens"`. Verified to fail identically at `e1d6692`, before any ticket of this round landed. Pre-existing, not caused here, not fixed here. |

Byte budgets needed no raise at the close. Two were raised mid-round by the tickets that hit a hard `build:verify` failure — the `story` and `deck-editor` domain closures, both `143_750 → 172_500` in `scripts/lib/domain-chunk-closure.ts`. Re-measuring at the close reproduced both numbers exactly from that file's own formula, so both stand.

## Assumptions

### O1 — ship depth per ticket

The plan was already red-teamed and coherence-reviewed (plan `## Assumptions` A22/A23, M2), so each worker runs `ship` at `mode=fast` by default, raising to `mode=balanced` for tickets that touch the worker/protocol or persisted state (T4, T10, T18, T19, T23). The real gate is unchanged either way: every ticket's own Validation block runs `npm run check:headless` and `npm run test:component`.

### O2 — publish policy

Workers commit on their own `wt/<ticket>` branch and never push. The orchestrator merges each branch into `main` (`--no-ff`) and owns every conflict, per J1 (no history rewriting) and G4 (one writer per worktree).

### O3 — shared `generated/` snapshot

`generated/` (2.3 GB, gitignored) is reflink-copied per worktree rather than shared by symlink, so a worker cannot corrupt the primary checkout's snapshot and parallel Vite caches cannot race. Copies cost no disk on btrfs.

### O4 — T2b: the bottom-anchored chip stack ate the acceptance probe's target strip

T2 (feedback item 2) bottom-anchors the card action chips. `e2e-acceptance/hand-zoom.spec.ts` probed a point between the chips' bottom edge and the card's bottom edge to prove the zoomed hand card still takes the pointer; measured in Chromium after T2, that strip shrank from ~29.5px to 0.0156px and the case failed (4/4 before, 3/4 after). The free card area survives, it moved above the chips.

Three options existed: (a) repoint the probe above the chips, (b) cap the overlay stack height so a strip survives below it, (c) leave the overlay chips centred and bottom-anchor only card-mounted chips. Chose (a) — (b) and (c) both walk back a direct owner directive. The invariant under test is unchanged; only the probe point moved, and it is now derived from live geometry rather than a pixel literal.

### O5 — T6b: item 5 had to reach the hand-zoom overlay too

T6 removed the Select chip from cards in place but listed the hand-zoom overlay as out of scope; its own review then found that a hand selection candidate still chipped through `HandZoomOverlay`, because `handChipChoices` strips only `activate` and a selection choice carries `action: "select"`. Opened T6b to apply T6's own stated remedy — gate the overlay's `choices` on the prompt kind, mirroring `CardControl`. `ZoneListDialog`'s target-list Select chips stay by plan assumption A18: they are the answering surface for off-field targets, and the hand is one.

### O6 — T4 took its own R5 fallback, so detach never became material-level

T4's step-1 gate characterized the engine before building: across 192 scripted duels (6 opponent decks × 40 seeds) and 8946 states holding an Xyz monster with materials, the core never once set `LOCATION_OVERLAY` on a prompt card. The payload does not merely fail to distinguish a material — it never addresses one. T4 therefore shipped the browse half (materials chip + dialog) and skipped the detach-target half per its own R5 branch; detach still selects the host card. A committed integration test asserts `overlay === (raw location & 128)` as a tripwire, so this goes red the day the engine emits one.

### O7 — T9's RP2 does not land on a 16:9 1920×1080 screen

The avatar cap was raised `0.26` → `0.32` of `--stage-h` as the ticket specified, but the rail column is `minmax(var(--rail-min), 1fr)` with `--rail-min: 15rem` = 240px, so at a true 16:9 stage the avatar is pinned at 240px for both the old and the new factor. Measured: 240×240 at 1920×1080 after the change; 346px at 2560×1080 (+23% vs the old cap). Making RP2 land at 16:9 needs `--rail-min` or the stage-width formula, which the ticket puts out of scope and which would steal ~106px of width from the duel field — a change the owner did not ask for. Shipped the ticket verbatim and corrected the manual-checklist bullet to state what is actually observable. See User TODO.

### O8 — TD1: T2 shipped a real regression, and the first report of it was wrong

After the deck-selection consumers landed, three `e2e/duel-smoke.spec.ts` drag cases were failing. A worker had reported them as pre-existing; that measurement was taken against a base which already contained the whole duel-field track, so it did not test what it claimed. Running them at `e1d6692` — the plan commit, before any ticket landed — gave `3 passed`, so the regression was this round's.

Opened TD1 to bisect and repair. `git bisect` named T2's feature commit `4fef1cc`: bottom-anchoring the chip stack draws the hand-zoom overlay's chips over the lower half of the very card they serve, so a drag's `pointerdown` landed on a chip button and `startCardDrag` never ran. Fixed by forwarding that press to a gesture run at the `DuelField` root — no CSS change, so feedback items 2 and 4 both stand — plus three headless component tests so the next such break does not need a browser to catch.

The general lesson, recorded because it shaped later prompts: a worker's "pre-existing" is only as good as the baseline it measured, and inside a multi-ticket round that baseline is usually not the round's base.

### O9 — T7 resolved a self-contradiction in its own test plan

The frozen best-fit rule builds the totals set as one option per list, summed; one test-plan row assumed subset semantics, which that rule cannot produce. T7 implemented the frozen rule, because it is what R3 describes, and because under subset semantics `0 ∈ T` always, which would make the documented `else X = min(T)` fallback dead code. Consequence: an overshoot displays the true total (`2 of 2 selected · sum 8 of 6`) rather than under-reporting the player's own selection. Reversing to the subset reading is a two-line change plus two test strings.

## User TODO

- **RP2 on a 16:9 full-HD screen.** The owner asked for bigger avatars on a full-HD screen; the raised cap only bites wider than 16:9 (see O7). Landing it at 1920×1080 means widening the rail (`--rail-min`, `src/styles/app.css`) and re-checking the stage-width formula, at the cost of duel-field width. That trade is the owner's call, not an agent's, so it was not taken.
- **Feedback item 11 (Cir/Dante trigger).** T10 is a diagnostic, not a fix: trigger propositions are pure engine passthrough with no app-side filter, and the expected verdict is engine-correct. The interpretation question is recorded as a `TODO(user)` in `.dev/bugs.md`; nothing further is justified until the owner answers what they expected to see.
- **The story's locked opponent seat reads `Main 0 · Extra 0 · Side 0`.** There is no story-legal source for a bundled preset's card counts: the opponent is fixed by the shell to `DEFAULT_OPPONENT_DECK_ID`, whose `.ydk` payload lives in battle internals, and a story import of `src/battle/index.ts` would make the duel eager. Honest, but it looks like a bug. Two real fixes, both the owner's call: give the encounter its own authored deck lists under `src/story/`, or have the shell hand the briefing the preset's counts.
- **`e2e-acceptance/full-height-field.spec.ts:495` fails.** `legal halo keeps its outer glow layer` expects `/0px 0px 14px 5px/` and gets `0px 0px 0px 3px, … 0px 0px 10px 0px`. Confirmed failing at `e1d6692` too, so it predates this round and was left alone — but it is a red acceptance suite and somebody should decide whether the token or the assertion is the stale one.

## Residual risks

- **Reviewer isolation was degraded on every ticket.** `ship`'s reviewer subagents have no registered agent in this runtime, so each worker ran the reviewer prompts inline, read-only, in its own authoring context. That is the skill's sanctioned fallback, and every worker recorded it, but it loses the fresh-context blind-spot protection those reviewers exist for.
- **35 ADRs repo-wide read `accepted; planned` while shipped**, including ADR-055/056/057/058/059 for this round. T25 declined a partial flip as worse than none. A status audit is its own ticket.
- **`graphify-out/` is stale for this round** — the `graphify` CLI is not on PATH, so the knowledge graph was not refreshed after ~4,000 lines of new source.
- **Duel-field T2, T3, T6, T7, T8 and T10 added no manual-checklist steps.** Only T1, T4, T5 and T9 appended any, and T25's mandate was to reconcile the checklist, not to author another ticket's manual evidence.
- **Colour-only semantics extend to the new screen** — red/blue seat halos and the gold default hairline carry meaning with no contrast or colour-blind pass. Known debt, explicitly out of the plan's scope.
- **`.tmp/` is gitignored but not eslint-ignored**, so an agent's scratch `.mjs` breaks `npm run lint`. Cost one gate re-run during the close.
