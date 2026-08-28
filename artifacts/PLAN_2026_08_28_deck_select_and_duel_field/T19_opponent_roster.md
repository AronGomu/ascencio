# T9: Opponent roster + settings persistence

**Plan:** `./artifacts/PLAN_2026_08_27_deck_selection_screen.md`
**Depends:** T1
**Commit outcome:** Free play has three named AI opponents, each owning one bundled deck; the chosen opponent persists in shell settings. Pure data + settings — no UI yet.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Opponent selection (free play only)): exactly three bundled AI opponents — Practice Bot, Blaze Circuit, Vault Warden — each owning exactly one bundled, undeletable deck; picking an AI brings its deck along.
- This slice: roster module in shell + settings field. T10 consumes.
- Out of scope here: opponent duel behavior (`src/battle/worker/opponent/OpponentPolicy.ts` untouched — personas are presentation/pairing only), portraits beyond inline SVG placeholder ids, story opponents.
- Assumptions in force (plan `## Assumptions`): mapping Practice Bot→`mvp-opponent`, Blaze Circuit→`burning-abyss`, Vault Warden→`shaddoll`; default persona = Vault Warden (its deck = existing `DEFAULT_OPPONENT_DECK_ID = "shaddoll"` from `src/battle/duel/presets/deck-catalog.ts`, so remembered-nothing behavior matches today's default opponent deck).

## Requirements

- New `src/shell/screens/free-play-opponents.ts`:

```ts
import type { DeckId } from "../../battle/index.ts"; // preset deck id union — check export; if DeckId is not exported from battle index, type deckId as string and validate with battle's isDeckId at the consumer instead. Do NOT deep-import battle internals.

export interface FreePlayOpponent {
  readonly id: "practice-bot" | "blaze-circuit" | "vault-warden";
  readonly name: string;
  /** Tagline under the name in the picker. */
  readonly line: string;
  /** Bundled deck this AI owns; `preset:${deckId}` key format. */
  readonly deckKey: string;
}

export const FREE_PLAY_OPPONENTS: readonly FreePlayOpponent[];
// practice-bot  "Practice Bot"  deckKey "preset:mvp-opponent"
// blaze-circuit "Blaze Circuit" deckKey "preset:burning-abyss"
// vault-warden  "Vault Warden"  deckKey "preset:shaddoll"

export const DEFAULT_FREE_PLAY_OPPONENT_ID = "vault-warden";

export function freePlayOpponent(id: string): FreePlayOpponent; // unknown id → default persona (a remembered id from a build that renamed personas must not crash the screen)
```

  Note: battle's public entry `src/battle/index.ts` exports `DECK_CATALOG` — write a unit test asserting every `deckKey` suffix is a real catalog id, so a catalog rename fails loudly here.
- Settings: read `src/shell/settings/shell-settings.ts` first (F1: schema/versioning shape), then:
  - `ShellSettings` gains `readonly freePlayOpponentId: string | null` (default `null` = default persona) and `readonly freePlayPresetFavouriteIds: readonly string[]` (default `[]` — preset-deck favourites live here because `DeckRepository.setFavourite` only covers local decks; plan `## Assumptions`).
  - `readShellSettings` tolerates both fields absent (old stored settings) → defaults.
  - `src/shell/settings/shell-settings-store.ts` `ShellSettingsStore` gains:

```ts
rememberFreePlayOpponent(id: string): void;
setPresetDeckFavourite(id: string, favourite: boolean): void;
```

  Both follow the existing `persist()` pattern (`rememberFreePlayPairing` precedent, same file).

## Inputs

- `src/shell/settings/shell-settings.ts` — `ShellSettings`, `DEFAULT_SHELL_SETTINGS`, `readShellSettings`, `writeShellSettings`.
- `src/shell/settings/shell-settings-store.ts` — store + `persist` pattern.
- `src/battle/index.ts` — `DECK_CATALOG` export (frozen list already carries it).
- Existing settings tests: `git grep -ln "readShellSettings\|rememberFreePlayPairing" tests/` — extend in place.
- **From Depends:** T1 unrelated code-wise; ordering only (branch base).

## TDD

1. **Red** — unit tests for roster + settings round-trip; fail.
2. **Green** — implement.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `roster has exactly three personas with real bundled decks` | `FREE_PLAY_OPPONENTS` vs `DECK_CATALOG` | 3 entries; every `deckKey` = `preset:` + existing catalog id |
| `unknown persona id falls back to default` | `freePlayOpponent("gone")` | returns vault-warden entry |
| `default persona owns the default opponent deck` | `freePlayOpponent(DEFAULT_FREE_PLAY_OPPONENT_ID)` | `deckKey === "preset:shaddoll"` (matches `DEFAULT_OPPONENT_DECK_ID`) |
| `settings default and round-trip` | fresh storage → remember "blaze-circuit" → re-read | null then "blaze-circuit" persisted |
| `old stored settings without new fields read cleanly` | stored JSON lacking both fields | defaults null / [] |
| `preset favourite toggles and persists` | set fav "preset:nekroz" true, then false | list gains then loses the key |

Run: `npx vitest run tests/unit/shell` (match the actual dir of existing settings tests found in Inputs)

## Impl steps

- [ ] 1. Locate settings tests (`git grep`), write failing roster test file `tests/unit/shell/free-play-opponents.test.ts` + settings assertions in existing file.
- [ ] 2. Create `src/shell/screens/free-play-opponents.ts` per Requirements.
- [ ] 3. Extend `ShellSettings` + defaults + `readShellSettings` tolerance in `src/shell/settings/shell-settings.ts`.
- [ ] 4. Add both store methods to `src/shell/settings/shell-settings-store.ts`.
- [ ] 5. `npx vitest run tests/unit` → green.
- [ ] 6. `npm run lint && npm run typecheck && npm run build` → green.

## Outputs

- New: `src/shell/screens/free-play-opponents.ts`, `tests/unit/shell/free-play-opponents.test.ts`.
- Edited: `src/shell/settings/shell-settings.ts`, `src/shell/settings/shell-settings-store.ts`, settings test file.
- Public API (shell-internal): `FREE_PLAY_OPPONENTS`, `DEFAULT_FREE_PLAY_OPPONENT_ID`, `freePlayOpponent(id)`, store methods `rememberFreePlayOpponent(id)`, `setPresetDeckFavourite(id, favourite)` — T10 quotes verbatim.

## Validation

- [ ] `npx vitest run tests/unit` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] app functional — settings additions backward-compatible
- [ ] commit msg draft: `feat(shell): give free play three AI opponents that own their bundled decks`
