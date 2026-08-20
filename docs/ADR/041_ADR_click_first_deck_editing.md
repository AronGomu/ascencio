# ADR-041: Click-First Deck Editing

> Status: accepted; planned
> Decided: 2026-08-20
> Owners: deck editor interaction architecture
> Relates: ADR-037 (manual deck order), ADR-024 (responsive stage)
> Feedback: [`../../feedback-decks.md`](../../feedback-decks.md) — Deck Builder 3, 3.1, 4, 9, 10

## Context

On the desktop layout a left click on a card tile only selected it; every edit needed a drag or a right click. Feedback round 2 wants the click to be the edit: main → side, side → back, extra → gone, catalog → added. It also wants a "to sideboard" checkbox in the catalog, and it says explicitly to keep right click.

Two other facts shaped this. The Side Deck was collapsed on open, so its drop area did not exist and "drag a card to the sideboard" could not work — the reported bug was a rendering decision, not a drag bug. And the catalog's drag legality only ever allowed a card's canonical zone, so a catalog card could not be dropped on Side even when Side was open.

## Decision

1. **A click means one intent, computed by a pure function.** `src/deck-editor/layout/click-intent.ts` maps (zone, canonical zone, zone counts, sideboard flag) to `move` / `remove` / `add` / `blocked`. The component applies it; it does not decide it.
2. **Desktop only.** Below `STAGE_BREAKPOINT_PX` the existing `TapTargetMenu` stays: a touch tap has no hover to disambiguate it, and an explicit menu is the accessible answer there. `selectEditorLayoutMode` already names the two worlds.
3. **Blocked is spoken, not silent.** A full target zone announces `Side Deck is full.` / `Main Deck is full.` / `Extra Deck is full.` / `No space left.` through the existing live region and mutates nothing.
4. **The sideboard flag reorders preferences, it does not override capacity.** Checked, the order is side → canonical → blocked; unchecked, canonical → side → blocked. Right-click add uses the same function, so the two paths cannot drift.
5. **Legality stays in the model.** Copy limits, forbidden cards and zone legality remain `applyDeckCommand`'s job; the intent function only decides *where the click aims*. Presentation never decides legality.
6. **Side starts expanded**, and a catalog card may be dropped on Side as well as on its canonical zone.

## Consequences

- Selection and editing now share the left button. Preview still follows hover first, selection second, so a click that moves a card also leaves it previewed.
- Every click-driven edit is an ordinary `DeckCommand`, so undo, redo, autosave and validation cannot tell clicks, drags and taps apart.

## Alternatives rejected

- Click-to-move everywhere, deleting `TapTargetMenu`: a tap has no hover, so a touch user would edit their deck by trying to look at a card.
- A modifier key (`Alt`+click) for the sideboard: feedback asked for a visible, stateful control; a modifier is invisible and unlearnable.
- Encoding capacity rules inside the components: three call sites (click, right click, drop) would each grow their own copy — one already had, in `contextAdd`.
</content>
