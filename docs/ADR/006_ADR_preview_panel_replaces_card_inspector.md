# ADR-006: Preview Panel Replaces The Modal Card Inspector

> Status: accepted; planned
> Decided: 2026-08-08
> Owners: presentation architecture
> Plan: [`../../artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`](../../artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md) — T11

## Context

`CardInspector.svelte` shows one card's art, name, location, position, effect text, counters and materials. It opens from three places: an `Inspect` button on every actionable non-`cardAction` field card, an `Inspect …` entry in the anchored action menu, and the HUD card list plus card trays. It manages focus on open, restores it on close, and closes on `Escape`.

The overhaul removes the first two entry points: the field inspect button and the action menu both disappear with the hover chips. It also asks for a permanent preview panel beside the field, filled by hover or press-and-hold. Keeping both means two components answering the same question, one of them reachable only through a HUD that is hidden by default.

## Decision

1. Delete `CardInspector.svelte`.
2. Add `CardPreviewPanel.svelte`: a fixed `22rem` column on the same grid row as the duel field, stretched to the same height, art on top, scrollable effect text below.
3. Fill it from `pointerenter`, `pointerdown` and `focusin` on any field card whose identity is visible. Hidden cards never fill it and never clear it.
4. Content is sticky. The panel keeps the last card after the pointer leaves, so the text stays readable while the pointer travels to it.
5. The panel is inert: no buttons, no links, nothing focusable, `pointer-events` never blocking a card underneath.
6. The HUD card list and card trays keep their `Inspect …` buttons and their `oninspect` prop; the app repoints that callback to fill the preview panel instead of opening a modal. `DuelHud.svelte` and `CardTray.svelte` need no change.
7. Below `64rem` viewport width the panel moves under the field and caps at `18rem` tall.
8. Image leasing reuses the inspector's lifecycle verbatim: lease on code change, release on change and on destroy, fall back to the placeholder on image error.

## Alternatives rejected

- **Keep both surfaces.** Two card-detail components, one of them behind a hidden HUD. More code, more tests, no user gain.
- **Clear the panel on pointer leave.** Always reflects the pointer exactly, and makes the text unreadable — moving the pointer toward the panel empties it.
- **Fluid percentage width.** Card text at 25% of a 1024px viewport is a two-word column. A fixed `22rem` reads the same at every desktop size.

## Full-height amendment (accepted 2026-08-13)

ADR-019 keeps preview fixed-width beside field. Effect text now lives in bounded `minmax(0,1fr)` real vertical scroller. Native scrollbar chrome is hidden; decorative custom overlay thumb mirrors/pointer-controls scroll. Permanent 10px inline gutter prevents text reflow. Real scroller stays keyboard/wheel reachable; overlay adds no Tab stop. Image lease/stickiness/privacy rules below remain.

## Consequences

- Counters and overlay materials leave the detail view. They remain in the HUD's rich card list and in the field's own badges.
- No focus trap and no `Escape` handling to maintain; the app-level `keydown` listener disappears with the modal.
- The preview panel is always mounted, so it holds one image lease for as long as a card is previewed. Bounded to one lease.
- `App.svelte` loses `inspectedCard`, `cardInspectorTrigger`, `closeCardInspector`, `isInspectableCard`, `findPublicCard` and the `afterUpdate` block that kept the inspected card in sync with the snapshot.
