# Handoff: Duel Field Feedback Round 2

**Date:** 2026-08-10
**Branch:** `feat/duel-field-round-2` (pushed, tracking `origin/feat/duel-field-round-2`)
**Plan:** [`PLAN_2026_08_09_duel_field_feedback_round_2.md`](PLAN_2026_08_09_duel_field_feedback_round_2.md)
**Base:** `b5702e2`, which is also `origin/main`. Branch is 16 ahead, 0 behind.
**State:** complete. All 12 tickets shipped, reviewed by a 4-dimension fanout, and repaired.

## State in one line

12/12 tickets committed and pushed, one review-repair pass on top, everything green at `73b5a26`.

## Verified at `73b5a26`

| Gate | Result |
| --- | --- |
| `format:check` / `lint` / `typecheck` | pass (svelte-check 0 errors, 0 warnings) |
| `test:legacy` | 21 pass |
| `test:unit` | 557 pass (53 files) |
| `test:component` | 189 pass (14 files) |
| `test:integration` | 20 pass (incl. real-WASM smoke) |
| `npm run build` | pass (snapshot `a562f5ad`, 70 runtime files) |
| chromium e2e | 18/18 pass (4.3 min) |

`webkit-smoke` is **unrunnable on this host**: WPE needs `libjxl.so.0.8`, nixpkgs ships 0.11, no root. Unverified for every commit in this run. `firefox-smoke` was not run per ticket.

## Ticket status

| ID | Title | SHA |
| --- | --- | --- |
| T1 | Duel header bar with avatars and life points | `80e363a` |
| T2 | Preview panel left, hover everywhere, status line | `8ed03a7` |
| T3 | In-field phase strip and repositioned End turn | `951b5bf` (+ `151ba85` e2e repair) |
| T4 | Auto-answer prompts that carry no decision | `10858e3` |
| T5 | Automatic placement and single-click actions | `51985d8` |
| T6 | Stack zones as interaction targets | `8084aa9` |
| T7 | Stack top-card face | `3141416` |
| T8 | Zone list dialog | `c786f0e` |
| T9 | Projected deck order and reveals | `235223d` |
| T10 | Deck list in the zone dialog | `9b57475` |
| T11 | Inline chain response | `3a082b2` |
| T12 | Duel result dialog | `c6ffe77` |
| R1 | Review repairs | `73b5a26` |

## Review fanout findings and repairs (R1)

Four fresh-context reviewers audited `git diff b5702e2..HEAD` at deep tier: correctness, security/privacy, scope fidelity, tests. Ticket: [`R1_review-repairs.md`](PLAN_2026_08_09_duel_field_feedback_round_2/R1_review-repairs.md).

1. **BLOCKER — a click anywhere inside the zone list dialog answered the live prompt.** `.zone-list-dialog` was absent from `INTERACTIVE_SELECTOR` in `DuelField.svelte`, so every click in the dialog that missed a chip bubbled to `dismissOnOutsideClick` and dispatched a real duel response — passing a chain, or cancelling a selection. Reachable today with the shipped presets: T8 made the dialog the only way to answer a stack-located choice, so the natural gesture (clicking the glowing tile) passed the chain instead. Fixed by adding `.zone-list-dialog` to the selector.
2. **MAJOR — deck sequence-space mismatch**, found independently by the correctness and security reviewers from different angles. `projectDeck` writes top-relative offsets (index 0 = top); `toPromptCard` passes the raw engine deck sequence, which is bottom-first; `ZoneListDialog.entryChoices` compared them directly. Chips landed on the mirrored slot, printing a real card name into `title`/`aria-label` on a tile the projection had marked face-down. Latent with the shipped presets (22 vanilla LOB-era cards, no searcher or excavation) but live the moment one search card enters the pool. Fixed at the UI boundary, scoped to `location === "deck"`, with both conventions named in a comment.
3. **Chain prompt was unanswerable when the field failed to render.** `promptSurface` returned `"field"` for every chain regardless of `fieldCapable`, but the field only mounts when `duelBoard !== null`. On the error-boundary path nothing was mounted that could answer, and the duel deadlocked under a panel reading "Prompt controls remain available." Now falls back to the dialog surface.
4. **Escape did not close a mouse-opened zone list** — the handler sat on an unfocused root, so the keydown fired on the stack button subtree. The T8 test passed only because it dispatched on the dialog node directly. Now on `svelte:document`.
5. **A weakened e2e gate, restored.** The field-action-bar geometry check had been wrapped in `if ((await dock.count()) > 0)` — permanently false after T4 removed `Shuffle Deck` — with a replacement comment claiming another test covered it, which was factually untrue. The gate is the codebase's only "must clear the duel board" assertion, guarding the exact overlay regression that sank the previous round. Moved to the full-duel walker with a counter and a final `expect(...).toBeGreaterThan(0)` so it can never silently skip again.
6. `stack stays non-interactive` asserted the opposite of the shipped contract and passed only because its fixture pile was empty. Renamed to what it actually pins.

Each of 1-4 was fixed test-first, with the failing output captured before the fix.

## Residual risks — carried, not fixed

1. **Non-chain prompt kinds can still report a `"field"` surface after the field error boundary swallows the field.** R1 fixed this for chains only, deliberately. Same gap was logged as residual risk #3 in the 2026-08-09 handoff. **Worth its own ticket.**
2. **`maybeAutoResolvePrompt` (`src/app/App.svelte:450`) has no automated coverage** — and it ships on by default, so it silently answers prompts in every duel. Flagged major by the tests reviewer. **Worth its own ticket.**
3. `webkit-smoke` unverified (see above). Run the full 3-project `npm run test:e2e` in CI before merge.
4. Untested branches: `phase-transitions.ts` `mainPhase2 -> main2`; the two new deck validators in `duel-worker-event.ts`; "SHUFFLE_HAND must not clear deck reveals".
5. The `data-cy` DOM uniqueness gate never renders this branch's biggest loop (the 40-entry deck list).
6. The zone list dialog (T8/T10) has no e2e coverage.
7. `tests/fixtures/transcripts/sort-chain-v1.json` keeps `scenarioId: "shuffle-and-sort-chain"` for a scenario that no longer shuffles (cosmetic).
8. Spatial-nav row skipping in `neighborInDirection` remains latent, carried from the previous round.
9. Documentation drift: several tickets' `Outputs` lists omit files the work legitimately touched (`ZoneListEntryTile.svelte`, `e2e/duel-smoke.spec.ts`, type-forced test fixtures), and commit `151ba85` belongs to no ticket. The commits and this handoff carry the truth; ticket bodies are records of intent.

## Orchestrator rulings made during the run

- **T3** — the ticket's DOM placement provably could not satisfy its own geometry table, because `.duel-field`'s padding makes its box diverge from the board's (measured 966x628 vs 932x524 at 1366px) and the table ignored the zones' `translate(-50%,-50%)`. Approved reparenting into a new padding-free `.duel-field-stage` with measured constants. Recorded in the ticket's `### Deviation` note.
- **T9** — the ticket said `REVERSE_DECK` is player-scoped; the pinned vendor type `OcgMessageReverseDeck` has no `player` field and reverses both decks. Vendor contract won: clears both players, no invented `message.player`.
- **T9** — the ticket's "exhaustive" 8-file fixture list was stale because `tests/unit/zone-list.test.ts` postdates the plan (T8 created it). Authorized the minimal `deck` field addition.
- **T1/T2 shipped e2e drift** because neither ticket carried an e2e validation line; T3's worker was first to run e2e against branch reality and found the suite red. Repaired in a separate commit `151ba85` to keep attribution clean. **Process lesson: any ticket that moves or removes a `data-cy` asserted in `e2e/duel-smoke.spec.ts` must update that spec in the same commit, whether or not its Validation section mentions e2e.**

## Environment facts — do not rediscover these

### Playwright needs a repo-local browser path

The nix store path used by the previous round had been garbage-collected. Rebuilt and pinned at `.tmp/pw-browsers` (gitignored):

```bash
cd /home/aron/projects/ascencio
timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
  libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
  alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
npx playwright test --project=chromium
'
```

- `PLAYWRIGHT_BROWSERS_PATH` is **mandatory**. `.tmp/pw-browsers` holds symlinks to the nix-patched browsers under the revision names playwright 1.61 expects (`chromium-1228 -> chromium-1217`). The mismatched revision numbers are deliberate.
- Without it, Playwright picks `~/.cache/ms-playwright`, whose binaries are unpatched and die with `libglib-2.0.so.0: cannot open shared object file`. **That error means the override is missing, not that the `-p` list is wrong.**
- `playwright-driver.browsers` and `xorg.xvfb` are both required in the `-p` list even though Xvfb is never launched. Do not simplify it.
- Recreate if lost: `S=$(nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link)` then `mkdir -p .tmp/pw-browsers && cd .tmp/pw-browsers && ln -sfn $S/chromium-1217 chromium-1228 && ln -sfn $S/chromium_headless_shell-1217 chromium_headless_shell-1228 && ln -sfn $S/ffmpeg-1011 ffmpeg-1011 && ln -sfn $S/firefox-1511 firefox-1532`.
- Run e2e in the **foreground, blocking**. A run takes 1-5 min against a 590 s ceiling. A previous worker lost ~40 minutes backgrounding it.

### The duel seed is random per run

`createProductionSeed()` uses `crypto.getRandomValues`. "Preset duel" means preset **decks**, not a preset game. A single pass of a duel-walking test is weak evidence; re-run before diagnosing a failure, and never call a walker green off one pass. The full keyboard-only duel walker takes ~3.8 min of the 180 s-per-test budget.

### e2e walkers disable background automation

Both `autoResolveTrivialPrompts` (T4) and `autoPlaceCards` (T5) are explicitly disabled in the walkers, because a background auto-answer races a test whose premise is one manual response per prompt. Any future background-automation feature will hit the same class and should be disabled in the walker, not retried around.

## Branch reality for later field work

- `.duel-field-stage` (`data-cy="duel-field-stage"`) is a padding-free wrapper inside `.duel-field` holding `FieldBoard` + `PhaseStrip` + `EndTurnButton`. Anything positioned by percentage against the board must live inside it, not inside `.duel-field`.
- The round-2 tickets' board-geometry table states zone extents as `center -> center + size`, but zones render with `transform: translate(-50%,-50%)`. True extent is the stated span shifted up/left by half the zone size. Measured true free gap between the banished zones is y `[42.65%, 57.36%]`.
- `AppMenubar.svelte`, `LifePointsPill.svelte`, `FieldStatusPills.svelte` are deleted. `DuelField` takes no `lifePoints` or `hasPriority` prop.
- `spec.fieldCapable` now counts `stackChoices` (assumption A9 was lifted by T8, after the zone dialog could answer).
- Deck slots are synthetic and deliberately excluded from `allVisibleCards`, so they do not inflate the 256-instance guard.

## Manual verification still owed

[`manual_test_checklist.md`](manual_test_checklist.md) — 164 steps, grouped into a **Round 2 (current)** section and a **Round 1 archive** whose superseded steps are banner-flagged. Round 1 ids collide with round 2 ids, hence the `R1-` prefix on the archive.

22 unchecked boxes remain across the ticket files; all are human-at-a-browser checks except a handful of under-claimed `commit msg draft` / `app functional` bookkeeping boxes. Nothing automated is left unverified.

## Working-tree hygiene

`feedback.md` was already modified before this run started and was deliberately never staged. Keep excluding it unless you authored those edits.
