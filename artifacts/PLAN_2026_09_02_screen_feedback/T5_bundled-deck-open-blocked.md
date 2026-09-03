# T5: Block bundled deck editing visibly

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T4  
**Commit outcome:** Bundled decks cannot open in builder; menu explains refusal and double-click emits exact toast.

## Context (self-contained)

Goal: DS5. `src/deck-select/` is presentation-only and imports no sibling domain; hosts own navigation/toast. Bundled presets are not editor records. Out of scope: default star (T2).

## Requirements

R1. Kebab keeps `Open in deck builder` visible but disabled for bundled tiles; expose reason `Bundled deck: cannot be modified`.
R2. Double-click bundled tile does not navigate; host publishes shell toast with exact copy.
R3. Local deck open paths unchanged.
R4. Implement in both hosts: free-play `FreePlayMatchSetup` and story `PreBattleScreen`.
R5. Deck-select emits callbacks/flags only; no shell/toast import.

## Inputs

I1. Read `DeckTileMenu.svelte`, `DeckTile.svelte`, `DeckSelectScreen.svelte`, `FreePlayMatchSetup.svelte`, `PreBattleScreen.svelte`, toast public contract.
I2. From T4: current deck-select markup stabilized.

## Interface contract (level 5)

P1. `DeckTileMenu` receives `openDisabled: boolean` and `openDisabledReason: string | null`; open menu button has `disabled={openDisabled}`, `aria-describedby` pointing to visible/visually-hidden reason.
P2. Exact message constant at host/shared legal location: `Bundled deck: cannot be modified`.
P3. `DeckSelectScreen` does not call `onopen` for `tile.bundled`; it calls a presentation callback `onblockedopen(tile)`; host maps callback to `toasts.show({ message, tone: "warning" })`.
E1. Missing toast context follows existing host fallback status/announcement; do not swallow.
N1. Double-click invokes exactly one path; no navigation side effect.

## TDD

1. **Red** — menu disabled/reason, both-host dblclick toast/no navigation, local open regression.
2. **Green** — flags/callback host wiring.
3. **Refactor** — one exact-copy constant only if boundary rules permit; else duplicate exact literal in host tests deliberately.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Bundled kebab | Open menu | Open item disabled + reason |
| Bundled dblclick | Tile | warning toast exact copy; no route |
| Local dblclick | Tile | builder route opens |
| Story host | Bundled tile | same refusal behavior |

## Impl steps

- [ ] 1. Add failing deck-select + host tests.
- [ ] 2. Add disabled reason contract without domain import.
- [ ] 3. Wire free-play/story host toast callbacks.

## Validation

- [ ] `npx vitest run tests/component/deck-select tests/component/FreePlayMatchSetup.test.ts tests/component/story/pre-battle-deck-picker.test.ts`
- [ ] `npx vitest run tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: bundled menu + dblclick; local dblclick.
- [ ] No silent-failure swallow: toast-unavailable path announces refusal.
- [ ] App functional: bundled deck remains selectable for duel.
- [ ] Commit msg draft: `fix(deck-select): stop bundled presets entering the editor`
