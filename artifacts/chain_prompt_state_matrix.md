# Chain-window state matrix

Scope: every state combination observable when the engine emits `MSG_SELECT_CHAIN` (`EngineMessageType.SELECT_CHAIN`, type `16`), and the message each combination could carry instead of the current fixed title `"Choose a chain response"` (`src/battle/worker/protocol/PromptRegistry.ts:378`).

Nothing here is implemented. This is the enumeration that a wording change would have to cover.

## 1. Inputs available at a chain window

| Input | Type | Source | Used today |
|---|---|---|---|
| `player` | `0 \| 1` | `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts:1157` | yes — prompt owner |
| `forced` | `boolean` | `index.d.ts:1159` | yes — `cancelable: !forced` (`PromptRegistry.ts:383`) |
| `spe_count` | `number` | `index.d.ts:1158` | no |
| `hint_timing` | `OcgHintTiming` bitmask, 28 bits | `index.d.ts:1160`, values at `index.d.ts:583-640` | no — zero hits in `src/` |
| `hint_timing_other` | same bitmask, other player | `index.d.ts:1161` | no |
| `selects[]` | `OcgCardLocPosActive[]` | `index.d.ts:1162` | partly — only `code` reaches the label |
| `selects[].description` | `bigint` effect reference | `index.d.ts:175` | no — resolvable via `resolveEffectDescription` (`protocol/effect-description.ts:8`) |
| `selects[].client_mode` | `NORMAL \| RESOLVE \| RESET` | `index.d.ts:176`, enum at `index.d.ts:524` | no |
| `state.chain[]` | `PublicChainLink[]` | `src/battle/duel/contracts/public-duel-state.ts:80-90` | rendered by `ChainStatus.svelte`, not by the prompt |
| `state.phase` | `DuelPhase`, 11 values | `public-duel-state.ts:4-15` | rail only |
| `state.turnPlayer` | `0 \| 1` | `public-duel-state.ts:99` | auto-response actor fallback |
| batch presentation events | `DuelPresentationEvent[]` | `src/battle/duel/contracts/duel-presentation-event.ts` | `lastActionActor` (`app/prompts/auto-response.ts:52`) |
| `MSG_HINT` / `CARD_HINT` / `PLAYER_HINT` | engine wording channel | `projection/DuelStateProjector.ts:476-493` | emitted raw: `` `System hint ${message.hint}` `` — never resolved through `strings.system` |

## 2. Axes and raw cardinality

| Axis | Values | Count |
|---|---|---|
| A — `forced` | `false`, `true` | 2 |
| B — chain class | empty · last link is yours · last link is opponent's · last link source hidden | 4 |
| C — `hint_timing` mask | any subset of 28 bits | 2^28 |
| D — candidate shape | 0 candidates · 1 · ≥2 | 3 |
| E — `state.phase` | 11 `DuelPhase` values | 11 |
| F — last-link `phase` × `outcome` | `pending\|solving\|solved` × `normal\|negated\|disabled` | 9 (only when B ≠ empty) |

Raw product ≈ `2 × 4 × 2^28 × 3 × 11` ≈ 3.5 × 10^11. Not enumerable, and not meaningful: C is a *set of legal response timings*, not a single fact. The matrix below reduces C to one dominant bit (§5) and drops E as redundant with C's phase bits.

Reduced product: `2 (A) × 4 (B) × 3 (D) = 24` templates (§6), with the chain-empty rows expanded across the 29 C-classes (§7).

## 3. Reachability filter — combinations no human ever sees

Applied in order. Default settings are `autoResolveTrivialPrompts: true`, `autoPlaceCards: true`, `fullControl: false` (`src/battle/app/stores/ui-settings-store.ts:30-34`).

| # | Condition | Effect | Source |
|---|---|---|---|
| R1 | `prompt.player === 1` | opponent policy answers in the worker; no UI at all | `worker/HeadlessDuelController.ts:218-229` |
| R2 | Full Control held/on | **all** auto-rules disabled → every combination below becomes visible | `app/App.svelte:667-671` |
| R3 | 0 activatable candidates + a pass choice | auto-pass | `app/prompts/auto-response.ts:22-26` |
| R4 | exactly 1 choice total and it is a candidate (i.e. `forced` with one option) | auto-select | `auto-response.ts:27-30` |
| R5 | last chain link controller is you, or chain empty and `lastActionActor` is you | auto-pass — own-effect window | `auto-response.ts:83-96` |

Consequence: with default settings the wording only ever reaches the player in the **opponent-owned** rows of §6/§7, plus every row when R2 holds. A wording change must still cover the R2 rows, because Full Control makes all of them visible.

## 4. Axis B — chain classes

Chain links come from `MSG_CHAINING` and are appended with `phase: "pending"`, `outcome: "normal"` (`projection/DuelStateProjector.ts:1512-1522`). `controller` is the **triggering** controller (`DuelStateProjector.ts:1485`). `label` is the card name, or the literal `"Card effect"` when the source identity is not visible (`DuelStateProjector.ts:1498-1502`).

| B | Condition | Proposed message fragment |
|---|---|---|
| B0 | `chain.length === 0` | no chain fragment — fall through to axis C (§5) |
| B1 | last link `controller === 0`, `sourceIdentityVisible` | `Respond to your "<label>"` — normally unreachable, R5 |
| B2 | last link `controller === 1`, `sourceIdentityVisible` | `Respond to the opponent's "<label>"` |
| B3 | last link `sourceIdentityVisible === false` | `Respond to the opponent's face-down effect` (label is `"Card effect"`) |

Chain depth is a suffix rather than an axis: `· Link <chain.length>` when `chain.length ≥ 2`.

Last-link `phase`/`outcome` (axis F): at a chain-building window the last link is `pending`/`normal` by construction, because `CHAIN_SOLVING`/`CHAIN_NEGATED`/`CHAIN_DISABLED` only arrive after the window closes and `CHAIN_END` empties the array (`DuelStateProjector.ts:458-474`). **Unverified** — see §9 U2. Treat the other 8 F-combinations as theoretically representable but not observed; wording should ignore F until a trace proves otherwise.

## 5. Axis C — `hint_timing` bits, all 28 + empty mask

Values verbatim from `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts:583-640`. "Prec." is the proposed dominant-bit precedence class (§8).

| Bit | Value | Vendor name | Vendor comment | Prec. | Proposed message (chain empty) |
|---|---|---|---|---|---|
| C1 | 1 | `DRAW_PHASE` | In draw phase | 3 | Respond in the Draw Phase |
| C2 | 2 | `STANDBY_PHASE` | In standby phase | 3 | Respond in the Standby Phase |
| C3 | 4 | `MAIN_END` | Before end of main | 3 | Respond before the Main Phase ends |
| C4 | 8 | `BATTLE_START` | In battle phase | 2 | Respond at the start of the Battle Phase |
| C5 | 16 | `BATTLE_END` | After battle | 2 | Respond at the end of the Battle Phase |
| C6 | 32 | `END_PHASE` | In end phase | 3 | Respond in the End Phase |
| C7 | 64 | `SUMMON` | After summon | 1 | Respond to the Normal Summon |
| C8 | 128 | `SPSUMMON` | After special summon | 1 | Respond to the Special Summon |
| C9 | 256 | `FLIPSUMMON` | After flip summon | 1 | Respond to the Flip Summon |
| C10 | 512 | `MSET` | After monster set | 1 | Respond to the Set monster |
| C11 | 1024 | `SSET` | After spell set | 1 | Respond to the Set Spell/Trap |
| C12 | 2048 | `POS_CHANGE` | After pos change | 1 | Respond to the position change |
| C13 | 4096 | `ATTACK` | In attack declaration | 1 | Respond to the attack declaration |
| C14 | 8192 | `DAMAGE_STEP` | In damage step | 2 | Respond in the Damage Step |
| C15 | 16384 | `DAMAGE_CAL` | In damage calculation | 2 | Respond before damage calculation |
| C16 | 32768 | `CHAIN_END` | After chain resolved | 1 | Respond after the chain resolved |
| C17 | 65536 | `DRAW` | After card draw | 1 | Respond to the draw |
| C18 | 131072 | `DAMAGE` | After damage | 1 | Respond to the damage |
| C19 | 262144 | `RECOVER` | After recover | 1 | Respond to the life point gain |
| C20 | 524288 | `DESTROY` | After destroy | 1 | Respond to the destruction |
| C21 | 1048576 | `REMOVE` | After banis[h] | 1 | Respond to the banishment |
| C22 | 2097152 | `TOHAND` | After card added to the hand | 1 | Respond to the card added to the hand |
| C23 | 4194304 | `TODECK` | After card sent to the deck | 1 | Respond to the card returned to the Deck |
| C24 | 8388608 | `TOGRAVE` | After card sent to the graveyard | 1 | Respond to the card sent to the Graveyard |
| C25 | 16777216 | `BATTLE_PHASE` | Battle phase | 3 | Respond in the Battle Phase |
| C26 | 33554432 | `EQUIP` | After equip | 1 | Respond to the equip |
| C27 | 67108864 | `BATTLE_STEP_END` | Battle step end | 2 | Respond at the end of the Battle Step |
| C28 | 134217728 | `BATTLED` | Battled | 2 | Respond after damage calculation |
| C0 | `0` | — | no bit set | 4 | fall back to the last presentation event (§10), else `Choose a chain response` |

## 6. Combination matrix — 24 templates

`A` = `forced`, `B` = chain class (§4), `D` = candidate shape. `⟨C⟩` = the axis-C fragment from §5/§7.

| # | A | B | D | Reachable by default | Message |
|---|---|---|---|---|---|
| 1 | false | B0 empty | 0 | no — R3 | — |
| 2 | false | B0 empty | 1 | no — R5 when actor is you; else yes | ⟨C⟩ |
| 3 | false | B0 empty | ≥2 | no — R5 when actor is you; else yes | ⟨C⟩ |
| 4 | false | B1 yours | 0 | no — R3 | — |
| 5 | false | B1 yours | 1 | no — R5 | Respond to your "\<label\>" |
| 6 | false | B1 yours | ≥2 | no — R5 | Respond to your "\<label\>" |
| 7 | false | B2 opponent | 0 | no — R3 | — |
| 8 | false | B2 opponent | 1 | **yes** | Respond to the opponent's "\<label\>" |
| 9 | false | B2 opponent | ≥2 | **yes** | Respond to the opponent's "\<label\>" |
| 10 | false | B3 hidden | 0 | no — R3 | — |
| 11 | false | B3 hidden | 1 | **yes** | Respond to the opponent's face-down effect |
| 12 | false | B3 hidden | ≥2 | **yes** | Respond to the opponent's face-down effect |
| 13 | true | B0 empty | 0 | contradiction — see §9 U4 | — |
| 14 | true | B0 empty | 1 | no — R4 | You must respond · ⟨C⟩ |
| 15 | true | B0 empty | ≥2 | **yes** | You must respond · ⟨C⟩ |
| 16 | true | B1 yours | 0 | contradiction — U4 | — |
| 17 | true | B1 yours | 1 | no — R4 | You must chain to your "\<label\>" |
| 18 | true | B1 yours | ≥2 | **yes** | You must chain to your "\<label\>" |
| 19 | true | B2 opponent | 0 | contradiction — U4 | — |
| 20 | true | B2 opponent | 1 | no — R4 | You must chain to the opponent's "\<label\>" |
| 21 | true | B2 opponent | ≥2 | **yes** | You must chain to the opponent's "\<label\>" |
| 22 | true | B3 hidden | 0 | contradiction — U4 | — |
| 23 | true | B3 hidden | 1 | no — R4 | You must chain to the opponent's face-down effect |
| 24 | true | B3 hidden | ≥2 | **yes** | You must chain to the opponent's face-down effect |

R4/R5 rows are still reachable under Full Control (R2), so their message column is filled rather than dashed.

Depth suffix appends to rows 5–12 and 17–24 when `chain.length ≥ 2`: `· Link <n>`.

Candidate suffix for `D = 1`, available from `selects[0].description` today and unused: `— <resolved effect text>`.

## 7. Chain-empty expansion — rows 2, 3, 15

29 axis-C classes × 2 `forced` values. This is the full enumeration of the chain-empty windows; everything else in §6 is already terminal.

| C | Optional (`forced === false`, rows 2/3) | Forced (rows 14/15) |
|---|---|---|
| C1 `DRAW_PHASE` | Respond in the Draw Phase | You must respond in the Draw Phase |
| C2 `STANDBY_PHASE` | Respond in the Standby Phase | You must respond in the Standby Phase |
| C3 `MAIN_END` | Respond before the Main Phase ends | You must respond before the Main Phase ends |
| C4 `BATTLE_START` | Respond at the start of the Battle Phase | You must respond at the start of the Battle Phase |
| C5 `BATTLE_END` | Respond at the end of the Battle Phase | You must respond at the end of the Battle Phase |
| C6 `END_PHASE` | Respond in the End Phase | You must respond in the End Phase |
| C7 `SUMMON` | Respond to the Normal Summon | You must respond to the Normal Summon |
| C8 `SPSUMMON` | Respond to the Special Summon | You must respond to the Special Summon |
| C9 `FLIPSUMMON` | Respond to the Flip Summon | You must respond to the Flip Summon |
| C10 `MSET` | Respond to the Set monster | You must respond to the Set monster |
| C11 `SSET` | Respond to the Set Spell/Trap | You must respond to the Set Spell/Trap |
| C12 `POS_CHANGE` | Respond to the position change | You must respond to the position change |
| C13 `ATTACK` | Respond to the attack declaration | You must respond to the attack declaration |
| C14 `DAMAGE_STEP` | Respond in the Damage Step | You must respond in the Damage Step |
| C15 `DAMAGE_CAL` | Respond before damage calculation | You must respond before damage calculation |
| C16 `CHAIN_END` | Respond after the chain resolved | You must respond after the chain resolved |
| C17 `DRAW` | Respond to the draw | You must respond to the draw |
| C18 `DAMAGE` | Respond to the damage | You must respond to the damage |
| C19 `RECOVER` | Respond to the life point gain | You must respond to the life point gain |
| C20 `DESTROY` | Respond to the destruction | You must respond to the destruction |
| C21 `REMOVE` | Respond to the banishment | You must respond to the banishment |
| C22 `TOHAND` | Respond to the card added to the hand | You must respond to the card added to the hand |
| C23 `TODECK` | Respond to the card returned to the Deck | You must respond to the card returned to the Deck |
| C24 `TOGRAVE` | Respond to the card sent to the Graveyard | You must respond to the card sent to the Graveyard |
| C25 `BATTLE_PHASE` | Respond in the Battle Phase | You must respond in the Battle Phase |
| C26 `EQUIP` | Respond to the equip | You must respond to the equip |
| C27 `BATTLE_STEP_END` | Respond at the end of the Battle Step | You must respond at the end of the Battle Step |
| C28 `BATTLED` | Respond after damage calculation | You must respond after damage calculation |
| C0 none | §10 fallback | You must respond |

## 8. Dominant-bit precedence

`hint_timing` is a *mask*, so a mask with `SUMMON | MAIN_END | BATTLE_PHASE` set has three truths in it. The message picks one. Proposed order, highest first:

1. **Class 1 — card events**: `SUMMON`, `SPSUMMON`, `FLIPSUMMON`, `MSET`, `SSET`, `POS_CHANGE`, `ATTACK`, `DRAW`, `DAMAGE`, `RECOVER`, `DESTROY`, `REMOVE`, `TOHAND`, `TODECK`, `TOGRAVE`, `EQUIP`, `CHAIN_END`
2. **Class 2 — battle sub-steps**: `DAMAGE_CAL`, `BATTLED`, `DAMAGE_STEP`, `BATTLE_STEP_END`, `BATTLE_START`, `BATTLE_END`
3. **Class 3 — phase windows**: `DRAW_PHASE`, `STANDBY_PHASE`, `MAIN_END`, `BATTLE_PHASE`, `END_PHASE`
4. **Class 4 — empty mask**: §10 fallback

Within a class, low bit value first, so the order is total and stable. Ties inside class 1 are the real risk: two card events in one mask produce a message naming only one of them. §9 U1 is the check that would settle how often that happens.

## 9. Unverified — needs a trace before wording ships

| # | Question | How to settle |
|---|---|---|
| U1 | Which `hint_timing` bit combinations actually co-occur, and how often class 1 has >1 bit | Record `hint_timing` per `SELECT_CHAIN` in `worker/diagnostics/duel-trace.ts`; run the existing duel fixtures; histogram the masks |
| U2 | Whether a `SELECT_CHAIN` can arrive with a non-`pending` last link (axis F) | Same trace, assert `chain.at(-1).phase === "pending"` at every chain window |
| U3 | What `hint_timing_other` adds — the *other* player's legal timings | Trace both fields; check whether they ever differ meaningfully at a player-0 window |
| U4 | Whether `forced` with 0 candidates can occur (rows 13/16/19/22 marked contradiction) | Trace `forced && selects.length === 0`; expected never, currently unguarded |
| U5 | Whether `client_mode` (`NORMAL\|RESOLVE\|RESET`) distinguishes candidates the label should mark | Trace the distribution over `selects[]` |
| U6 | Whether `MSG_HINT` with `hint_type = 3` (`selectmsg`) precedes chain windows and already carries the engine's own wording | Resolve `message.hint` through `strings.system` instead of the raw dump at `DuelStateProjector.ts:476-477`, log both |

## 10. Fallback chain when axis C is empty

Ordered, first hit wins, from the batch's presentation events (`duel-presentation-event.ts`), newest first, stopping at `turnStarted` exactly as `lastActionActor` does (`auto-response.ts:52-74`):

| Event | Message |
|---|---|
| `summon` | Respond to the Normal Summon |
| `specialSummon` | Respond to the Special Summon |
| `flipSummon` | Respond to the Flip Summon |
| `set` | Respond to the Set card |
| `attack` | Respond to the attack declaration |
| `cardDrawn` | Respond to the draw |
| `damage` / `recover` | Respond to the life point change |
| `positionChanged` | Respond to the position change |
| `cardMoved` | Respond to the card movement |
| none of the above | Choose a chain response — current behaviour |

## 11. Blast radius of changing the wording

- `e2e/duel-smoke.spec.ts:4066` asserts `toHaveText("Choose a chain response")` on the rail prompt.
- Title flows to `PromptControls.svelte:205`/`:246`/`:275`, `PromptDialog.svelte:25` (`aria-label`), `presentation/duel-rail-status.ts:30`, `prompts/interaction-spec.ts:369`.
- Keeping `title` fixed and filling the existing `PlayerPrompt.message` field instead leaves all of the above untouched; `message` already has a precedent in effectYesNo (`PromptRegistry.ts:158-172`).
- The build seam is `buildEnginePrompt` (`PromptRegistry.ts:132`), which today receives only the message plus text dependencies. Chain state lives in `DuelStateProjector` and is current at publish time, because the controller applies every message of the batch (`HeadlessDuelController.ts:154-161`) before it builds prompts (`:205`).
