# R4: Gate hardening and documentation, from the review fanout

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** R3 (done, HEAD `b9c5e5f`)
**Type:** parent-directed repair after the deep reviewer fanout. Not a plan ticket.
**Commit outcome:** The plan's own `data-cy` uniqueness gate actually enforces uniqueness in a rendered document, two vacuous e2e guards become real, the chip reveal behaviour gains a test, and the documents this plan invalidated are corrected.

## Context (self-contained)

A Svelte 5 (legacy mode: `export let`, `$:`, `afterUpdate`) Yu-Gi-Oh duel client, just converted from a panel-stack shell into a field-first duel client across 11 tickets. Four deep reviewers audited the result. `R3` fixed the code defects; this file carries the test-gate and documentation findings. `src/worker/**`, `src/duel/**` and the card-data pipeline stay untouched.

Every claim below was verified against shipped code by the parent. Line numbers are from HEAD `b9c5e5f` unless stated.

## Defects to fix

### G1 — the `data-cy` uniqueness gate does not enforce uniqueness in a rendered document

`AGENT.md:83` states the contract: values "are unique inside a rendered document. Elements rendered in a loop suffix the value with the item's stable id, for example `` data-cy={`field-card-${card.id}`} ``. `tests/unit/data-cy-coverage.test.ts` enforces presence and uniqueness."

It does not. `tests/unit/data-cy-coverage.test.ts:76-99` collects **static source literals** across `src/app` and flags only two source sites sharing one literal. A single literal inside a component that is instantiated once per card is invisible to it. The live document therefore carries many duplicates while the gate reports zero:

- `card-control-art`, `card-control-image`, `card-control-label` — `src/app/components/duel-field/CardControl.svelte:207,214,220`, one instance per board card (`FieldBoard.svelte:183`).
- `zone-control-label` — `ZoneControl.svelte:66`, ~34 instances.
- `stack-control-name`, `stack-control-count` — `StackControl.svelte:27,34`, 8 each.
- the `card-tray-*` literals in `CardTray.svelte:167-252`, one per mounted tray, and `card-tray-card-image` / `card-tray-card-label` once per card inside the tray's `{#each}`.

This is not theoretical. A Playwright `page.locator('[data-cy="card-control-image"]')` gets a strict-mode "resolved to N elements" violation on a value the gate certified unique, and the suite already works around it — `tests/component/DuelField.test.ts:1107` has to scope `zone-control-label` inside a zone element to disambiguate.

Two further holes in the same gate:
- `data-cy=""` satisfies the presence regex at `:67`, and `staticDataCyValue` (`tests/fixtures/svelte-element-scan.ts:124`) returns `""` rather than `null`, so an empty value passes as a legitimate selector.
- Hoisting the literal into a constant evades the uniqueness scan entirely: `staticDataCyValue` returns `null` for `data-cy={LIST_DATA_CY}`, and `FieldActionBar.svelte:119` and `:168` already emit the same value `"field-action-bar-list"` through that route.

Fix both halves — the values and the gate:

- [x] G1.1 Suffix the item's stable id on every element rendered per-instance or in a loop, per the `AGENT.md` rule. Covers the `CardControl`, `ZoneControl`, `StackControl` and `CardTray` values listed above. Use the id the component already has to hand (`card.id`, `zone.id`, and the stack/tray equivalents) — do not invent a counter, and do not renumber anything that is already unique. Validate: rendering the fixture boards yields no duplicate `data-cy` in the DOM.
- [x] G1.2 Update every selector that referenced one of the changed static values — component tests, e2e, and any CSS. Note `src/styles/app.css` styles three elements through `[data-cy="…"]` selectors (`field-action-bar-list`, `field-action-bar-validation`, `card-preview-text`); those three values are not per-instance so they should not change, but grep before you assume. Validate: `npm run test:component` and the e2e suite green.
- [x] G1.3 Make the gate detect what it missed. A DOM-level assertion is the honest form: render the existing test fixture boards and assert `new Set(values).size === values.length` over every `[data-cy]` in the rendered output. If a DOM-level check proves impractical, a static approximation must at minimum flag a literal `data-cy` on an element inside an `{#each}`, and a literal in a component instantiated more than once. Say in your report which you implemented and why. Validate: the new assertion fails when you temporarily revert one G1.1 change, and passes after.
- [x] G1.4 Reject `data-cy=""` as absent, and make hoisted-constant values visible to the uniqueness scan or explicitly fail them as unverifiable. Validate: a test proving an empty value is now a violation.

### G2 — two hard gates are wrapped in guards that delete them instead of failing

`e2e/duel-smoke.spec.ts`, in `responsive field compositions contain controls across supported viewports`.

- The action-bar geometry gate sits inside `if ((await dock.count()) > 0)`. It is currently deterministic — `fieldActionBarRequired` (`src/app/prompts/interaction-spec.ts:166`) is true in the first Main Phase because `battlePhase` is a non-`endPhase` global choice — so make it an unconditional `await expect(dock).toBeVisible()` followed by the gate.
- The chip block sits inside `if ((await actionTarget.count()) > 0)`, and that guard **is** genuinely seed-dependent: an opening hand with no summonable monster and no activatable spell yields an `idleCommand` with global choices only and no actionable card. When that happens the chip visibility assertion, the viewport assertion, the `ST-05` evidence capture and the Escape round trip all silently vanish at **all six viewports** on a green run — i.e. the entire deliverable of the earlier `R2` repair can fail to execute without anyone noticing. Do not make this one unconditional; that would trade a silent skip for a seed-dependent failure. Instead track whether the block ran at least once across the viewport loop and assert that at the end, so a run where chips never appeared fails loudly.

- [x] G2.1 Make the action-bar gate unconditional. Validate: chromium green; temporarily renaming the bar's `data-cy` makes it fail rather than skip.
- [x] G2.2 Assert the chip block executed at least once across the viewport loop. Validate: chromium green, and the assertion message names what was missing.

### G3 — the chips' hover and focus reveal, the headline behaviour of the plan, has no test

`src/styles/app.css:1078-1079`. Delete `.duel-field-card.is-actionable:hover .card-action-chips` and the whole suite stays green. jsdom loads no stylesheet, so no component test can observe `display`. The e2e only ever reaches the chips through the **pinned** path, and before asserting they are hidden it deliberately drops both focus and the pointer — so neither reveal trigger is ever positively asserted.

The plan requirement is explicit: "Chips are invisible until the card is hovered, contains focus, or is the pinned `session.menuTarget`."

- [x] G3.1 Add coverage for the hover and focus triggers. Cheapest in-pattern option is a row in `tests/unit/global-styles.test.ts`, which already gates the halo colour and the board min-width by asserting rule text. An e2e `hover()` → `toBeVisible()` is stronger; do that too if it is stable. Validate: the new assertion fails when the selector is removed from the CSS.

### G4 — a seed-dependent `test.skip` discards the only e2e of the placement seam

`e2e/duel-smoke.spec.ts:838-839`, `test.skip(true, "preset opening hand offers no placement action")`, inside `dragging a hand card onto a highlighted zone plays it`. It fires whenever the seed deals an opening hand with no `summon`/`setMonster` chip — observed live during `R3`, where chromium run 1 skipped it and run 2 ran it.

What is lost is not just the gesture: this is the only test anywhere that exercises `App.svelte onplacementintent` → `duel-store.armPlacementIntent` → the in-`subscribe` auto-answer, and the only assertion that one gesture yields exactly two responses with the second answering the `selectPlace` prompt. The store pieces are well covered by unit tests and the DuelField side by component tests, but the wiring between them exists only here.

`dropChoiceForZone` already handles `activate` / `setSpellTrap` into a `spellTrap` zone, so the walker can fall back to a backrow chip and a spell/trap zone instead of skipping.

- [x] G4.1 Replace the skip with a backrow fallback so the test runs on any seed that offers a placement of any kind. Match the engine action id through the chip's `data-cy` suffix, never the chip's text — `Set` is ambiguous between `setMonster` and `setSpellTrap`, which is the exact ambiguity an earlier repair existed to remove. Keep a skip only for the genuinely degenerate case where no placement action of any kind exists, and make its message say so. Validate: `--repeat-each=5` on this test alone, reporting how many runs executed the body versus skipped, before and after.

### G5 — documents this plan made wrong

- [x] G5.1 `docs/architecture/05-presentation/duel-field-architecture.md:270-273` — the canonical component tree still lists `FieldActionMenu.svelte`, `SelectionDock.svelte` and `CardInspector.svelte`, all deleted, and omits `FieldActionBar`, `CardActionChips`, `EndTurnButton`, `CardPreviewPanel`, `FieldStatusPills`, `LifePointsPill`. `AGENT.md` routes readers to `docs/architecture/` as the decision map, so this misdirects both humans and agents. Correct the tree. Validate: every path named in that tree exists on disk.
- [x] G5.2 `docs/GLOSSARY.md:20,26` — the `selection` row points at `duel-field/SelectionDock.svelte` and the `inspector` row at `duel-field/CardInspector.svelte`, both deleted by this plan. The glossary was added by this plan's own base commit, so this is self-inflicted. Repoint both rows at what actually serves those concepts now. Validate: every file path in the glossary exists.
- [x] G5.3 `ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md` — propagate two corrections its tickets already made and logged. Assumption A12 still says the preview panel "stacks below the field under `64rem`" while the shipped CSS is `@media (max-width: 79rem)` (the arithmetic is in `T11_card-preview-panel.md` under "Breakpoint correction"). And the ticket table and flowchart order T8 before T9-T11, whereas execution ran T6 → T7 → T9 → T10 → T11 → T8 because T8 depends on T7 and nothing depends on T8. Also add rows for the three parent-directed repairs now living in the tickets directory: `R2_stabilise-chip-viewport-assertion.md`, `R3_review-code-defects.md` and this file. Validate: every ticket file in the directory is reachable from the index, and the index states no breakpoint or ordering that contradicts the code.
- [x] G5.4 Two ticket files record deviations in prose but have no `## Assumptions` section, so the deviations read as unlogged: `T10_hand-drag-and-drop.md` (the worker shipped **both** authorised remedies for the chip hit-test trap — the `closest` walk *and* a `.duel-field[data-dragging="true"] .card-action-chips { pointer-events: none; }` rule, which disables chip clicking for a keyboard-pinned card while an unrelated drag is in flight; and it added a `next === previous` guard beyond the step-7 code, changing when an armed intent is consumed) and `T8_status-and-life-pills.md` (its manual-check box cites "see Assumptions" and no such section exists). Add the missing sections recording what was actually decided. Documentation only — do **not** change the code these describe. Validate: neither file cites a section it lacks.

## Constraints

- `src/worker/**`, `src/duel/**` and the card-data pipeline stay untouched.
- The three responsive e2e gates must stay green and unweakened: action bar vs board non-intersection, `[data-cy="field-end-turn-button"]` vs board non-intersection, and `scrollWidth <= clientWidth + 1` at every viewport `>= 1024`.
- Do **not** change `.duel-field`'s scroll or positioning strategy, and do **not** rewrite the `assertRectInsideViewport` calls that follow a `scrollIntoViewIfNeeded`. A reviewer correctly identified those as tautological, but they are tautological *because* absolutely positioned field controls pan out of view below ~900px — a real structural defect deliberately deferred to its own ticket. Making the assertions honest without fixing the structure would simply turn the suite red.
- Do not re-fix anything from `R3`; those five defects are already fixed and committed.

## Validation

- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes, with the strengthened assertions
- [x] `npm run test:unit && npm run test:component` passes
- [x] `npm run typecheck && npm run lint` passes
- [x] `npm run format` then `npm run format:check` passes
- [x] e2e green: chromium full spec twice + firefox-smoke (webkit-smoke env-blocked, note it, do not treat as failure)
- [x] all three responsive gates still green and unweakened
- [x] G1.3 and G3.1 each proved by a temporary revert that makes the new assertion fail
- [x] G4.1 reports before/after `--repeat-each=5` executed-vs-skipped tallies
- [x] every file path named in the two corrected documents exists on disk
- [x] commit msg draft: `test(app): enforce rendered data-cy uniqueness and close vacuous gates`

## Environment (do not rediscover these)

- **The `ship` skill is not installed here** (`Unknown skill: ship`). Run this file's own loop directly.
- **Playwright runs must be foreground and blocking.** Never `run_in_background`. Runs take 1-5 min; the Bash timeout ceiling is 600 s per call — split across calls.
- **The duel seed is random per run** — `createProductionSeed()` → `crypto.getRandomValues` at `src/worker/DuelWorkerRuntime.ts:328`. One pass proves nothing for duel-walking tests; run the chromium spec twice.
- **`webkit-smoke` is unrunnable in this sandbox.** Not a code defect.
- **`firefox-smoke` only runs the single test at `e2e/duel-smoke.spec.ts:213`**, so it will not exercise most of your changes. Run it anyway as a regression check.
- **jsdom has no `ResizeObserver`.** Guard any use with `typeof ResizeObserver === "undefined"`.
- **Browsers are ALREADY INSTALLED** at the path below; do not run `playwright install`. Chromium and firefox need two *different* invocations — do not merge them. Run from the repo root.

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
- `webServer` auto-builds/starts/stops per invocation (`reuseExistingServer: false`) — do not hand-start `npm run preview`.

## Working-tree hygiene

Never stage these — dirty before the run and deliberately excluded: `.gitignore`, `README.md`, `docs/README.md`, `docs/architecture/architecture.md`, `docs/architecture/02-runtime/worker-contract.md`, `docs/developer-guide/**`, `docs/duel-field-architecture.html`, `docs/duel-field-validation-references.html`, `playwright.config.ts`, `vite.config.ts`, `test-results/**`, and untracked `.claude/`, `.pi/`, `.pi-subagents/`, `.agents/`, `.agentsystem/`, `.dev/`, `.tmp/`, `CLAUDE.md`, `AGENTS.md`, `context.md`, `.graphifyignore`, `ai-artifacts/HANDOFF_2026_08_09_duel_field_ux_overhaul.md`.

Note that `docs/architecture/05-presentation/duel-field-architecture.md` and `docs/GLOSSARY.md` are **clean and tracked** — they are yours to edit under G5. Do not confuse them with the dirty `docs/` paths above, and do not touch `docs/duel-field-architecture.html` (dirty, different file).

Stage explicit paths only. Never `git add -A`.
