# R3: Code defects found by the review fanout

**Plan:** `./artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** all 11 tickets (done, HEAD `2414f37`)
**Type:** parent-directed repair after the deep reviewer fanout. Not a plan ticket.
**Commit outcome:** Five defects found by the correctness and security reviewers are fixed, each with a regression test that fails without the fix.

## Context (self-contained)

A Svelte 5 (legacy mode: `export let`, `$:`, `afterUpdate`) Yu-Gi-Oh duel client. The rules engine is `ocgcore` in a web worker; `src/worker/**` is out of scope and must stay untouched. Four deep reviewers audited `git diff f0139d0..HEAD`. This file carries only the code defects worth fixing now. Test-gate and documentation findings are handled separately in `R4`; do not do R4's work here.

Every claim below was re-verified against the shipped code by the parent. Line numbers are from HEAD `2414f37`.

## Defects to fix

### D1 — dropping on an Extra Monster Zone Normal Summons instead of Special Summoning

`src/app/prompts/drop-target.ts:21-36`. `dropChoiceForZone` branches on `zone.kind` alone. The two shared Extra Monster Zones have `kind: "monster"`, so `MONSTER_PREFERENCE` (`summon` → `specialSummon` → `setMonster`) returns **`summon`** for them.

Why it matters: `startCardDrag` unions `placementZoneCandidates` across every choice, and `src/field/placement-candidates.ts:21-22` haloes `shared:extraMonster:left` / `:right` only for `specialSummon`. So the halo promises a Special Summon, the drop performs a Normal Summon — irreversibly consuming the once-per-turn normal summon — and the engine's follow-up `SELECT_PLACE` then offers only monster sequences 0-4, so the armed EMZ matches nothing and the player is dumped into a manual place prompt.

Fix: an Extra Monster Zone must prefer `specialSummon`, and must never resolve to `summon` or `setMonster`. `BoardZoneView.id` is available to the resolver, so distinguish on the id (the shared EMZ ids are `shared:extraMonster:left` and `shared:extraMonster:right`); do not infer it from `kind`.

`tests/unit/drop-target.test.ts` cannot catch this today: its `zone()` helper hardcodes `id: "p0:mainMonster:0"` and varies only `kind`. Give the helper a real id parameter and add EMZ rows.

- [x] D1.1 Add failing rows to `tests/unit/drop-target.test.ts` first: an EMZ zone with `summon` + `specialSummon` offered must return `specialSummon`; an EMZ zone offering only `summon` and `setMonster` must return `null`, not a normal summon. Validate: both fail before the fix.
- [x] D1.2 Fix `dropChoiceForZone`. Validate: `npx vitest run tests/unit/drop-target.test.ts` green, and the pre-existing main-monster-zone rows still pass unchanged.

### D2 — a placement intent survives a locally rejected response

`src/app/stores/duel-store.ts:338-364`. The field's own doc comment at `:96-99` states the invariant: `pendingPlacement` is "Cleared by every prompt, result and error, so a guess can never survive into a later turn." The reducer honours it (`:235`, `:251`, `:276`, `:289`), but the two error states `acceptResponse` synthesises itself do not: the `invalid_response` branch (`:341-350`) and the `stale_prompt` branch (`:354-363`) both `set(freezeState({ ...current, error }))`, spreading `pendingPlacement` through untouched. No worker `error` event is emitted on these paths, so nothing else clears it.

The two reviewers disagreed on reachability — security argued `endCardDrag` arms the intent *before* dispatching, so a failed dispatch strands it; correctness could not construct a reachable sequence because `armPlacementIntent` and `acceptResponse` gate on the same `responsePending`/`status`. Either way the stated invariant is violated and the fix is two lines. Fix it as defence in depth; do not spend time adjudicating reachability.

- [x] D2.1 Add a store test that arms an intent, drives `acceptResponse` down each locally-synthesized error branch, and asserts `pendingPlacement === null` afterwards. Validate: fails before the fix on at least one branch.
- [x] D2.2 Set `pendingPlacement: null` in both branches. Validate: `npx vitest run tests/unit/duel-store.test.ts` green.

### D3 — `previewHudCard` lost its identity-visibility guard

`src/app/App.svelte:562-565`. The retired `inspectHudCard` re-checked `isCardIdentityVisible(0, card.controller, card.location, card.position)`. `previewHudCard` now previews on `card.code` alone.

Not currently exploitable — both callers pre-filter (`DuelHud.svelte:36-40` `canReveal`, `CardTray.svelte:110-116` `canRevealCard`) and the worker's projector already deletes `code` on cards hidden from player 0. This is a lost defence-in-depth layer at a privacy boundary, so restore it. The sibling `previewFieldCard` (`:554`) needs no change: `BoardCardView.code` is only populated under `identityVisible`.

- [x] D3.1 Restore the visibility guard in `previewHudCard`. Validate: a component or unit test asserting a hidden-identity card handed to the HUD preview path does not populate the panel.

### D4 — unguarded `bind:this` deref after `await tick()`

`src/app/components/duel-field/FieldBoard.svelte:117-125`. `focusActiveTarget()` awaits `tick()` then does `[...boardElement.querySelectorAll(...)]` with no guard, while `:76` in the same file correctly uses `boardElement?.contains(...)`.

Svelte writes `null` — not `undefined` — into a `bind:this` ref as the element unmounts. This is the exact class of crash already fixed in `CardControl.svelte:74`. If `FieldBoard` unmounts while the promise is in flight (the `{#key workerGeneration:sessionGeneration}` regeneration in `App.svelte`, `duelBoard` going null, or a boundary teardown), the microtask throws `TypeError: Cannot read properties of null (reading 'querySelectorAll')`. It is called as `void focusActiveTarget()` at `:85` and `:114`, so the rejection is unhandled and outside the boundary's synchronous reach.

- [x] D4.1 Add the null guard, matching the `?.` style already used at `:76`. Validate: `npm run test:component` green; state in your report why a regression test is or is not practical here (an unmount-mid-microtask test may not be worth its fragility — your call, but say which you chose and why).

### D5 — `surrender()` failure is invisible

`src/app/App.svelte`, the menu's surrender handler. `duel.surrender()`'s boolean return is discarded and `menuOpen = false` runs unconditionally. When `client.surrender()` returns false — no active duel, worker closed, disposal in flight — the store returns `false` without changing state, the menu closes, and the player sees no feedback for an action they believe committed. The existing `responsePending` disable covers only one of several false-returning paths.

- [x] D5.1 Make a failed surrender visible: keep the menu open and surface the existing recoverable-error affordance, or equivalent. Do not invent a new error channel — reuse what the app already has. Validate: a component test asserting the menu stays open and something is announced when `surrender()` returns false.

## Constraints

- `src/worker/**`, `src/duel/**` and the card-data pipeline stay untouched.
- The three responsive e2e gates must stay green and unweakened: action bar vs board non-intersection, `[data-cy="field-end-turn-button"]` vs board non-intersection, and `scrollWidth <= clientWidth + 1` at every viewport `>= 1024`.
- Do **not** change `.duel-field`'s scroll or positioning strategy. The reviewers found that absolutely positioned field controls pan out of view below ~900px viewport width; that is a real defect but its fix is a structural change, deliberately deferred to its own ticket. Leave it alone, and leave the e2e assertions around it as they are — "fixing" those assertions without the structural fix would just turn the suite red.
- Do not do R4's work: no `data-cy` contract changes, no documentation updates, no e2e gate restructuring.

## Validation

- [x] `npx vitest run tests/unit/drop-target.test.ts tests/unit/duel-store.test.ts` passes, with the new rows
- [x] `npm run test:unit && npm run test:component` passes
- [x] `npm run typecheck && npm run lint` passes
- [x] `npm run format` then `npm run format:check` passes
- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes
- [x] e2e green: chromium full spec twice + firefox-smoke (webkit-smoke env-blocked, note it, do not treat as failure)
- [x] all three responsive gates still green and unweakened
- [x] each of D1-D5 has a stated before/after evidence line; for any defect where you chose not to add a regression test, say so explicitly and why
- [x] commit msg draft: `fix(field): correct extra-zone drops and clear stranded placement intents`

## Evidence (this run)

Before/after, one line per defect. Every "before" is a recorded failing run against
the shipped code, not an inspection.

- **D1** before: `tests/unit/drop-target.test.ts` 4 new EMZ rows fail — `expected { action: 'summon', … } to deeply equal { action: 'specialSummon', … }` and `expected { id: 'prompt-choice-0-summon', … } to be null`; 8 pre-existing rows pass. After: `12 passed (12)`, pre-existing rows untouched. Fix is `preferenceForZone()` in `src/app/prompts/drop-target.ts`, branching on `BoardZoneView.id` against `EXTRA_MONSTER_ZONE_IDS`, never on `kind`.
- **D2** before: `clears a placement intent the store rejects locally` fails on the `invalid_response` branch (`cleared by invalid_response: expected { zoneId: 'p0:mainMonster:2', … } to be null`); with only that branch fixed it then fails on `stale_prompt` (`cleared by stale_prompt: …`), so both branches were confirmed failing independently. After: `20 passed (20)`.
- **D3** before: `cardPreviewForPublicCard is not a function`, 4 rows red. After: `8 passed (8)`. The guard lives in `cardPreviewForPublicCard` (`src/app/presentation/card-preview.ts`) rather than inline in `App.svelte` so it is unit-testable; `previewHudCard` now calls it. `previewFieldCard` left alone as specified.
- **D4** before: the new `FieldBoard > survives unmounting while a queued focus move is in flight` row reports exactly `Cannot read properties of null (reading 'querySelectorAll')` as an unhandled rejection. After: `61 passed (61)`. A regression test **was** written and is not fragile: dispatching the keydown without awaiting leaves the microtask deterministically suspended on `tick()` at unmount time, and the assertion filters process-level rejections by message rather than asserting on a global count.
- **D5** before: `closes the menu once a surrender is under way` and `keeps the menu open and announces a surrender that never started` both fail (`onclose` never called; no `role="alert"` failure node). After: `14 passed (14)`. `MenuDialog.onsurrender` now returns whether the surrender started; on `false` the dialog stays up and renders a `role="alert"` beside the existing surrender warning, on `true` it calls the existing `onclose`.

Gates and suites:

- Chromium full spec, run 1: `17 passed, 1 skipped (1.0m)`. The skip is the pre-existing seed guard in `dragging a hand card onto a highlighted zone plays it` (`preset opening hand offers no placement action`).
- Chromium full spec, run 2 (fresh random seed): `18 passed (59.4s)` — the drag test ran and passed this time.
- `firefox-smoke`: `1 passed (4.4s)`.
- `webkit-smoke`: not run — environment-blocked in this sandbox, as this file records. Not a failure.
- The three responsive gates are byte-identical: `git diff -- e2e/ src/styles/` is empty. `responsive field compositions contain controls across supported viewports` passed in both chromium runs, which is the test carrying all three assertions.

## Environment (do not rediscover these)

- **The `ship` skill is not installed here** (`Unknown skill: ship`). Run this file's own loop directly.
- **Playwright runs must be foreground and blocking.** Never `run_in_background`. Runs take 1-5 min; the Bash timeout ceiling is 600 s per call — split across calls.
- **The duel seed is random per run** — `createProductionSeed()` → `crypto.getRandomValues` at `src/worker/DuelWorkerRuntime.ts:328`. One pass proves nothing for duel-walking tests; run the chromium spec twice.
- **`webkit-smoke` is unrunnable in this sandbox.** Not a code defect.
- **jsdom has no `ResizeObserver`.** Guard any use with `typeof ResizeObserver === "undefined"`, as `DuelField.observeAnchor()` and `FieldActionBar` already do.
- **A `@container` query cannot style its own query container**, only descendants. `.duel-field` declares `container: duel-field / inline-size`. Use `@media` for `.duel-field` itself.
- **Browsers only launch inside a nix library closure, and chromium/firefox need two *different* invocations.** Do not merge them. Browsers are ALREADY INSTALLED at the path below; do not run `playwright install`. Run from the repo root.

```bash
cd /home/aron/projects/ascencio

# CHROMIUM
timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
  libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa libgbm \
  alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb libxcb libxkbcommon systemd --run '
LD_LIBRARY_PATH="$(nix-build "<nixpkgs>" -A glib.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A gtk3.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A nss.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A nspr.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A dbus.lib --no-out-link)/lib:$(nix-build "<nixpkgs>" -A atk.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A cups.lib --no-out-link)/lib:$(nix-build "<nixpkgs>" -A libdrm.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A expat.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libX11.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXcomposite.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXdamage.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXext.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXfixes.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXrandr.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A mesa.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A libgbm --no-out-link)/lib:$(nix-build "<nixpkgs>" -A alsa-lib.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A at-spi2-atk.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A at-spi2-core.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A cairo.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A pango.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A libxcb --no-out-link)/lib:$(nix-build "<nixpkgs>" -A libxkbcommon --no-out-link)/lib:$(nix-build "<nixpkgs>" -A systemd --no-out-link)/lib"
export LD_LIBRARY_PATH
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-1000/-home-aron-projects-ascencio/96d04da1-8a1d-4c99-a486-a78e08224806/scratchpad/pw-browsers
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

- `PLAYWRIGHT_BROWSERS_PATH` MUST be re-exported *inside* the single-quoted `--run` block — the outer shell's exports do not reach it.
- `playwright-driver.browsers` **and** `xorg.xvfb` are both empirically required in chromium's `-p` list even though Xvfb is never launched. Do not "simplify" the list.
- `nix-shell -p pkg` does **not** export `LD_LIBRARY_PATH` for prebuilt binaries, and `-A pkg` often resolves to a `-dev` output with no `.so`. Use `-A pkg.out`.
- `webServer` auto-builds/starts/stops per invocation (`reuseExistingServer: false`) — do not hand-start `npm run preview`. The `Port 4202 is in use` warning is ignorable.

## Working-tree hygiene

Never stage these — dirty before the run and deliberately excluded: `.gitignore`, `README.md`, `docs/README.md`, `docs/architecture/architecture.md`, `docs/architecture/02-runtime/worker-contract.md`, `docs/developer-guide/**`, `docs/duel-field-architecture.html`, `docs/duel-field-validation-references.html`, `playwright.config.ts`, `vite.config.ts`, `test-results/**`, and untracked `.claude/`, `.pi/`, `.pi-subagents/`, `.agents/`, `.agentsystem/`, `.dev/`, `.tmp/`, `CLAUDE.md`, `AGENTS.md`, `context.md`, `.graphifyignore`, `artifacts/HANDOFF_2026_08_09_duel_field_ux_overhaul.md`.

Stage explicit paths only — the source and test files you actually changed, plus this file with its checkboxes flipped. Never `git add -A`.
