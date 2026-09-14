# T7: Battle semantic runtime transport

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T2, T5  
**Commit outcome:** Real Worker duel initializes from semantic clone-safe runtime input without Content imports.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: Real Worker duel initializes from semantic clone-safe runtime input without Content imports.

C3. Out of scope here: No engine/loader/vendor updates, AI/rules rewrite, RPC framework, per-domain Content gating, changes to shuffle/random production behavior.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [ ] R1. Public BattleRuntimeSource loads semantic DTO; Shell adapter alone reads Content. Worker command initialize takes runtime, not ContentSetRef/manifest/receipt. Update facade/client/store/parser/runtime/storage/diagnostics together.
- [ ] R2. Preserve frozen engine import/loader/version, real-WASM initialization and synchronous preloaded callbacks. Convert decimal race/string data to engine fields only Worker side; main thread never calls/imports engine adapter runtime.
- [ ] R3. Pure Battle validator owns runtime support/ABI/dependency semantics; both duel seats enforce selected chapter allowed pool distinct from whole support DB. Snapshot identity and exact-source replay preserved.
- [ ] R4. Transfer fresh WASM buffer per load; postMessage clones semantic maps/arrays, no function port/Blob/path/Response. Abort/dispose/restart cannot retain detached buffer or late ready events.
- [ ] R5. Remove Battle Content incoming imports and Content-specific receipt rechecks. IPC shape/engine ABI/pool legality remain defense/engine requirements, not manifest readiness. Existing concealment tests guard Cards/art adapters.

## Inputs

I1. Target-main src/battle/worker/create-browser-runtime.ts:1-170; DuelWorkerRuntime.ts:62-95; duel/contracts/duel-command.ts; app/DuelWorkerClient.ts

I2. src/battle/worker/engine/OcgCoreAdapter.ts:1-45,89-130; assets/active-duel-dependencies.ts:1-65; installed-runtime-dependencies.ts:9-38

I3. tests/integration/installed-runtime-wasm.test.ts; tests/unit/installed-runtime-receipt-validation.test.ts; card-visibility.ts; tests/unit/card-visibility.test.ts

**From Depends:** T2 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T2_cards-deck-editing.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.; T5 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T5_progressive-storage.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** battle.

### Contract `battle`

```ts
// src/battle/ports/battle-runtime-source.ts; public through src/battle/ports/index.ts
import type { CardCode } from "../../cards/index.ts";
export interface BattleRuntimeCard {
  readonly code: CardCode;
  readonly alias: number;
  readonly setcodes: readonly number[];
  readonly type: number;
  readonly level: number;
  readonly attribute: number;
  readonly race: string;
  readonly attack: number;
  readonly defense: number;
  readonly lscale: number;
  readonly rscale: number;
  readonly linkMarker: number;
}
export interface BattleRuntimeInput {
  readonly schemaVersion: 1;
  readonly snapshotId: string;
  readonly coreVersion: readonly [number, number];
  readonly wasmBinary: ArrayBuffer;
  readonly cards: readonly BattleRuntimeCard[];
  readonly texts: readonly { readonly code: CardCode; readonly name: string; readonly description: string; readonly strings: readonly string[] }[];
  readonly scripts: readonly { readonly name: string; readonly source: string }[];
  readonly requiredScripts: Readonly<{ cards: readonly string[]; globals: readonly string[] }>;
  readonly strings: Readonly<{
    system: Readonly<Record<string, string>>;
    victory: Readonly<Record<string, string>>;
    counter: Readonly<Record<string, string>>;
    setname: Readonly<Record<string, string>>;
  }>;
  readonly allowedCardCodes: readonly CardCode[];
  readonly ruleset: Readonly<{ id: string; revision: string; quantityByCode: readonly (readonly [CardCode, 0 | 1 | 2 | 3])[] }>;
  readonly revisions: Readonly<{ babelCdb: string; cardScripts: string }>;
}
export interface BattleRuntimeSource { load(signal: AbortSignal): Promise<BattleRuntimeInput> }
export interface InitializeRuntimeCommand { readonly type: "initialize"; readonly runtime: BattleRuntimeInput }
export declare function parseBattleRuntimeInput(value: unknown): BattleRuntimeInput;
export declare function validateBattleRuntime(input: BattleRuntimeInput): void;
```

No Content types/paths/receipts; script.name is engine semantic script filename (e.g. c123.lua), not content-store path. Shell adapter loads+decodes whole frozen-compatible runtime support, allowedCardCodes selected chapter union only. wasmBinary transferred once per fresh source.load; source returns fresh ArrayBuffer so replay/restart cannot reuse detached buffer. requiredScripts comes from verified script index plus global inventory for whole runtime support pool, sorted unique names; missing indexed card/global script rejects BATTLE_RUNTIME_INVALID, genuinely unindexed normal card remains valid. Cards/text/scripts cloned; race decimal -> bigint only inside Worker engine adapter, linkMarker -> link_marker there. Parse IPC rejects invalid/oversized/duplicate data before engine initialization; retain existing runtime bounds, pure validateBattleRuntime checks supported pool, dependency/script/globals/string presence, frozen vendor identity/version checks. Main thread never imports OcgCoreAdapter runtime. Worker initializes engine, ABI checks actual getVersion, preloads callbacks synchronously; no Content re-verification. Existing progress channel, error codes snapshot_validation_failed/engine_initialization_failed/dependency_resolution_failed and diagnostics preserved. New input parse failure exact Error("BATTLE_RUNTIME_INVALID"); source required read failure reaches Shell APP_REQUIRED_INPUT_FAILED.

### Consumes — binding predecessor contracts

### Contract `storage`

```ts
// src/content/contracts/progressive-content-store.ts; public through src/content/index.ts
import type { ChapterId, LatestContentPointer, ProgressiveManifest } from "./progressive-release.ts";
export type ContentErrorCode = "CONTENT_INVALID_MANIFEST" | "CONTENT_INTEGRITY_FAILED" | "CONTENT_MISSING" | "CONTENT_NETWORK_FAILED" | "CONTENT_STORAGE_UNAVAILABLE" | "CONTENT_QUOTA_EXCEEDED" | "CONTENT_CANCELLED" | "CONTENT_JOB_CONFLICT";
export interface ContentError extends Error { readonly code: ContentErrorCode }
export interface StagedContent {
  readonly receiptId: string;
  readonly manifestVersion: string;
  readonly releaseSequence: number;
  readonly chapterIds: readonly ChapterId[];
}
export interface DownloadProgress {
  readonly jobId: string;
  readonly phase: "running" | "paused" | "complete" | "failed";
  readonly completedFiles: number;
  readonly totalFiles: number;
  readonly completedBytes: number;
  readonly totalBytes: number;
}
export interface DownloadRequest {
  readonly jobId: string;
  readonly manifestVersion: string;
  readonly chapterIds: readonly ChapterId[];
  readonly kind: "required" | "media";
}
export interface DownloadJob {
  readonly request: DownloadRequest;
  readonly progress: DownloadProgress;
}
export interface ContentReader {
  readManifest(version: string): Promise<ProgressiveManifest>;
  readFile(manifestVersion: string, path: string, signal: AbortSignal): Promise<Uint8Array | null>;
  verifyRequired(content: StagedContent, signal: AbortSignal): Promise<void>;
}
export interface ProgressiveContentStore extends ContentReader {
  fetchLatest(signal: AbortSignal): Promise<LatestContentPointer>;
  cacheManifest(pointer: LatestContentPointer, signal: AbortSignal): Promise<ProgressiveManifest>;
  download(request: DownloadRequest, signal: AbortSignal, onProgress: (value: DownloadProgress) => void): Promise<void>;
  sealRequired(manifestVersion: string, chapterIds: readonly ChapterId[]): Promise<StagedContent>;
  listJobs(): Promise<readonly DownloadJob[]>;
  deleteFilesOutside(manifestVersion: string): Promise<void>;
  deleteAllDownloaded(): Promise<void>;
  close(): void;
}
export declare function openProgressiveContentStore(baseUrl: string | null): Promise<ProgressiveContentStore>;
```

Only Shell application/adapters import Content public API. Content errors have name="ContentError", code/message equal enumerated code; no raw remote text/path logging. Absence readFile returns null, corruption rejects CONTENT_INTEGRITY_FAILED, malformed membership/path rejects CONTENT_INVALID_MANIFEST. listJobs returns immutable normalized requests plus progress, sorted ascending jobId; request stores original manifestVersion, dependency-closed sorted chapterIds and kind, never latest alias. Persisted running job without live download lock is resumable/paused in Shell UI, never automatic network restart or permanent cleanup blocker. Jobs use unique UUID jobId; resumptions require exact manifest/chapters/kind, otherwise CONTENT_JOB_CONFLICT. Concurrency 4 files; interrupted file restarts, complete verified identities reused, no Range assumption. Required job excludes every media file. Cache key includes path+version, never release manifest version; DB file receipt written after Cache.put completes, validate actual cache/hash on resume/read. New DB/cache `ygo-content-files-v1`; stores manifests(version), files([path,version]), jobs(jobId), receipts(receiptId); no active store. sealRequired checks full selected runtime/chapter closure, returns receipt digest over sorted file identities; staged receipt grants no gameplay. Deletion caller must hold application-exclusive then download-exclusive locks; preserve unknown/legacy stores. Offline reader works with null delivery base; only fetch methods fail network when no endpoint.

### Contract `cards`

```ts
// src/cards/contracts.ts; exported by src/cards/index.ts
export type CardCode = number & { readonly __cardCode: unique symbol };
export declare function cardCode(value: number): CardCode;
export type CardImageVariant = "full" | "cropped";
export interface CardImageRef {
  readonly code: CardCode;
  readonly variant: CardImageVariant;
}
export interface CardDefinition {
  readonly code: CardCode;
  readonly alias: number;
  readonly setcodes: readonly number[];
  readonly type: number;
  readonly level: number;
  readonly attribute: number;
  readonly race: string;
  readonly attack: number;
  readonly defense: number;
  readonly lscale: number;
  readonly rscale: number;
  readonly linkMarker: number;
  readonly scope: number;
  readonly name: string;
  readonly description: string;
  readonly strings: readonly string[];
  readonly images: Readonly<{ full: CardImageRef; cropped: CardImageRef }>;
}
export interface Cards {
  get(code: CardCode): CardDefinition | undefined;
  all(): readonly CardDefinition[];
}
export declare function createCards(definitions: readonly CardDefinition[]): Cards;
export declare function parseCardDefinitions(value: unknown): readonly CardDefinition[];
export declare function validateCardConsistency(chapter: readonly CardDefinition[], runtime: readonly CardDefinition[]): void;
export type CardFrame = "normal" | "effect" | "ritual" | "fusion" | "synchro" | "xyz" | "link" | "spell" | "trap";
export declare function cardFrameOf(rawType: number): CardFrame;
export declare function hasOcgType(type: number, mask: number): boolean;
export declare const CARD_FRAME_COLORS: Readonly<Record<CardFrame, string>>;
```

Positive safe-integer CardCode; cardCode keeps exact `Invalid card code: ${value}` error. createCards rejects conflicting duplicate code with Error("CARDS_INVALID_DEFINITION"); identical duplicates deduplicate, all() sorted ascending, nested records frozen. race is canonical nonnegative decimal string, not bigint on wire; no mutable stats/ownership. Masks/colors copied verbatim from existing source, not new semantics. OCG_TYPE/OCG_ATTRIBUTE/OCG_RACE exports retained through src/cards/classification/index.ts; no vendor runtime import. Cards definition image refs are code+variant, not URL/path.

### Contract `images`

```ts
// src/cards/ports/card-image-source.ts; exported by src/cards/images/index.ts
import type { CardCode, CardImageVariant } from "../contracts.ts";
export interface CardImageLease {
  readonly url: string;
  release(): void;
}
export interface CardImageSource {
  acquire(code: CardCode, variant: CardImageVariant, signal: AbortSignal): Promise<CardImageLease | null>;
}
```

Cache-only optional acquire: missing/corrupt/unreadable media -> null; adapter reports missing-media status to Shell. Required failure does not use this port. Abort rejects DOMException("The operation was aborted.", "AbortError"); release idempotent. Read/decode concurrency <=4, unleased memory <=32 MiB/64 entries; active leases separate, never silently delete persistent assets. Stale request result releases without rendering. No direct URL fallback.

### Contract `decks`

```ts
// src/decks/catalog/cards-catalog.ts; exported by src/decks/catalog/index.ts
import type { Cards } from "../../cards/index.ts";
import type { DeckBuilderCardView } from "./ocg-card-mapper.ts";
import type { DeckCardLists } from "../deck-contracts.ts";
import type { PinnedDeckRuleset } from "./pinned-ruleset.ts";
export declare function cardsDeckCatalog(cards: Cards): readonly DeckBuilderCardView[];
export declare function validatePublishedDecks(decks: readonly DeckCardLists[], cards: Cards, ruleset: PinnedDeckRuleset): void;
// src/decks/validation/index.ts additionally re-exports these existing APIs:
export { validateDeckDraft, validationDigest } from "../deck-validation.ts";
export type { DeckValidationInput } from "../deck-validation.ts";
export { PROTOTYPE_RULESET, quantityLimit, catalogByCode } from "../catalog/pinned-ruleset.ts";
export type { PinnedDeckRuleset } from "../catalog/pinned-ruleset.ts";
export { unlimitedCardOwnership } from "../card-ownership.ts";
export type { CardOwnership } from "../card-ownership.ts";
```

cardsDeckCatalog reuses existing mapper semantics; imageUrl initially null, containers fill transient ViewModels from leases. Existing DeckBuilderCardView/DeckRecord/DeckRepository method shapes remain; no DB migration for Cards extraction. validatePublishedDecks rejects missing card, token, wrong main/extra placement, per-code summed main/extra/side quantity excess with Error("DECK_RELEASE_INVALID"), matching old verifyGameplay rather than introducing new published-deck minimum rules. Existing draft validator retains quantity, wrong-zone, supported/owned distinctions. Public entries explicitly export named symbols, no export-star. Full public-entry inventory below is binding; no generic root expansion.

**Errors:** BATTLE_RUNTIME_INVALID for malformed DTO; preserve exact existing DuelOperationError codes/message source for engine/runtime failures. Worker onerror/onmessageerror/promise rejection dispatches Shell required-input failure, not blank screen.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** BattleFacade receives source → DuelWorkerClient initialize postMessage({type:"initialize",runtime},[runtime.wasmBinary]) → parseDuelCommand/parseBattleRuntimeInput in Worker → OcgCoreAdapter.initialize({wasmBinary}) → existing ready/progress/duel events. Existing factory anchor target-main create-browser-runtime.ts:109-123. Observe real Worker ready plus duel result; functions never cross IPC.

## TDD

- [x] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [x] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [x] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Worker transport | valid runtime DTO plus wasm transfer | initialize ready; sender buffer detached only once |
| Replay | restore after transferred first buffer | new source load buffer; same snapshot |
| Allowed pool | supported but uninstalled card on either seat | start rejected before duel |
| Required script inventory | remove indexed card/global script; retain unindexed normal card | indexed omission BATTLE_RUNTIME_INVALID; genuinely unindexed normal card valid |
| Real engine | canonical frozen WASM+runtime | duel progresses via real ocgcore |
| Concealment | hidden opponent/overlay | no Cards/image read; own known face-down still works |

## Impl steps

- [x] P1. Red: old initialize.content rejected, valid runtime DTO accepted; out-of-pool both seats; no Content imports; detached-buffer replay test. Verify: parser/source failures first.
- [x] P2. Implement Battle ports/pure validator and Shell runtime adapter from verified runtime catalog/text/script/system JSON; move file lookup mechanics out of Worker. Verify: complete frozen runtime payload, no optional art requirement.
- [x] P3. Change client/facade/worker command to runtime DTO; transfer wasm once, rebuild for restart/restore; maintain progress/error channels. Verify: structured-clone test plus Worker integration.
- [x] P4. Retain OcgCoreAdapter as sole engine owner; preload scripts/globals and validate getVersion. Remove unused Content-specific reader/receipt paths only after all Battle callers migrate. Verify: vendor tree unchanged.
- [x] P5. Run real-WASM installed-runtime test plus privacy tests; record payload bytes/peak heap/startup time with baseline. Verify: no unexplained >20% startup/memory regression; if exceeded, optimize clones within same DTO, do not invent RPC redesign silently.

## Validation

- [x] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/unit/battle-runtime-input.test.ts tests/unit/card-visibility.test.ts tests/unit/domain-boundaries.test.ts tests/integration/installed-runtime.test.ts tests/integration/installed-runtime-wasm.test.ts --reporter=verbose
npm run vendor:verify
npm run typecheck
```

- [x] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [x] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [x] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [x] V5. Commit msg draft: `refactor(battle): inject semantic runtime without storage coupling`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.
