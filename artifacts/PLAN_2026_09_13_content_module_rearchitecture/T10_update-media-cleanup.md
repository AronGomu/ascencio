# T10: Explicit media, content updates, CORE consent, cleanup

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T9  
**Commit outcome:** Main Menu exposes independent safe actions; missing media never blocks play; asset cleanup preserves saves/settings.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: Main Menu exposes independent safe actions; missing media never blocks play; asset cleanup preserves saves/settings.

C3. Out of scope here: No auto-download, automatic cleanup, irreversible admin save reset folded into asset removal, historical version selector, live PWA deploy.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [x] R1. Separate Check updates / Install required data / Activate content / Download media / Resume / Delete unused assets / Delete all assets / Approve CORE controls. Primary action depends on state; existing playable offline pair remains available while checking/downloading fails.
- [x] R2. Prominent persistent optional-media warning with placeholder counts, not repeated toast flood. Required-only Story/Free Play/Editor/collection/duel flows remain functional; cached media acquire never triggers HTTP.
- [x] R3. Activation/cleanup/CORE approval Main Menu only with cross-tab locks. Cleanup no active jobs; explicit confirmation states downloads removed, saves/settings retained. Partial failure visible/retryable; no wildcard DB/cache deletion.
- [x] R4. CORE metadata discovery no automatic content transfer. Explicit approval checks candidate epoch against installed manifest then writes durable matching approval before registration.update. SW update install gates caching on approval; first install exempt; cold update retains no skipWaiting/clients.claim.
- [x] R5. CORE approval can outlive session only for exact build; subsequent content activation must also fit approved target epoch. Unapproved update after all tabs close must not silently become active. Local two-build Chromium test proves this; no live deploy.

## Inputs

I1. Target-main src/shell/screens/InstallContentScreen.svelte; src/shell/pwa/register-service-worker.ts; src/service-worker.ts:1-54

I2. T9 ApplicationSelector/Application lifecycle lock, T5 ProgressiveContentStore cleanup/jobs; src/shell/admin-actions.ts (locate current admin action owner before edit)

I3. docs/ADR/094_ADR_explicit_media_updates_and_cleanup.md; existing Main Menu/settings/toast/confirm components

**From Depends:** T9 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T9_atomic-activation.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** lifecycle.

### Contract `lifecycle`

```ts
// src/shell/application/content-actions.ts
export interface ContentActionsView {
  readonly phase: "idle" | "checking" | "downloading" | "paused" | "ready" | "blocked" | "failed";
  readonly message: string;
  readonly completedBytes: number;
  readonly totalBytes: number;
  readonly missingMedia: number;
  readonly canInstall: boolean;
  readonly canActivate: boolean;
  readonly canDownloadMedia: boolean;
  readonly canDeleteAssets: boolean;
}
export type CoreCandidate = Readonly<{ schemaVersion: 1; buildId: string; coreContentApiVersion: number }>;
export interface CoreApproval {
  readonly schemaVersion: 1;
  readonly buildId: string;
  readonly coreContentApiVersion: number;
  readonly approvedAt: number;
  readonly selectionGeneration: number;
}
export interface ContentActions {
  check(signal: AbortSignal): Promise<void>;
  installRequired(signal: AbortSignal): Promise<void>;
  resume(jobId: string, signal: AbortSignal): Promise<void>;
  activate(signal: AbortSignal): Promise<void>;
  downloadMedia(signal: AbortSignal): Promise<void>;
  deleteUnusedAssets(): Promise<void>;
  deleteAllAssets(): Promise<void>;
  approveCore(candidate: CoreCandidate): Promise<void>;
}
```

ContentActions belongs Shell only, screens receive view/callbacks, no Content imports. All mutation actions explicitly clicked; own AbortController pauses download on cancel, persisted job resume explicit. Download may stage while domain sessions exist, but media download/activation/cleanup UI available from Main Menu only; concurrent jobs block cleanup. Delete all first CAS selector to content:null while retaining storyGenerationId, then deletes only owned Content DB/cache; failure leaves truthful partial deletion status, saves/settings/Decks/SW untouched. Delete unused keeps every active-manifest file identity, including unselected media entries; no active manifest -> blocked until explicit Delete all or install. CoreCandidate served `core-release.json` with immutable build ID/compat epoch matching compiled SW constants. approveCore obtains Main Menu exclusive, checks current content coreRange against candidate epoch, writes CoreApproval then calls registration.update. SW first install allowed; later install awaits matching approval before precache.install, manually wiring install via addToCacheList (not automatic precache.precache listener). Unapproved candidate throws Error("CORE_UPDATE_NOT_APPROVED"), old worker remains. Incompatible approval reports "CORE_CONTENT_INCOMPATIBLE" with no download. Approved waiting worker uses cold close/reopen, no skipWaiting/clients.claim. While approval pending, content activation must remain compatible with both current/candidate epochs or fail; no race invalidates approval. Single approval row cannot be overwritten by different build while unresolved: approveCore rejects Error("CORE_UPDATE_PENDING"). Same build approval is idempotent. Consume approval only after matching currently running build confirmed; failed newer install never relaxes compatibility with older approved waiting build. Clearing/consuming approval must not prevent approved waiting worker after restart. Remote discovery failure only message, never readiness reset.

### Consumes — binding predecessor contracts

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

### Contract `story`

```ts
// src/story/ports/story-release.ts; public through src/story/ports/index.ts
import type { CardCode } from "../../cards/index.ts";
import type { DeckCardLists } from "../../decks/contracts/index.ts";
export type StoryChoiceId = "trust-rin" | "challenge-rin" | "observe-first";
export type StoryRarity = "common" | "rare" | "super-rare" | "ultra-rare" | "secret-rare" | "ultimate-rare" | "ghost-rare";
export interface StoryDocument {
  readonly schemaVersion: 1;
  readonly contentId: "prototype-prologue-v1";
  readonly title: string;
  readonly beats: readonly {
    readonly id: string;
    readonly speaker: "Rin" | "Kael" | "Protagonist" | null;
    readonly kind: "dialogue" | "narration" | "thought";
    readonly text: string;
    readonly background: "station" | "concourse" | "arena";
    readonly characters: readonly ("rin-neutral" | "rin-smile" | "kael")[];
  }[];
  readonly choices: readonly { readonly id: StoryChoiceId; readonly label: string }[];
  readonly choiceResponses: Readonly<Record<StoryChoiceId, string>>;
  readonly laterAcknowledgments: Readonly<Record<StoryChoiceId, string>>;
}
export interface StorySet {
  readonly id: string;
  readonly name: string;
  readonly releaseYear: number;
  readonly cards: readonly {
    readonly code: CardCode;
    readonly name: string;
    readonly rarity: StoryRarity;
    readonly printingCode: string;
    readonly sourceRarity: string;
    readonly sourceRarityCode: string;
  }[];
}
export interface StoryRelease {
  readonly revision: number;
  readonly chapters: readonly {
    readonly id: string;
    readonly document: StoryDocument | null;
    readonly cardCodes: readonly CardCode[];
    readonly sets: readonly StorySet[];
    readonly decks: readonly (DeckCardLists & { readonly id: string; readonly name: string })[];
    readonly opponents: readonly { readonly id: string; readonly name: string; readonly line: string; readonly deckId: string; readonly policyId: "basic" }[];
    readonly defaults: Readonly<{ starterDeckId: string; opponentId: string }>;
  }[];
}
export interface StoryMediaLease { readonly url: string; release(): void }
export interface StoryMedia {
  acquireMap(chapterId: string, signal: AbortSignal): Promise<StoryMediaLease | null>;
  acquireSetImage(setId: string, signal: AbortSignal): Promise<StoryMediaLease | null>;
}
export declare function parseStoryRelease(value: unknown): StoryRelease;
export declare function validateStoryRelease(release: StoryRelease): void;
export declare function validateStoryContinuity(previous: StoryRelease, next: StoryRelease): void;
```

Story ports contain no raw paths/Blob/Content refs. StoryRelease.revision equals releaseSequence mapped by Shell; chapter data map from producer definitions, no synthetic defaults. Story map/set image identity resolved inside Shell adapter. Schema constraints preserve current prologue, speakers, choices, rarity/source printing metadata. Future media roles not consumed by current UI need no speculative semantic methods. Story validates unique IDs, all defaults/refs, metadata bounds, deterministic chapter order/identical duplicate definitions; errors Error("STORY_RELEASE_INVALID") / Error("STORY_CONTINUITY_FAILED"). validateStoryContinuity requires nondecreasing revision and preservation of beat IDs, choices, locations used by current model, cards/sets/decks/opponents, semantic contentId; removed references reject official release. No downloaded JS.

**Errors:** Player copy fixed: "Optional media is missing. You can keep playing."; "Return all game tabs to Main Menu before updating."; "Required content is unavailable. Return to Main Menu to repair it."; "This CORE update is incompatible with installed content.". Map Content codes to concise retry states. Internal CORE_UPDATE_NOT_APPROVED / CORE_CONTENT_INCOMPATIBLE / CORE_UPDATE_PENDING preserved; no raw remote error shown.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** Main Menu action → ContentActions → named application/download locks → ContentStore method or coreApproval DB row + registration.update() → SW install validates __APP_BUILD_ID__/compat approval before precache.install → waiting worker UI → close all clients/reopen → new approved shell visible. Observe network log, SW controller build ID, persisted approval/selector, untouched save hashes. No skipWaiting or live clients.claim.

## TDD

- [ ] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [x] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [x] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Independent consent | approve CORE only / content only | no other payload download |
| No optional fetch | visit every domain with media absent | placeholders+warning; zero media GET |
| Delete all | populated saves/decks/settings/CORE cache | only owned Content bytes removed, selection.content null |
| Partial delete fail | Cache.delete/IDB failure mid-cleanup | visible retry state; saves/settings unchanged |
| CORE cold consent | discover update then close all without approval | old approved CORE stays active |
| Approved incompatible | target epoch outside content coreRange | CORE_CONTENT_INCOMPATIBLE; old play works |
| Three-build approval | B approved/waiting; C approval requested; C install failure | CORE_UPDATE_PENDING; B constraint persists; B-incompatible content still blocked |
| Download crash/cleanup | other tab holds download lock then crashes | busy cleanup blocked immediately; abandoned running metadata does not block forever |
| Pending approval race | approve B then activate content incompatible with B | activation blocked; approval cannot be bypassed |

## Impl steps

- [ ] P1. Red: missing media play, no implicit GET, separate approvals, cleanup preserving saves, unapproved SW cold-close update. Verify: existing wait-only SW fails consent requirement.
- [x] P2. Implement Shell ContentActions/ViewModels, action availability/state transitions/byte progress and error copy. Screens import Shell contracts only. Verify: keyboard focus, unique data-cy, cancel/resume behavior.
- [x] P3. Implement persistent media warning and cache-only leases; media batch selected installed closure explicit. Verify: null media across every UI surface, no hidden fallback fetch.
- [x] P4. Wire cleanup under application/download lock order; all clears content selection before owned-byte removal; unused retains full active manifest identities. Verify: actual populated Story/Decks/settings/CORE caches identical.
- [x] P5. Wire core-release.json/SW approval gate/manual precache lifecycle and cold instructions; remove automatic install listener bypass. Verify: exact two-build offline/approval/cross-tab tests, no forced reload.

## Validation

- [x] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/component/InstallContentScreen.test.ts --reporter=verbose
npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/content-media-cleanup.spec.ts e2e-core/core-update-consent.spec.ts
```

- [x] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [x] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [x] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [x] V5. Commit msg draft: `feat(shell): keep updates and media under player control`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.

## Implementation evidence

State: **repaired — checked; independent repair acceptance pending**. Initial implementation evidence below remains historical.

- [x] E1. Exact focused Vitest: 14/14. Validation: `artifacts/T10-EVIDENCE/green-vitest.log`.
- [x] E2. Local Chromium media/cleanup + CORE consent: 2/2 with real Service Worker for CORE. Validation: `native-playwright.log`, `playwright-report.json`, `test-results/**/trace.zip`, `media-placeholder.png`, `core-approved-waiting.png`.
- [x] E3. T9/basic regressions: 124/124 Vitest, 5/5 Chromium. Validation: `t9-basic-regressions.log`, `t9-native-regressions.log`.
- [x] E4. Build/type/quality: Shell 99224/115000, vendor 21/21, typecheck 0 errors, boundaries/data-cy 87/87, scoped ESLint/Prettier clean. Validation: logs under `artifacts/T10-EVIDENCE/`.
- [x] E5. Exact 27-path source/test/config inventory and SHA-256 recorded. Validation: `source-paths.txt`, `source-sha256.txt`.
- [ ] E6. Independent repair acceptance. Validation: reviewer checks `artifacts/IMPLEMENTATION-REPORT-T10-repair.md`, `artifacts/T10-REPAIR-EVIDENCE/`, B1–B5; author does not self-accept.

TDD deviation: D1/P1 remain unchecked. Final acceptance tests were not all authored before implementation. `red-baseline-vitest.log` proves three predecessor behavior failures retrospectively; it is not represented as chronological test-first evidence.


## B1–B5 bounded repair evidence

- [x] R6. Chronological repair RED before source fixes. Verify: `artifacts/T10-REPAIR-EVIDENCE/red-vitest.log` has 10 behavior failures; `red-native-4.log` proves stale second-tab action; `red-native.log` proves missing controller identity. Original D1/P1 remain unchecked permanently.
- [x] R7. Bounded CORE stream / independent discovery channels / lifecycle epochs / exact selected media closure. Verify: same ticket Vitest command now 29/29 (14 original + 15 repair); superseded preparation disposed; superseded progress/local reads cannot override current selection. Follow-up media notification test RED → GREEN recorded separately.
- [x] R8. Native required-only Story/Free Play/editor/collection/duel. Verify: actual WASM duel renders; zero media requests; populated Story/Decks snapshots hash-identical after isolated cleanup; local settings/CORE marker/unknown Content key retained; second-tab controls/warnings refresh without discovery. `native/media-native-observations.json`, screenshots/traces.
- [x] R9. Native CORE identity/approval. Verify: readonly IDB transaction completes before intercepted native `registration.update()` call; exact candidate/generation/timestamp row recorded; active controller responds with compiled build ID/epoch before cold unapproved, approved waiting, cold/offline approved states. `native/core-native-observations.json`.
- [x] R10. Final validation. Verify: exact native command 2/2; atomic/offline native 5/5; basic Vitest 124/124; boundaries/data-cy 87/87; build Shell 99224/115000; typecheck 0 errors/4 existing warnings; 27-path scoped lint/format + hashes; original report/evidence byte-identical. Cmds/exits in `artifacts/T10-REPAIR-EVIDENCE/commands.json`.

Repair validation uses `T10_REPAIR_EVIDENCE=artifacts/T10-REPAIR-EVIDENCE/native` with exact ticket Playwright command, preserving old output. T11 locked asset acquisition remains deferred. Independent acceptance E6/R5 (ledger) remains pending.
