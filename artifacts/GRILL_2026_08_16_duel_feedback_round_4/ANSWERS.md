# Grill: duel_feedback_round_4

## Round 1 — Plan judgment calls

| #   | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1   | Full Control ON: what does checking it disable? | Disable ALL auto answers (trivial, own-chain pass, auto-place) — every core decision surfaces | — |
| 2   | Full Control OFF: which windows auto-pass as "your own effect"? | Chain tail yours **OR** empty-chain response window following your own action (summon, attack declaration) | Any meaningful opponent action, with or without full control, must prompt if you can activate anything |
| 3   | Full Control persistence? | Session-only, resets unchecked every app load | Default = deactivated |
| 4   | Remove Inspect: depth? | Delete whole expander (toggle + image + description); left preview panel = card-info surface | Confirm preview parity; image + name + main stats + effect = enough |
| 5   | "Select between 1 and 1 choices" scope? | Remove validation paragraph from target-list footer entirely (all ranges); counter carries requirement | — |
| 6   | Zoom overlay keyboard? | Pointer-only; keyboard keeps pin/focus flow | — |
| 7   | Zoom overlay size/anchor? | Modest 1.6× | Subtle emphasis/feedback only; info lives in preview panel |
| 8   | Extra-deck stack hover preview? | No preview update; browse list to see inside | Open list dialog = private info = cards face up |
| 9   | LP plate format? | "LP 8000", label-left, no thousands separator | Colors: >4000 green, 2000–4000 orange, <2000 red; animate number updates |
| 10  | Red invalid halo surfaces? | Also on field cards during a targeting prompt | Field red = hover-only, on the invalid card under the pointer |

## Facts (scout)

- `MSG_SELECT_CHAIN` exposes `player`, `forced`, `selects`, `spe_count`, `hint_timing`, `hint_timing_other` — **no trigger-actor field** — source: `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts:1156-1161`, `src/battle/worker/protocol/PromptRegistry.ts:340`.
- Presentation events attest the actor: `summon | specialSummon | flipSummon | set` and `attack` carry `player`; `turnStarted` carries `player` — source: `src/battle/duel/contracts/duel-presentation-event.ts`.
- Old Inspect expanders showed card image + effect description only (`PromptCard.name/description`); preview panel shows image + name + effect text → **parity: nothing missing**. Structured stats (ATK/DEF/Level/Attribute/Type) exist nowhere as text — only inside the card art — source: `src/battle/app/prompts/PromptControls.svelte`, `src/battle/app/components/CardPreviewPanel.svelte`, `src/battle/app/presentation/card-preview.ts` (`CardPreviewText = { name, description }`).
- Own extra-deck browse list already shows faces: projector reconciles own extra codes at duel start (`#ensureOwnExtraDeckReconciled`, player 0) → `zoneListEntries` marks them `identityVisible` — source: `src/battle/worker/HeadlessDuelController.ts`, `src/battle/field/zone-list.ts`. Q8 precision already satisfied; no change needed.

## Round 2 — Chain attribution + preview parity

| #   | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1   | Empty-chain window: how is "your own action" attributed? | Actor = player of last summon/flip/set/position/attack presentation event; none since turn start → actor = turn player. Auto-pass when actor is you (Full Control off) | — |
| 2   | Preview panel: structured stats row? | Yes — add ATK/DEF/Level/Attribute/Type row; new ticket appended to plan | — |

## Facts (scout, round 2)

- Stats data already in memory: `activeCatalog()` returns `DeckBuilderCardView` with `family`, `subtypes`, `attribute`, `race`, `levelRankLink`, `ratingLabel` (Level/Rank/Link), `attack`, `defense`, `pendulumScales`, `linkMarkers` — source: `src/decks/catalog/ocg-card-mapper.ts`, `src/decks/catalog/active-catalog.ts`. `App.svelte` already builds `ACTIVE_CARDS` from it → stats row needs no new data path.

## Assumptions (logged, not asked)

- LP color boundaries: green when `lp > 4000`; orange when `2000 ≤ lp ≤ 4000`; red when `lp < 2000`. Applied to both plates.
- LP animation: number tween on change (~600 ms), disabled under `prefers-reduced-motion`.
- Field red halo: during an active card-targeting prompt, ANY non-candidate field card shows red hover halo (not restricted to zones containing candidates); hover-only, never persistent.
- Round-1 Q2 combined answer means: opponent's meaningful action ⇒ always prompt when activatable choices exist, regardless of Full Control.
- Stats row format: one line under the name — monsters `"DARK · Spellcaster · Level 4 · ATK 1800 / DEF 1200"` (Rank/Link label via `ratingLabel`; Link omits DEF), spells/traps `"Spell · Quick-Play"` style from `family` + `subtypes`.

## Shared understanding

- **Goal:** land `feedback-duel.md` round 4 — 2 engine bugs (field-spell zone address kills field UI; `unsupported_message` aborts spellbook duels), privacy-correct visibility (deck search PRIVATE, extra-deck top face-down, known face-down zoom+label, sticky preview), Full Control chain toggle with Ctrl hold, hand centering, 1.6× hover-zoom overlay, right-rail redesign with LP states, list-dialog polish (upright cards, no range text, collapse toggle), halo v2 incl. field red hover. Plan = 15 tickets (T15 appended), ADR 028–032.
- **Settled (round 1):** Full Control ON disables ALL auto answers; OFF auto-passes chain-tail-yours AND own-action empty-chain windows; opponent action always prompts when activatable; session-only, default off. Inspect expanders deleted whole. Range text removed from list footer, all ranges. Zoom overlay pointer-only, 1.6×, subtle emphasis. Extra-deck hover = no preview update; list dialog stays the private viewer (already face-up). LP "LP 8000", label-left, colors >4000 green / 2000–4000 orange / <2000 red, animated updates. Red halo also on field cards, hover-only.
- **Settled (round 2):** own-action attribution = last summon/flip/set/position/attack event's player, fallback turn player since turn start. Preview panel gains a stats row (new ticket T15; data already in `activeCatalog()`).
- **Assumptions:** LP boundaries green `>4000`, orange `2000–4000` inclusive, red `<2000`; LP tween ~600 ms, reduced-motion respected; field red on ANY non-candidate field card during targeting, hover-only; stats-row format above.
- **Out of scope:** LP danger-state redesign beyond colors, keyboard zoom overlay, opponent avatars art, HUD tray Inspect labels, engine vendor upgrade, deck browse showing full deck contents outside search prompts.
