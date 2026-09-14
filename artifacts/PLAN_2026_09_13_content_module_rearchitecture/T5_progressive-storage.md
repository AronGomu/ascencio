# T5: Verified progressive staging and explicit resume

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T4  
**Commit outcome:** Required-file job can stage/resume offline-reusable bytes without activating or downloading optional media.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: Required-file job can stage/resume offline-reusable bytes without activating or downloading optional media.

C3. Out of scope here: No semantic validators, active selector, Story save writes, automatic media acquisition, implicit update/cleanup.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [ ] R1. New ProgressiveContentStore owns structural bytes/receipts/jobs only; never Story/Battle/Decks semantics or active app pointer. Existing old installed flow may remain behind old mount until T9, but never consumes new receipts as activation.
- [ ] R2. Per-file cache identity path+version reuses unchanged bytes across manifests. Partial downloads never receive receipt; full required closure verified before seal. Media excluded from required job.
- [ ] R3. Explicit cancellation persists paused job; explicit resume validates exact job identity, skips actual verified files, retries partial file wholly. Restart resumes only on user action, not at bootstrap.
- [ ] R4. Cache-only required/optional reads never network. Installed local reader opens with null remote delivery; remote latest failures cannot mutate previous installed state.
- [ ] R5. Build negative incoming/outgoing fixtures for new progressive Content path now; new provider has zero semantic domain imports. Exact pre-existing legacy verifyGameplay exception stays frozen until T8 removes it; no new exception. Structural malformed JSON/path/body bounds distinct from semantic failure.

## Inputs

I1. Target-main src/content/create-content-installer.ts; storage/content-database.ts:13-104; storage/content-cache.ts; content-reader.ts

I2. T4 src/content/contracts/progressive-release.ts; scripts/lib/asset-delivery/progressive producer; tests/fixtures/progressive-release.ts

I3. T7 implementations only as source-level salvage after T1 inventory; no ZIP or old active-pointer transplant

**From Depends:** T4 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T4_per-file-producer.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** storage.

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

### Consumes — binding predecessor contracts

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

### Contract `fixture`

```ts
// tests/fixtures/progressive-release.ts
export interface ProgressiveFixture {
  readonly baseUrl: string;
  readonly requests: string[];
  readonly objects: ReadonlyMap<string, Uint8Array>;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}
export declare function createProgressiveFixture(options?: Readonly<{ releaseSequence?: number; optionalMedia?: boolean; missingRequired?: boolean }>): Promise<ProgressiveFixture>;
```

Fixture deterministic, local HTTP only; no real account or downloaded code.

**Errors:** All ContentErrorCode paths specified in storage contract. Quota preserves old active content; invalid bytes never replace previous version. Disk/hash/DB failures surfaced, no empty catch/return-success.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** Shell later explicit action → ProgressiveContentStore.download DownloadRequest → fetch configured content/files/<version>/<path> (credentials omit, redirect error) → bounded digest verification → Cache.put + IDB file row → DownloadProgress and sealed StagedContent. Tests observe HTTP log/cache keys/DB rows; no gameplay mount yet.

## TDD

- [ ] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [ ] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [ ] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Progressive resume | abort middle file, restart explicitly | completed files skipped; partial restarted |
| Persisted job identity | restart paused job after latest pointer advanced | resume uses listJobs request original manifest/chapters/kind |
| Version reuse | two manifests same path+version | one cached body |
| Integrity fail | receipt present, body corrupted | CONTENT_INTEGRITY_FAILED; no seal |
| Required-only | all media absent | seal succeeds; 0 media GET |
| No activation | sealRequired success | no application selection write |
| Offline local read | baseUrl null, all required cached | read succeeds; fetchLatest fails without readiness mutation |

## Impl steps

- [ ] P1. Red: unchanged-file reuse, interrupted file, missing/corrupt receipt cache, zero optional network. Verify: old manifest-keyed ZIP flow fails.
- [ ] P2. Implement DB/cache/new receipts using idb and Web Crypto existing primitives; hash outside IDB tx. Verify: crash after Cache.put before receipt grants nothing, resume safely re-verifies.
- [ ] P3. Implement bounded queue/download job persistence/progress/AbortSignal. Verify: correct total/completed bytes, max4 network tasks, cancellation release.
- [ ] P4. Implement reader/readManifest/verifyRequired/sealRequired; no active writes. Verify: required seal checks every selected closure file, optional absence does not fail.
- [ ] P5. Add explicit low-level cleanup methods, callable only under Shell lock contract; no automatic cleanup timers/GC. Verify: filesOutside uses entire active manifest allow-set, other stores untouched.

## Validation

- [ ] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose
npm run typecheck
```

- [ ] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [ ] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [ ] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [ ] V5. Commit msg draft: `feat(content): stage resumable required files without activation`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.
