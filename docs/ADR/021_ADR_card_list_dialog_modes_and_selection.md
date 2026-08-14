# ADR-021: Card-List Dialog Modes And Selection

> Status: accepted; planned
> Decided: 2026-08-13
> Owners: field interaction presentation
> Plan: [`../../ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`](../../ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md) — T10–T13
> Evidence: [`../../ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md`](../../ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md), [`../feature/PDDR-card-list-dialog.md`](../feature/PDDR-card-list-dialog.md)

## Context

Current `ZoneListDialog` partly supports browse + off-field targets. Approved prototype freezes physical-card layout, exact-target flow, sorting, halos, responsive behavior. Current prompt model additionally supports min/max ranges, Hand sources, several `ChoiceId`s for one card address. Production must preserve those legal answers.

## Decision

1. One Svelte DOM `ZoneListDialog`; modes: browse/activate + card target draft.
2. Worker-projected choices, prompt bounds/cancelability, sanitized snapshot remain sole legality/privacy authority. UI never invents/filter-widens legal answers.
3. Field-local top-left position/clamp/layer/drag from ADR-017 wins over prototype viewport positioning. 1320×600 is expanded cap when boundary permits.
4. Frozen visual defaults: 58px header, 64px footer, 144px card width, 8px card gaps/edges, 1.60 zoom, full physical copy per address, one horizontal row.
5. Browse:
   - zone source order by default;
   - optional stable alphabetical display for fully visible identities only;
   - card click never selects/pins;
   - projected legal actions + local Details below art;
   - header `×`, footer red Cancel, outside/Escape dismiss;
   - no collapse/Validate.
6. Target:
   - legal projected entries only;
   - exact + variable min/max card-selection prompts use same dialog;
   - every card click edits draft; no immediate submit, including 1/1;
   - explicit `Validate selection`; existing validator remains final authority;
   - hard maximum native-disables unselected choices; selected choices remain enabled for unselect;
   - outside/Escape preserve window + draft;
   - no `×`; explicit Cancel only if engine says cancelable;
   - collapse is visual-only, 58×58, anchor-stable, not persisted.
7. Display count:
   - exact: `X / Y selected`;
   - range: `X selected · choose min–max`.
8. Validate additionally fails closed if selected IDs are duplicate/stale/unrendered. Never trim/replace extra IDs.
9. One card address renders one tile. One projected choice toggles directly. Multiple projected choices open one keyboard-reachable menu; every opaque ID remains independently answerable.
10. Source labels use full text. Dynamic order: Hand, Extra Deck, Graveyard, Banished, Deck. Four-zone fixture retains exact approved sentence.
11. Alphabetical mode never mutates source/domain order; original index breaks equal names; selected stable IDs survive sorting. Hidden identity disables sorting.
12. State colors: legal green, selected/normal hover orange, unavailable red. Red overrides hover/focus. Color supplements native disabled/pressed/count text.
13. Sum/order/counter allocation families stay on existing prompt surfaces. This ADR covers off-field card-selection min/max prompts only.
14. Every rendered element obeys unique `data-cy`; target controls use native button/disabled/`aria-pressed`; mixed badges expose full accessible names.

## Consequences

- ADR-017 dismissal matrix splits browse list vs target list.
- ADR-009 immediate-single policy gets target-list carveout; mounted-field exact-single behavior stays.
- `OffFieldTargetEntry.choices` remains grouped by address; no legal choice dropped.
- Details is local preview action, never fake `InteractionChoice`.
- Chromium owns measured geometry/color/transform/keyboard acceptance; Vitest owns ordering/state/callback/privacy.
- Deterministic acceptance-only scenarios required; production app gains no fixture/query backdoor.

## Rejected

- One tile per `ChoiceId` → duplicates physical card, violates one-copy rule.
- First choice only → drops legal answers.
- Route ranges/Hand/duplicates away → loses current capability.
- Modal backdrop → blocks mixed field/off-field prompts.
- Outside/Escape target cancel → silently loses live engine decision.
- Alphabetize hidden names → leaks identity.
