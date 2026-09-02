# T9: GY trigger chain window reaches the player

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** none
**Commit outcome:** A chain window opened by the player's own action with an activatable graveyard trigger (Scarm case) prompts the player instead of auto-passing.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 11 — after sending Scarm to the graveyard, no action proposed to activate its valid trigger; suspected global for graveyard triggers.
- This slice: guard the auto-pass heuristic; MUST start with a failing integration repro because the prompt kind is unverified.
- Out of scope here: hover chips (T8), detach dialog (T10), Full Control changes.
- Assumptions in force: A10 (red-team D2, option a) — guard ONLY the empty-chain/actor-heuristic branch of `ownEffectChainPassResponse`; own-last-link auto-pass (chaining onto your own effect mid-chain) stays. A4 — root at `auto-response.ts:83-97`: fn returns `[pass]` when `owner === 0` without checking activatable choices; when the chain is empty it falls back to `actor`, so a fresh trigger window after the player's own action is swallowed.
- Risk (red-team UNVERIFIED): Scarm's trigger may arrive as `effectYesNo` instead of `chain` (Falco's does — `tests/integration/falco-facedown-special-summon.test.ts:233`); if the repro shows `effectYesNo`, STOP, report re-scope — fix location would be wrong.

## Requirements

- Repro first: integration test that mills/destroys a card with a GY chain trigger after the player's own action and captures the prompt sequence — assert the `chain` prompt with an activatable choice is surfaced to the player (i.e., not auto-answered).
- Fix: in the empty-chain branch (`lastLink === undefined`), return `null` when the prompt has any non-pass choice.
- Locked test flip: `tests/unit/auto-response.test.ts:204-211` ("passes an empty-chain window after the player's own action", `CHAIN_CHOICES = [activate, pass]` at `:180-183`) asserts the buggy behavior — rewrite it to assert `null` (player decides), and add a case proving own-last-link auto-pass still returns `[pass]`.

## Inputs

- `src/battle/app/prompts/auto-response.ts:83-97` `ownEffectChainPassResponse`; `:14-42` `trivialPromptResponse` (already auto-passes truly empty windows — unchanged).
- Prompt shape: `PlayerPrompt` kind `chain` with `choices: [{ action: "activate" | "pass", … }]`, `snapshot.chain: readonly ChainLink[]` (`lastLink.controller`).
- Integration harness examples: `tests/integration/cir-mill-chain-prompt.test.ts` (GY chain prompts, engine-level), `falco-facedown-special-summon.test.ts` (deterministic duel scripting pattern).
- Full Control note: `App.svelte:756-758` — Full Control ON already bypasses auto-response entirely; the bug only bites default mode.

## Interface contract (level 5)

- **Produces:** `ownEffectChainPassResponse` exact change:
  ```ts
  const lastLink = snapshot === null ? undefined : snapshot.chain.at(-1);
  if (lastLink === undefined) {
    const activatable = prompt.choices.some((choice) => choice.action !== "pass");
    if (activatable) return null; // fresh window with a real option: player decides
    const owner = actor;
    return owner === 0 ? [passChoice.id] : null;
  }
  return lastLink.controller === 0 ? [passChoice.id] : null;
  ```
  (Shape it to the file's actual style; semantics binding: empty chain + activatable ⇒ `null`; empty chain + no activatable ⇒ old actor behavior; non-empty chain ⇒ old controller behavior.)
- **Consumes:** `PlayerPrompt` (`chain` kind), `PublicDuelSnapshot.chain`, `lastActionActor` — all unchanged.
- **Errors:** none.
- **Invariants:** never auto-answer a prompt holding a non-pass choice in a fresh window; Full Control path untouched; opponent-owned windows (`owner !== 0`) never auto-passed (unchanged).
- **Integration links:** trigger card sent to GY by player's action (worker engine) → dispatch `prompt` worker event kind `chain` → receive `maybeAutoResolvePrompt` (`App.svelte:740-773`) → observe prompt reaches UI (chip/halo on GY stack via `stackChoices`, `card-mapping.ts` `STACK_ZONE_BY_LOCATION`) instead of an auto `respond`.

## TDD

1. **Red** — integration repro (Scarm-or-equivalent GY chain trigger swallowed) + rewritten unit case.
2. **Green** — guard.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| unit auto-response | empty chain, choices `[activate, pass]`, actor 0 | `null` |
| unit auto-response | empty chain, choices `[pass]`, actor 0 | `[pass.id]` |
| unit auto-response | chain last link controller 0, `[activate, pass]` | `[pass.id]` (own-link auto-pass preserved) |
| unit auto-response | chain last link controller 1 | `null` |
| integration | GY trigger after own action, default settings | player prompt surfaced, not auto-answered |

## Impl steps

- [ ] 1. Integration repro; if prompt kind ≠ `chain` → STOP, report re-scope (E5).
- [ ] 2. Rewrite locked unit test + add cases (red).
- [ ] 3. Guard impl (green).
- [ ] 4. Manual Chromium: Scarm-style trigger prompts appear.

## Validation

- [ ] `npm run check:headless`; `npx vitest run tests/unit/auto-response.test.ts tests/integration/…`
- [ ] manual check: default settings duel — GY trigger window prompts
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `fix(duel): stop auto-passing fresh chain windows that hold real activations`
