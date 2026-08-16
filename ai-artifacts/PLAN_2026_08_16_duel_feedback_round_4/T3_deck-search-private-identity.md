# T3: Deck search shows private identities

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Searching own deck lists real card faces + names in the target list dialog; identity vanishes again after the prompt (shuffle).

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). User bug: "When searching for a card in my deck, I am not able to see the cards even though I should." Visibility model: PUBLIC (both know), PRIVATE (one knows), HIDDEN (none). During own-deck search, deck cards become PRIVATE to the searcher for the prompt's lifetime; shuffle erases it.
- This slice: target-list identity join. `offFieldTargetEntries` in `src/battle/field/off-field-target-list.ts` derives identity **only** from the projected snapshot (ADR-014). Projected own deck carries codes only for ADR-008 reveal offsets — a search prompt reveals nothing there → every entry renders "Face-down card". But the sanitized prompt itself carries `choice.card.code`/`name` for own cards (worker-event validator `validatePromptCard` in `src/battle/duel/contracts/duel-worker-event.ts` strips identity only for `controller === 1` concealed cards). Fix = prompt-attested fallback for controller 0. ADR-029 (`docs/ADR/029_ADR_prompt_attested_private_identity_in_selection_lists.md`) records this.
- Out of scope here: projecting search identity into the snapshot/deck browse list, opponent identities, ADR-008 reveal model changes, list dialog CSS.
- Assumptions in force: prompt lifetime scoping is automatic — `offFieldTargets` recompute per prompt in `App.svelte`; when prompt resolves + deck shuffles, entries are gone.

## Requirements

- `InteractionChoice` carries the engine-sent own-card code.
- Target entries fall back to that code when the snapshot does not attest identity, `address.controller === 0` only.
- Label resolves through `cardTexts` (fallback `Card ${code}`); `identityVisible: true`; tile renders face + name.

## Inputs

- `src/battle/app/prompts/interaction-spec.ts` — `interface InteractionChoice` (fields today: `id`, `label`, `action`, `value?`, `toggleState?`, `allocationMaximum?`, `cardAddress?`), `sanitizeChoice(choice: PromptChoice)`, guard `isValidCardTarget`.
- `src/battle/field/off-field-target-list.ts` — `targetEntry(choices, snapshot, cardTexts)`: computes `identityVisible` via `isProjectedCardIdentityKnown(card)`, `code`, `label: "Face-down card"` fallback.
- `src/battle/duel/contracts/player-prompt.ts` — `PromptCard.code?: CardCode`.
- Rendering consumers (no changes expected): `ZoneListEntryTile.svelte` uses `entry.code` for image lease, `entry.identityVisible` for alt/name; `App.svelte` `previewZoneListEntry` uses `entry.code`.
- Existing tests: `tests/unit/interaction-spec.test.ts`, `tests/unit/off-field-target-list.test.ts`, `tests/component/ZoneListDialog.test.ts`.

## TDD

1. **Red**
   - `tests/unit/interaction-spec.test.ts` — test name: `sanitizeChoice keeps the engine card code for an own-card choice`. PromptChoice with `card: { instanceId, code: 12345, controller: 0, location: "deck", sequence: 3 }` → sanitized choice has `cardCode === 12345`. Companion: `sanitizeChoice drops the card code for an opponent-controlled choice` → `cardCode` undefined when `card.controller === 1`.
   - `tests/unit/off-field-target-list.test.ts` — test name: `an own deck target unattested by the projection renders with the prompt-sent identity`. Spec with off-field deck choice carrying `cardCode`, snapshot deck slot with no `code` → entry `identityVisible: true`, `code === cardCode`, `label` = cardTexts name. Companion: `an opponent target without projection attestation stays face-down` → controller 1, no fallback.
2. **Green** — impl below.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| sanitizeChoice keeps the engine card code for an own-card choice | PromptChoice, card controller 0, code 12345 | `choice.cardCode === 12345` |
| sanitizeChoice drops the card code for an opponent-controlled choice | card controller 1, code present | `choice.cardCode === undefined` |
| own deck target unattested by projection renders with prompt-sent identity | spec + hidden-deck snapshot | `identityVisible: true`, name label |
| opponent target without attestation stays face-down | controller-1 address | `identityVisible: false`, "Face-down card" |

## Impl steps

- [ ] 1. Write the four tests above; run `npm run test:unit -- tests/unit/interaction-spec.test.ts tests/unit/off-field-target-list.test.ts`; confirm red.
- [ ] 2. `src/battle/app/prompts/interaction-spec.ts`: add `readonly cardCode?: CardCode;` to `InteractionChoice` (import `CardCode` from `../../duel/contracts/ids.ts` if absent). In `sanitizeChoice`'s returned object add: `...(isValidCardTarget(choice.card) && choice.card!.controller === 0 && choice.card!.code !== undefined ? { cardCode: choice.card!.code as CardCode } : {})`.
- [ ] 3. `src/battle/field/off-field-target-list.ts` `targetEntry`: after the attested `code` computation add `const promptCode = address.controller === 0 ? choices.find((choice) => choice.cardCode !== undefined)?.cardCode : undefined;` then `const resolvedCode = code ?? promptCode;` — use `resolvedCode` for `identityVisible` (`resolvedCode !== undefined`), the spread `code` field, and the label lookup.
- [ ] 4. Tests green. Run `npm run test:unit && npm run test:component`.
- [ ] 5. `npm run typecheck && npm run lint`.
- [ ] 6. Write `docs/ADR/029_ADR_prompt_attested_private_identity_in_selection_lists.md` if not already present from plan step (plan writes it; verify content matches implementation).
- [ ] 7. Manual check: dev duel, activate a searcher (e.g. Spellbook Magician effect / Reinforcement-style search) → target list shows faces + names; after confirm, deck browse shows face-downs again.

## Outputs

- Files touched: `src/battle/app/prompts/interaction-spec.ts`, `src/battle/field/off-field-target-list.ts`, `tests/unit/interaction-spec.test.ts`, `tests/unit/off-field-target-list.test.ts`.
- Public API: `InteractionChoice.cardCode?: CardCode` (own-card, engine-attested). Downstream tickets may rely on it.
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:unit`, `npm run test:component`
- [ ] manual check: deck search shows card faces
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `fix(field): surface prompt-attested own-card identity in the target list`
