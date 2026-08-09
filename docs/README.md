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
| [`ADR/003_ADR_field_first_application_chrome.md`](ADR/003_ADR_field_first_application_chrome.md)       | Accepted removal of the panel stack in favour of field-first chrome  |
| [`ADR/004_ADR_prompt_surfaces_after_selection_dock.md`](ADR/004_ADR_prompt_surfaces_after_selection_dock.md) | Accepted prompt-surface routing after the selection dock is removed |
| [`ADR/005_ADR_optimistic_drag_placement.md`](ADR/005_ADR_optimistic_drag_placement.md)                 | Accepted optimistic drag placement with engine reconciliation        |
| [`ADR/006_ADR_preview_panel_replaces_card_inspector.md`](ADR/006_ADR_preview_panel_replaces_card_inspector.md) | Accepted preview panel replacing the modal card inspector    |
| [`ADR/007_ADR_stack_zones_as_interaction_targets.md`](ADR/007_ADR_stack_zones_as_interaction_targets.md) | Accepted deck/extra/graveyard/banished piles as field interaction targets |
| [`ADR/008_ADR_projected_deck_order_and_reveals.md`](ADR/008_ADR_projected_deck_order_and_reveals.md)   | Accepted projected deck order with offset-based reveal tracking      |
| [`ADR/009_ADR_automatic_prompt_resolution.md`](ADR/009_ADR_automatic_prompt_resolution.md)             | Accepted automatic placement and automatic answering of non-decisions |
| [`ADR/010_ADR_in_field_phase_navigation.md`](ADR/010_ADR_in_field_phase_navigation.md)                 | Accepted in-field phase strip replacing the corner status pills      |
| [`duel-field-architecture.html`](duel-field-architecture.html)                                         | Styled field architecture design                                     |
| [`duel-field-interaction-shell.html`](duel-field-interaction-shell.html)                               | Styled interaction-shell design: surfaces, routing, drag, settings   |
| [`duel-field-interaction-model-v2.html`](duel-field-interaction-model-v2.html)                         | Styled round-2 interaction model: stack targets, deck reveals, auto-resolution, overlay geometry |
| [`../ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`](../ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md) | Completed TDD ticket ledger for the duel-field UX overhaul |
| [`../ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`](../ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md) | Active TDD ticket ledger for duel-field feedback round 2 |
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

## Historical material

[`archive/`](archive/) contains superseded research and rejected directions. Use it for rationale/history only; it cannot override current architecture or current implementation plans.
