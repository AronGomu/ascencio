# Handoff: Duel Field UX Overhaul

**Date:** 2026-08-09
**Branch:** `plan/duel-field-ux-overhaul` (pushed, tracking `origin/plan/duel-field-ux-overhaul`)
**Plan:** [`artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`](PLAN_2026_08_08_duel_field_ux_overhaul.md)
**Progress file:** `.tmp/MAKE_PROGRESS_duel-field-ux-overhaul.md`
**Stopped by:** user request, mid-T6. Run was autonomous (`/make`) from 19:10 to 00:20.

## State in one line

6 of 11 tickets committed and pushed, all green at `e22e9bd`. T6 is **half-done and uncommitted in the working tree with a known failing e2e test**. T7–T11 not started.

## Ticket status

| ID | Title | State | SHA | Evidence |
| --- | --- | --- | --- | --- |
| T1 | data-cy contract + coverage gate | done | `d8bb0aa` | data-cy 8/8, unit 381, component 53, typecheck/lint/format clean |
| T2 | Header menubar, menu + settings dialogs | done | `886b1cf` | unit 385, component 64, both dialogs verified in browser |
| T3 | Remove app chrome panels | done | `542ee73` | unit 386, component 67, e2e chromium 14/14 |
| T4 | Full-width board, free page scroll | done (1 repair) | `2b2fe31` | unit 394, component 67, e2e chromium 15/15 |
| R1 | Repair: deterministic preset-duel e2e | done | `e22e9bd` | failure rate 4/7 → 0/7; chromium 16/16, firefox 1/1 |
| T5 | Hidden panels + prompt dialog | done | `43b8d7d` | unit 400, component 73 |
| **T6** | **Field action bar replaces selection dock** | **in progress, uncommitted, e2e RED** | — | see below |
| T7 | End turn corner button | not started | — | depends T6 |
| T8 | Priority, phase and life pills | not started | — | depends T4 ✅, T7 |
| T9 | Hover action chips + orange halo | not started | — | depends T6 |
| T10 | Drag and drop from hand | not started | — | depends T9 |
| T11 | Card preview panel | not started | — | depends T4 ✅, T9 |

Last good commit: **`e22e9bd`**. Everything through T5 + R1 is validated and pushed.

## T6 — exactly where it stands

Uncommitted in the working tree (nothing staged except the `SelectionDock` deletion):

```
 M artifacts/.../T6_field-action-bar.md      5 boxes still unchecked
 M e2e/duel-smoke.spec.ts                       +18
 M src/app/components/DuelField.svelte          +13
D  src/app/components/duel-field/SelectionDock.svelte   -240  (staged deletion)
 M src/app/prompts/interaction-spec.ts          +11   <-- scope drift, see below
 M src/styles/app.css                           ~73
 M tests/component/DuelField.test.ts            +11
 M tests/unit/interaction-spec.test.ts          +68
?? src/app/components/duel-field/FieldActionBar.svelte   (new, untracked)
?? tests/component/FieldActionBar.test.ts                (new, untracked)
```

### The blocking failure — a real defect, not a flake

`e2e/duel-smoke.spec.ts:799` — *"responsive field compositions contain controls across supported viewports"* — times out at 180 s.

Root cause is in the Playwright call log, unambiguous:

```
attempting click on  button.duel-field-card__target [data-cy="field-card-target-card-1"]
  <button class="secondary compact-button"
          data-cy="field-action-bar-choice-…-choice-9-shuffle">Shuffle Deck</button>
  from <section class="field-action-bar" data-cy="field-action-bar" aria-label="Field decision">
  subtree intercepts pointer events
  ... 344 × retrying
```

**The new `FieldActionBar` is painted over the board and swallows pointer events aimed at card targets.** A card the user must be able to click sits underneath the bar's global-choice buttons. This is a genuine interaction regression that the plan's own risk list anticipated — the bar is pinned *inside* the field, so its footprint has to be carved out of the board's hit area, not laid on top of it.

Do **not** "fix" this by relaxing the test. The test is asserting the right thing.

Likely fix directions (unverified — pick after reading `FieldActionBar.svelte` and the `.field-action-bar` rules in `src/styles/app.css`):
- give the bar its own reserved row in the field's layout instead of overlaying the board, or
- keep the overlay but shrink/reposition it clear of zone geometry, or
- `pointer-events: none` on the bar's container with `pointer-events: auto` only on its buttons — this alone will **not** be enough where a button literally covers a card.

### Scope drift to review

`src/app/prompts/interaction-spec.ts` gained an exported `fieldActionBarRequired(spec)` helper (+11 lines) with 68 lines of new tests in `tests/unit/interaction-spec.test.ts`. That file is **not** in T6's declared `## Inputs` edit list. The helper looks reasonable, but it was never reviewed against the ticket contract. Either fold it into the ticket's Inputs deliberately or move the logic into `FieldActionBar.svelte`.

### Resume options

1. **Finish T6** — fix the pointer interception, re-run the two failing e2e specs, flip the 5 remaining boxes, commit as `feat(field): replace the selection dock with a field action bar`.
2. **Discard and restart T6 clean** — `git checkout -- <paths>` plus `git restore --staged src/app/components/duel-field/SelectionDock.svelte` and delete the two untracked new files. The ticket file is self-contained; a fresh worker can redo it knowing the overlay trap up front.

Nothing else depends on the uncommitted state. `e22e9bd` is a clean base either way.

## Environment facts — do not rediscover these, they cost ~1 h total

### `ship` skill is not installed

`Unknown skill: ship`. Workers ran their ticket's own Requirements → TDD → Impl → Validation loop directly at the same evidence bar.

### Playwright browsers need a nix closure, and chromium/firefox need *different* invocations

Do not try to merge them into one shell. Both browser dirs already exist and work.

```bash
cd /home/aron/projects/ascencio

# CHROMIUM
timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
  libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
  alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-1000/-home-aron-projects-ascencio/e506203b-19ea-467c-ad38-5319790d65e3/scratchpad/pw-browsers
npx playwright test --project=chromium
'
# filtered: append -g "pattern" to the npx line

# FIREFOX-SMOKE (no PLAYWRIGHT_BROWSERS_PATH override — uses ~/.cache/ms-playwright)
timeout 170 nix-shell -p glib gtk3 dbus nspr nss libx11 libxcb libxcomposite libxdamage \
  libxext libxfixes libxrandr mesa alsa-lib pango cairo atk at-spi2-atk at-spi2-core \
  cups libdrm expat gdk-pixbuf --run '
LD_LIBRARY_PATH="$(nix-build "<nixpkgs>" -A gtk3.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A glib.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A pango.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A cairo.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A at-spi2-core.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A gdk-pixbuf.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libX11.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A alsa-lib.out --no-out-link)/lib"
export LD_LIBRARY_PATH
npx playwright test --project=firefox-smoke
'
```

Gotchas, all learned the hard way:

- Must run from repo root. Plain headless works; `--headed` and hand-started Xvfb are dead ends.
- `playwright-driver.browsers` **and** `xorg.xvfb` are both empirically required in chromium's `-p` list even though Xvfb is never launched. Drop either and `libglib-2.0.so.0: cannot open shared object file` returns. Do not "simplify" the list.
- `nix-shell -p pkg` does **not** export `LD_LIBRARY_PATH` for prebuilt binaries, and `-A pkg` often resolves to a `-dev` output with no `.so`. Use `-A pkg.out`.
- Chromium runs against a scratchpad dir of deliberately **mismatched-revision symlinks** (`chromium-1228 → chromium-1217`, from nix `playwright-driver.browsers`). Tolerated for chromium; do not assume it generalises. Firefox uses the real version-matched `firefox-1532` in `~/.cache/ms-playwright`.
- `webServer` auto-builds/starts/stops per invocation (`reuseExistingServer: false`), so each command is self-contained — do not hand-start `npm run preview`. The `Port 4202 is in use on a wildcard address` warning is unrelated and ignorable.
- `webkit-smoke` is **unrunnable here**: WPE needs `libjxl.so.0.8`, nixpkgs ships 0.11, no root/apt. Not a code defect.

### The duel seed is random per run

`createProductionSeed()` → `crypto.getRandomValues` at `src/worker/DuelWorkerRuntime.ts:328`. "Preset duel" means preset **decks**, not a preset game — every e2e run plays a different shuffle. **A single pass or a single failure of a duel-walking test proves nothing; run it ≥3 times.** Two workers reported opposite results at the same commit for exactly this reason.

### Playwright runs must be foreground

The T6 worker launched e2e with `run_in_background`, returned control, and idled twice — roughly 40 min lost. Runs take 1–5 min; the Bash timeout ceiling is 600 s. Run them blocking.

## Residual risks carried by the committed work

1. **`webkit-smoke` unverified** for every commit in this run. Run the full 3-project `npm run test:e2e` in CI before merge.
2. **T4 partial requirement.** "No horizontal scrollbar at any supported viewport" holds only at **≥1024 px**. Below ~864 px of container width it is mathematically incompatible with the 44 px pointer-target invariant the same ticket demands (board space is 1280×720 with a 72-unit card → targets reach 44 px only at ≥782 px board width). `.duel-field` keeps `min-width: 52rem` + `overflow-x: auto`; narrow viewports pan as before. Logged in the ticket as A-T4-1/2/3.
3. **T5 plan defect, dropped as out of scope.** When `DuelFieldErrorBoundary` catches a render failure, `section.duel-field` never mounts, yet `promptSurface()` still reports `"field"` (it reads only `spec.fieldCapable`, not render success). A field-capable prompt then has no surface and the user must manually reveal the workspace to unstick the engine. `DuelFieldErrorBoundary.svelte` was not in T5's Inputs. **Worth its own ticket.**
4. **Spatial-nav row skipping (latent).** `neighborInDirection` (`src/field/board-view-model.ts:502-535`) prefers x-aligned candidates across *all* rows above, so ArrowUp from a row's leftmost control can jump two rows when nothing is x-aligned directly above. Not triggered by committed code, but latent in both the nav graph and the e2e walkers. **Worth its own ticket.**
5. **R1 not airtight by construction.** The defense assertion now retries every Main Phase against a ~22-monster/40 deck, so it is practically certain but not guaranteed. A seed-override hook is the only airtight fix; deliberately not added (production code + test-only surface, unrequested).
6. **T4 e2e runtime.** The keyboard-only duel test runs ~78 s (was ~34 s) of a 180 s budget — less headroom than before.

## Working-tree hygiene

These were dirty **before** this run started and were deliberately never staged. Keep excluding them:

`.gitignore`, `README.md`, `docs/README.md`, `docs/architecture/**`, `docs/developer-guide/**`, `docs/duel-field-architecture.html`, `docs/duel-field-validation-references.html`, `playwright.config.ts`, `vite.config.ts`, deleted `test-results/**`, and untracked `.claude/`, `.pi/`, `.pi-subagents/`, `.agents/`, `.agentsystem/`, `.dev/`, `.tmp/`, `CLAUDE.md`, `AGENTS.md`, `context.md`, `.graphifyignore`.

Baseline commit `f0139d0` carries the plan, ticket files, ADRs 002–006, `AGENT.md` rename, glossary and `feedback.md`.

Note: **base is `plan/dom-duel-field-implementation-plan` (`1d55aea`), not `origin/main`.** `origin/main` contains no `src/app/components/duel-field/**` at all — 23 commits of DOM field work live only on the branch chain. Basing on main would make this plan unimplementable.

## To resume

```bash
git checkout plan/duel-field-ux-overhaul   # already at e22e9bd + dirty T6 work
/make @artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md
```

The orchestrator reads `.tmp/MAKE_PROGRESS_duel-field-ux-overhaul.md`, skips `done`, and picks up at T6. Hand the next T6 worker the pointer-interception diagnosis above — it is the whole job.
