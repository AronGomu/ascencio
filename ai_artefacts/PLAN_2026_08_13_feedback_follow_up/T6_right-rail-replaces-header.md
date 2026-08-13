# T6: Right rail replaces header

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T5
**Commit outcome:** Mounted `DuelRail` owns settings, LP, turn/phase, avatars, additive status; `DuelHeaderBar` + preview status are removed without broken chrome.

## Context (self-contained)

- Goal: Delete top header so board can consume viewport height. Rail must be functional before old header deletion.
- This slice: Mount rail in current shell/row. Final 3-column `100svh` sizing waits next ticket.
- Out of scope here: shell geometry, preview internal scroll, card-list, new domain/profile assets.
- Assumptions: no player-profile domain exists → use current avatar URLs/placeholders only. Status derives existing prompt/snapshot/pending facts; prompts remain decision owners.

## Requirements

- Rail rows: top, opponent, status `minmax(0,1fr)`, player.
- Top shows `Turn N · <phase>` + fixed 2.5rem options button; no duel title/deck names.
- Opponent avatar above LP; player LP above avatar; active-turn border only presentation.
- Status `aria-live="polite"`; title/subtitle; dots only when `thinking`; reduced motion keeps dots visible/static.
- Move current `CardPreviewStatus` logic to rail model. `CardPreviewPanel` becomes card content only; remove `status`, `hasPriority` props/DOM.
- Mount rail in `App.svelte` before deleting `DuelHeaderBar.svelte` + test. Update every `duel-header-*` browser/component selector in same commit.

## Inputs

- `src/app/components/DuelHeaderBar.svelte`, `CardPreviewPanel.svelte`, `src/app/presentation/preview-status.ts`, `src/app/App.svelte`.
- `tests/component/DuelHeaderBar.test.ts`, `AppChrome.test.ts`, `CardPreviewPanel.test.ts`, `tests/unit/preview-status.test.ts`, `e2e/duel-smoke.spec.ts` header selectors.
- `ai-artifacts/DESIGN_2026_08_13_full_height_duel_field.md` §7.
- `docs/ADR/019_ADR_full_height_duel_shell_and_pixel_geometry.md`.
- `ai_artefacts/manual_test_checklist.md` — append/update only T6 human checks; preserve all other sections.
- **From Depends:** pixel board/hands/phases functional in current shell; phase/current turn state already available in `App.svelte`.

## Required API

Create `src/app/presentation/duel-rail-status.ts`:

```ts
export interface DuelRailStatus {
  readonly title: string;
  readonly subtitle: string;
  readonly thinking: boolean;
}

export function duelRailStatusFor(input: {
  readonly prompt: PlayerPrompt | null;
  readonly snapshot: PublicDuelState | null;
  readonly responsePending: boolean;
}): DuelRailStatus;
```

Precedence + exact copy:

1. `responsePending` → title `Waiting for the engine`, subtitle `Your response is being processed.`, thinking true.
2. `snapshot===null` → `Preparing duel` / `Loading current duel state.`, thinking true.
3. `prompt!==null` → title=`prompt.title`; subtitle `Choose in the active prompt.`, thinking false.
4. `snapshot.turnPlayer===1` → `Opponent is thinking` / `Waiting for the opponent's next action.`, thinking true.
5. else → `Your move` / `${DUEL_PHASE_LABELS[snapshot.phase]} · ${snapshot.players[0].handCount} cards in hand`, thinking false.

Never name card/effect absent from input. Import canonical `DUEL_PHASE_LABELS`; unknown phase fallback = `Unknown phase`.

`DuelRail.svelte` props:

```ts
export let turn: number;
export let phase: DuelPhase;
export let turnPlayer: PlayerIndex;
export let lifePoints: readonly [number, number];
export let playerAvatarUrl: string;
export let opponentAvatarUrl: string;
export let status: DuelRailStatus;
export let onopensettings: () => void;
```

Stable selectors: `duel-right-rail`, `duel-right-rail-turn-phase`, `duel-right-rail-options`, `duel-right-rail-status`, `duel-right-rail-status-title`, `duel-right-rail-status-subtitle`, `duel-player-avatar-0/1`, `duel-right-rail-life-points-0/1`, dots `duel-right-rail-status-dot-1..3`.

## TDD

1. **Red** — status pure tests + rail component tests + App selector migration tests.
2. **Green** — model/component/mount; then delete old header/status only after new assertions green.
3. **Refactor** — transfer existing LP/avatar/options behavior; no duplicate owners.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `renders turn and phase without duel title` | snapshot | exact text; no catalog/title |
| `orders opponent and player identity blocks` | LP/avatar data | opponent avatar→LP; player LP→avatar |
| `opens settings from fixed options control` | click | existing settings dialog opens |
| `announces truthful additive status` | model matrix | `aria-live=polite`; no invented text |
| `renders dots only for thinking states` | pending/your move | 3 vs 0 dots |
| `reduced motion keeps static dots` | Chromium media | animation none; opacity visible |
| `removes header ownership` | App DOM | zero `duel-header-*`; one rail/options/LP owner |
| `preview retains lease/content behavior` | preview card | no status DOM; image/text unchanged |

## Impl steps

- [x] 1. Add `tests/unit/duel-rail-status.test.ts` + `tests/component/DuelRail.test.ts`; update AppChrome/preview tests; run red.
- [x] 2. Implement pure status mapping from existing facts.
- [x] 3. Add `DuelRail.svelte` with exact props/selectors/order/a11y/dots.
- [x] 4. Mount rail in current `App.svelte` row; route existing options callback, LP/avatar/turn/phase/status.
- [x] 5. Remove status props/DOM from CardPreviewPanel + call sites; preserve image lease.
- [x] 6. Delete `DuelHeaderBar.svelte`, test, `preview-status.ts`, test after `rg` proves new owners.
- [x] 7. Update old header selectors/assertions in `e2e/duel-smoke.spec.ts` to rail selectors.
- [x] 8. Add reduced-motion CSS/browser assertion; run focused/full component gates.

## Outputs

- Created: DuelRail + status model + tests.
- Deleted: DuelHeaderBar + test; preview-status + test.
- Modified: App, CardPreviewPanel, styles, AppChrome/e2e.
- Public APIs exactly above.

## Validation

- [x] `npx vitest run tests/unit/duel-rail-status.test.ts tests/component/DuelRail.test.ts tests/component/AppChrome.test.ts tests/component/CardPreviewPanel.test.ts` → exit 0.
- [x] `test -z "$(rg -l 'DuelHeaderBar|duel-header-|previewStatusFor|CardPreviewStatus' src tests e2e || true)"` → success.
- [x] `npm run typecheck && npm run lint` → exit 0.
- [x] `npx playwright test e2e/duel-smoke.spec.ts --project=chromium --grep "production bundle initializes|life points|rail"` → exit 0.
- [ ] manual check — options opens settings; status never replaces prompt UI.
- [x] app functional — `npm run build` exits 0.
- [ ] commit msg draft: `feat(shell): replace duel header with status rail`
