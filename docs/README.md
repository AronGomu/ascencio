# Documentation

This directory contains current project documentation and historical context. Root [`AGENT.md`](../AGENT.md) is the fast entry point for AI and contributors.

## Current sources of truth

| Document                                                                                               | Purpose                                                              |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [`architecture/architecture.md`](architecture/architecture.md)                                         | Canonical architecture index, invariants, and task-based routing     |
| [`GLOSSARY.md`](GLOSSARY.md)                                                                           | Shared user/agent vocabulary for naming parts of the codebase        |
| [`DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md`](DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md)                       | Completed TDD ticket ledger for semantic DOM-field migration         |
| [`ADR/001_ADR_semantic_dom_duel_field_rendering.md`](ADR/001_ADR_semantic_dom_duel_field_rendering.md) | Accepted renderer ADR                                                |
| [`ADR/002_ADR_universal_data_cy_selector_contract.md`](ADR/002_ADR_universal_data_cy_selector_contract.md) | Accepted `data-cy` selector contract for every rendered element  |
| [`ADR/019_ADR_full_height_duel_shell_and_pixel_geometry.md`](ADR/019_ADR_full_height_duel_shell_and_pixel_geometry.md) | Accepted full-height shell, px geometry, rail, hands, phase and preview-scroll invariants |
| [`ADR/004_ADR_prompt_surfaces_after_selection_dock.md`](ADR/004_ADR_prompt_surfaces_after_selection_dock.md) | Accepted prompt-surface routing after the selection dock is removed |
| [`ADR/005_ADR_optimistic_drag_placement.md`](ADR/005_ADR_optimistic_drag_placement.md)                 | Accepted optimistic drag placement with engine reconciliation        |
| [`ADR/006_ADR_preview_panel_replaces_card_inspector.md`](ADR/006_ADR_preview_panel_replaces_card_inspector.md) | Accepted preview panel replacing the modal card inspector    |
| [`ADR/007_ADR_stack_zones_as_interaction_targets.md`](ADR/007_ADR_stack_zones_as_interaction_targets.md) | Accepted deck/extra/graveyard/banished piles as field interaction targets |
| [`ADR/008_ADR_projected_deck_order_and_reveals.md`](ADR/008_ADR_projected_deck_order_and_reveals.md)   | Accepted projected deck order with offset-based reveal tracking      |
| [`ADR/009_ADR_automatic_prompt_resolution.md`](ADR/009_ADR_automatic_prompt_resolution.md)             | Accepted automatic placement and automatic answering of non-decisions |
| [`ADR/010_ADR_in_field_phase_navigation.md`](ADR/010_ADR_in_field_phase_navigation.md)                 | Accepted in-field phase strip replacing the corner status pills      |
| [`ADR/011_ADR_deck_registry_and_derived_card_pool.md`](ADR/011_ADR_deck_registry_and_derived_card_pool.md) | Accepted bundled deck registry and derived reviewed pool |
| [`ADR/012_ADR_pre_duel_deck_selection.md`](ADR/012_ADR_pre_duel_deck_selection.md)                     | Accepted pre-duel pair selection and replacement lifecycle |
| [`ADR/020_ADR_browser_persisted_ui_state_v2.md`](ADR/020_ADR_browser_persisted_ui_state_v2.md)         | Accepted v2 deck/window plus field-display preference persistence |
| [`ADR/014_ADR_public_knowledge_for_face_down_cards.md`](ADR/014_ADR_public_knowledge_for_face_down_cards.md) | Accepted conservative face-down public-knowledge tracking |
| [`ADR/015_ADR_halo_semantics_legal_versus_selected.md`](ADR/015_ADR_halo_semantics_legal_versus_selected.md) | Accepted legal/selected/focus/feedback visual semantics |
| [`ADR/016_ADR_dependency_free_drag_physics.md`](ADR/016_ADR_dependency_free_drag_physics.md)           | Accepted dependency-free drag ghost physics |
| [`ADR/017_ADR_floating_field_windows_and_dismissal.md`](ADR/017_ADR_floating_field_windows_and_dismissal.md) | Accepted field-window bounds, persistence, and dismissal |
| [`ADR/018_ADR_conditional_extra_monster_zones.md`](ADR/018_ADR_conditional_extra_monster_zones.md)     | Accepted Worker-owned MR3/MR5 conditional EMZ profile |
| [`ADR/021_ADR_card_list_dialog_modes_and_selection.md`](ADR/021_ADR_card_list_dialog_modes_and_selection.md) | Accepted browse/target/range/duplicate-choice card-list contract |
| [`ADR/022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md`](ADR/022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md) | Accepted single-app topology and parallel UI ownership |
| [`duel-field-architecture.html`](duel-field-architecture.html)                                         | Styled full-height field architecture design |
| [`card-list-dialog-architecture.html`](card-list-dialog-architecture.html)                             | Styled card-list modes, data flow, state and acceptance design |
| [`duel-field-interaction-shell.html`](duel-field-interaction-shell.html)                               | Styled interaction-shell design: surfaces, routing, drag, settings   |
| [`duel-field-interaction-model-v2.html`](duel-field-interaction-model-v2.html)                         | Styled round-2 interaction baseline |
| [`duel-field-interaction-model-v3.html`](duel-field-interaction-model-v3.html)                         | Styled round-3 interaction model: knowledge, semantics, motion, windows, target routing |
| [`deck-selection-architecture.html`](deck-selection-architecture.html)                                 | Styled registry-to-picker-to-Worker deck-selection architecture |
| [`../ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`](../ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md) | Completed TDD ticket ledger for the duel-field UX overhaul |
| [`../ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`](../ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md) | Round-2 TDD ticket ledger |
| [`../ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`](../ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md) | Completed round-3 implementation ledger |
| [`../ai_artefacts/PLAN_2026_08_13_feedback_follow_up.html`](../ai_artefacts/PLAN_2026_08_13_feedback_follow_up.html) | Completed full-height field + approved card-list implementation plan |
| [`duel-field-validation-references.html`](duel-field-validation-references.html)                       | Styled rule/visual/a11y validation catalog                           |
| [`MVP_TECHNICAL_IMPLEMENTATION_PLAN.md`](MVP_TECHNICAL_IMPLEMENTATION_PLAN.md)                         | Completed MVP/Phaser baseline audit plan                             |
| [`assets/asset-import-pipeline.md`](assets/asset-import-pipeline.md)                                   | Implemented asset acquisition, generation, and verification pipeline |

## Architecture navigation

Architecture decisions are split into narrowly scoped files under [`architecture/`](architecture/). Start at [`architecture/architecture.md`](architecture/architecture.md); its decision map points to the minimum context needed for a task.

```text
ADR/                          # Numbered architecture decision records
architecture/
├── architecture.md          # Canonical map and cross-cutting invariants
├── 01-product/              # Scope and technology choices
├── 02-runtime/              # Platform, topology, Worker contract, duel lifecycle
├── 03-engine/               # OcgCore adapter, protocol/state, opponent
├── 04-data/                 # Snapshots, cards/scripts, images, storage
├── 05-presentation/         # DOM field ADR, detailed architecture, validation references
├── 06-quality/              # Testing and diagnostics
└── 07-governance/           # Security, licensing, future extensions
```

## Approved future architecture handoff

[`card-game-vn-handoff/`](card-game-vn-handoff/) defines the approved post-MVP visual-novel campaign target and phased implementation plan. It preserves the completed duel architecture but is not evidence that story, map, save, deck-library, content-pack, or PWA work is implemented. Current runtime behavior remains governed by [`architecture/`](architecture/) until each handoff phase lands and updates its owning canonical decision.

Start with [`card-game-vn-handoff/00-index.md`](card-game-vn-handoff/00-index.md), then use [`card-game-vn-handoff/08-phased-implementation-plan.md`](card-game-vn-handoff/08-phased-implementation-plan.md) for implementation order.

## Agent artifact roots

- [`../ai-artifacts/`](../ai-artifacts/) — existing design/prototype evidence.
- [`../ai_artefacts/`](../ai_artefacts/) — implementation-plan indexes, self-contained tickets, rendered plan HTML (caller-required spelling).

## Historical material

[`archive/`](archive/) contains superseded research and rejected directions. Use it for rationale/history only; it cannot override current architecture or current implementation plans.

Superseded records retained at stable paths for old plan links:

- [`ADR/003_ADR_field_first_application_chrome.md`](ADR/003_ADR_field_first_application_chrome.md) → superseded by ADR-019.
- [`ADR/013_ADR_browser_persisted_ui_state.md`](ADR/013_ADR_browser_persisted_ui_state.md) → superseded by ADR-020.
- [`duel-field-interaction-shell.html`](duel-field-interaction-shell.html), [`duel-field-interaction-model-v2.html`](duel-field-interaction-model-v2.html), [`duel-field-interaction-model-v3.html`](duel-field-interaction-model-v3.html) → historical interaction generations; ADR-019/021 + current architecture HTML override them.
