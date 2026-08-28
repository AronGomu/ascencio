# T11 — Zone-list face-up entry must fall back to the placeholder, not the card back (audit F25, issue #25)

## Context

`src/battle/app/components/duel-field/ZoneListEntryTile.svelte:44`:

```svelte
  $: synchronizeImageLease(imageLibrary, entry.code, cardBackUrl);
```

`renderedImageUrl` starts at `cardBackUrl` and the lease's fallback is `cardBackUrl`. So a face-up entry —
`entry.code` defined, `identityVisible` true — with `imageLibrary === null` renders as a **card back**: a card
the player is entitled to identify, drawn as if it were hidden. `App.svelte:1392` nulls `imageLibrary`
whenever `imagesMatchRuntime` is false, so this is a real runtime state, not a hypothetical.

`CardControl` handles the same case correctly through `FieldBoard.svelte:115`:

```ts
  function cardImageUrl(card: BoardViewModel["cards"][number]): string {
    return card.image.kind === "back" ? cardBackUrl : placeholderUrl;
  }
```

`OffFieldTargetEntry` extends `ZoneListEntry`, so one fix covers `mode="target"` too.

This is presentation only. It never widens what is revealed: a concealed entry carries no code and keeps the
card back.

## Requirements

- R1. The zone-list tile's image fallback is `entry.identityVisible ? placeholderUrl : cardBackUrl`.
- R2. Concealed entries (`identityVisible` false, or no code) are unchanged — still the card back.
- R3. Applies to `mode="target"` as well, via the shared entry type.
- R4. Presentation only: no change to what data reaches the component, no change to lease lifecycle beyond the
  fallback argument.

## Inputs

- `src/battle/app/components/duel-field/ZoneListEntryTile.svelte` (`:30`–`:60`)
- `src/battle/app/components/duel-field/FieldBoard.svelte` (`:113`–`:117`, the correct precedent)
- the `ZoneListEntry` / `OffFieldTargetEntry` types (`grep -rn "OffFieldTargetEntry" src/`)
- `src/battle/app/App.svelte` (`:1392` region, where `imageLibrary` is nulled)
- existing `ZoneListDialog` / zone-list component tests under `tests/component/`
- `AGENTS.md` privacy rules for concealed cards

## TDD

Red first, component test:

- `face-up zone-list entry with a null image library renders the placeholder, not the card back`
- `concealed zone-list entry with a null image library still renders the card back`

The existing `ZoneListDialog` source assertions both use `identityVisible: false`, so they must stay green
untouched — that is the regression guard for R2.

## Test plan

- [x] Both tests above. verify: both named tests present in `tests/component/ZoneListDialog.test.ts`
- [x] `npm run test:component`, `npm run test:unit` green. verify: exit 0 for both

## Impl steps

- [x] Write both failing tests. verify: the face-up one fails on `cardBackUrl`, quote it
      → `AssertionError: expected 'back.png' to be 'placeholder.webp'`; concealed test passed unchanged in the same run
- [x] Change the fallback argument at `:44` (and the `renderedImageUrl` seed if it needs it for consistency). verify: tests green
      → `imageFallbackUrl` derived at `:44`; seed left alone, the `$:` block assigns `renderedImageUrl` before first render so it never reaches the DOM
- [x] Confirm `mode="target"` shares the fixed path. verify: test or code-path note in report
      → `ZoneListDialog.svelte:217` (target branch) and `:236` (browse branch) both pass `{placeholderUrl}` into the same `ZoneListEntryTile`; `OffFieldTargetEntry extends ZoneListEntry` so `entry.identityVisible` is the same field

## Outputs

- Face-up zone-list entries show the placeholder when art is unavailable.
- Append this slice's manual steps to `artifacts/manual_test_checklist.md` under its own heading.

## Validation

- [x] `npm run test:component` exit 0 — 102 files, 923 tests passed
- [x] `npm run test:unit` exit 0 — 147 files, 1694 tests passed
- [x] `npm run check:headless` exit 0 — snapshot `a562f5ad…`, all gates ok
- [x] New face-up test fails when the fix is reverted (prove non-vacuous) — reverted the fallback arg in place, face-up test failed `expected 'back.png' to be 'placeholder.webp'`, concealed test stayed green, file restored
