# Grill: Two Prototype Scope

## Round 1 — Scope authority

| # | Question | Answer | Precision |
| --- | --- | --- | --- |
| 1 | Which prototype scope should implementation plan cover? | Full-height duel field + approved card-list dialog | — |

## Facts (scout)

- Two distinct current feature prototypes exist: full-height duel field + card-list dialog — sources: `ai-artifacts/PROTO_2026_08_12_full_height_field.html`, `ai-artifacts/PROTOTYPE_card-list-dialog.html`.
- Card-list feature itself has 2 HTML variants: working evaluator + fixed approved state — sources: `ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md`, `docs/feature/PROTOTYPE_card-list-dialog.html`.
- Full-height prototype is validated, ready to implement; prod still uses fixed `1280×720` geometry + `DuelHeaderBar` — sources: `ai-artifacts/DESIGN_2026_08_13_full_height_duel_field.md`, `src/field/duel-field-layout.ts`, `src/app/App.svelte`.
- Card-list prod impl exists but predates approved redesign — sources: `src/app/components/duel-field/ZoneListDialog.svelte`, `ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md`.
- `.pi/artifacts/*prototype*.html` files are untracked local mirrors, not authority — source: `git status --short`.
- Approved card-list spec has no unresolved variable — source: `ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md:121`.
- Full-height design leaves exactly 3 product choices open — source: `ai-artifacts/DESIGN_2026_08_13_full_height_duel_field.md:505-509`.
- Existing ADR-013 persists deck pair + window positions only; setting persistence needs explicit supersession/schema change — source: `docs/ADR/013_ADR_browser_persisted_ui_state.md`.
- Graph BFS confirms current fixed geometry seams (`DUEL_FIELD_WIDTH`, `DUEL_FIELD_HEIGHT`, `FieldZoneKind`, `fieldZoneId`) in `src/field/duel-field-layout.ts`; prototype decision detail comes from source docs, not graph labels.

## Round 2 — Field edge policy

| # | Question | Answer | Precision |
| --- | --- | --- | --- |
| 1 | How should no-EMZ field behave at 1366×768? | Accept 95.7% board height | — |
| 2 | Which scrollbar should card preview use? | Custom overlay scrollbar matching hand | — |
| 3 | Should zone-outline + zone-count toggles persist across reloads? | Persist both toggles with `PersistedUiState` v2 | — |

## Provisional understanding after Round 2

- Goal: Write implementation-ready plan `PLAN_2026_08_13_feedback_follow_up` covering full-height duel-field prototype plus approved card-list dialog redesign. Each ticket = commit-sized TDD slice; app compiles after each ticket. Do not implement.
- Settled: Full-height field accepts 95.7% board height at 1366×768 no-EMZ; no preview/rail compression solely to reach 100%.
- Settled: Card preview uses custom vertical overlay scrollbar matching hand scrollbar while retaining required scrolling + stable 10px gutter.
- Settled: `showZoneOutlines` + `showZoneCounts` persist across reloads via `PersistedUiState` v2. Plan must supersede ADR-013, define v1/default handling, test malformed storage + migration behavior.
- Settled: Approved card-list prototype/spec is acceptance authority. Working + fixed HTML variants represent one feature; no card-list design variable reopens.
- Settled: Production card-list stays Svelte DOM, Worker-projected legality, existing typed callbacks, field-local `FloatingFieldWindow` positioning/clamping per ADR-017.
- Assumptions: User text `PLAN_2026_08_13_feedback_follow_up` sets plan basename/title slug `feedback_follow_up`.
- Assumptions: Existing prototype decisions not explicitly superseded above remain binding.
- Out of scope: Worker/WASM legality redesign, engine response encoding, card-preview content redesign beyond field prototype scroll/layout needs, story/deck/progression/multiplayer work, implementation/commit/push.

## Round 3 — Prompt compatibility

| # | Question | Answer | Precision |
| --- | --- | --- | --- |
| 1 | How should redesigned card list handle variable-count target prompts? | Support ranges in redesigned dialog | — |
| 2 | How should mixed notice + badges handle Hand entries? | Use dynamic full source names including Hand | — |
| 3 | How should one tile expose multiple legal `ChoiceId`s for one card address? | One tile with projected choice menu | — |

## Shared understanding

- Goal: Write implementation-ready plan `PLAN_2026_08_13_feedback_follow_up` covering full-height duel-field prototype + approved card-list dialog redesign. One self-contained file per commit-sized TDD ticket. App compiles after every ticket. Do not implement.
- Field: viewport-derived px geometry; 5px zone gaps; square footprints; rotated Defense/Set cards; full-height shell; right rail replaces header; all stable ids/a11y/Worker authority remain.
- Small viewport: accept 95.7% board height at 1366×768 no-EMZ. Preserve preview ≥18rem + rail ≥12rem instead of forcing 100%.
- Scroll: hand uses horizontal custom overlay scrollbar; preview uses vertical custom overlay scrollbar. Real overflow containers retain wheel/keyboard semantics; custom thumbs mirror scroll + allow pointer drag. Preview reserves stable 10px text gutter.
- Settings: `showZoneOutlines` + `showZoneCounts` default on, persist under `PersistedUiState` v2. Use `ygo.ui.v2`; valid v2 leaves validate independently; old v1/wrong version → complete v2 defaults. Other current settings remain session-only.
- Card-list authority: `ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md` + approved fixed prototype own frozen visuals/interactions, subject to Worker/privacy/a11y + field-local `FloatingFieldWindow` bounds.
- Card-list counts: exact modes keep exact counters/Validate behavior. Variable ranges stay in redesigned dialog; show selected count + min–max requirement, lock at max, enable Validate iff existing validator + rendered-choice invariant pass.
- Card-list sources: dynamic full source labels include Hand. Use fixed source order: Hand, Extra Deck, Graveyard, Banished, Deck. Exact four-zone fixture retains approved sentence.
- Duplicate choices: one physical tile per card address. One choice → tile toggles it. Several choices → tile opens keyboard-reachable projected choice menu; all opaque `ChoiceId`s remain answerable; no fake legality.
- Card-list dismissal: browse has `×`, Cancel, outside/Escape dismissal. Target has no `×`; outside/Escape preserve window + draft; Cancel only when engine says cancelable; collapse is visual-only + not persisted.
- Architecture: add successor ADRs for full-height shell/geometry, persisted UI v2, card-list modes. Supersede conflicting ADR-003/013; amend ADR-006/009/010/017/018 narrowly; update canonical field/storage/card-list docs + HTML.
- Testing: deterministic test-only browser scenarios required for exact geometry/state. Chromium owns measured acceptance; Vitest owns pure/state/component behavior.
- Assumptions: `PLAN_2026_08_13_feedback_follow_up` is requested plan basename. Prototype files stay evidence; `.pi/artifacts` mirrors stay untracked/non-authoritative.
- Out of scope: Worker/WASM rule changes, engine encoding, new card metadata/profile system, story/deck/progression/multiplayer, implementation, commit, push.
- Confirmed by user: yes.
