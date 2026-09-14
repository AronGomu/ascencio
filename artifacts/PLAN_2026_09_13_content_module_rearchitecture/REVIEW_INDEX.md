# INDEX decomposition red-team

Status: **blocked pending index amendments**. Scope: INDEX decomposition only; ticket-body absence intentionally ignored.

## Review

- R1 Correct: plan keeps progressive producer → storage → semantic consumers → activation → UX/acceptance spine. `artifacts/PLAN_2026_09_13_content_module_rearchitecture.md:9-21`.
- R2 Correct: COW Story save generation + sole Shell selector rejects fictitious cross-IDB tx. `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:8,29`; separate DB ownership proves need at `docs/ADR/026_ADR_domain_storage_ownership.md:16-31`.
- R3 Fixed: none. Review-only; source/index untouched. This report only output.
- R4 Blocker: T6 consumes Story/Battle validators before T7/T8 create consumer-owned ports/validation. Current edges `T6 → T7` / `T6 → T8` invert contract flow. `artifacts/PLAN_2026_09_13_content_module_rearchitecture.md:13-19`; ownership requires consumer validator → Shell composition at `artifacts/CONTENT_AND_MODULE_REARCHITECTURE_HANDOFF_2026-09-13.md:117-126,158-160`.
- R5 Note: root boundary test passed 12/12, but root is old `25d761f`; target-main `0104019` already has direct Content imports across Battle/Deck Editor/Decks/Story plus Content→Decks imports. Evidence: `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:35,48-52`; direct target scan found `src/battle/BattleFacade.svelte:10`, `src/deck-editor/DeckEditorApp.svelte:8`, `src/decks/catalog/installed-gameplay-cards.ts:1`, `src/story/StoryApp.svelte:8`, `src/content/install/verify-gameplay.ts:1-5` in `.tmp/worktrees/core-integrate`.

## Findings

- F1 **blocker — dependency order:** T6 cannot compose not-yet-owned Story/Battle semantics. Apply E1-E4 before ticket writing. Evidence R4.
- F2 **high — baseline/preflight:** current root remains 15 commits behind with many unrelated dirty files; T7 remains heavily dirty. T1 must stop before mutation until human-owned dirty-work disposition yields authorized implementation cwd. Do not re-ask already locked main/selective-salvage choice. `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:13,31,48`; `artifacts/CONTENT_AND_MODULE_REARCHITECTURE_HANDOFF_2026-09-13.md:170-176`.
- F3 **high — dual authority risk:** T5 wording permits Content to retain active pointer before T9. Existing `commitInstall` writes Content `active` row at `.tmp/worktrees/core-install-t7/src/content/storage/content-database.ts:62-104`. T5 must stage only; T9 commits sole Shell selector after sealed Story COW generation. Otherwise two authorities can disagree.
- F4 **high — live-publication scope leak:** T4 says “publishes” without fake-R2 bound. Acceptance excludes remote public deployment. `artifacts/PLAN_2026_09_13_content_module_rearchitecture.md:31`; `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:22-23,49`. Existing publisher absent per `scout-content-contracts.md:F5`.
- F5 **medium — late enforcement:** T11 cannot own first enforcement of boundaries/privacy/selector invariants. Target-main already violates target Content direction, while current root test only proves old baseline. Each slice must add its boundary/behavior gate; T11 stays aggregate Chromium regression. `tests/unit/domain-boundaries.test.ts:104-120`; `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:35,48`.

## Critical edge amendments

- E1 Remove `T6 → T7` and `T6 → T8`.
- E2 Add `T5 → T7`; retain `T3 → T7`. T7 then owns Story port, Story validator, COW save-generation prep.
- E3 Add `T2 → T8` and `T5 → T8`. T8 then owns Battle validator plus clone-safe Worker input.
- E4 Add `T7 → T6` and `T8 → T6`; replace direct `T7/T8 → T9` with `T6 → T9`. T6 composes completed Cards/Decks/Story/Battle validators; T9 activates.
- E5 Add scheduler constraint beside Mermaid: dependency fanout permits advisory parallelism only; one cwd = one writer. Default main execution serial. Isolated clean authorized worktrees only exception. Do not invent product deps solely to serialize writers. `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:31`.

## Per-ticket disposition — T1–T6

| ID | Verdict | Reason / exact goal amendment |
| --- | --- | --- |
| T1 | **BLOCKED** | Keep first. Goal → “Human preflight records safe disposition of unrelated dirty root/T7 work, verifies `origin/main` target, creates file-level T7 salvage inventory, establishes authorized clean implementation cwd; no source/Git mutation before gate.” R2 account/domain/rights/creds remain deployment-only pending facts, not local acceptance blockers (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:22-23`; `docs/assets/asset-delivery-setup.md:12-28`). |
| T2 | **KEEP** | Cohesive first vertical user slice: canonical Cards + focused Decks APIs + Deck Editor. Ticket must also remove target-main Decks/Deck Editor Content imports and land Cards/Decks import/API tests now, not T11. Ownership evidence: `artifacts/CONTENT_AND_MODULE_REARCHITECTURE_HANDOFF_2026-09-13.md:114-120`; current API sources listed in `artifacts/GRILL_2026_09_13_content_module_rearchitecture/scout-domain-contracts.md:E1-E4`. |
| T3 | **AMEND** | Goal → “Shared preview/scrollbar accept complete VMs; host containers own image leases; generic scrollbar geometry leaves Battle; Deck Select receives frame/color VM and imports no sibling.” Moving files alone fails because preview leases by code at `src/shell/card-preview/CardPreviewPanel.svelte:11-16,25-52`; scrollbar/Deck Select hazards: `artifacts/GRILL_2026_09_13_content_module_rearchitecture/scout-domain-contracts.md:E5,G5`. |
| T4 | **AMEND** | Goal → “Build deterministic immutable per-file objects, full manifest, latest pointer; prove files→manifest→pointer order against local fake R2 only.” No live upload/deploy acceptance. Reuse digest-bearing `playerPayload`; no ZIP bridge. `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:22-23,49`; `artifacts/GRILL_2026_09_13_content_module_rearchitecture/scout-content-contracts.md:K1,C3-C4`. |
| T5 | **AMEND** | Goal → “Explicitly resume missing required-file jobs; verify immutable staged release; preserve installed offline pair on network/catalog failure; write no active application selector.” Optional media excluded from required job. This closes F3. |
| T6 | **BLOCKED** | Keep goal, reorder after T7/T8 via E1-E4. Goal → “Shell invokes completed domain validators over staged semantic inputs; Content retains path/byte/hash mechanics only; successful prep emits selector-ready candidate, never activates.” Existing semantic YGO rules in Content: `.tmp/worktrees/core-install-t7/src/content/install/verify-gameplay.ts:1-5,125-176`. |

## Per-ticket disposition — T7–T11

| ID | Verdict | Reason / exact goal amendment |
| --- | --- | --- |
| T7 | **AMEND** | Goal → “Story consumes semantic ports; migrate every supported slot into sealed COW generation without changing active generation; retain incompatible bytes visibly; salvage only T7-unique Story/save work.” Five slots exist at `.tmp/worktrees/core-install-t7/src/story/saves/story-save-contracts.ts:25-37`; old schemas currently reject at `:142-160`. |
| T8 | **AMEND** | Goal → “Battle owns semantic validation; Shell adapter supplies clone-safe runtime DTO; Worker alone initializes frozen engine; no Content paths/refs/receipts cross Battle contracts.” Target-main coupling is broad (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:48,52`; `artifacts/GRILL_2026_09_13_content_module_rearchitecture/scout-domain-contracts.md:J1,F4-F5`). Add real-WASM gate in-ticket. |
| T9 | **AMEND** | Goal already selects correct mechanism. Add: “Under cross-tab Main-Menu exclusivity, atomically CAS sole Shell selector to matching verified content + sealed Story generation; failure leaves prior selector authoritative.” No Content-active + Shell-active dual pointer. Crash points belong this ticket, not T11. |
| T10 | **AMEND** | Goal → “Main Menu exposes separate explicit content, optional-media, CORE-approval, cleanup actions; all reject active domain tab; no hidden network/cleanup.” CORE candidate needs explicit compatible approval, old worker retained until approved cold close/reopen; first install exempt. `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:14-15,51`; cleanup preservation: `artifacts/CONTENT_AND_MODULE_REARCHITECTURE_HANDOFF_2026-09-13.md:94-102`. |
| T11 | **AMEND** | Keep aggregate acceptance, not deferred implementation. Goal → “Run final machine boundary/privacy/selector gates plus Chromium offline/install/update/eviction/multitab/crash regression; consume predecessor tests; use local fake R2; no live public deployment.” `artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:9,22-23`. |

No KILL/MERGE recommendation. Eleven tickets remain bounded once T6 reordered and goals narrowed.

## Decision ownership

- D1 **User-owned, settled:** main target/selective T7 salvage; explicit media; Main-Menu cross-tab block; no deployed ZIP bridge. `artifacts/GRILL_2026_09_13_content_module_rearchitecture/ANSWERS.md:11-14`.
- D2 **User-owned, deployment-only:** R2 account/domain/origins/rights/budget/credentials. Record pending; never block local fake-R2 implementation or copy secrets. `docs/ADR/082_ADR_r2_nightly_and_immutable_asset_releases.md:18,30,34`; `docs/assets/asset-delivery-setup.md:12-28`.
- D3 **User-owned now:** disposition/access for unrelated dirty working copies before T1 Git mutation. Exact file salvage remains evidence-driven impl work, not blanket owner choice.
- D4 **Implementation choice, no user question:** full SHA-256, COW generation schema, selector record shape/location, lock/API names, compatibility serialization. `CONTEXT.md:27-31`; parent specs contracts.

## Assumptions

- A1 Ticket bodies intentionally absent; review judges index decomposition only.
- A2 `.tmp/worktrees/core-integrate` remained clean `010401956d` target-main snapshot during inspection; dirty T7 remains mutable. Recheck paths before implementation.

## Residual risks

- X1 Exact save-generation/selector contracts still unwritten; P3 must freeze predecessor outputs before coherence review.
- X2 PWA candidate approval/compat handshake remains proposed, not existing behavior. `CONTEXT.md:51`.
- X3 50k full-manifest parse/memory budget remains unmeasured; runtime closure caps must stay separate. `CONTEXT.md:49`; `scout-content-contracts.md:R3`.
- X4 Generated assets/full suite/browser evidence not run; focused old-root boundary pass proves only current root.
- X5 Output artifact is sole write; repository source/index/Git unchanged.

## Next action

- N1 Parent applies E1-E5 plus ticket goal amendments before writing bodies; T1 implementation remains blocked at dirty-work human preflight.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1-F5 give blocker/high/medium findings with exact plan/source paths; ticket tables disposition T1-T11; X1-X5 record residual risks."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/c1e4340c-8609-4eb9-bd6c-d759081994a5/artifacts/PLAN_2026_09_13_content_module_rearchitecture/REVIEW_INDEX.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"content module rearchitecture plan ticket dependency order Story COW save generations Shell selector\"",
      "result": "passed",
      "summary": "Graph query completed; output truncated; skill/package mismatch warning noted."
    },
    {
      "command": "npx vitest run tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "Old root baseline: 1 file, 12 tests passed."
    },
    {
      "command": "git status --short --branch; git worktree list; git rev-parse HEAD origin/main",
      "result": "passed",
      "summary": "Root dirty and 15 behind; HEAD 25d761f; origin/main and integration 0104019."
    },
    {
      "command": "git -C .tmp/worktrees/core-integrate grep <Content dependency patterns>",
      "result": "passed",
      "summary": "Confirmed target-main direct domain→Content imports and Content→Decks exception."
    },
    {
      "command": "two exploratory git grep shell commands",
      "result": "failed",
      "summary": "Quoted shell failed with exact error: `/etc/profiles/per-user/aron/bin/bash: -c: line 1: unexpected EOF while looking for matching `\"'`; corrected target scan then passed."
    }
  ],
  "validationOutput": [
    "V1: `tests/unit/domain-boundaries.test.ts`: 12/12 passed on old root only.",
    "V2: target-main scan found 21 representative domain→Content imports plus Content→Decks exception.",
    "V3: output target was absent before write; staged-file query returned empty output."
  ],
  "residualRisks": [
    "X1: exact selector/save-generation contracts remain unwritten.",
    "X2: PWA approval handshake remains proposed.",
    "X3: 50k manifest budget remains unmeasured.",
    "X4: generated-asset/full-browser suites not run."
  ],
  "noStagedFiles": true,
  "diffSummary": "Read-only INDEX review; wrote required review artifact only. No plan/source/Git mutation.",
  "reviewFindings": [
    "F1 blocker: artifacts/PLAN_2026_09_13_content_module_rearchitecture.md:13-19 - T6 dependency direction is inverted.",
    "F2 high: artifacts/PLAN_2026_09_13_content_module_rearchitecture/CONTEXT.md:13,31 - dirty baseline requires first-ticket human preflight.",
    "F3 high: .tmp/worktrees/core-install-t7/src/content/storage/content-database.ts:62-104 - existing Content active pointer risks dual authority with Shell selector.",
    "F4 high: artifacts/PLAN_2026_09_13_content_module_rearchitecture.md:31 - publisher goal lacks local-fake-only acceptance bound.",
    "F5 medium: tests/unit/domain-boundaries.test.ts:104-120 - final-only boundary enforcement would permit intermediate architecture drift."
  ],
  "manualNotes": "Scouts completed mid-run and were incorporated. Ticket-body absence was not treated as defect."
}
```
