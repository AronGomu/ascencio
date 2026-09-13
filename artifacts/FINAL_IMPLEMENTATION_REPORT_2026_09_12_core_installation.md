# CORE Installation — Final Implementation Report

Status: **blocked**

Plan: `PLAN_2026_09_12_core_installation`

## Ticket State List

| Ticket | State | Evidence / next dependency |
| --- | --- | --- |
| T1 — source readiness | COMPLETE | Worker `7621123`; merge `7f78229`; 193 ticket tests; parent 86 focused tests. |
| T2 — asset-free CORE boot | COMPLETE | Worker `4760c7f`; merge `c31588f`; 68 unit + 5 component + 4 Chromium tests; parent 73 focused tests + typecheck. |
| T3 — chapter packs | COMPLETE | Worker `4204cdc`; merge `ad5fecc`; fourth independent review approved; parent 73 Node + 14 Vitest tests + typecheck. Verified pack index `03571be5…08d0`. |
| T4 — verified installer | COMPLETE | Worker `6a52909`; merged on integration branch; final independent review approved; 42 unit + 3 component + 12 Chromium tests; full suite 3,633 tests. |
| T5 — installed union | COMPLETE | Worker `dd8dbaf`; independently approved after invalidation-race review; parent 68 focused tests passed. |
| T6 — installed Free Play | COMPLETE | Worker/parent commit `ae258cd`; three-stage independent review approved; 12 source Chromium + built root/subpath duels; parent 63 focused tests. |
| T7 — installed Story/saves | BLOCKED | Uncommitted reviewed candidate in `.tmp/worktrees/core-install-t7`; 136 focused tests + exact-current-null Continue pass, but segmented editor readiness remains at `Loading local decks…` beyond 360s after five bounded Chromium repair loops. |
| T8 — lifecycle | BLOCKED | Depends on complete T7. |
| T9 — offline shell | COMPLETE | Worker `7e59b96`; independently approved; 20 unit + 8 Chromium tests; root/subpath full executable JS precache and cold-update behavior verified. |
| T10 — acceptance | BLOCKED | Depends on complete T8 + T9. |

## Delivered

| Area | Result | Source |
| --- | --- | --- |
| Source normalization | 75 sets; 1,627 cards; approved alias/exclusions enforced; raw source unchanged | `scripts/lib/chapter-source-policy.ts`; `artifacts/CORE_ACCEPTANCE/T1/validation.json` |
| CORE boot | Source-only menu/settings/installer shell; gameplay gated before domain startup | `src/shell/core/core-gate.ts`; `src/shell/screens/InstallContentScreen.svelte` |
| Chapter packs | Schema-2 real gameplay/story/media producer and verifier; 1,627 full + cropped images | `scripts/lib/asset-delivery/chapter-gameplay.ts`; `scripts/lib/asset-delivery/verify-chapter-gameplay.ts` |
| Set media | 56 verified set images; 19 evidence-backed nullable images; text-only UI fallback | `content/authoring/chapter-one-set-media.json`; `src/story/shop/ShopBrowseScreen.svelte` |
| Browser delivery | Served index bytes verified with browser `crypto.subtle.digest` | `e2e-core/chapter-content-delivery.spec.ts`; `artifacts/CORE_ACCEPTANCE/T3/` |
| Verified installer | 468,243,718-byte real install; generation-1 atomic activation; exact runtime receipt; zero Workers | `src/content/create-content-installer.ts`; `src/battle/storage/installed-runtime-receipt.ts`; `artifacts/CORE_ACCEPTANCE/T4/README.md` |
| Offline shell | Complete executable JS precache; payload exclusion; visible install failure; cold activation after old clients close | `src/service-worker.ts`; `src/shell/pwa/register-service-worker.ts`; `artifacts/CORE_ACCEPTANCE/T9/README.md` |
| Installed union | Deterministic chapter-only cards/sets/decks/opponents; cache-only verified media leases; invalidation-safe memo/cache races | `src/content/load-installed-gameplay.ts`; `src/content/acquire-installed-asset.ts`; `src/decks/catalog/installed-gameplay-cards.ts` |
| Installed Free Play | Exact refs reach Worker; runtime-support vs deck-permission separation; both-seat validation; built-app real duel terminal result | `src/battle/worker/create-browser-runtime.ts`; `src/battle/worker/decks/resolve-duel-decks.ts`; `artifacts/CORE_ACCEPTANCE/T6/REPORT.md` |

## Assumptions

### A1 — Nullable set art approved

Owner approved `ChapterSet.image: ChapterFileRef | null` only when pinned authoritative provider evidence proves no image exists. All 75 sets remain. UI uses text-only fallback. Placeholder art forbidden.

### A2 — Private-only scope remains

No public release, remote publish, vendor update, or redistribution-rights claim performed.

### A3 — Exact-source policy remains

Raw card-set source and frozen vendor remain unchanged. Generated chapter payloads derive from normalized/pinned sources.

## User TODO

- [ ] Authorize one new T7 performance-repair cycle with this exact scope: request-scoped manifest memoization plus bounded four-worker media acquisition/abort cleanup, then one segmented Chromium acceptance run. Validation: editor leaves `Loading local decks…`; exact Continue, autosave/navigation, editor readiness, duel/checkpoint all pass without weakening SHA/cache verification.

## Residual Risks

- Public release still requires license, host, and device evidence.
- Graph refresh failed with Gemini API `429 RESOURCE_EXHAUSTED`; existing graph was preserved instead of replacing it with partial output.
- Untouched `e2e/asset-root-urls.spec.ts` retains a pre-existing Prettier warning.
- Integration-worktree typecheck exposes pre-existing TS6 `ReadonlySet` method errors in `src/battle/app/presentation/immutable-choice-id-set.ts`; T5 changed no affected file.
- `StoryMenuEntry` timed out twice during T4 full runs; isolated and full bounded reruns passed; cause remains unresolved.
- T7 editor eagerly loads 1,683 images. Current path causes about 5,049 manifest reads/hash/parse passes, about 3.65 GB metadata hashing, before deck repository/controller readiness; `src/content/load-installed-images.ts` plus `src/content/acquire-installed-asset.ts` are the bounded repair targets.
- T7 shell bundle has 39-byte headroom: 114,961/115,000. No budget raise approved.
- T7 uncommitted worktree preserves schema-5 binding, per-slot failure isolation, pinned-reader coherence, exact Continue evidence, and failed browser traces. No partial T7 commit merged.
- Root `main` worktree gained unrelated concurrent edits during T4, including deletion of `docs/GLOSSARY.md`; integration continues in isolated `integrate/core-install` without touching those files.
- `TEST-LOADING-ASSETS.md`, `feedback.md`, CORE spec, and grill records remain preserved.

## Git State

T1–T6 and T9 merged on isolated `integrate/core-install`; ticket branches are pushed. Remote `main` is updated only by fast-forward from this integration branch. Root worktree's unrelated dirty files remain untouched. No history rewrite, force-push, system apply, deployment, or publication performed.
