# Remaining-source audit — checkpoint

## Review

- R1. **Done: three newly confirmed bugs. Partial: source audit.** Parent requested checkpoint after current probe. No clean-audit claim.
- R2. **Blocker — F1, P1:** field selection submits wrong card for `SELECT_UNSELECT_CARD`.
- R3. **Blocker — F2, P1:** genuine engine draw becomes projection error.
- R4. **Finding — F3, P2:** shop greeting consumes Enter/Space intended for focused controls/dialogs.
- R5. **Correct:** focused probes exercised real prompt producer → mapper → reducer → validator → encoder; separate draw probe exercised pinned WASM. No broad suites, src edits, commits, staging, subagents, vendor changes.
- R6. **Fixed:** none. Only this report written. Existing dirty work preserved.
- R7. **Next action:** parent assigns F1–F3 corrective impl/regressions; resume P/N coverage below in bounded follow-up. Findings remain outside inspected isolated fixes.

## Assumptions

- A1. Scope = tracked `src/battle/**`, `src/story/**`, `src/shell/**`, entrypoints, shared styles, font inventory. Content85/Cards-Decks102 excluded from broad re-review; boundary references only.
- A2. Findings describe inspected working tree; final observed HEAD `e5471ce`. Other workers integrated changes during audit. Prior full-read claims remain attributed to prior reports, not fresh validation of changed revisions.
- A3. Graph-first attempted; `graphify` unavailable. Source/doc inspection used instead. Architecture docs, AGENTS, prior reports consulted; truncated combined outputs not counted as full reads.
- A4. Report output authorized separately from prohibited src edits. No scratch/progress files created or deleted.
- A5. P1 = valid duel interaction/result corrupted or terminated. P2 = reachable keyboard interaction defect. Browser acceptance not performed.

## F1 — P1: field unselect prompt answers different card than clicked

**Evidence:** `src/battle/worker/protocol/PromptRegistry.ts:477–517` models `SELECT_UNSELECT_CARD` as one toggle response: choices enumerate selectable cards, then already-selected cards; `resolve` requires exactly one ID. `src/battle/app/prompts/interaction-spec.ts:149` maps this to `cardSelection`; `:215–218` identifies immediate submission only through `minimum === maximum === 1`.

`src/battle/app/prompts/interaction-session.ts:84–98` initializes draft with every `toggleState: "selected"` ID. `:129–141` edits aggregate set; `:198–201` submits remaining set. `src/battle/app/components/DuelField.svelte:587–590` takes this aggregate path for other min/max values. `src/battle/app/prompts/prompt-selection.ts:50–53` accepts any single retained ID.

**Repro:** real producer prompt, `min:1`, `max:3`, two initially selected monsters A/B, Finish available. Map valid board; click A; Confirm. Engine receives B's toggle index, not A's. Both selections valid individually → validator cannot detect changed intent.

Observed focused Node probe:

```text
fieldCapable: true
mountedTargets: ["card:card-0", "card:card-1"]
clicked: prompt-1-choice-0-select
initial: [prompt-1-choice-0-select,prompt-1-choice-1-select]
submitted: [prompt-1-choice-1-select]
validation: {valid:true}
wire: {type:7,index:1}
```

**Impact:** wrong monster selected/unselected. Other initial counts leave invalid multi-ID/empty drafts, despite legal engine toggles. Field action bar exposes aggregate Confirm (`src/battle/app/components/duel-field/FieldActionBar.svelte:189–198`), reinforcing incorrect interaction.

**Smallest fix:** distinguish toggle response intent from engine's current selection decoration. Submit clicked choice alone for toggle-family prompts; preserve explicit Finish/Cancel IDs. Apply same distinction to mounted cards, off-field lists, material lists. Do not change engine response shape or weaken validator.

**Regression:** build real `SELECT_UNSELECT_CARD`, map mounted board, activate A with A/B initially selected, assert submitted ID A → wire index 0. Cover initially unselected card, zero/two selected cards, Finish, Cancel, list presentation. Existing inspected test sections cover generic toggling/spec shape, not this producer-to-field wire invariant.

**Suggested focused cmd, not run:**

```sh
npx vitest run --maxWorkers=1 tests/unit/interaction-session.test.ts tests/unit/interaction-spec.test.ts tests/unit/prompt-registry.test.ts
```

**Executed probe:**

```sh
node --input-type=module <<'NODE'
import { buildEnginePrompt } from './src/battle/worker/protocol/PromptRegistry.ts';
import { EngineMessageType, EngineLocation } from './src/battle/worker/engine/engine-constants.ts';
import { mapPromptToInteractionSpec } from './src/battle/app/prompts/interaction-spec.ts';
import { createInteractionSession, reduceInteractionSession } from './src/battle/app/prompts/interaction-session.ts';
import { validatePromptSelection } from './src/battle/app/prompts/prompt-selection.ts';
import { mapSnapshotToBoard } from './src/battle/field/board-view-model.ts';
import { BOARD_VIEW_MODEL_FIXTURES } from './tests/fixtures/board-view-model.ts';
const snapshot = structuredClone(BOARD_VIEW_MODEL_FIXTURES['ST-08']);
snapshot.players[0].monsters = [0,1].map(sequence=>({...snapshot.players[0].monsters[0],instanceId:`card-${sequence}`,sequence}));
const board = mapSnapshotToBoard(snapshot);
if (!board.ok) throw new Error(JSON.stringify(board));
const dependencies = {cards:new Map(),texts:new Map(),scripts:new Map(),images:new Map(),strings:{system:{},victory:{},counter:{},setname:{}},counts:{cards:0,texts:0,scripts:0,globals:0,images:0}};
const binding = buildEnginePrompt({type:EngineMessageType.SELECT_UNSELECT_CARD,player:0,min:1,max:3,can_finish:true,can_cancel:false,select_cards:[],unselect_cards:snapshot.players[0].monsters.map(card=>({code:card.code,controller:0,location:EngineLocation.MONSTER,sequence:card.sequence}))},1,dependencies);
const spec = mapPromptToInteractionSpec(binding.prompt,snapshot,board.value,{workerGeneration:1,sessionGeneration:1});
const initial = createInteractionSession(spec);
const clicked = binding.prompt.choices[0].id;
const toggled = reduceInteractionSession(initial,spec,{type:'toggleChoice',choiceId:clicked,key:spec.key});
const submitted = reduceInteractionSession(toggled.session,spec,{type:'confirm',key:spec.key}).command.choiceIds;
console.log(JSON.stringify({fieldCapable:spec.fieldCapable,mountedTargets:[...spec.cardChoices.keys()],clicked,initial:initial.selectedChoiceIds,submitted,validation:validatePromptSelection(binding.prompt,submitted),wire:binding.resolve(submitted)},null,2));
NODE
```

## F2 — P1: genuine draw crashes result projection

**Evidence:** `src/battle/worker/projection/DuelStateProjector.ts:537–543` passes WIN's player through `asPlayer`; `:2213–2216` rejects values other than 0/1. `src/battle/duel/contracts/duel-result.ts:3–9` permits only player winner/loser for completed result. `src/battle/app/components/DuelResultDialog.svelte:50–52` offers only win/loss display. Public `BattleOutcome` already includes `"draw"` (`src/battle/battle-contracts.ts:19`).

**Repro:** fresh pinned WASM, load in-memory script `Duel.Win(2, 1)`, start/process duel, feed resulting actual WIN message into projector. No vendor/script files modified.

```text
script loaded: true
boundary: 2 [ 40 ]
real WASM WIN: {"type":5,"player":2,"reason":1}
projection error: Unsupported player index: 2
```

This is supported engine output, not synthetic out-of-range input. Cached upstream scripts corroborate actual draw use: `.cache/upstream/CardScripts/constant.lua:238` defines `PLAYER_NONE = 2`; `official/c95308449.lua:88` calls `Duel.Win(PLAYER_NONE,WIN_REASON_FINAL_COUNTDOWN)`. Cache evidence ancillary; pinned-WASM probe is authoritative.

**Impact:** normal drawn duel cannot produce completed result; projection throws instead. Correct terminal outcome lost.

**Smallest fix:** explicitly represent draw at result boundary; preserve 0/1 restriction for actual player fields. Handle engine sentinel only in WIN conversion. Update result validation/serialization, result display, host outcome mapping coherently. Do not map draw arbitrarily to player 0/1.

**Regression:** real pinned-core draw → projector → worker event parser → host draw result; UI displays draw. Retain player-0/player-1 win tests. Test real simultaneous-loss/scripted-draw scenario once narrow contract fix passes.

**Suggested focused cmd, not run:**

```sh
npx vitest run --maxWorkers=1 tests/unit/duel-state-projector.test.ts tests/unit/contracts.test.ts
```

**Executed probe:**

```sh
node --input-type=module <<'NODE'
import {loadVendoredCoreNode} from './src/battle/worker/engine/load-vendored-core-node.ts';
import {DuelStateProjector} from './src/battle/worker/projection/DuelStateProjector.ts';
import {EngineDuelFlag, EngineMessageType} from './src/battle/worker/engine/engine-constants.ts';
const adapter = await loadVendoredCoreNode();
const team={startingLP:8000,startingDrawCount:0,drawCountPerTurn:0};
const handle=adapter.createDuel({flags:EngineDuelFlag.MODE_MR5,seed:[1n,2n,3n,4n],team1:team,team2:team,cardReader:()=>null,scriptReader:()=>null,errorHandler:(_type,message)=>console.log('core:',message)});
if(handle===null) throw new Error('No handle');
try {
 console.log('script loaded:',adapter.loadScript(handle,'audit-draw.lua','Duel.Win(2, 1)'));
 adapter.startDuel(handle);
 for(let i=0;i<4;i++){
  const status=adapter.process(handle);
  const messages=adapter.getMessages(handle);
  const win=messages.find(x=>x.type===EngineMessageType.WIN);
  if(win){
   console.log('real WASM WIN:',JSON.stringify(win));
   const projector=new DuelStateProjector('a'.repeat(64),[0,0],[0,0],{extraMonsterZones:true});
   try {console.log('projected:',projector.apply(win));} catch(error){console.log('projection error:',error.message);}
   break;
  }
  console.log('boundary:',status,messages.map(x=>x.type));
 }
} finally {adapter.destroyDuel(handle);}
NODE
```

## F3 — P2: greeting hijacks keyboard controls

**Evidence:** `src/story/shop/ShopGreetingScreen.svelte:47–52` handles window Enter/Space, calls `preventDefault()`, advances greeting without checking target. Existing `isControl` helper at `:39–45` only used for clicks (`:55–57`). Listener remains global (`:66`).

Reachable composition: `src/story/StoryApp.svelte:989–1009` renders top-bar settings/decks/packs controls beside greeting (`:1157–1166`); overlays render separately. `src/story/overlays/OverlayShell.svelte:28–43` handles Escape/Tab, not suppression of greeting's Enter/Space listener. Narrative sibling already guards `isControl(event.target)` (`src/story/screens/NarrativeScreen.svelte:37–47`).

**Repro:** during first/second shop greeting beat, focus Settings or packs button, press Enter/Space. Greeting window handler cancels control's native keyboard action, advances dialogue. Pointer-opened dialog also exposes focused controls to same handler.

Executed source-extracted handler in JSDOM, bubbling cancelable Enter from focused button:

```text
{"target":"BUTTON","defaultPrevented":true,"greetingAdvances":1}
```

Probe tests actual handler body, not mounted Svelte/browser composition. Native control cancellation follows its `preventDefault`; full browser regression remains required.

**Smallest fix:** use existing `isControl(event.target)` guard in keyboard handler; honor already-prevented events. Keep bare-stage Enter/Space progression. Ensure overlay-focused controls never advance underlying greeting.

**Regression:** extend `tests/component/story/ShopGreeting.test.ts` with sibling control focus, dialog control focus, both keys, repeated-key guard, ordinary stage progression. Current file's three tests cover pointer advance/buy/leave only (`:10–74`).

**Suggested focused cmd, not run:**

```sh
npx vitest run --maxWorkers=1 tests/component/story/ShopGreeting.test.ts
```

**Executed probe:**

```sh
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { JSDOM } from 'jsdom';
const text = readFileSync('src/story/shop/ShopGreetingScreen.svelte','utf8');
const match = text.match(/function handleKeydown\(event: KeyboardEvent\): void \{[\s\S]*?\n  \}/)[0];
const dom = new JSDOM('<button id="settings">Settings</button>');
let advances = 0;
const handler = new Function('showMenu','advance',`${stripTypeScriptTypes(match)}; return handleKeydown;`)(false,()=>advances++);
dom.window.addEventListener('keydown',handler);
const button = dom.window.document.querySelector('button');
button.focus();
const event = new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
button.dispatchEvent(event);
console.log(JSON.stringify({target:button.tagName,defaultPrevented:event.defaultPrevented,greetingAdvances:advances}));
dom.window.close();
NODE
```

## Isolated-fix comparison / duplication control

- D1. `.tmp/codebase-audit-battle`: inspected diff stats, relevant `PromptControls.svelte` diff. Changes address overlay allowlist, announcement paging/limits, LP payments. No interaction-session/field toggle correction; WIN handling unchanged. F1/F2 distinct from earlier Battle F1–F3.
- D2. `.tmp/codebase-audit-story`: inspected diff stats, relevant StoryApp diff. Navigation/session save handling, stale writes, load summaries corrected there. Shop greeting keyboard path untouched. F3 distinct from earlier Story/Shell F1–F5.
- D3. `.tmp/codebase-audit-content`: inspected `b6aca31` changed-file summary; recovery/storage/SW/content-action fixes do not overlap F1–F3. Main observed integrated commit `e5471ce`.
- D4. `.tmp/codebase-audit-decks`: inspected changed-file summary; editor/selection/history/import fixes do not overlap F1–F3. No broad re-audit or acceptance claim for isolated fixes.
- D5. Earlier Battle empty-selection claim not repeated: parent ledger records rejection after pinned-core verification. Prior findings not relabeled as new findings.

## Residual risks / unpromoted observations

- U1. **Free-play cache helper mismatch reproduced; UI reachability unresolved.** `src/shell/screens/free-play-deck-listing.ts:70–81` tests in-flight request against last-completed identity, not pending identity. After completed A, pending B, new A request returns B promise. In-process mocked-repo probe printed `A request reused B promise: true`, `A request received: ['B']`. Production overlapping A→B→A lifecycle not established → not promoted to product finding. Fix candidate: track pending key separately; guard stale cache commits. Deferred two-identity test settles helper behavior; route/content lifecycle test settles user impact.
- U2. **DOM selector uniqueness:** newly read `src/battle/app/components/duel-field/ChainStatus.svelte:18–30` repeats static `data-cy` descendants for multiple links. Conflicts with AGENTS rendered-document uniqueness. No rendered multi-link probe before checkpoint; record for follow-up, not primary gameplay finding.
- U3. `src/story/README.md` retains obsolete mock-battle/placeholder-save/Auto-Skip limits. Current primary architecture router takes precedence; no src behavior finding inferred from stale README.
- U4. Large combined reads were truncated. Ledger conservatively marks affected files P even when requested ranges spanned whole file. No silent full-read promotion.
- U5. No full browser/component/unit suite, build, lint, typecheck, exhaustive E2E, generated-asset verification, performance benchmark. Focused probes are bug evidence, not project acceptance.
- U6. Runtime producer coverage remains incomplete: normal deck/script scenario for F1, full browser draw handoff for F2, mounted overlay keyboard flow for F3 require regressions.

## Tracked-path coverage

Inventory cmd:

```sh
git ls-files 'src/battle/**' 'src/story/**' 'src/shell/**' 'src/main.ts' 'src/acceptance-main.ts' 'src/styles/**' 'src/assets/fonts/**'
```

**325 paths, exhaustive classification below.** I = 110 prior-report full reads, attributed, not fresh re-review. F = 74 full reads verified in this pass. P = 109 partial/search/truncated reads; unread ranges remain. N = 32 inventory-only, source bodies remaining. Fonts are binary inventory, not source correctness review. Categories disjoint. Source reads ≠ passing tests.

### I — prior full reads, 110

Source: `artifacts/codebase-audit/battle-audit.md` / `story-shell-audit.md`, “Fully read” sections. Relevant finding paths received additional targeted reads/probes without reclassifying entire large file as fresh full read.

```text
src/acceptance-main.ts
src/battle/BattleFacade.svelte
src/battle/app/App.svelte
src/battle/app/DuelWorkerClient.ts
src/battle/app/presentation/card-preview.ts
src/battle/app/prompts/prompt-selection.ts
src/battle/app/stores/duel-store.ts
src/battle/battle-contracts.ts
src/battle/duel/card-visibility.ts
src/battle/duel/contracts/duel-command-parsing.ts
src/battle/duel/contracts/duel-command.ts
src/battle/duel/contracts/duel-deck-selection.ts
src/battle/duel/contracts/duel-result.ts
src/battle/duel/contracts/duel-worker-event.ts
src/battle/duel/contracts/player-prompt.ts
src/battle/duel/contracts/public-duel-state.ts
src/battle/field/card-mapping.ts
src/battle/field/material-list.ts
src/battle/field/off-field-target-list.ts
src/battle/field/zone-list.ts
src/battle/ports/battle-presentation-input.ts
src/battle/ports/battle-runtime-source.ts
src/battle/ports/frozen-battle-executable.ts
src/battle/ports/index.ts
src/battle/worker/DuelWorkerRuntime.ts
src/battle/worker/HeadlessDuelController.ts
src/battle/worker/assets/active-duel-dependencies.ts
src/battle/worker/create-browser-runtime.ts
src/battle/worker/create-node-runtime.ts
src/battle/worker/decks/resolve-duel-decks.ts
src/battle/worker/diagnostics/duel-trace.ts
src/battle/worker/duel.worker-browser.ts
src/battle/worker/duel.worker.ts
src/battle/worker/engine/DuelSession.ts
src/battle/worker/engine/OcgCoreAdapter.ts
src/battle/worker/engine/engine-constants.ts
src/battle/worker/opponent/OpponentPolicy.ts
src/battle/worker/opponent/ReplayOpponentPolicy.ts
src/battle/worker/projection/DuelStateProjector.ts
src/battle/worker/protocol/PromptRegistry.ts
src/battle/worker/protocol/message-classification.ts
src/battle/worker/runtime-initialization.ts
src/battle/worker/worker-thread-bridge-node.ts
src/main.ts
src/shell/AppShell.svelte
src/shell/adapters/installed-card-image-source.ts
src/shell/adapters/installed-editor-catalog.ts
src/shell/adapters/progressive-release-data.ts
src/shell/adapters/progressive-release-media.ts
src/shell/adapters/story-release.ts
src/shell/application/application-bootstrap.ts
src/shell/application/application-locks.ts
src/shell/application/application-readiness.ts
src/shell/application/application-selector.ts
src/shell/application/application-service.ts
src/shell/application/application-state.ts
src/shell/application/content-actions.ts
src/shell/application/core-update-approval.ts
src/shell/application/prepared-release.ts
src/shell/application/selected-gameplay.ts
src/shell/core/core-gate.ts
src/shell/core/installed-inputs.ts
src/shell/core/menu-saves.ts
src/shell/core/session-saves.ts
src/shell/core/shell-application.ts
src/shell/handoff/handoff-coordinator.ts
src/shell/handoff/handoff-request.ts
src/shell/pwa/register-service-worker.ts
src/shell/pwa/shell-cache-policy.ts
src/shell/release-validation.ts
src/shell/routes.ts
src/shell/shell-store.ts
src/story/StoryApp.svelte
src/story/collection/collection-cards.ts
src/story/collection/group-by-rarity.ts
src/story/decks/card-ownership.ts
src/story/decks/encounter-deck.ts
src/story/decks/pre-battle-decks.ts
src/story/decks/pre-battle-tiles.ts
src/story/decks/starter-grant.ts
src/story/decks/story-deck-context.ts
src/story/decks/story-deck-repository.ts
src/story/handoff/story-handoff.ts
src/story/model/story-reducer.ts
src/story/model/story-state.ts
src/story/ports/index.ts
src/story/ports/parse-story-release.ts
src/story/ports/release-value.ts
src/story/ports/story-continuity.ts
src/story/ports/story-document.ts
src/story/ports/story-release.ts
src/story/ports/story-session.ts
src/story/saves/generation-contracts.ts
src/story/saves/generation-database.ts
src/story/saves/generation-envelope.ts
src/story/saves/generation-record.ts
src/story/saves/generation-repository.ts
src/story/saves/story-migration.ts
src/story/saves/story-save-contracts.ts
src/story/saves/story-save-repository.ts
src/story/screens/LoadScreen.svelte
src/story/shop/auto-flip.ts
src/story/shop/data/latest-sets.ts
src/story/shop/data/pack-generator.ts
src/story/shop/data/shop-pricing.ts
src/story/shop/data/shop-rarity.ts
src/story/shop/data/shop-set-data.ts
src/story/shop/opened-card-quantities.ts
src/story/shop/sell-impact.ts
src/story/shop/shop-screens.ts
```

### F — fresh full reads, 74

```text
src/battle/app/components/LoadingOverlay.svelte
src/battle/app/components/PromptDialog.svelte
src/battle/app/components/DuelErrorDialog.svelte
src/battle/app/components/DuelResultDialog.svelte
src/battle/app/components/MenuDialog.svelte
src/battle/app/components/PhaseBar.svelte
src/battle/app/components/duel-field/FieldLines.svelte
src/battle/app/components/duel-field/EndTurnButton.svelte
src/battle/app/components/duel-field/DragGhost.svelte
src/battle/app/components/duel-field/ChainStatus.svelte
src/battle/app/components/duel-field/FullControlToggle.svelte
src/battle/app/components/duel-field/PromptContextMessage.svelte
src/battle/app/components/duel-field/DuelLog.svelte
src/battle/app/components/duel-field/ProjectedChoiceMenu.svelte
src/battle/app/components/duel-field/MaterialCard.svelte
src/battle/app/components/duel-field/DropConfirmDialog.svelte
src/battle/app/components/duel-field/ZoneControl.svelte
src/battle/app/components/duel-field/FieldActionBar.svelte
src/battle/app/components/portal-duel-dialog.ts
src/battle/app/diagnostics/download-diagnostics.ts
src/battle/app/images/card-image-cache.ts
src/battle/app/presentation/card-action-label.ts
src/battle/app/presentation/drag-ghost-physics.ts
src/battle/app/presentation/duel-phase-label.ts
src/battle/app/presentation/duel-rail-status.ts
src/battle/app/presentation/floating-window-position.ts
src/battle/app/presentation/format-duel-log-entry.ts
src/battle/app/presentation/format-duel-presentation-event.ts
src/battle/app/presentation/format-selection-status.ts
src/battle/app/presentation/immutable-choice-id-set.ts
src/battle/app/presentation/local-card-action.ts
src/battle/app/prompts/interaction-session.ts
src/battle/decks/installed-selectable-decks.ts
src/battle/decks/selectable-decks.ts
src/battle/duel/contracts/assert-never.ts
src/battle/duel/contracts/duel-diagnostics.ts
src/battle/duel/contracts/duel-error.ts
src/battle/duel/contracts/duel-presentation-event.ts
src/battle/duel/contracts/ids.ts
src/battle/duel/contracts/structured-clone.ts
src/battle/duel/presets/deck-catalog.ts
src/battle/duel/presets/deck-parser.ts
src/battle/duel/presets/deck-sources-browser.ts
src/battle/duel/presets/deck-sources-node.ts
src/battle/duel/presets/duel-preset.ts
src/battle/duel/presets/duel-rules-profile.ts
src/battle/duel/presets/mvp-preset-node.ts
src/battle/duel/presets/mvp-preset.ts
src/battle/duel/presets/reviewed-card-pool.ts
src/battle/duel/prompt-sum.ts
src/battle/index.ts
src/battle/settle-once.ts
src/battle/worker/diagnostics/worker-log.ts
src/battle/worker/duel-errors.ts
src/battle/worker/duel.worker-node.ts
src/battle/worker/engine/duel-seed.ts
src/battle/worker/engine/load-vendored-core-node.ts
src/battle/worker/protocol/effect-description-format.ts
src/battle/worker/protocol/effect-description.ts
src/battle/worker/protocol/sum-selection.ts
src/shell/screens/free-play-deck-listing.ts
src/story/README.md
src/story/collection/CollectionScreen.svelte
src/story/components/StoryTopBar.svelte
src/story/content/prologue.ts
src/story/overlays/OverlayShell.svelte
src/story/overlays/focus-trap.ts
src/story/screens/IllustratedMapScreen.svelte
src/story/shop/ShopGreetingScreen.svelte
src/story/styles.css
src/styles/acceptance.css
src/styles/fonts.css
src/styles/primitives.css
src/styles/tokens.css
```

### P — partial/search/truncated reads, 109

Conservative classification: file body requested/inspected partly, but complete untruncated read not established. `PromptControls.svelte` includes isolated diff inspection. Finding-specific ranges cited above fully inspected.

```text
src/battle/app/components/DuelField.svelte
src/battle/app/components/duel-field/CardControl.svelte
src/battle/app/components/duel-field/FieldBoard.svelte
src/battle/app/components/duel-field/MaterialSelectDialog.svelte
src/battle/app/components/duel-field/ZoneListDialog.svelte
src/battle/app/images/semantic-image-leases.ts
src/battle/app/presentation/card-list-dialog-model.ts
src/battle/app/presentation/end-turn-automation.ts
src/battle/app/presentation/selected-hand-zoom.ts
src/battle/app/prompts/PromptControls.svelte
src/battle/app/prompts/auto-placement.ts
src/battle/app/prompts/auto-response.ts
src/battle/app/prompts/drop-target.ts
src/battle/app/prompts/duel-priority.ts
src/battle/app/prompts/field-navigation.ts
src/battle/app/prompts/hand-activation-choices.ts
src/battle/app/prompts/interaction-spec.ts
src/battle/app/prompts/pending-placement.ts
src/battle/app/prompts/phase-transitions.ts
src/battle/app/prompts/prompt-control-family.ts
src/battle/app/prompts/prompt-surface.ts
src/battle/app/stores/persisted-ui-state.ts
src/battle/app/stores/persisted-ui-store.ts
src/battle/app/stores/ui-settings-store.ts
src/battle/field/board-view-model.ts
src/battle/field/duel-field-geometry.ts
src/battle/field/duel-field-layout.ts
src/battle/field/perspective.ts
src/battle/field/placement-candidates.ts
src/battle/storage/revision-cache-cleanup.ts
src/battle/storage/snapshot-digest.ts
src/battle/storage/snapshot-store.ts
src/battle/worker/assets/active-duel-dependencies-node.ts
src/battle/worker/assets/browser-runtime-assets.ts
src/battle/worker/assets/runtime-manifest.ts
src/battle/worker/assets/runtime-snapshot-node.ts
src/shell/adapters/legacy-battle-runtime.ts
src/shell/adapters/legacy-collection.ts
src/shell/adapters/legacy-content-api.ts
src/shell/adapters/legacy-frozen-vendor-pin.ts
src/shell/adapters/legacy-gameplay-validation.ts
src/shell/adapters/legacy-installed-runtime-receipt.ts
src/shell/adapters/legacy-prepare-installed-runtime.ts
src/shell/adapters/legacy-runtime-digest.ts
src/shell/adapters/legacy-runtime-manifest.ts
src/shell/adapters/legacy-verify-runtime-support.ts
src/shell/adapters/runtime-activation.ts
src/shell/admin/AdminConsole.svelte
src/shell/admin/admin-actions.ts
src/shell/application/core-startup.ts
src/shell/application/installer-chapter-sizes.ts
src/shell/application/legacy-content.ts
src/shell/application/legacy-installer.ts
src/shell/application/saved-content-refs.ts
src/shell/application/shell-bootstrap.ts
src/shell/cards/deck-cover.ts
src/shell/content/content-error-copy.ts
src/shell/domain-loaders.ts
src/shell/index.ts
src/shell/screens/DomainLoadError.svelte
src/shell/screens/FreePlayMatchSetup.svelte
src/shell/screens/InstallContentScreen.svelte
src/shell/screens/MainMenuScreen.svelte
src/shell/screens/ShellSettingsDialog.svelte
src/shell/screens/free-play-deck-actions.ts
src/shell/screens/free-play-deck-tiles.ts
src/shell/screens/free-play-opponents.ts
src/shell/screens/story-save-presence.ts
src/shell/settings/shell-settings-store.ts
src/shell/settings/shell-settings.ts
src/shell/stage-layout.ts
src/shell/toast/ToastHost.svelte
src/shell/toast/toast-context.ts
src/shell/toast/toast-store.ts
src/story/cards/deck-cover.ts
src/story/components/CardPreviewHost.svelte
src/story/components/CardZoomInspector.svelte
src/story/components/ChoiceList.svelte
src/story/components/RaritySortButton.svelte
src/story/components/StoryCardTile.svelte
src/story/components/icons/DeckIcon.svelte
src/story/components/icons/GearIcon.svelte
src/story/components/icons/ShopIcon.svelte
src/story/components/zoom-window-position.ts
src/story/index.ts
src/story/overlays/HistoryOverlay.svelte
src/story/overlays/LoadOverlay.svelte
src/story/overlays/PauseOverlay.svelte
src/story/overlays/SaveLoadOverlay.svelte
src/story/overlays/SettingsOverlay.svelte
src/story/playback/story-playback-settings-store.ts
src/story/playback/story-playback-settings.ts
src/story/playback/story-playback.ts
src/story/playback/story-read-log.ts
src/story/saves/index.ts
src/story/screens/BattleHandoffScreen.svelte
src/story/screens/NarrativeScreen.svelte
src/story/screens/OutcomeScreen.svelte
src/story/screens/PreBattleScreen.svelte
src/story/screens/RewardScreen.svelte
src/story/shop/BoosterInventoryDialog.svelte
src/story/shop/BoosterOpeningScreen.svelte
src/story/shop/BoosterResultsScreen.svelte
src/story/shop/SellImpactDialog.svelte
src/story/shop/SetTile.svelte
src/story/shop/ShopBrowseScreen.svelte
src/story/shop/ShopCardListScreen.svelte
src/story/shop/ShopSellScreen.svelte
src/story/shop/ShopSetDialog.svelte
```

### N — inventory-only / remaining, 32

```text
src/assets/fonts/forum-latin.woff2
src/assets/fonts/source-serif-4-italic-latin.woff2
src/assets/fonts/source-serif-4-latin.woff2
src/battle/app/acceptance/AcceptanceHarness.svelte
src/battle/app/acceptance/acceptance-scenario.ts
src/battle/app/acceptance/card-list-dialog-scenarios.ts
src/battle/app/acceptance/full-height-field-scenarios.ts
src/battle/app/components/DeckPicker.svelte
src/battle/app/components/DuelRail.svelte
src/battle/app/components/SettingsDialog.svelte
src/battle/app/components/duel-field/CardActionChips.svelte
src/battle/app/components/duel-field/CardTray.svelte
src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte
src/battle/app/components/duel-field/DuelHud.svelte
src/battle/app/components/duel-field/FloatingFieldWindow.svelte
src/battle/app/components/duel-field/HandBand.svelte
src/battle/app/components/duel-field/HandZoomOverlay.svelte
src/battle/app/components/duel-field/StackControl.svelte
src/battle/app/components/duel-field/ZoneListEntryTile.svelte
src/battle/app/presentation/dom-feedback-controller.ts
src/battle/app/presentation/presentation-command.ts
src/battle/app/presentation/prompt-context-message.ts
src/battle/components/RotationNotice.svelte
src/battle/duel/presets/decks/burning-abyss.ydk
src/battle/duel/presets/decks/chapter-one-practice.ydk
src/battle/duel/presets/decks/chapter-one-starter.ydk
src/battle/duel/presets/decks/nekroz.ydk
src/battle/duel/presets/decks/opponent.ydk
src/battle/duel/presets/decks/player.ydk
src/battle/duel/presets/decks/shaddoll.ydk
src/battle/duel/presets/decks/spellbook.ydk
src/styles/app.css
```

### Test/doc coverage outside 325-path inventory

- T1. Full test-source read: `tests/component/story/ShopGreeting.test.ts`; `tests/integration/real-wasm-smoke.test.ts`.
- T2. Partial source/search: `tests/unit/interaction-session.test.ts`, `interaction-spec.test.ts`, `prompt-registry.test.ts`, `duel-state-projector.test.ts`, `data-cy-coverage.test.ts`; `tests/integration/duel-session.test.ts`; `tests/fixtures/board-view-model.ts`. Fixture imported by probe ≠ full source read.
- T3. Other related tests/E2E remain unreviewed except prior-report coverage. No suite result claimed here.
- T4. Full focused ADR reads: ADR-009 automatic resolution, ADR-054 free-play seats. AGENTS/prior audit reports/docs routers consulted earlier; mixed/truncated architecture/contract reads remain partial.
- T5. Final observed `git diff --cached --name-only`: empty. No staged files. No baseline-dirty hash comparison performed by this child.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Three new findings include severity, exact source references, observed focused probes, minimal fixes, regression guidance. Existing isolated fixes compared without duplicate findings."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "All 325 tracked scoped paths explicitly classified: 110 prior full reads, 74 fresh full reads, 109 partial/search/truncated, 32 inventory-only."
    },
    {
      "id": "criterion-3",
      "status": "partial",
      "evidence": "Parent requested immediate checkpoint. P/N coverage, mounted browser regressions, exhaustive test review remain incomplete."
    }
  ],
  "changedFiles": ["artifacts/codebase-audit/remaining-source-audit.md"],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {"command": "graphify query <remaining-source architecture question>", "result": "failed", "summary": "graphify unavailable; source fallback used."},
    {"command": "git ls-files 'src/battle/**' 'src/story/**' 'src/shell/**' 'src/main.ts' 'src/acceptance-main.ts' 'src/styles/**' 'src/assets/fonts/**'", "result": "passed", "summary": "325 tracked paths inventoried."},
    {"command": "node --input-type=module <F1 inline probe in report>", "result": "passed", "summary": "Real producer + mapped mounted board reproduces wrong toggle index."},
    {"command": "node --input-type=module <F2 inline probe in report>", "result": "passed", "summary": "Pinned WASM emits real draw; projector rejects player 2."},
    {"command": "node --input-type=module <F3 inline probe in report>", "result": "passed", "summary": "Source-extracted greeting handler cancels focused-button Enter, advances greeting."},
    {"command": "node --input-type=module <free-play cache helper probe>", "result": "passed", "summary": "Cross-identity promise mismatch reproduced; UI lifecycle reachability unresolved."},
    {"command": "git diff --cached --name-only", "result": "passed", "summary": "Empty output; no staged files."}
  ],
  "validationOutput": [
    "F1: clicked prompt-1-choice-0-select; submitted prompt-1-choice-1-select; valid true; wire type 7 index 1.",
    "F2: real WASM WIN: {\"type\":5,\"player\":2,\"reason\":1}",
    "F2: projection error: Unsupported player index: 2",
    "F3: {\"target\":\"BUTTON\",\"defaultPrevented\":true,\"greetingAdvances\":1}",
    "Coverage: 325 paths; I110/F74/P109/N32."
  ],
  "residualRisks": [
    "P109/N32 source coverage incomplete at parent checkpoint.",
    "No browser/component suite, broad unit suite, build, lint, typecheck, benchmark, or asset verification run.",
    "F1 normal scripted duel, F2 browser draw handoff, F3 mounted overlay flow still need regressions.",
    "Free-play listing identity mismatch reproduced only at helper boundary.",
    "Multi-link ChainStatus static data-cy duplication noted without rendered probe.",
    "Prior full-read coverage inherited; concurrent integrations not freshly re-reviewed."
  ],
  "noStagedFiles": true,
  "diffSummary": "Report only. No src/test/vendor edits, commits, staging, cleanup, or subagents.",
  "reviewFindings": [
    "F1 P1: DuelField.svelte:587-590 / interaction-session.ts:84-98,129-141 — SELECT_UNSELECT_CARD aggregate draft submits wrong card.",
    "F2 P1: DuelStateProjector.ts:537-543,2213-2216 — genuine draw WIN player 2 throws Unsupported player index: 2.",
    "F3 P2: ShopGreetingScreen.svelte:47-52 — global Enter/Space handling hijacks focused controls/dialogs."
  ],
  "manualNotes": "Checkpoint per parent steering. Parent assigns corrective workers, resumes explicit remaining coverage. Authoritative report written at artifacts/codebase-audit/remaining-source-audit.md."
}
```
