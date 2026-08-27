# T10: Cir/Dante trigger proposition diagnostic (item 11)

**Plan:** `./artifacts/PLAN_2026_08_27_duel_field_right_pane_feedback.md`
**Depends:** none
**Commit outcome:** Deterministic headless repro + engine-passthrough verdict recorded in `.dev/bugs.md`

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel field / right pane. This ticket is item 11, a bug report, quoted verbatim (binding; likely contains a typo — "valid" probably meant "invalid"):
  > BUG : In test game with burning abyss deck, I used Dante to mill 3 cards. I milled Cir but i got proposition to activate its effect even thought the trigger condition is valid.
- This slice: diagnostic-only. It produces evidence and a verdict, not an app change. Three deliverables:
  1. Evidence, with `path:line`, that trigger propositions are pure engine passthrough in this repo (no app-side filter/dedupe/rule check).
  2. A verdict on the disputed Cir proposition — preferred path: deterministic headless repro; allowed fallback (if scripted repro exceeds ~half a day): verdict from CardScripts source reading + engine-trace reasoning.
  3. A `.dev/bugs.md` entry recording repro steps (or script citation), the verdict, and a `TODO(user)` asking the owner to confirm whether "valid" was a typo and what behavior they expected.
- Out of scope here (fence): NO app behavior change. No `vendor/` changes (vendored `ocgcore-wasm` is permanently frozen). No changes to `src/battle/worker/protocol/PromptRegistry.ts` or any other `src/` file. No UI changes. Never edit `feedback.md` or any `feedback*.md`. If the verdict suggests an engine bug, an upstream (Project Ignis) issue is out of scope — note it in the bugs entry only.
- Assumptions in force:
  - `.dev/` does not exist yet in the working tree (verified 2026-08-27); this ticket creates `.dev/bugs.md`. `AGENTS.md` already names `.dev/bugs.md` as the bug log location, so creating it is conforming, not scope widening.
  - Deterministic seeded duels are test/diagnostic-legal per `AGENTS.md` ("Production duels shuffle normally; deterministic inputs are test/diagnostic-only").
  - Decision (recorded, from planning): integration tests seed decks via `DuelSession` programmed mode with explicit `playerDeckOrder`/`opponentDeckOrder` and a fixed `seed` (pattern: `tests/integration/field-spell-activation.test.ts:83-93`), which is fully deterministic — so a green repro test lives under `tests/integration/`. Only if the repro cannot be made deterministic-and-green does it move to a gitignored scratch path (`.tmp/`, already gitignored) with the transcript excerpt pasted into `.dev/bugs.md`.

## Requirements

- R1. Document, with exact `path:line` citations, that a `MSG_SELECT_CHAIN` proposition reaching the player is built 1:1 from the engine's `message.selects` with no app-side filtering.
- R2. Establish whether the engine offering Cir's effect after a Dante mill is correct — verdict is exactly one of: `engine-correct`, `engine-bug`, `unresolvable`.
- R3. Preferred evidence: a deterministic headless duel (seeded, programmed deck order) in which the player Xyz Summons Dante, activates its detach-and-mill effect with Cir among the milled cards, and the captured chain prompt payload is asserted to contain (or not contain) Cir's card code `57143342`.
- R4. Fallback evidence (only if R3 exceeds ~half a day of effort): source reading of Cir's CardScript (`generated/assets/current/scripts/cards/2e.json`, key `c57143342.lua`) plus Dante's (`generated/assets/current/scripts/cards/b1.json`, key `c83531441.lua`), with the relevant lua lines quoted in the bugs entry.
- R5. `.dev/bugs.md` entry created matching the template in the Interface contract, ending with the owner-confirmation `TODO(user)`.
- R6. `npm run check:headless` green. If no CI-worthy test is added the gate is trivially green — still run it.
- R7. If the verdict is `engine-correct`, the entry documents that Cir's trigger IS met by milling (mill = "sent to the Graveyard"; Cir's script trigger is unconditional `EVENT_TO_GRAVE`). If it suggests `engine-bug`, the entry records the exact chain-prompt payload and card codes.

## Inputs

- `src/battle/worker/protocol/message-classification.ts:18` — `16: "prompt"` in `PINNED_MESSAGE_CLASSIFICATION` (MSG_SELECT_CHAIN = 16, see `src/battle/worker/engine/engine-constants.ts:57` `SELECT_CHAIN: 16`).
- `src/battle/worker/protocol/PromptRegistry.ts:369-393` — `case EngineMessageType.SELECT_CHAIN`: calls `addCardActions(bindings, id, message.selects, "activate", "Chain", text)` then, when `!message.forced`, `addSimpleChoice(bindings, id, "pass", "Pass")`. No filter.
- `src/battle/worker/protocol/PromptRegistry.ts:965-983` — `function addCardActions(...)`: `cards.forEach((card, index) => bindings.push(makeCardBinding(...)))` — unconditional push of every engine-offered select.
- `src/battle/worker/HeadlessDuelController.ts` — headless driver; `controller.advance()`, `controller.respond(promptId, choiceIds)`, `controller.trace().entries`, `controller.dispose()`.
- `src/battle/worker/engine/DuelSession.ts:37-45` — `ProgrammedDuelConfiguration` (`mode: "programmed"`, `rules`, `seed`, `playerDeckOrder`, `opponentDeckOrder`).
- `tests/integration/field-spell-activation.test.ts` — pattern for: loading the vendored core (`loadVendoredCoreNode`), `parseYdk` deck loading, `loadActiveDuelDependenciesNode(path.resolve("generated/assets/current"), uniqueDeckCodes(...))`, programmed-mode session, prompt-driving loop with targeted `activationChoice` + `firstValidChoice` fallback, `rotateToFront` deck reordering.
- `tests/integration/xyz-overlay-progression.test.ts` — pattern for: `selectedDeckPairRulesProfile(player, opponent, dependencies.cards)`, burning-abyss deck loading, retry-on-`invalid_response` answering (`candidateResponses`), `traceTail(controller)`.
- `src/battle/duel/presets/decks/burning-abyss.ydk` — main deck contains Cir `57143342` ×3, Scarm `84764038` ×3, Graff `20758643` ×3, Book of Moon `14087893` ×2, Dark Hole `53129443`, Allure of Darkness `1475311` ×2; extra deck contains Dante `83531441` ×3.
- `src/battle/duel/contracts/player-prompt.ts` — `PromptKind` includes `"chain"`; `ChoiceAction` includes `"activate"` and `"pass"`; `PromptCard` carries `code?: CardCode`.
- CardScripts snapshot: `generated/assets/current/scripts/cards/{shard}.json`, shard = `(code % 256).toString(16).padStart(2, "0")` (algorithm `numeric-id-modulo`, `shardCount: 256`, per `generated/assets/current/scripts/index.json`; loader at `src/battle/worker/assets/active-duel-dependencies.ts:165`). Cir → shard `2e`, key `c57143342.lua`. Dante → shard `b1`, key `c83531441.lua`.
- **From Depends:** none.

## Interface contract (level 5)

Machine-checkable shapes this slice produces or consumes.

- **Produces (1): repro test file** `tests/integration/cir-mill-chain-prompt.test.ts` (only if deterministic + green; else the same driver lives at `.tmp/cir-mill-repro.ts` and is not committed):

  ```ts
  // Card codes (from burning-abyss.ydk + generated/assets/current/catalog/texts/en)
  const CIR = cardCode(57143342); // "Cir, Malebranche of the Burning Abyss"
  const DANTE = cardCode(83531441); // "Dante, Traveler of the Burning Abyss"
  const SCARM = cardCode(84764038);
  const GRAFF = cardCode(20758643);

  interface CirMillRun {
    /** kind === "chain" prompts observed after Dante's mill resolved. */
    readonly chainPrompts: readonly PlayerPrompt[];
    /** Card codes offered as "activate" choices in those prompts. */
    readonly offeredCodes: readonly number[];
    /** True once Dante's detach-and-mill ignition effect was activated. */
    readonly danteMillActivated: boolean;
    readonly traceTail: readonly DuelTraceEntry[];
  }

  function playUntilDanteMillChainPrompt(): CirMillRun;
  ```

  Test names (exact):
  - `describe("Cir mill chain prompt (feedback item 11)")`
  - `it("Dante's mill sends Cir to the GY and the engine offers Cir's trigger in the chain prompt")` — asserts `run.danteMillActivated === true` and `expect(run.offeredCodes).toContain(57143342)` if the verdict is engine-correct; if the run shows Cir NOT offered, invert the assertion and the verdict becomes engine-bug material.

- **Produces (2): `.dev/bugs.md`** — new file, exact skeleton (verdict line filled with one of the three enum values; the two `{...}` blocks filled from the run):

  ```md
  # Bug log

  Owner-reported bugs with diagnosis records. Newest first.

  ## 2026-08-27 — Cir effect proposition after Dante mill (feedback round item 11)

  - **Report (owner, verbatim):** "BUG : In test game with burning abyss deck, I used Dante
    to mill 3 cards. I milled Cir but i got proposition to activate its effect even thought
    the trigger condition is valid."
  - **Verdict:** engine-correct | engine-bug | unresolvable
  - **Passthrough evidence:** chain propositions are pure engine passthrough. MSG_SELECT_CHAIN
    (type 16) is classified "prompt" at `src/battle/worker/protocol/message-classification.ts:18`;
    `src/battle/worker/protocol/PromptRegistry.ts:369-393` builds the prompt from
    `message.selects` via `addCardActions` (`PromptRegistry.ts:965-983`), an unconditional
    `forEach` push — no app-side filter, dedupe, or rule check exists. Any disputed
    proposition originates in ocgcore + CardScripts, not this repo.
  - **Repro / evidence:** {either: "deterministic headless repro at
    tests/integration/cir-mill-chain-prompt.test.ts — seed [..], playerDeckOrder rotated so
    Scarm+Graff open in hand and Cir occupies deck positions 6-9; Dante Xyz-summoned, mill-3
    ignition activated, captured chain prompt offered codes {codes}"; or: script citation —
    Cir `c57143342.lua` (snapshot shard `generated/assets/current/scripts/cards/2e.json`)
    registers effect e3 as `EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O` with
    `SetCode(EVENT_TO_GRAVE)` and no reason/origin condition; Dante `c83531441.lua`
    (shard `b1.json`) mills via `Duel.DiscardDeck(tp,op,REASON_COST)`, and deck→GY raises
    EVENT_TO_GRAVE regardless of reason.}
  - **Reading (if engine-correct):** Cir's printed trigger "If this card is sent to the
    Graveyard" IS satisfied by a Dante mill — a mill is "sent to the Graveyard", and Cir's
    script attaches no condition restricting the origin or reason. The engine offering the
    activation is correct; the owner's sentence likely means "invalid" and the expectation
    behind it is what needs confirming.
  - **Payload (if engine-bug):** {exact SELECT_CHAIN payload: forced flag + selects[] with
    code/controller/location/sequence, plus the trace tail}
  - **TODO(user):** confirm whether "valid" in the report was a typo for "invalid", and state
    what behavior you expected (no proposition at all? a different timing? fewer duplicate
    propositions when several Cir are milled at once?).
  ```

- **Consumes:** `HeadlessDuelController` public API as-is (`advance(): DuelAdvance`, `respond(id: PromptId, choiceIds: readonly ChoiceId[]): DuelAdvance`, `trace(): DuelTrace`, `dispose(): void` — `src/battle/worker/HeadlessDuelController.ts`); `ProgrammedDuelConfiguration` as-is (`src/battle/worker/engine/DuelSession.ts:37-45`); `PlayerPrompt`/`PromptCard`/`ChoiceAction` as-is (`src/battle/duel/contracts/player-prompt.ts`). Binding — do not redesign, do not widen any public entry.
- **Errors:** driver loop re-throws anything that is not `DuelOperationError` with `duelError.code === "invalid_response"`; on `invalid_response` it tries the next candidate choice (pattern: `tests/integration/xyz-overlay-progression.test.ts:187-208`). Prompt budget exhausted without a chain prompt after the mill → test fails with message `"Dante mill never produced a chain prompt within budget"` (that outcome feeds the `unresolvable`-vs-fallback decision, it is not committed red).
- **Invariants:** deterministic — fixed `seed` (use `[17n, 23n, 29n, 31n]` like field-spell test), fixed `playerDeckOrder`/`opponentDeckOrder`, seeded candidate ordering only; no wall-clock, no `Math.random`. `controller.dispose()` always runs (`finally`). No file under `src/` or `vendor/` is modified. `feedback.md` byte-identical.
- **Integration links:** trigger `tests/integration/cir-mill-chain-prompt.test.ts` (driver loop) → dispatch `HeadlessDuelController.respond` → `DuelSession.respond` → vendored ocgcore WASM (in-process, `loadVendoredCoreNode()`, `vendor/ocgcore-wasm/0.1.2/` read-only) → receive `MSG_SELECT_CHAIN` (type 16) classified at `src/battle/worker/protocol/message-classification.ts:18`, mapped at `PromptRegistry.ts:369` → observe `PlayerPrompt` with `kind === "chain"` captured into `CirMillRun.chainPrompts` + `controller.trace().entries` tail; durable observe = the `.dev/bugs.md` entry.

## Diagnostic protocol (skill override of TDD)

Diagnostic ticket: the "red" is the disputed observation, the "green" is a recorded verdict.

1. **Verify passthrough claim by inspection** — re-read the three cited sites (`message-classification.ts:18`, `PromptRegistry.ts:369-393`, `PromptRegistry.ts:965-983`) and grep `src/battle/` for any chain filtering (`grep -rn "forced\|selects" src/battle/worker/protocol/`); confirm no filter exists. If one is found, the brief is wrong — record it under Assumptions and report.
2. **Reproduce** — build the seeded headless duel below; drive to Dante's mill; capture the first `kind === "chain"` prompt after the mill and its offered card codes.
3. **Verdict** — Cir offered + script reading agrees trigger is met → `engine-correct`. Cir offered but script shows an unmet condition (there is none as of snapshot reading: e3 is bare `EVENT_TO_GRAVE`) → `engine-bug`, record payload. Repro unreachable within ~half a day → fallback to script-reading verdict (R4); if even that is ambiguous → `unresolvable`.
4. **Record** — write `.dev/bugs.md` per the contract skeleton.

## Evidence plan (skill override of Test plan)

| Evidence | Input | Expect |
| -------- | ----- | ------ |
| Passthrough citation | read `src/battle/worker/protocol/PromptRegistry.ts:369-393`, `:965-983`; `message-classification.ts:18` | `addCardActions` pushes every `message.selects` entry unconditionally; no filter branch anywhere in the SELECT_CHAIN case |
| Repro test `it("Dante's mill sends Cir to the GY and the engine offers Cir's trigger in the chain prompt")` | programmed duel: burning-abyss vs `(await loadMvpPreset()).opponent`, seed `[17n, 23n, 29n, 31n]`, `playerDeckOrder` rearranged so indices 0-4 = `[84764038 (Scarm), 20758643 (Graff), 14087893, 14087893, 53129443]`, indices 5-8 = `[1475311, 57143342, 57143342, 57143342]` (filler then Cir×3 — covers both draw-on-turn-1 and no-draw: any 3-card mill from position 5/6 contains Cir), rest of main in original order | `run.danteMillActivated === true`; `run.offeredCodes` contains `57143342` (expected outcome per script reading); `run.chainPrompts.length >= 1` |
| Script citation (fallback + corroboration) | `node` one-liner extracting `c57143342.lua` from `generated/assets/current/scripts/cards/2e.json` and `c83531441.lua` from `.../b1.json` | Cir e3: `SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)` + `SetCode(EVENT_TO_GRAVE)`, no origin condition. Dante atkcost: `Duel.DiscardDeck(tp,op,REASON_COST)` |
| Gate | `npm run check:headless` | exit 0 |
| Fence | `git status --porcelain -- feedback.md src/ vendor/` | empty (no modification lines beyond the pre-existing `feedback.md`/`src/story/` dirt already in the tree — this ticket adds none) |

Run commands (exact): `npx vitest run tests/integration/cir-mill-chain-prompt.test.ts` · `npm run check:headless`.

## Impl steps

- [ ] 1. Verify the passthrough claim by inspection and freeze the citations.
  - [ ] 1.1 Read `src/battle/worker/protocol/message-classification.ts:18` and confirm `16: "prompt"`; read `src/battle/worker/engine/engine-constants.ts:57` and confirm `SELECT_CHAIN: 16`.
  - [ ] 1.2 Read `src/battle/worker/protocol/PromptRegistry.ts:369-393` (SELECT_CHAIN case) and `:965-983` (`addCardActions`); confirm the unconditional `forEach` push and absence of any filter.
  - [ ] 1.3 Run `grep -rn "SELECT_CHAIN" src/battle/ --include='*.ts'` and confirm no other site post-processes chain selects. Keep the three `path:line` citations for the bugs entry.
- [ ] 2. Extract and read both card scripts from the snapshot (corroboration now, fallback evidence if step 3 stalls).
  - [ ] 2.1 Run: `node -e 'const fs=require("fs");const g=(c)=>JSON.parse(fs.readFileSync("generated/assets/current/scripts/cards/"+(c%256).toString(16).padStart(2,"0")+".json","utf8"))["c"+c+".lua"];fs.writeFileSync("/tmp/cir.lua",g(57143342));fs.writeFileSync("/tmp/dante.lua",g(83531441));'`
  - [ ] 2.2 In `/tmp/cir.lua` locate effect `e3` (`SetCode(EVENT_TO_GRAVE)`, `EFFECT_TYPE_TRIGGER_O`, `SetCountLimit(1,id)`, no `SetCondition`). In `/tmp/dante.lua` locate `s.atkcost` (`Duel.DiscardDeck(tp,op,REASON_COST)`, `Duel.AnnounceNumberRange(tp,1,max_ct)`). Quote both in the bugs entry.
- [ ] 3. Build the deterministic headless repro `tests/integration/cir-mill-chain-prompt.test.ts` (budget: ~half a day; if exceeded, skip to step 4-fallback).
  - [ ] 3.1 Create the file. Copy the `beforeAll` scaffold from `tests/integration/xyz-overlay-progression.test.ts:78-88` (`loadVendoredCoreNode`, `parseYdk` of `src/battle/duel/presets/decks/burning-abyss.ydk`, `(await loadMvpPreset()).opponent` as opponent per `field-spell-activation.test.ts:53`, `loadActiveDuelDependenciesNode(path.resolve("generated/assets/current"), uniqueDeckCodes(player, opponent))`).
  - [ ] 3.2 Write `function arrangedDeckOrder(main: readonly CardCode[]): readonly CardCode[]` — pulls one `84764038`, one `20758643`, two `14087893`, one `53129443`, one `1475311`, three `57143342` out of `main` (throw if any is missing), returns `[those nine in the order given in the Evidence plan row, ...remaining in original order]`.
  - [ ] 3.3 Create the session exactly as `field-spell-activation.test.ts:84-105` but: `playerDeck` = burning-abyss, `configuration: { mode: "programmed", rules: profile.rules, seed: [17n, 23n, 29n, 31n], playerDeckOrder: arrangedDeckOrder(player.main), opponentDeckOrder: opponent.main }` with `profile = selectedDeckPairRulesProfile(player, opponent, dependencies.cards)`; controller options `presetId: "cir-mill-chain-prompt"`, `extraMonsterZones: profile.extraMonsterZones`, `maximumAutomaticResponses: 5_000`.
  - [ ] 3.4 Write `function playUntilDanteMillChainPrompt(): CirMillRun` — prompt loop (budget 120 prompts) with a goal ladder tried in order on every prompt, falling back to `firstValidChoice` (copy from `field-spell-activation.test.ts:155-164`) wrapped in the retry-on-`invalid_response` pattern of `xyz-overlay-progression.test.ts:187-208`:
    1. `idleCommand`: choice `action === "activate" && card?.code === 84764038 && card.location === "hand"` (Scarm self-Special-Summon) — until done once;
    2. `idleCommand`: choice `action === "summon" && card?.code === 20758643` (Normal Summon Graff);
    3. `idleCommand`: choice `action === "specialSummon" && card?.code === 83531441` (Xyz Summon Dante); answer subsequent `selectCard`/`selectUnselectCard` material prompts with the two on-field level-3s, `selectPlace` with `firstValidChoice`;
    4. `idleCommand`: choice `action === "activate" && card?.code === 83531441` → set `danteMillActivated = true`; answer the following `announceNumber` prompt with the choice whose label/value is `3` (fallback: last choice);
    5. after `danteMillActivated`, every prompt with `kind === "chain"`: push the prompt into `chainPrompts` and its `action === "activate"` choice `card.code`s into `offeredCodes`, then answer `pass`; stop the loop after the first such capture.
  - [ ] 3.5 Write the test: `describe("Cir mill chain prompt (feedback item 11)", ...)` with `it("Dante's mill sends Cir to the GY and the engine offers Cir's trigger in the chain prompt", ...)` asserting `run.danteMillActivated === true`, `run.chainPrompts.length` ≥ 1, and `run.offeredCodes` contains `57143342`. On failure print `run.traceTail` (pattern: `describeFailure`, `xyz-overlay-progression.test.ts:285-292`).
  - [ ] 3.6 Run `npx vitest run tests/integration/cir-mill-chain-prompt.test.ts`. Iterate on the goal ladder (not the assertions) until green **or** the half-day budget is spent. If the run instead shows Cir absent from the chain prompt, keep the run, flip the verdict path to `engine-bug`, and record the exact payload + trace tail — do not commit a red test either way.
- [ ] 4. Decide test placement per the recorded decision.
  - [ ] 4.1 Repro deterministic + green → keep `tests/integration/cir-mill-chain-prompt.test.ts`. Not green in budget → move driver to `.tmp/cir-mill-repro.ts` (gitignored via `.tmp/`), paste the transcript/trace excerpt into the bugs entry, and rely on step 2's script citation as primary evidence (fallback verdict).
- [ ] 5. Write the diagnostic record.
  - [ ] 5.1 Create `.dev/bugs.md` with the exact skeleton from the Interface contract, verdict filled (`engine-correct` expected: Cir's `EVENT_TO_GRAVE` trigger is unconditional and a Dante mill is deck→Graveyard), evidence block filled from whichever path step 4 landed on, `TODO(user)` kept verbatim.
- [ ] 6. Gate and commit.
  - [ ] 6.1 Run `npm run check:headless`; must exit 0.
  - [ ] 6.2 Run `git status --porcelain` and confirm this ticket only added `.dev/bugs.md` (+ optionally `tests/integration/cir-mill-chain-prompt.test.ts`); `feedback.md`, `src/`, `vendor/` untouched by this ticket.
  - [ ] 6.3 Stage only this ticket's files: `git add .dev/bugs.md tests/integration/cir-mill-chain-prompt.test.ts` (drop the test path if fallback) and commit.

## Outputs

- `.dev/bugs.md` — new file, one dated entry per the contract skeleton (durable diagnostic record).
- `tests/integration/cir-mill-chain-prompt.test.ts` — new deterministic integration test, only if green in budget; otherwise nothing committed under `tests/` and the driver lives (uncommitted) at `.tmp/cir-mill-repro.ts`.
- No public API change, no behavior change, no migration, no config change.

## Validation

- [ ] tests pass: `npx vitest run tests/integration/cir-mill-chain-prompt.test.ts` (skip if fallback path) then `npm run check:headless` — both exit 0
- [ ] manual check: open `.dev/bugs.md`, confirm every skeleton field is filled, verdict is one of the three enum values, and the `TODO(user)` question is present
- [ ] no silent-failure swallow on a path this slice adds — the driver's `catch` narrows to `DuelOperationError` with code `invalid_response` and re-throws everything else (kept: it is the established legal-choice-search pattern from `xyz-overlay-progression.test.ts`); no `|| true`, no empty catch, no output redirection to `/dev/null`
- [ ] app functional — no `src/`/`vendor/` file touched, so no runtime path can break; `check:headless` proves it
- [ ] commit msg draft: `docs(dev): record Cir/Dante chain-prompt diagnostic — engine passthrough verified, verdict logged (#11)`
