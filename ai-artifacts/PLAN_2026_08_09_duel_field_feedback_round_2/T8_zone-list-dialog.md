# T8: Zone list dialog

**Plan:** `./ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** T2, T7
**Commit outcome:** Clicking any deck, extra deck, graveyard or banished pile opens a floating list centred on the field: one entry per card, horizontally scrollable, position-numbered, face-down for anything the local player must not know, orange-haloed and chip-actionable for anything the engine currently offers.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is items 13 (except the deck-reveal projection, which is T9/T10) and 14.
- This slice: piles are inert `<div>`s showing a name, a count and — since T7 — the top card's art. The contents are unreachable. A graveyard activation is only answerable through the modal `PromptDialog`.
- Out of scope here: the deck's *real* contents (T9 adds `PublicPlayerState.deck`, T10 wires it in — until then a deck list renders `count` face-down placeholders), the chain status line (T11), removing `PromptDialog` (T11).
- Assumptions in force:
  - **A10** clicking a stack always opens its list. The stack itself never fires a choice; the list is the only place an action on a stack card is taken.
  - **A9 is lifted here.** This ticket is the one that makes `stackChoices` count towards `fieldCapable`.
- **From Depends (T6, via T7):**
  - `src/field/card-mapping.ts`'s `PromptChoiceBoardTargetResolution` includes `{ kind: "stack"; targetId: \`stack:${PhysicalZoneId}\` }`, produced for any choice whose `card.location` is `deck`, `extra`, `graveyard` or `banished`.
  - `ActiveInteractionSpec.stackChoices: ReadonlyMap<BoardTargetId, readonly InteractionChoice[]>` exists, keyed by `stack:p0:graveyard` and friends.
  - `spec.fieldCapable` is still `cardChoices.size > 0 || zoneChoices.size > 0` and carries a comment naming assumption A9.
  - `StackControl` accepts `actionable`, `imageLibrary`, `placeholderUrl`, `onpreview`, and renders `stack-control-art-<id>` / `stack-control-image-<id>` when `stack.topCardCode` is defined.
- **From Depends (T2):**
  - `CardPreviewPanel` accepts `status: CardPreviewStatus | null`.
  - `HIDDEN_CARD_PREVIEW` and `stackTopCode` live in `src/app/presentation/card-preview.ts`.
  - `BoardStackView.topCardCode?: CardCode`.
  - `DuelField` / `DuelFieldErrorBoundary` / `FieldBoard` accept `onstackpreview: (stack: BoardStackView) => void`.

## Key fact the design turns on

`InteractionChoice` is sanitized down to `{ id, label, action, value?, toggleState?, allocationMaximum? }` — the card it acts on is dropped. `PromptChoice.card.instanceId` is **not** the projector's instance id either: `src/worker/protocol/PromptRegistry.ts`'s `toPromptCard` synthesises `` `p${controller}-l${location}-s${sequence}` ``. The only reliable key between a choice and a card in a pile is the triple `(controller, location, sequence)`. `graveyard` and `banished` arrays are resequenced by the projector so `card.sequence === arrayIndex`; the local player's `extraDeck` is validated to have `sequence === arrayIndex` too. This ticket therefore threads that triple through, not an id.

## Requirements

1. `src/app/prompts/interaction-spec.ts` — `InteractionChoice` gains
   ```ts
   /** Engine-side address of the card this choice acts on, when it has one. */
   readonly cardAddress?: {
     readonly controller: PlayerIndex;
     readonly location: PublicLocation;
     readonly sequence: number;
   };
   ```
   populated in `sanitizeChoice` when `isValidCardTarget(choice.card)` holds, as a frozen object. Existing consumers ignore the extra field.
2. `src/app/prompts/interaction-spec.ts` — `fieldCapable` becomes
   ```ts
   const fieldCapable =
     cardChoices.size > 0 || zoneChoices.size > 0 || stackChoices.size > 0;
   ```
   and the A9 comment is replaced by one naming this ticket. This is what stops `promptSurface` opening the modal for a graveyard activation.
3. New module `src/field/zone-list.ts`:
   ```ts
   export interface ZoneListEntry {
     /** Stable within one rendered list: `${stackId}:${position}`. */
     readonly id: string;
     /** 1-based position in the pile, bottom-first for graveyard and banished, top-first for deck and extra deck. */
     readonly position: number;
     readonly controller: PlayerIndex;
     readonly location: PublicLocation;
     readonly sequence: number;
     readonly identityVisible: boolean;
     readonly code?: CardCode;
     readonly label: string;
   }

   export function zoneListEntries(
     stack: BoardStackView,
     snapshot: PublicDuelState,
     cardTexts: ReadonlyMap<number, BoardCardText>,
   ): readonly ZoneListEntry[];

   export function zoneListsForBoard(
     board: BoardViewModel,
     snapshot: PublicDuelState | null,
     cardTexts: ReadonlyMap<number, BoardCardText>,
   ): ReadonlyMap<PhysicalZoneId, readonly ZoneListEntry[]>;
   ```
   `zoneListEntries` rules:
   - `stack.zone === "graveyard"` → `snapshot.players[stack.player].graveyard`, `position = index + 1`.
   - `stack.zone === "banished"` → `.banished`, `position = index + 1`.
   - `stack.zone === "extra"` → `.extraDeck`, `position = index + 1`.
   - `stack.zone === "deck"` → **no source list yet**: emit `stack.count` synthetic entries with `identityVisible: false`, `code: undefined`, `sequence: index`, `location: "deck"`, `position: index + 1`. T10 replaces this branch.
   - `identityVisible` = `isCardIdentityVisible(0, card.controller, card.location, card.position)` from `src/duel/card-visibility.ts`, **and** `card.code !== undefined`.
   - `label` = `cardTexts.get(code)?.name ?? \`Card ${code}\`` when visible, else `"Face-down card"`. `code` is omitted entirely when not visible.
   `zoneListsForBoard` returns a frozen `Map` keyed by `stack.id`, empty when `snapshot === null`.
4. New component `src/app/components/duel-field/ZoneListDialog.svelte`:
   ```svelte
   <script lang="ts">
     export let stack: BoardStackView;
     export let entries: readonly ZoneListEntry[] = [];
     export let choices: readonly InteractionChoice[] = [];
     export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
     export let cardBackUrl = "";
     export let placeholderUrl = "";
     export let disabled = false;
     export let onchoose: (choice: InteractionChoice) => void = () => undefined;
     export let onpreview: (entry: ZoneListEntry) => void = () => undefined;
     export let onclose: () => void = () => undefined;
   </script>
   ```
   Behaviour:
   - Renders `role="dialog"` `aria-modal="false"` `aria-label={\`${stack.label} contents\`}` inside the field, centred (`position: absolute; inset: auto; left: 50%; top: 50%; transform: translate(-50%, -50%)`), `max-width: 80%`, `max-height: 70%`.
   - A header row with the pile name, the count, and a close button.
   - A horizontally scrolling row (`overflow-x: auto`) of entries. Each entry is a fixed-size card tile showing the art (leased face image when `entry.code` is defined, `cardBackUrl` otherwise), the position number, and — when the entry has choices — a `CardActionChips` group revealed on hover/focus exactly as a hand card does.
   - `entryChoices(entry)` = `choices.filter((choice) => choice.cardAddress !== undefined && choice.cardAddress.controller === entry.controller && choice.cardAddress.location === entry.location && choice.cardAddress.sequence === entry.sequence)`.
   - An entry with at least one choice carries class `is-actionable` and the orange halo.
   - `onpointerenter` and `onfocusin` on an entry fire `onpreview(entry)`.
   - `Escape` anywhere in the dialog and a click on the close button both fire `onclose`. There is **no** backdrop: the dialog must not block the field.
   - One image lease at a time per entry, released on destroy — same pattern as `CardControl.svelte`.
5. `src/app/components/DuelField.svelte`:
   - gains `export let zoneLists: ReadonlyMap<PhysicalZoneId, readonly ZoneListEntry[]> = new Map();`
   - gains `let openStackId: PhysicalZoneId | null = null;`
   - passes `onstackactivate={(stack) => { openStackId = openStackId === stack.id ? null : stack.id; }}` to `FieldBoard`.
   - renders `<ZoneListDialog … />` when `openStackId !== null` and the board still holds that stack, passing `entries={zoneLists.get(openStackId) ?? []}`, `choices={spec?.stackChoices.get(openStack.targetId) ?? []}`, `onchoose={(choice) => { dispatch({ type: "chooseChoice", choiceId: choice.id }); openStackId = null; }}`, `onpreview={(entry) => onzonelistpreview(entry)}`, `onclose={() => { openStackId = null; }}`.
   - gains `export let onzonelistpreview: (entry: ZoneListEntry) => void = () => undefined;`
   - resets `openStackId` to `null` whenever `spec?.key.promptId` changes, so a stale list never survives a prompt.
6. `src/app/components/duel-field/StackControl.svelte` becomes clickable: it renders as `<button type="button">` (via `<svelte:element this={...}>` like `ZoneControl.svelte`) whenever `stack.count > 0`, keeps `role="group"` semantics off in that case, and calls a new `export let onactivate: () => void = () => undefined;`. When `stack.count === 0` it stays a `<div role="group">`. Keep the existing 8px pointer-move guard pattern from `ZoneControl.svelte` so a drag across a pile does not open a list.
7. `src/app/components/duel-field/FieldBoard.svelte` forwards `onstackactivate: (stack: BoardStackView) => void`.
8. `src/app/components/duel-field/DuelFieldErrorBoundary.svelte` forwards `zoneLists` and `onzonelistpreview`.
9. `src/app/App.svelte`:
   - `$: zoneLists = zoneListsForBoard(duelBoard, $duel.snapshot, ACTIVE_CARD_TEXTS);` (guarding `duelBoard === null` → empty map)
   - passes `zoneLists` and `onzonelistpreview={previewZoneListEntry}` down.
   - `previewZoneListEntry(entry)` sets `previewCard = entry.code === undefined ? HIDDEN_CARD_PREVIEW : (cardPreviewForCode(entry.code, ACTIVE_CARD_TEXTS) ?? HIDDEN_CARD_PREVIEW)`.
10. Every rendered element carries a unique kebab-case `data-cy`.

### Exact `data-cy` values

| Element | `data-cy` |
| --- | --- |
| dialog root | `zone-list-dialog` |
| header row | `zone-list-dialog-header` |
| title | `zone-list-dialog-title` |
| count | `zone-list-dialog-count` |
| close button | `zone-list-dialog-close-button` |
| scroll row | `zone-list-dialog-entries` |
| entry root | `` `zone-list-entry-${entry.id}` `` |
| entry art `<img>` | `` `zone-list-entry-image-${entry.id}` `` |
| entry position `<span>` | `` `zone-list-entry-position-${entry.id}` `` |
| entry chips group | reused `CardActionChips`, which emits `` `card-action-chips-${cardId}` `` — pass `cardId={entry.id}` so the value is `card-action-chips-<entry.id>` |

## Inputs

- `src/app/prompts/interaction-spec.ts` — `InteractionChoice`, `sanitizeChoice`, `isValidCardTarget`, the `fieldCapable` expression, `stackChoices`.
- `src/app/prompts/prompt-surface.ts` — `promptSurface(prompt, spec, showWorkspace)` returns `"field"` when `spec.fieldCapable`; this is what requirement 2 unlocks.
- `src/field/board-view-model.ts` — `BoardStackView`, `BoardViewModel`, `BoardCardText`, `cardIdentityVisible` (private; use `isCardIdentityVisible` from `src/duel/card-visibility.ts` instead).
- `src/duel/card-visibility.ts` — `isCardIdentityVisible(viewer, controller, location, position)`.
- `src/duel/contracts/public-duel-state.ts` — `PublicDuelState`, `PublicPlayerState` (`graveyard`, `banished`, `extraDeck`, `deckCount`), `PublicCard`, `PublicLocation`, `PlayerIndex`.
- `src/app/components/duel-field/CardActionChips.svelte` — props `cardId`, `cardLabel`, `choices`, `disabled`, `onchoose`, `ondismiss`; exposes `focusFirstChip()` through `bind:this`.
- `src/app/components/duel-field/CardControl.svelte` — the image-lease pattern and the `.card-action-chips` hover reveal it relies on.
- `src/app/components/duel-field/ZoneControl.svelte` — the `<svelte:element this={actionable ? "button" : "div"}>` pattern and the `pointerOrigin` / `pointerMoved` 8px guard to copy.
- `src/app/components/duel-field/StackControl.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`.
- `src/styles/app.css` — `--duel-field-layer-menu` is the top field layer; `.card-action-chips` reveal rules around line 1063.
- `tests/component/DuelField.test.ts`, `tests/component/CardActionChips.test.ts`, `tests/fixtures/board-public-states.ts`, `tests/fixtures/board-view-model.ts`.
- **From Depends:** listed in Context above.

## TDD

1. **Red** — add `tests/unit/zone-list.test.ts`, `tests/component/ZoneListDialog.test.ts` and the `DuelField` open/close cases; add the `fieldCapable` and `cardAddress` cases to `tests/unit/interaction-spec.test.ts`. Run `npm run test:unit && npm run test:component`; every new case must fail.
2. **Green** — implement `zone-list.ts`, `ZoneListDialog.svelte`, the `StackControl` button, the prop plumbing and the `interaction-spec` changes.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `numbers graveyard entries bottom first` | snapshot with 4 face-up graveyard cards | entries `position` are `1,2,3,4`; entry 4's `code` is the last array element's code |
| `hides opponent face-down banished cards` | snapshot with one face-down banished card controlled by player 1 | that entry has `identityVisible: false`, no `code`, `label: "Face-down card"` |
| `lists the whole own extra deck` | snapshot with `extraDeckCount: 3` and 3 `extraDeck` records | 3 entries, all `identityVisible: true` |
| `hides the opponent extra deck` | opponent `extraDeck` records with `code: undefined` | all 3 entries `identityVisible: false` |
| `synthesises face-down deck entries` | `deckCount: 40`, deck stack | 40 entries, all `identityVisible: false`, positions `1..40` |
| `choices carry their card address` | `chain` prompt with a graveyard activation at sequence 2 | `spec.stackChoices.get("stack:p0:graveyard")[0].cardAddress` equals `{ controller: 0, location: "graveyard", sequence: 2 }` |
| `stack choices now make a prompt field capable` | same spec | `spec.fieldCapable === true` |
| `dialog lists every entry` | render `ZoneListDialog` with 4 entries | `zone-list-entry-<id>` present for all 4; `zone-list-dialog-count` reads `4` |
| `dialog haloes only the actionable entry` | 3 entries, one choice whose `cardAddress.sequence` matches entry 2 | only entry 2 carries `is-actionable` |
| `dialog fires the choice from its chip` | click `card-action-chip-<choiceId>` inside entry 2 | `onchoose` called once with that choice |
| `dialog previews on hover` | `pointerenter` entry 1 | `onpreview` called with entry 1 |
| `dialog closes on Escape` | `keydown` `Escape` on the dialog | `onclose` called once |
| `dialog closes on the close button` | click `zone-list-dialog-close-button` | `onclose` called once |
| `face-down entries use the card back` | entry with no `code`, `cardBackUrl="back.png"` | `zone-list-entry-image-<id>` `src` is `back.png` |
| `clicking a pile opens its list` | render `DuelField` with `zoneLists`, click `field-stack-p0:graveyard` | `zone-list-dialog` appears |
| `clicking the same pile closes it` | click it twice | `zone-list-dialog` absent after the second click |
| `an empty pile is not clickable` | stack with `count: 0` | `field-stack-p1:banished` `tagName` is `DIV` |
| `a new prompt closes an open list` | open a list, then re-render with a spec carrying a different `promptId` | `zone-list-dialog` absent |

## Impl steps

- [ ] 1. Create `tests/unit/zone-list.test.ts` with the five `zoneListEntries` cases.
- [ ] 2. Add the two `interaction-spec` cases to `tests/unit/interaction-spec.test.ts`.
- [ ] 3. Create `tests/component/ZoneListDialog.test.ts` with the seven dialog cases.
- [ ] 4. Add the four open/close cases to `tests/component/DuelField.test.ts`.
- [ ] 5. Run `npm run test:unit && npm run test:component`; confirm every new case fails.
- [ ] 6. In `src/app/prompts/interaction-spec.ts`, add `cardAddress` to `InteractionChoice` and populate it in `sanitizeChoice`.
- [ ] 7. In the same file, change `fieldCapable` to include `stackChoices.size > 0` and replace the A9 comment.
- [ ] 8. Create `src/field/zone-list.ts` with `ZoneListEntry`, `zoneListEntries` and `zoneListsForBoard` exactly as specified.
- [ ] 9. Create `src/app/components/duel-field/ZoneListDialog.svelte` with the prop contract, the `entryChoices` filter, the `data-cy` values above, `Escape` handling via a `onkeydown` on the dialog root, and per-entry image leases released in `onDestroy`.
- [ ] 10. In `src/app/components/duel-field/StackControl.svelte`, add `export let onactivate: () => void = () => undefined;` and switch the root to `<svelte:element this={stack.count > 0 ? "button" : "div"}>` with the `ZoneControl` pointer-move guard; keep every existing attribute and `data-cy`.
- [ ] 11. In `src/app/components/duel-field/FieldBoard.svelte`, add `export let onstackactivate: (stack: BoardStackView) => void = () => undefined;` and pass `onactivate={() => onstackactivate(stack)}`.
- [ ] 12. In `src/app/components/DuelField.svelte`, add `zoneLists`, `onzonelistpreview`, `openStackId`, the reset-on-prompt-change reactive statement, the `onstackactivate` handler and the `ZoneListDialog` render block.
- [ ] 13. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, declare and forward `zoneLists` and `onzonelistpreview`.
- [ ] 14. In `src/app/App.svelte`, add `zoneLists`, `previewZoneListEntry`, and pass both down.
- [ ] 15. In `src/styles/app.css`, add the `.zone-list-dialog` rules: centred absolute positioning inside `.duel-field`, `z-index: var(--duel-field-layer-menu)`, `background: var(--surface-strong)`, `border: 1px solid var(--border)`, `border-radius: 0.9rem`, `box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.45)`, `padding: 0.75rem`; `.zone-list-dialog__entries { display: flex; gap: 0.5rem; overflow-x: auto; }`; `.zone-list-entry { position: relative; flex: 0 0 auto; width: 4.5rem; }`; `.zone-list-entry.is-actionable img { border-color: var(--warning); box-shadow: 0 0 0 2px rgb(255 213 128 / 0.55); }`; and reveal the chips with `.zone-list-entry:hover .card-action-chips, .zone-list-entry:focus-within .card-action-chips { display: flex; }`.
- [ ] 16. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`.
- [ ] 17. Run the chromium e2e suite (see Validation). If a spec still expects the `Choose a chain response` modal for a graveyard activation, update it — that modal is now correctly replaced by the field path.

## Outputs

- Added: `src/field/zone-list.ts`, `src/app/components/duel-field/ZoneListDialog.svelte`, `tests/unit/zone-list.test.ts`, `tests/component/ZoneListDialog.test.ts`.
- Edited: `src/app/prompts/interaction-spec.ts`, `src/app/components/duel-field/StackControl.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`, `src/styles/app.css`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`, possibly `e2e/duel-smoke.spec.ts`.
- Public contract for successors:
  - `ZoneListEntry` and `zoneListEntries(stack, snapshot, cardTexts)` / `zoneListsForBoard(board, snapshot, cardTexts)` in `src/field/zone-list.ts`. **T10 replaces only the `stack.zone === "deck"` branch of `zoneListEntries`.**
  - `InteractionChoice.cardAddress?: { controller; location; sequence }`.
  - `spec.fieldCapable` now includes `stackChoices.size > 0`.
  - `DuelField` / `DuelFieldErrorBoundary` accept `zoneLists` and `onzonelistpreview`.
  - `ZoneListDialog` prop contract and `data-cy` values as tabled above.
- No migration, no config change.

## Validation

- [ ] `npm run format:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:unit` exits 0
- [ ] `npm run test:component` exits 0
- [ ] chromium e2e exits 0:
  ```bash
  cd /home/aron/projects/ascencio
  timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
    libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
    alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
  export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
  npx playwright test --project=chromium
  '
  ```
  **This exact command was verified green by the orchestrator on 2026-08-10** (`1 passed` on `-g "production bundle initializes"`). Run it verbatim from the repo root.
  - `PLAYWRIGHT_BROWSERS_PATH=.tmp/pw-browsers` is mandatory. That directory holds symlinks to the nix-patched browsers in `/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` under the revision names playwright 1.61 expects (`chromium-1228 -> chromium-1217`). The mismatched revision numbers are deliberate and fine.
  - Without the override, Playwright picks `~/.cache/ms-playwright`, whose binaries are unpatched and die with `libglib-2.0.so.0: cannot open shared object file`. That error means the override is missing, not that the `-p` list is wrong.
  - `playwright-driver.browsers` and `xorg.xvfb` are both required in the `-p` list even though Xvfb is never launched. Do not simplify the list.
  - If `.tmp/pw-browsers` is gone, recreate it: `S=/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` (rebuild with `nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link` if the path is garbage-collected), then `mkdir -p .tmp/pw-browsers && cd .tmp/pw-browsers && ln -sfn $S/chromium-1217 chromium-1228 && ln -sfn $S/chromium_headless_shell-1217 chromium_headless_shell-1228 && ln -sfn $S/ffmpeg-1011 ffmpeg-1011 && ln -sfn $S/firefox-1511 firefox-1532`.
  - Run it in the **foreground**, blocking. Runs take 1-5 min; `webServer` builds and starts the preview itself, so do not hand-start `npm run preview`.
  - The duel seed is random per run (`crypto.getRandomValues`). A single pass of a duel-walking test proves little; if a duel-walking test is the one you changed, run the suite 3 times before calling it green.
- [ ] manual check: `npm run dev`; click your graveyard — a centred list opens, scrolls horizontally, numbers each card, previews on hover, and closes on Escape. Click the opponent's extra deck — every entry is face-down.
- [ ] app functional — the dialog never blocks the board (no backdrop) and a new prompt closes it
- [ ] commit msg draft: `feat(field): open and act from a zone list dialog`
</content>
