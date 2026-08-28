# Bug log

Owner-reported bugs with diagnosis records. Newest first.

## 2026-08-27 — Cir effect proposition after Dante mill (feedback round item 11)

- **Report (owner, verbatim):** "BUG : In test game with burning abyss deck, I used Dante
  to mill 3 cards. I milled Cir but i got proposition to activate its effect even thought
  the trigger condition is valid."
- **Verdict:** engine-correct
- **Passthrough evidence:** chain propositions are pure engine passthrough. MSG_SELECT_CHAIN
  (type 16) is classified "prompt" at `src/battle/worker/protocol/message-classification.ts:18`;
  `src/battle/worker/protocol/PromptRegistry.ts:369-393` builds the prompt from
  `message.selects` via `addCardActions` (`PromptRegistry.ts:965-983`), an unconditional
  `forEach` push — no app-side filter, dedupe, or rule check exists. `SELECT_CHAIN` resolves
  to 16 at `src/battle/worker/engine/engine-constants.ts:57`, and those are the only two
  `SELECT_CHAIN` sites under `src/battle/`, so nothing post-processes the selects. Any
  disputed proposition originates in ocgcore + CardScripts, not this repo.
- **Repro / evidence:** deterministic headless repro at
  `tests/integration/cir-mill-chain-prompt.test.ts` — programmed-mode duel, seed
  `[17n, 23n, 29n, 31n]`, `playerDeckOrder` arranged so the opening hand is
  Scarm `84764038` / Graff `20758643` / Book of Moon `14087893` ×2 / Dark Hole `53129443`
  and deck positions 6-9 are Allure of Darkness `1475311` then Cir `57143342` ×3. The seat
  Special Summons Scarm, Normal Summons Graff, Xyz Summons Dante `83531441` over the pair,
  activates Dante and announces a 3-card mill. The captured chain prompt offers codes
  `[57143342, 57143342, 20758643]` — both milled Cir plus the Graff that hit the Graveyard
  as Dante's detach cost.
- **Script citation (corroboration):** Cir `c57143342.lua` (snapshot shard
  `generated/assets/current/scripts/cards/2e.json`) registers effect e3 as
  `EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O` with `SetCode(EVENT_TO_GRAVE)`,
  `SetProperty(EFFECT_FLAG_CARD_TARGET+EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DELAY)` and
  `SetCountLimit(1,id)` — and **no** `SetCondition`, so nothing restricts the origin or the
  reason of the trip to the Graveyard. Dante `c83531441.lua` (shard `b1.json`) pays its cost
  with `Cost.AND(Cost.DetachFromSelf(1),s.atkcost)`, where
  `s.atkcost` runs `Duel.AnnounceNumberRange(tp,1,max_ct)` then
  `Duel.DiscardDeck(tp,op,REASON_COST)`; a deck→Graveyard move raises EVENT_TO_GRAVE
  regardless of reason.
- **Reading (verdict rationale):** Cir's printed trigger "If this card is sent to the
  Graveyard" IS satisfied by a Dante mill — a mill is "sent to the Graveyard", and Cir's
  script attaches no condition restricting the origin or reason. The Graveyard copy the run
  offered carries that exact text back from the catalog: "● If this card is sent to the
  Graveyard: You can target 1 \"Burning Abyss\" monster in your Graveyard, except \"Cir,
  Malebranche of the Burning Abyss\"; Special Summon it." The engine offering the activation
  is correct; the owner's sentence likely means "invalid" and the expectation behind it is
  what needs confirming.
- **Two timing facts the run surfaced, in case either is the real surprise:**
  - The proposition does **not** appear in the chain window that opens while Dante's
    ignition effect is on the chain — that window offered only Book of Moon. The mill is
    Dante's *cost*, and a trigger whose timing is met during cost payment cannot chain to
    the effect that paid it; it opens a new chain once Dante's effect has resolved. The Cir
    proposition arrives one chain window later.
  - Cir's effect targets, and its target filter excludes its own name
    (`c:IsSetCard(SET_BURNING_ABYSS) and not c:IsCode(id)`). In this run the legal target was
    the Graff sent to the Graveyard as Dante's detach cost. Milling only Cir copies and no
    other "Burning Abyss" monster leaves the effect with no legal target, and then the engine
    offers nothing.
- **Payload (recorded even though the verdict is engine-correct):** the captured
  `MSG_SELECT_CHAIN` reached the seat as prompt `prompt-67`, `kind: "chain"`, `player: 0`,
  `cancelable: true` (so the engine's `forced` flag was false), `minimum: 1`, `maximum: 1`,
  with four choices:

  | choice | action | code | location | sequence |
  | --- | --- | --- | --- | --- |
  | `prompt-67-choice-0-activate` | activate | 57143342 | graveyard | 3 |
  | `prompt-67-choice-1-activate` | activate | 57143342 | graveyard | 2 |
  | `prompt-67-choice-2-activate` | activate | 20758643 | graveyard | 0 |
  | `prompt-67-choice-3-pass` | pass | — | — | — |

- **Upstream:** no upstream (Project Ignis) issue is warranted — the verdict is
  engine-correct, so there is nothing to report against ocgcore or CardScripts.
- **TODO(user):** confirm whether "valid" in the report was a typo for "invalid", and state
  what behavior you expected (no proposition at all? a different timing? fewer duplicate
  propositions when several Cir are milled at once?).
