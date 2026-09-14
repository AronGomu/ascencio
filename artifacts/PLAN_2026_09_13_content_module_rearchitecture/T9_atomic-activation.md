# T9: Atomic application selection and cross-tab readiness

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T8  
**Commit outcome:** At Main Menu, one CAS exposes verified content plus prepared saves; failures retain old pair.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: At Main Menu, one CAS exposes verified content plus prepared saves; failures retain old pair.

C3. Out of scope here: No physical cross-DB transaction claim, rollback UI, source-save mutation before commit, per-domain install checks, remote deployment.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [x] R1. Implement sole ApplicationSelection DB authority. No new independent Content active pointer; old legacy stores not selected by final path, no silent deletion.
- [x] R2. Main Menu activation nonqueued exclusive; all domain routes, collection, Story-owned deck edit, duel handoff, admin save mutations join same session lease. Acquire shared before read/recheck/mount; hold through save/dispose. BroadcastChannel only refreshes status.
- [x] R3. Under exclusive + download locks: recheck compatibility/generation, verify required files, prepare all Story copies, verify seal; one selector tx CAS current generation+1 with content/save token. No foreign awaits inside tx.
- [x] R4. Bootstrap first reads installed selector and local manifest; StoryMigrationPort.verifyActiveGeneration verifies selected semantic descriptor/existence without preparation-seal comparison after saves; only later checks network. Same generation preparation cached in Shell, modules trust inputs. Post-activation normal saves do not fail original preparation seal hash recheck.
- [x] R5. Svelte root boundary plus explicit promise/Worker error channel returns Main Menu with recovery message. Storage loss never silently selects old/new mismatched saves. New generation notification failure after commit cannot turn committed success into rollback.

## Inputs

I1. T8 PreparedRelease and prepareRelease; T6 StoryMigrationPort; T5 StagedContent/verifyRequired

I2. Target-main src/content/storage/content-database.ts:62-104; src/shell/core/core-gate.ts:53-145; AppShell.svelte; routes.ts

I3. docs/ADR/093_ADR_atomic_release_selector_and_save_generations.md; existing handoff-coordinator.ts

**From Depends:** T8 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T8_semantic-preparation.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** selector.

### Contract `selector`

```ts
// src/shell/application/application-selector.ts
import type { StagedContent } from "../../content/index.ts";
import type { StoryGenerationId, StoryMigrationPort } from "../../story/saves/index.ts";
import type { PreparedRelease } from "./prepared-release.ts";
export interface ApplicationSelection {
  readonly schemaVersion: 1;
  readonly generation: number;
  readonly content: StagedContent | null;
  readonly storyGenerationId: StoryGenerationId | null;
}
export type ActivationResult =
  | { readonly kind: "activated"; readonly selection: ApplicationSelection }
  | { readonly kind: "blocked"; readonly code: "APP_SESSION_ACTIVE" | "APP_DOWNLOAD_ACTIVE" | "APP_CORE_INCOMPATIBLE" | "APP_ACTIVATION_CONFLICT" }
  | { readonly kind: "failed"; readonly code: "APP_REQUIRED_INPUT_FAILED" | "APP_SAVE_MIGRATION_FAILED" | "APP_STORAGE_UNAVAILABLE" };
export interface ApplicationSelector {
  read(): Promise<ApplicationSelection>;
  activate(expectedGeneration: number, prepared: PreparedRelease, saves: StoryMigrationPort, signal: AbortSignal): Promise<ActivationResult>;
}
export interface DomainSession { readonly selection: ApplicationSelection; release(): void }
export declare function acquireDomainSession(signal: AbortSignal): Promise<DomainSession>;
export declare const APPLICATION_LIFECYCLE_LOCK: "ygo-application-lifecycle-v1";
export declare const CONTENT_DOWNLOAD_LOCK: "ygo-content-download-v1";
```

Sole selector DB `ygo-application-state` v1, store `selection` key "active"; default {schemaVersion:1,generation:0,content:null,storyGenerationId:null}. Separate `coreApproval` store key "approved" used by T10. No independent Content/Story active selector. acquireDomainSession uses shared Web Lock held until idempotent release; under lock read current selector, verify session-ready generation in Shell, then mount. Activation nonqueued exclusive ifAvailable; local route must home before request; any tab shared lease -> blocked immediately, no surprise queued commit. Lock order application-exclusive -> download-exclusive, both nonqueued ifAvailable; busy download returns APP_DOWNLOAD_ACTIVE. Shell download runner holds download-exclusive throughout network/hash/cache/receipt work; Content imports no Shell lock API. Seal verification under locks, Cache/hash/Story awaits outside selector tx. Stage required files first; prepare migration under locks; verify files/seal then one generation CAS put. If commit succeeds selection is authoritative even if later notification fails; never report rollback or overwrite old pointer after commit. Fresh route/startup resolves one pair; post-gate I/O/async/Worker errors dispatch to Shell boundary, clear readiness, dispose domain/leases, Main Menu. Unknown DB row or missing selected save generation blocks, never pairs old saves with new content. Normal Story writes/admin saves need held session or shared lease so migration cannot race.

### Consumes — binding predecessor contracts

### Contract `candidate`

```ts
// src/shell/application/prepared-release.ts
import type { Cards } from "../../cards/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type { StagedContent, ProgressiveContentStore } from "../../content/index.ts";
import type { EditorCatalogInput } from "../../deck-editor/ports/index.ts";
import type { StoryRelease, StoryMedia } from "../../story/ports/index.ts";
import type { BattleRuntimeSource } from "../../battle/ports/index.ts";
export interface PreparedRelease {
  readonly content: StagedContent;
  readonly cards: Cards;
  readonly images: CardImageSource;
  readonly editor: EditorCatalogInput;
  readonly story: StoryRelease;
  readonly storyMedia: StoryMedia;
  readonly battle: BattleRuntimeSource;
  dispose(): void;
}
export declare function prepareRelease(store: ProgressiveContentStore, content: StagedContent, signal: AbortSignal): Promise<PreparedRelease>;
```

prepareRelease performs verified required reads once, maps structural wire data, invokes Cards/Decks/Story/Battle validators, returns pinned adapters bound to same StagedContent. No activation/save mutations. Exact semantic payload producer keys read from existing ChapterGameplay/ChapterCard/ChapterSet/ChapterStoryDocument schemas; file mechanics stay Shell/Content. optional refs validated for manifest membership/role/MIME without demanding local bytes. Card/text records must match runtime support exactly; chapters dedup identical definitions, conflicting IDs rejected. Defaults from lexically first selected chapter retained, explicit chapter document when Story mount. Required read/semantic failure rejects Error("APP_REQUIRED_INPUT_FAILED") with internal cause, never new Content imports in domains.

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

### Contract `wire`

```ts
// src/content/contracts/progressive-release.ts; public through src/content/index.ts
export type FileVersion = string;
export type ChapterId = `chapter-${string}`;
export interface CoreRange { readonly min: number; readonly maxExclusive: number }
export interface ReleaseFile {
  readonly path: string;
  readonly version: FileVersion;
  readonly bytes: number;
  readonly mediaType: string;
  readonly role: "runtime" | "gameplay" | "story" | "media";
  readonly required: boolean;
  readonly packIds: readonly ("runtime" | ChapterId)[];
}
export interface ProgressiveManifest {
  readonly schemaVersion: 3;
  readonly releaseSequence: number;
  readonly coreRange: CoreRange;
  readonly runtimeSnapshotId: string;
  readonly chapters: readonly {
    readonly id: ChapterId;
    readonly title: string;
    readonly description: string;
    readonly depends: readonly ChapterId[];
    readonly gameplayPath: string;
    readonly storyPath: string | null;
  }[];
  readonly files: readonly ReleaseFile[];
}
export interface LatestContentPointer {
  readonly schemaVersion: 1;
  readonly releaseSequence: number;
  readonly manifest: Readonly<{ version: FileVersion; bytes: number }>;
}
export interface CoreBootstrap {
  readonly schemaVersion: 2;
  readonly coreContentApiVersion: number;
  readonly delivery: null | Readonly<{ baseUrl: string; pointerPath: "content/latest.json" }>;
}
export declare function parseProgressiveManifest(value: unknown): ProgressiveManifest;
export declare function parseLatestContentPointer(value: unknown): LatestContentPointer;
```

All hashes full 64 lowercase hex; canonical JSON UTF-8 sorted object keys, arrays sorted as specified, exactly one terminal LF. releaseSequence positive safe integer; chapter IDs match chapter-(0[1-9]|[1-9][0-9]); dependency acyclic closure sorted lexical, runtime always included. files sorted ASCII path, unique path, version=raw-byte SHA-256; packIds sorted unique, nonempty. Paths ASCII relative segments [A-Za-z0-9._-]+, no empty/dot/dotdot/backslash/query/hash/percent-encoded ambiguity. bytes integer 0..2^53-1, checked sum no overflow; individual file cap 256 MiB, runtime-specific limits unchanged. Manifest cap 32 MiB / 50,000 entries / 99 chapters; parser reads bounded body before JSON. required iff role != media, media MIME image/audio/video; all gameplay/story descriptors point to required files, no runtime-only play. CORE compatibility is integer epoch: min <= running coreContentApiVersion < maxExclusive; positive min/max, max>min. File key `content/files/<version>/<path>`; manifest key `content/manifests/<version>.json`; pointer `content/latest.json`, appended to configured publicBaseUrl/keyPrefix. Pointer sequence equals parsed manifest sequence. Unknown fields rejected; byte identity verified before parser. No compiled full inventory.

### Contract `saves`

```ts
// src/story/saves/generation-contracts.ts; public through src/story/saves/index.ts
import type { StoryState } from "../model/story-state.ts";
import type { StoryRelease } from "../ports/story-release.ts";
export type StoryGenerationId = string & { readonly __storyGenerationId: unique symbol };
export type StorySlotKey = `manual:${1 | 2 | 3}` | "autosave" | "checkpoint:pre-duel";
export interface StoryBinding {
  readonly chapterId: string;
  readonly contentId: "prototype-prologue-v1";
  readonly revision: number;
  readonly completedChapterIds: readonly string[];
}
export interface StorySaveEnvelope {
  readonly schemaVersion: 6;
  readonly slot: StorySlotKey;
  readonly revision: number;
  readonly savedAt: number;
  readonly state: StoryState;
  readonly story: StoryBinding;
}
export type StorySaveReadResult =
  | { readonly kind: "empty"; readonly slot: StorySlotKey }
  | { readonly kind: "ready"; readonly envelope: StorySaveEnvelope }
  | { readonly kind: "incompatible"; readonly slot: StorySlotKey; readonly found: number }
  | { readonly kind: "corrupt"; readonly slot: StorySlotKey; readonly reason: string };
export type StorySaveWriteResult =
  | { readonly kind: "written"; readonly revision: number }
  | { readonly kind: "stale"; readonly currentRevision: number }
  | { readonly kind: "failed"; readonly reason: "quota" | "unavailable" | "unknown" };
export interface StorySaveSummary {
  readonly slot: StorySlotKey;
  readonly revision: number;
  readonly savedAt: number;
  readonly chapterLabel: string;
}
export interface GenerationSaveRepository {
  read(slot: StorySlotKey): Promise<StorySaveReadResult>;
  write(slot: StorySlotKey, state: StoryState, expectedRevision: number | null, story: StoryBinding): Promise<StorySaveWriteResult>;
  list(): Promise<readonly StorySaveSummary[]>;
  clear(slot: StorySlotKey): Promise<void>;
}
export interface StoryGenerationSeal {
  readonly generationId: StoryGenerationId;
  readonly sourceGenerationId: StoryGenerationId | null;
  readonly revision: number;
  readonly slots: readonly { readonly slot: StorySlotKey; readonly revision: number; readonly digest: string }[];
}
export interface StoryMigrationPort {
  prepare(sourceGenerationId: StoryGenerationId | null, target: StoryRelease): Promise<StoryGenerationSeal>;
  verifySeal(seal: StoryGenerationSeal): Promise<void>;
  verifyActiveGeneration(generationId: StoryGenerationId, target: StoryRelease): Promise<void>;
  repository(generationId: StoryGenerationId): GenerationSaveRepository;
}
export declare function createStoryMigrationPort(factory: IDBFactory, now?: () => number): StoryMigrationPort;
```

New Story DB version 2 adds `generations` (generationId) and `generationSaves` ([generationId,slot]); retains old `saves` store byte-identically. Generation row holds full StoryRelease descriptor, source ID, phase prepared, seal; no Story active pointer. Schema1–5 legacy slots remain preserved/visibly incompatible, no ZIP-content bridge or guessed binding. New supported generation saves are schema6; same-schema forward content migration remaps narrativeIndex via old stored beat ID into target beat list, preserves every other state field and slot revision/savedAt. Every nonempty supported slot copied; null source creates sealed empty generation, never starter/DP/collection grant. Invalid/future/corrupt slot blocks migration, never omitted. prepare idempotent for same source+target with unchanged source revisions; creates new random generation if prior prepared inputs differ, no overwrite. verifySeal checks all 5 slots/absences and descriptor, not metadata stamp only. verifyActiveGeneration checks selected generation existence and full semantic target descriptor, never compares mutable slots with preparation seal; missing/mismatched descriptor rejects STORY_MIGRATION_FAILED. Normal writes retain slot CAS; clear(slot) remains explicitly unconditional authorized deletion within supplied generation, with no CAS promise; source generation visible only through Shell injection. Error("STORY_MIGRATION_FAILED") for semantic/missing input, Error("STORY_STORAGE_UNAVAILABLE") for unavailable DB, Error("STORY_STORAGE_QUOTA") for quota. Repository failures use existing result unions; no silent list=[] on I/O failure. Writes snapshot inputs before await. Active generation mutates by normal saving after activation; original preparation seal verified only at activation, not re-used as immutable proof after gameplay saves.

**Errors:** ActivationResult codes fixed; no rejection swallowed into ready. Unexpected failure before commit -> failed storage/required/migration classification. After committed tx, observer failure triggers UI reread/error notice only. Lock API unavailable -> APP_STORAGE_UNAVAILABLE; no fake cross-tab fallback.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** Install view activate click → Shell ApplicationSelector.activate(expectedGeneration,prepared,saves,signal) → Web Locks application exclusive + download exclusive → Story prepare/verifySeal → IDB ygo-application-state.selection[active] CAS → AppShell reads selection and mounts pinned inputs. Observe DB pointer + all slot hashes + DOM; fixture crash hooks surround every commit boundary. New handler path src/shell/application/application-selector.ts (proposed), existing gate core-gate.ts:53-145.

## TDD

- [x] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [x] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [x] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Crash matrix | before save tx / after seal / after selector tx | old / old / new exact pair |
| Quota migration | fail write of one of five slots | old selector and all old slot hashes unchanged |
| Two tabs | A domain lease, B activate | APP_SESSION_ACTIVE; no queued later commit |
| Concurrent selection | stale expectedGeneration | APP_ACTIVATION_CONFLICT |
| Save after activation | normal save/clear followed by offline reopen | selected generation accepted; no stale preparation-seal rejection |
| Offline bootstrap | latest URL down, cached required pair | ready; no remote prerequisite |
| Post-gate eviction | required read/Worker failure | Main Menu visible; saved bytes untouched |

## Impl steps

- [x] P1. Red: crash at each stage, stale CAS, active second tab, source-save preservation; offline missing pointer endpoint. Verify: old per-Content activation fails paired atomicity test.
- [x] P2. Implement application DB/selection parser, default empty selector, shared session lease and nonqueued exclusive helper. Verify: lock release on crash/dispose, no waiting activation surprise.
- [x] P3. Implement prepare-save→verify→selector CAS under locks, return typed ActivationResult. Verify: old bytes unchanged for abort/quota/failure; selector is sole linearization point.
- [x] P4. Wire AppShell readiness/mount/handoff/collection/admin consumers to selection-scoped adapters/repositories. Verify: session lease retained across Story→Battle checkpoint/result corridor.
- [x] P5. Add explicit asynchronous error dispatcher + root boundary Main Menu recovery; no automatic repair/download. Verify: injected storage eviction after gate disposes Worker/URLs and shows message without save rewrite.

## Validation

- [x] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/unit/application-selector.test.ts tests/unit/application-readiness.test.ts tests/component/AppShell.test.ts --reporter=verbose
npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/atomic-content-activation.spec.ts
```

- [x] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [x] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [x] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [x] V5. Commit msg draft: `feat(shell): activate matching content and saves atomically`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.


## T9 implementation evidence — checked; independent acceptance pending

- [x] E1. Selector/leases/readiness implemented. Verify: `artifacts/T9-EVIDENCE/review-vitest.log` exits 0, 59/59; crash matrix, five-slot quota preservation, transaction CAS, sparse/unknown rows, storage loss, normal save/clear reopen, pending-save lease, input snapshot tests.
- [x] E2. Production composition/recovery implemented. Verify: `e2e-core/atomic-content-activation.spec.ts` runs native Chromium two-tab Web Locks, Story/Free Play/editor/collection/admin routes, checkpoint Battle→Story corridor, real held download network, postcommit notification throw, production Story Save UI and exact envelope reload, real Worker error/termination, actual required Cache eviction without selector/save replacement.
- [x] E3. Preserve lazy budgets and module boundaries. Verify: `artifacts/T9-EVIDENCE/review-build.log` exits 0; same 115000 Shell budget; `acceptance-boundaries.log` 152/152; helper-chunk prefix collision regression red→green without budget changes.
- [x] E4. Record quality/evidence limits. Verify: source lint/typecheck/targeted format pass; full unit retains four known asset-prerequisite failures; full format retains unchanged `e2e/asset-root-urls.spec.ts`; unfiltered lint finds prior scratch/artifact config issues. Exact commands/exits: `artifacts/T9-EVIDENCE/commands-final.json`, `commands.json`. Report: `artifacts/IMPLEMENTATION-REPORT-T9.md`. No commit/stage/push/deploy/download of live Content; commit message remains draft only.
- [ ] A1. Independent reviewer accepts T9. Verify: reviewer inspects source inventory, red/green logs, native trace/DB assertions; author does not self-accept.

## Assumptions

- A1. Empty-selector startup remains locked; T10 owns explicit discovery/install/update UI. T9 exposes `createApplicationService` activation/download seam; startup never consults retired Content active state or performs automatic network acquisition.
- A2. Native acceptance uses local structurally/semantically verified fixture bytes plus frozen vendored executable. Service Worker blocked in this test to isolate lifecycle locks; PWA update policy remains T10.
