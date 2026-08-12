# T6: Face-down public knowledge in the projector

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T5
**Commit outcome:** A face-down opponent card whose identity was already public keeps its instance id and code while it remains trackable; hidden-origin cards stay secret; a later information-destroying move or shuffle clears correlation.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`. This finishes item 1: "It should still be visible if the card is face-down but was public before."
- Current projector treats geometric visibility as knowledge. `#move` and `#changePosition` call `#rotatePublicIdentity(card)` whenever a visible card becomes hidden, then delete `card.code`. This intentionally blocks correlation, but it also forgets a face-up monster turned face-down and a graveyard card publicly moved into a set field position.
- This slice: preserve **local-viewer knowledge**, not globally reveal hidden cards. `PublicCard.code` remains the capability: defined means local viewer knows identity; absent means unknown. No raw engine code may become visible merely because a hidden MOVE/POSITION_CHANGE message contains it.
- Out of scope: persistent knowledge across a deck/hand/extra return; omniscient logs; opponent AI access; deck-sequence reveals beyond ADR-008; card materials.
- Assumption **A16**: keep on visible graveyard / face-up banished / face-up field → face-down field; keep on face-up → face-down in one field slot; keep a previously projected known card that is then set. Never grant on opponent hand/deck → set or face-down summon. Once an already-known face-down card changes address or enters hand/deck/extra, rotate id and forget code. Shuffle clears hidden-zone correlation. Conservative misses are allowed; invented knowledge is not.

## Requirements

- `PublicCard.code` is documented and consumed as "identity known to local viewer", independent of current face orientation.
- Face-up opponent card turned face-down in the same monster/spell/field slot keeps its `instanceId` and `code`. Board art remains the card back/face-down orientation; hover preview and accessible text may use the known code.
- Known opponent card moved from a public source to a face-down fixed field destination keeps `instanceId` and `code`.
- A valid `CONFIRM_CARDS` shown to player 0 records projector-internal address/code knowledge. If that exact card is then placed face-down, identity is retained; a mismatch never grants knowledge.
- Opponent card set from unrevealed hand/deck or summoned face-down from deck has no code and cannot be correlated with prior hidden ids.
- A known face-down card moved to any other address rotates `instanceId`. If destination is public, raw code establishes a new public id/code; if hidden, code is removed.
- Opponent hidden hand shuffle rotates stored internal ids and deletes any remembered code. `SHUFFLE_SET_CARD` rotates/de-identifies affected known opponent set cards while applying the engine-provided from→to address permutation. Deck shuffle continues to clear temporary deck reveals.
- Local player's own cards are unchanged: code remains available in private zones.
- Existing presentation-event redaction remains. Snapshot knowledge may retain code; an event must still not newly expose an unknown opponent code.
- Checkpoint/restore includes pending reveal tokens. Tokens remain projector-private; no worker runtime, UI, or public-state side channel is added.

## Inputs

- `src/worker/projection/DuelStateProjector.ts:49-60` — internal `MutableCard`; code is optional. No new field is required.
- `DuelStateProjector.ts:755-842` — `#move`; `fromVisible`, `toVisible`; lines 814 and 820-821 rotate/delete on visible→hidden.
- `DuelStateProjector.ts:1034-1070` — `#changePosition`; lines 1065 and 1068-1069 rotate/delete on face-up→face-down.
- `DuelStateProjector.ts:732-753` — `#shuffleHand` returns immediately for opponent.
- `DuelStateProjector.ts:1317-1319` — `#rotatePublicIdentity` only changes instance id; caller owns code removal.
- `src/duel/contracts/public-duel-state.ts:41-52` — `PublicCard.code?: CardCode`.
- `src/duel/contracts/duel-worker-event.ts:580-585` — state validator currently rejects code on every opponent face-down card; widen only fixed `monsters`/`spellsAndTraps`.
- `src/worker/engine/engine-constants.ts` — add `CONFIRM_CARDS:31` and `SHUFFLE_SET_CARD:36`.
- Pinned `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts` defines `OcgMessageConfirmCards { type:31; player:number; cards:OcgCardLoc[] }` (`OcgCardLoc` = code/controller/location/sequence) and `OcgMessageShuffleSetCard { type:36; location; cards:{ from:OcgLocPos; to:OcgLocPos }[] }`; no adapter parser change is needed because both are in its union.
- `src/duel/card-visibility.ts` — `isCardIdentityVisible` computes geometric/default privacy and is still required for raw engine addresses. Do not weaken it.
- `src/field/board-view-model.ts:283-286,336-357,546-550` — board independently recomputes face visibility in `cardIdentityVisible`; it must trust projected knowledge instead.
- `src/field/zone-list.ts:109-134` — sourced entries independently use `isCardIdentityVisible`; switch to projected knowledge.
- `src/app/presentation/card-preview.ts:63-78`, `src/app/components/duel-field/CardTray.svelte:117`, `DuelHud.svelte:38` — other `PublicCard` consumers re-check geometric visibility; switch them to projected knowledge.
- `tests/unit/duel-state-projector.test.ts:50-169` — current redaction and identity-rotation tests.
- `tests/unit/board-view-model.test.ts` and `tests/unit/zone-list.test.ts` — presentation mapping tests.
- **From Depends (T5):** passive face-down card roots receive hover; hidden cards render no visual "Hidden card" caption. Once this ticket supplies `code`, hover can show the known card in the persistent preview.

## Repair state (parent-inlined 2026-08-12, authorized extra repair)

A previous worker implemented this ticket almost completely, then exhausted its repair budget on one failure. The user has authorized exactly one extra repair attempt. Do not restart from scratch.

- Preserved candidate code: git ref `refs/candidates/t6-face-down` (commit `fda015d`, parent `676d191`). Also `stash@{1}` — do not drop it.
- Candidate evidence already achieved: unit 632/632; component 200 of 201.
- **The single remaining failure:** `tests/component/DuelHud.test.ts:83` still expects no `Dark Magician` to appear; under the new public-knowledge rule that fixture legitimately exposes a known face-down identity. Align that one expectation/fixture with the rule, then re-run every gate.
- **Invariant that must survive the fix:** identity is retained only when it was already public to the local viewer. A hidden engine payload must never grant knowledge. If aligning the fixture would require relaxing that invariant, the fix is wrong — change the expectation, not the privacy rule.

### Rebase hazard — read before restoring

The candidate was snapshotted on `676d191`. Branch HEAD has since advanced to `1e87e63` (T7: zone labels + geometry + nav graph). `git merge-tree` on 2026-08-12 shows the candidate **no longer applies cleanly**:

- Auto-merges fine: `src/field/board-view-model.ts` and all other source files.
- **Conflicts:** `tests/unit/duel-field.test.ts` and `tests/component/DuelField.test.ts` — both were also edited by T7.

Recommended restore path:

```
git cherry-pick -n fda015d       # applies the candidate diff, leaves it staged, no merge commit
git status --short               # expect UU on the two test files above
```

Resolve those two files by **keeping T7's shipped label/geometry expectations and adding T6's knowledge expectations on top**. T7 renamed visible zone labels (`Monster Zone 1`, `Spell/Trap Zone 1`, `GY`, …), split visible `label` from a new owner-aware `accessibleLabel` on `BoardZoneView`/`BoardStackView`, moved the central column x centres to `450,545,640,735,830`, moved Extra x to `330`, and changed the neighbour graph's vertical-alignment rule to horizontal span overlap. None of that is negotiable here; T6 must adapt to it. Any `BoardZoneView`/`BoardStackView` fixture the candidate adds needs the `accessibleLabel` field.

Never stage `feedback.md` — it is user-owned and intentionally dirty. Unstage the candidate's copy of this ticket file if it overwrites this Repair state section; the working-tree version wins.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here because `playwright.config.ts` includes a `webkit-smoke` project unsupported on this machine. Use `npm run check:headless` plus the explicit Chromium invocation instead.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly` and no assertion failure. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.

## Knowledge rules in code

Add to `src/duel/card-visibility.ts` without changing `isCardIdentityVisible`:

```ts
/** Projector is privacy boundary: a projected code means local viewer knows it. */
export function isProjectedCardIdentityKnown(
  card: Pick<PublicCard, "code">,
): boolean {
  return card.code !== undefined;
}
```

In `#move`, after removing/creating `card` and before mutating its address, consume an exact token first:

```ts
const confirmedCode = this.#consumePendingPublicReveal(from, rawCode);
const confirmedForMove = confirmedCode !== undefined;
if (confirmedCode !== undefined) card.code = confirmedCode;

const sourceWasKnown = card.code !== undefined;
const preservesKnownIdentity =
  (fromVisible || confirmedForMove) &&
  !toVisible &&
  sourceWasKnown &&
  isFixedLocation(toLocation) &&
  isFaceDown(to.position);
const staleHiddenCorrelation =
  !fromVisible && sourceWasKnown && !confirmedForMove;

if (
  staleHiddenCorrelation ||
  ((fromVisible || confirmedForMove) &&
    !toVisible &&
    !preservesKnownIdentity)
) {
  this.#rotatePublicIdentity(card);
  delete card.code;
}
```

After address mutation:

```ts
if (toVisible && rawCode > 0) card.code = cardCode(rawCode);
else if (!preservesKnownIdentity) delete card.code;
```

`rawCode` alone never makes a hidden destination known. `confirmedForMove` is exact, one-use public attestation; it is also the only hidden-source flag allowed by presentation-event redaction. A stale stored hidden code without a fresh token always rotates/clears.

In `#changePosition`:

- remove the visible→hidden identity rotation;
- when `visible && rawCode > 0`, set code;
- when `!visible`, leave an existing code untouched and never set one from `rawCode`.

This preserves face-up→face-down and repeated face-down updates in one address. Unknown face-down stays unknown. Face-down→face-up keeps the same instance and receives/retains code.

Add projector-internal one-use reveal state:

```ts
interface PendingPublicReveal {
  readonly controller: PlayerIndex;
  readonly location: PublicLocation;
  readonly sequence: number;
  readonly code: CardCode;
}
#pendingPublicReveals = new Map<string, PendingPublicReveal>();
```

Include it in `ProjectionCheckpoint`/restore. On `CONFIRM_CARDS`, record entries only when `message.player === 0`, code is positive, and location is not deck (ADR-008 owns deck sequence safety). For an already stored card at the exact address, set its code immediately so hover works while reveal is visible. Player-1 recipient messages do not grant local knowledge.

On MOVE, consume a token only when from controller/location/sequence **and raw code** all match. A match counts as existing known identity for immediate face-down fixed-field preservation. Mismatch is discarded for that address and never sets code. Clear affected-location tokens on moves that can resequence it; clear relevant/all tokens on hand/deck/set shuffle, swap/reverse deck, NEW_TURN and NEW_PHASE. Forget early when uncertain.

In `#shuffleHand(player, codes)`, replace the player-1 early return with: for each internal opponent hand card call `#rotatePublicIdentity(card)` and `delete card.code`, clear that hand's reveal tokens, then return. Player-0 reorder logic stays byte-for-byte.

Add `SHUFFLE_SET_CARD: 36` and a projector case calling `#shuffleSetCards(message.cards)`. The helper validates all `from`/`to` endpoints are fixed monster/spell/field addresses, removes every source card before inserting any destination (so swaps cannot collide), then applies each pair. For controller 1, rotate id + delete code before insertion; controller 0 retains identity/code. Clear affected reveal tokens. Reassign controller/location/sequence/position/faceUp from `to`. Missing source or duplicate destination throws: never guess through a malformed permutation.

## TDD

1. **Red** — projector privacy/knowledge tests first, then view-model consumers.
2. **Green** — change only the transition predicates and knowledge consumers.
3. **Refactor** — extract predicates (`isFaceDown`, `isFixedLocation` reuse) only if duplication remains.

## Test plan

Extend `tests/unit/duel-state-projector.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `keeps identity when a face-up opponent monster turns face-down` | deck→face-up monster MOVE, snapshot; POSITION_CHANGE to faceDownDefense | same instance id; code still defined; `faceUp === false` |
| `keeps identity when a public graveyard card is set to the field` | deck→grave face-up, then grave→spellTrap face-down | set card has same id/code as grave card |
| `keeps identity when a face-up banished card is set` | deck→banished face-up, then banished→monster face-down | same id/code |
| `keeps an effect-revealed hand card when it is set` | CONFIRM_CARDS player 0 with exact opponent hand address/code, then matching hand→spellTrap face-down MOVE | destination has confirmed code and same tracked id |
| `ignores a reveal shown only to the opponent` | same CONFIRM_CARDS with `player:1`, then set | destination has no code |
| `rejects stale or mismatched reveal correlation` | address/code mismatch before set | no code; reveal token consumed/cleared |
| `checkpoint restore preserves a pending reveal token` | confirm, checkpoint, mutate/restore, matching set | KEEP succeeds after restore |
| `does not learn an unrevealed opponent set from hand` | hidden deck→hand, hand→spellTrap face-down, all raw messages carry nonzero code | destination has no code; event does not contain code/id |
| `does not learn a face-down summon from deck` | deck→monster faceDownDefense with nonzero raw code | destination has no code |
| `forgets a known face-down card when it changes address` | public grave→face-down monster 0, then monster 0→monster 1 face-down | second card id differs; code absent |
| `re-establishes a new public identity when a known face-down card moves public` | known face-down field→grave face-up | grave id differs from set id; code present |
| `opponent hand shuffle clears remembered hidden identity` | build an internal opponent hand card through public→hand, then SHUFFLE_HAND | later hand→field face-down cannot reuse old public id/code |
| `set-card shuffle clears known opponent set identities and follows permutation` | two known set cards, SHUFFLE_SET_CARD swapping slots | destination ids differ from both public ids; codes absent; positions swapped without duplicate occupancy |
| `set-card shuffle preserves own card knowledge` | two local set cards swapped | codes retained at mapped destinations |
| `checkpoint restore keeps a known face-down card known` | establish known face-down, checkpoint, mutate, restore | restored snapshot has original id/code |
| `event redaction still hides an unknown face-down card` | retain existing line 50 test | JSON contains no code |

Replace the old test `rotates public identity when an opponent card crosses a concealed zone` with two narrower tests: public→hand rotates/forgets; hidden hand→set stays unknown. Do not preserve a test whose former blanket rule is intentionally superseded.

Extend `tests/unit/card-visibility.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `projected identity is known exactly when code exists` | `{ code: cardCode(1) }`, `{}` | true, false |
| `raw geometric visibility remains conservative` | opponent face-down field | `isCardIdentityVisible(...) === false` |

Extend `tests/unit/contracts.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `accepts projector-attested code on an opponent face-down fixed field card` | worker state with code in p1 monster/spellTrap faceDownDefense | parses |
| `still rejects code in concealed opponent deck/hand/extra/banished` | one zone per case | `*.code privacy` |

Extend `tests/unit/duel-field.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `carries known code while rendering a face-down card back` | `PublicCard` opponent, faceDownDefense, `code` defined | board card `hidden === true`, `image.kind === "back"`, `code`/known name retained for preview/accessibility, position still faceDownDefense |
| `renders an unknown face-down card with back art` | same without code | `hidden === true`, `image.kind === "back"`, no code/name |

Extend `tests/unit/zone-list.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `trusts projected code for known face-down identity` | face-down sourced card with code | entry `identityVisible === true`, code/name present |
| `keeps unknown face-down identity hidden` | no code | false, no code |

Extend the relevant component test (`tests/component/AppChrome.test.ts` if it already tests preview functions; otherwise `tests/component/DuelField.test.ts`): known face-down `BoardCardView` hover invokes preview with code and renders card name through the App-level fixture. Do not duplicate T5's pointer test.

## Impl steps

- [x] 1. Add the ten projector tests/updates. Run `npm run test:unit -- duel-state-projector` — expect known-face-down cases to fail and old privacy cases to pass.
- [x] 2. Add `isProjectedCardIdentityKnown` plus its two tests in `src/duel/card-visibility.ts` / `tests/unit/card-visibility.test.ts`.
- [x] 3. Add `CONFIRM_CARDS:31`, pending reveal map/checkpoint state, recorder/expiry helpers and tests. Only player-0 recipient, non-deck, exact positive code/address can attest knowledge.
- [x] 4. Edit `DuelStateProjector.#move` with exact `confirmedForMove` / `staleHiddenCorrelation` / `preservesKnownIdentity` rules plus one-use reveal-token consumption. Keep event-code/event-id logic conservative: a geometrically public or explicitly confirmed source may name its prior card; an unrevealed hidden source may not.
- [x] 5. Edit `#changePosition` as specified: never delete existing knowledge merely because the card turned down; never grant code from a face-down POSITION_CHANGE raw payload.
- [x] 6. Edit `#shuffleHand` to rotate/delete internal opponent hand knowledge, leaving player-0 reorder unchanged. Add `SHUFFLE_SET_CARD:36`, projector dispatch and `#shuffleSetCards` using the pinned adapter shape above.
- [x] 7. Widen `validatePublicPlayer` in `src/duel/contracts/duel-worker-event.ts`: for p1, a concealed code is allowed only when loop variable `zone` is `monsters` or `spellsAndTraps`; keep rejection for deck/hand/extraDeck/banished. Add contract tests. Do not weaken prompt-card validation at lines ~400-411.
- [x] 8. Re-run projector/contract tests. Audit every assignment/deletion of `card.code` in the file with `grep -n "card.code\|delete .*code" src/worker/projection/DuelStateProjector.ts`; explain each remaining hidden-state branch in the commit body.
- [x] 9. Add board and zone-list tests, run them red.
- [x] 10. In `src/field/board-view-model.ts`, separate `identityKnown = isProjectedCardIdentityKnown(card)` from face presentation. Always carry `code` when known. Use existing face/location rule for `hidden` and `image`: known opponent face-down stays `hidden:true` with back art. Use known name in accessible label/preview data. Delete only obsolete combined helper logic.
- [x] 11. In `src/field/zone-list.ts`, use `isProjectedCardIdentityKnown(card)` for deck and sourced entries. A temporary deck reveal has code; an unrevealed deck card does not. Keep ordering and labels.
- [x] 12. In `src/app/presentation/card-preview.ts`, `CardTray.svelte` and `DuelHud.svelte`, use `isProjectedCardIdentityKnown(card)` whenever input is a `PublicCard`. Do not alter `PromptRegistry` or projector raw-address calls to `isCardIdentityVisible`.
- [x] 13. Add/adjust component preview test and run focused unit/component suites. Assert board image remains card back while App preview resolves known code.
- [x] 14. Run `grep -Rni "isCardIdentityVisible" src/app src/field` — it should return no `PublicCard` presentation consumer. Remaining uses in `src/worker` are expected privacy boundaries.

### Repair-round evidence (2026-08-12)

Candidate `fda015d` restored onto `1e87e63` with `git cherry-pick -n -m 1`; the two T7 conflicts resolved by keeping T7 labels and adding T6 knowledge (`Dark Magician in Your Monster Zone 3`).

- Steps 1, 3–8: `tests/unit/duel-state-projector.test.ts` 63 tests pass (`npx vitest run tests/unit/duel-state-projector.test.ts`), including every knowledge/privacy row of the Test plan; `grep -n "card.code\|delete .*code\|\.code = " src/worker/projection/DuelStateProjector.ts` audited, 20 sites, each explained in the commit body.
- Step 2: `tests/unit/card-visibility.test.ts` created this round (missing from the candidate) — 2 tests pass.
- Steps 7: `tests/unit/contracts.test.ts` accepts p1 concealed code only in `monsters`/`spellsAndTraps`, rejects `deck`/`hand`/`extraDeck`/`banished` (`/code privacy/`).
- Steps 9–13: focused run `duel-state-projector + contracts + card-visibility + duel-field + zone-list + card-preview` = 195 tests pass; `npm run test:component` 203/203 including `hovering a known face-down board card reports code while rendering back art`.
- Step 14: `grep -Rni "isCardIdentityVisible" src/app src/field` returns nothing; remaining uses are `src/worker/projection/DuelStateProjector.ts` and `src/worker/protocol/PromptRegistry.ts`.
- Repair fix: `tests/fixtures/board-public-states.ts` gained `concealedStateCard`; the opponent hand/Extra/banished fixture cards no longer carry a `code` they could never have been projected with, which is why `tests/component/DuelHud.test.ts:83` had started seeing `Dark Magician`.
- Extra hardening found by the contract audit: `#recordPendingPublicReveals` no longer writes an attested code onto a concealed opponent card outside a fixed field slot (that snapshot would fail `*.code privacy` and kill the worker). Covered by `keeps a concealed-zone reveal out of the projected opponent state`, verified red without the guard.

## Outputs

- Files edited: `src/worker/projection/DuelStateProjector.ts`, `src/worker/engine/engine-constants.ts`, `src/duel/contracts/duel-worker-event.ts`, `src/duel/card-visibility.ts`, `src/field/board-view-model.ts`, `src/field/zone-list.ts`, `src/app/presentation/card-preview.ts`, `src/app/components/duel-field/CardTray.svelte`, `DuelHud.svelte`, `tests/unit/duel-state-projector.test.ts`, `tests/unit/contracts.test.ts`, `tests/unit/card-visibility.test.ts`, `tests/unit/duel-field.test.ts`, `tests/unit/zone-list.test.ts`, one existing component preview test file.
- Public contract semantics: `PublicCard.code` explicitly means local-viewer knowledge, not current face-up state. Shape unchanged.
- Migration / config: none.

## Validation

- [x] focused projector, contracts, visibility, duel-field and zone-list tests pass — 195 passed
- [x] `npm run test:unit` passes — 58 files, 638 tests (640 with `card-visibility.test.ts`)
- [x] `npm run test:component` passes — 15 files, 203 tests
- [x] `npm run test:integration` and `npm run test:legacy` pass — 20 tests + legacy suite green inside `npm run check:headless` (exit 0)
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass — inside `npm run check:headless` (exit 0)
- [x] `npm run build` succeeds — exit 0, `build:verify` `{"status":"ok"}`
- [ ] manual fixture check: turn a known face-up opponent card face-down; hover it; preview keeps art, name and effect — human step, published to `ai-artifacts/manual_test_checklist.md` (automated proxy: component test `hovering a known face-down board card reports code while rendering back art`)
- [ ] manual privacy check: set an unrevealed opponent card from hand; hover it; preview says hidden and no card identity appears in snapshot/diagnostics — human step, published to `ai-artifacts/manual_test_checklist.md` (automated proxy: `does not learn an unrevealed opponent set from hand`)
- [x] app functional — no broken path from this slice — `PLAYWRIGHT_BROWSERS_PATH=… npx playwright test --project=chromium` 21/21 passed, full preset duel completed keyboard-only
- [x] commit msg draft: `fix(projection): retain trackable face-down public knowledge`
