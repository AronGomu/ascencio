# R2: Stabilise the VP-06 card-action-chips viewport assertion

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T9, T10 (both done)
**Type:** parent-directed repair, not a plan ticket.
**Commit outcome:** The `card action chips` viewport assertion in the responsive e2e test stops failing intermittently, without weakening what it asserts.

## Context (self-contained)

- The duel field is a field-first duel client. T9 replaced the old anchored action menu with tiny action chips that float above an actionable card, centred on it (`.card-action-chips { position: absolute; bottom: calc(100% - .35rem); left: 50%; transform: translateX(-50%); }`, `src/styles/app.css:972`).
- `e2e/duel-smoke.spec.ts`, test `responsive field compositions contain controls across supported viewports`, walks `RESPONSIVE_VIEWPORTS`. For each it finds the first `[data-field-target][aria-label^='Legal action, Open actions']`, calls `await actionTarget.scrollIntoViewIfNeeded()`, clicks it to pin the chips, then calls `assertRectInsideViewport(page, chips, `${viewport.id} card action chips`)`.
- **The defect:** at `VP-06` (375×667) that assertion fails intermittently. On identical code, `--repeat-each=3` gave 2 pass / 1 fail with `Expected <= 376, Received 377.109375` — the chips' right edge overflows the viewport by ~1.1px.
- **Root cause:** `scrollIntoViewIfNeeded()` scrolls the element only just far enough to be visible, which parks it flush against a viewport edge. The chips are wider than the card and centred on it, so roughly `(chipsWidth - cardWidth) / 2` pokes past that edge. Whether it happens at all depends on which hand card the run's random seed makes actionable and how many chips it carries — hence the flakiness.
- The board keeps `min-width: 52rem` and `.duel-field` pans horizontally, so at 375px the card can sit anywhere along the scroll range. Centring the card in the viewport is what a user panning to it would actually do.
- **Do not weaken the assertion.** `assertRectInsideViewport` stays exactly as strict; only the scroll precondition becomes deterministic. This mirrors the earlier R1 repair, which made a duel-walking assertion deterministic rather than loosening it.
- Out of scope: changing `.card-action-chips` CSS, adding a JS edge-clamp, or touching any other viewport's assertions.

## Requirements

- Before the chips are measured, the card that owns them is scrolled to the **centre** of the viewport in both axes, not merely into view.
- `assertRectInsideViewport` keeps its current tolerances. Do not relax `-1` / `+1`, do not add a viewport exemption, do not skip `VP-06`.
- The pin → assert → `Escape` → `toBeHidden()` sequence around it is unchanged.
- Other `scrollIntoViewIfNeeded()` calls in the spec stay as they are — only the action-target one feeding the chip assertion changes.

## Inputs

- Edit: `e2e/duel-smoke.spec.ts` only.
- The relevant block is the `if ((await actionTarget.count()) > 0) { … }` body that pins the chips and asserts on `[data-cy^="card-action-chips-"]`, immediately after the two board non-intersection gates.
- **Do not touch** the two non-intersection assertions just above it (action bar vs board, `[data-cy="field-end-turn-button"]` vs board). They are hard gates.

## Impl steps

- [x] 1. Reproduce first, so you can prove the fix. Run the responsive test alone with `--repeat-each=5 -g "responsive field compositions"` on chromium and record how many runs fail with the chips-overflow message. Evidence: the pass/fail tally. If 5/5 pass, run 5 more before concluding it is unreproducible — the trigger is seed-dependent. Evidence: batch 1 = 5/5 pass; batch 2 = 4/5 pass, 1 fail with `Expected <= 376, Received 377.109375` (repeat3). Tally across both: 9/10 pass.
- [x] 2. Replace the `await actionTarget.scrollIntoViewIfNeeded();` that precedes the chip pin with a centring scroll, e.g. `await actionTarget.evaluate((element) => { element.scrollIntoView({ block: "center", inline: "center" }); });`. Evidence: the line is present and `scrollIntoViewIfNeeded` no longer appears in that block. Evidence: `e2e/duel-smoke.spec.ts:1089-1091` now calls `element.scrollIntoView({ block: "center", inline: "center" })`; `grep -n scrollIntoViewIfNeeded e2e/duel-smoke.spec.ts` no longer matches this block (only the unrelated calls at other line numbers remain).
- [x] 3. Confirm the centring actually lands before the measurement — if the scroll is animated or deferred anywhere in this codebase, wait for the box to settle rather than sleeping. Evidence: assertion passes with no added fixed delay. Evidence: `grep -rn "scroll-behavior" src/` shows the only rule is scoped to `@media (prefers-reduced-motion: reduce)`, so scroll is instant/synchronous by default; no added delay was needed and step-4 passed without one.
- [x] 4. Re-run `--repeat-each=5 -g "responsive field compositions"` on chromium. Evidence: 5/5 pass, versus the step-1 tally. Evidence: two separate `--repeat-each=5` batches after the fix, both 5/5 pass (10/10 total), versus the 9/10 baseline.
- [x] 5. Run the full chromium spec twice (random seed differs per run) plus `firefox-smoke`. Evidence: run counts and durations. Evidence: full chromium run 1 = 17/17 passed (55.6s); run 2 = 17/17 passed (1.2m); `firefox-smoke` = 1/1 passed (4.5s).

## Validation

- [x] step-1 tally recorded and step-4 tally is 5/5 green — recorded above; step-4 is 5/5 (x2)
- [x] `assertRectInsideViewport` body is byte-identical to before — validate: `git diff` shows no change inside that function — confirmed, `git diff -- e2e/duel-smoke.spec.ts` touches only lines 1084-1092 (the action-target scroll)
- [x] both board non-intersection assertions still present and green — untouched by the diff; green in both full chromium runs
- [x] chromium full spec twice + `firefox-smoke` green (webkit-smoke env-blocked, note it, do not treat as failure) — 17/17, 17/17, 1/1; webkit-smoke not run, per Environment note (no `webkit-2311` binary / missing `libjxl.so.0.8`)
- [x] `npm run typecheck && npm run lint` and `npm run format:check` pass — all three passed clean
- [x] commit msg draft: `test(e2e): centre the action target before measuring its chips`

## Notes

If step 1 cannot reproduce the failure in 10 runs, still apply step 2 — the root cause is structural (`scrollIntoViewIfNeeded` parks elements flush against the edge, and the chips are wider than their card), not statistical. Say so in your report and record the tally you did get.

If, after centring, the chips still overflow at `VP-06`, then the chips are genuinely wider than the 375px viewport and this is a product defect rather than a test-determinism one. In that case stop, do not weaken the assertion, and report `failed: product defect — chips exceed the VP-06 viewport width even when centred`, with the measured widths.

## Environment (do not rediscover these)

- **The `ship` skill is not installed here** (`Unknown skill: ship`). Run this file's own loop directly.
- **Playwright runs must be foreground and blocking.** Never `run_in_background`. Runs take 1-5 min; the Bash timeout ceiling is 600 s. Four workers have already lost time to this.
- **The duel seed is random per run** — `createProductionSeed()` → `crypto.getRandomValues` at `src/worker/DuelWorkerRuntime.ts:328`. That randomness is the whole reason this assertion is flaky.
- **`webkit-smoke` is unrunnable in this sandbox** (no `webkit-2311` binary; WPE also wants `libjxl.so.0.8` and nixpkgs ships 0.11, no root). Not a code defect.
- **`firefox-smoke` only runs the single test at `e2e/duel-smoke.spec.ts:213`**, so it will not exercise your change. Run it anyway as a regression check.
- **Browsers only launch inside a nix library closure, and chromium/firefox need two *different* invocations.** Do not merge them. Run from the repo root.

```bash
cd /home/aron/projects/ascencio

# CHROMIUM
timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
  libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
  alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-1000/-home-aron-projects-ascencio/e506203b-19ea-467c-ad38-5319790d65e3/scratchpad/pw-browsers
npx playwright test --project=chromium
'
# filtered: append -g "pattern" and/or --repeat-each=N to the npx line

# FIREFOX-SMOKE (no PLAYWRIGHT_BROWSERS_PATH override — uses ~/.cache/ms-playwright)
timeout 170 nix-shell -p glib gtk3 dbus nspr nss libx11 libxcb libxcomposite libxdamage \
  libxext libxfixes libxrandr mesa alsa-lib pango cairo atk at-spi2-atk at-spi2-core \
  cups libdrm expat gdk-pixbuf --run '
LD_LIBRARY_PATH="$(nix-build "<nixpkgs>" -A gtk3.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A glib.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A pango.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A cairo.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A at-spi2-core.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A gdk-pixbuf.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libX11.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A alsa-lib.out --no-out-link)/lib"
export LD_LIBRARY_PATH
npx playwright test --project=firefox-smoke
'
```

- `playwright-driver.browsers` **and** `xorg.xvfb` are both empirically required in chromium's `-p` list even though Xvfb is never launched. Drop either and `libglib-2.0.so.0: cannot open shared object file` returns. Do not "simplify" the list.
- `nix-shell -p pkg` does **not** export `LD_LIBRARY_PATH` for prebuilt binaries, and `-A pkg` often resolves to a `-dev` output with no `.so`. Use `-A pkg.out`.
- `webServer` auto-builds/starts/stops per invocation (`reuseExistingServer: false`), so each command is self-contained — do not hand-start `npm run preview`. The `Port 4202 is in use on a wildcard address` warning is unrelated and ignorable.
- Plain headless works; `--headed` and hand-started Xvfb are dead ends.

## Working-tree hygiene

These files were dirty **before** this run and must never be staged: `.gitignore`, `README.md`, `docs/README.md`, `docs/architecture/**`, `docs/developer-guide/**`, `docs/duel-field-architecture.html`, `docs/duel-field-validation-references.html`, `playwright.config.ts`, `vite.config.ts`, `test-results/**`, and untracked `.claude/`, `.pi/`, `.pi-subagents/`, `.agents/`, `.agentsystem/`, `.dev/`, `.tmp/`, `CLAUDE.md`, `AGENTS.md`, `context.md`, `.graphifyignore`, `ai-artifacts/HANDOFF_2026_08_09_duel_field_ux_overhaul.md`. Also leave `ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul/T8_*.md` and `T11_*.md` alone — those are the parent's edits to tickets you do not own.

Stage explicit paths only: `e2e/duel-smoke.spec.ts` and this file (`R2_stabilise-chip-viewport-assertion.md`) with your checkbox updates. Never `git add -A`.
