# T11: Aggregate architecture and Chromium acceptance

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T10  
**Commit outcome:** All slice contracts/boundaries and required offline/runtime/update/save flows have actual regression evidence.

**Execution state:** CHECKED / independent acceptance pending. Retry2 runner vanished; parent routed Astra/high retry3. Real selected-Content fixture and schema6/cache-only assertion mapping retained. Parent-approved shop printing, verified manifest parsing memo, selection-scoped Library images, mounted Battle image leases, private hover invalidation/refresh, exact native RO-warning guard implemented. Exact44 exited1 (131 passed,7 failed,1 conditional skip/139).106 interrupted at111/139 after1269 components/build/reproducibility pass; no exit/result invented, full6GiB output retained. Retry3 test-only prompt/hover setup batch passes focused113:14/14 (failed3 plus adjacent4, twice), no skips.114 exact aggregate exit0:1269 components,139/139 E2E,41/41 acceptance,zero skips;115 current-source headless exit0;116 native core11/11.117 frozen-source hashes allOK;118 original-report/inherited-diff hashes unchanged. Independent acceptance pending. Original evidence preserved: `artifacts/IMPLEMENTATION-REPORT-T11.md`, `artifacts/T11-EVIDENCE/`. Repair: `artifacts/IMPLEMENTATION-REPORT-T11-repair.md`, `artifacts/T11-REPAIR-EVIDENCE/`.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: All slice contracts/boundaries and required offline/runtime/update/save flows have actual regression evidence.

C3. Out of scope here: No new features, architectural redesign, new browser families, budget increase without explicit evidence/decision, public deploy, unrelated dirty fixes.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [x] R1. Aggregate existing per-ticket tests; do not defer first tests/refactor here. Validation: boundary/data-cy/chunk command passes 97/97 including type/dynamic/re-export/require/worker negative fixtures; `T11-EVIDENCE/01-boundaries.log`.
- [x] R2. Content outgoing sibling imports zero; Cards cannot import Decks; shared-svelte-ui/Deck Select no domain imports; domains no generic Shell UI back-edges. Validation: same 97/97 boundary run plus full ESLint pass.
- [x] R3. Public Worker DTO cannot contain Content path/manifest/Blob/function; no concealed identity lookup/render/art GET, runtime allowed pool both seats, frozen vendor unchanged. Validation: aggregate 285/285, vendor 21-file verify, native real-WASM duel.
- [x] R4. Chromium production-build acceptance covers fresh required-only install, explicit media, offline restart, forward save activation and crash matrix, cancellation/resume, cleanup, incompatible CORE/content, unapproved cold SW, two-tab session block, real WASM duel. Validation: `T11-REPAIR-EVIDENCE/114-browser-retry3.exit`=0 (139 E2E+41 acceptance,zero skips);115 headless exit0;116 native core11/11. Stage/native JSON/screenshots/traces retained. Independent review still pending.
- [x] R5. Update architecture routers/ADR implemented status only on evidence; refresh manual checklist with real user-visible flows, no ephemeral durable links. Validation: ADR-089–094 and routers cite immutable accepted SHAs; checklist updated unchecked; build ceilings pass; canonical gaps resolved via acquisition scripts without lock changes/mocks.

## Inputs

I1. All predecessor tests and explicit entrypoint freezes; tests/unit/domain-boundaries.test.ts; tests/unit/data-cy-coverage.test.ts; eslint.config.js

I2. scripts/lib/domain-chunk-closure.ts; scripts/verify-browser-build.ts; playwright.core.config.ts; playwright.acceptance.config.ts

I3. artifacts/manual_test_checklist.md (durable exception); docs/README.md; docs/architecture/architecture.md; ADR-089–094; T1 fixture/canonical asset evidence

**From Depends:** T10 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T10_update-media-cleanup.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** Aggregate validation evidence only; no new production API..

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

### Contract `preview`

```ts
// src/shared-svelte-ui/card-preview/card-preview-view.ts
export interface CardPreviewView {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly statsLine: string | null;
  readonly imageUrl: string | null;
  readonly imageAlt: string;
  readonly placeholderLabel: string;
}
export interface CardPreviewPanelProps {
  readonly preview: CardPreviewView | null;
  readonly dataCyPrefix: string;
  readonly emptyLabel: string;
}
// src/shared-svelte-ui/scrollbar/scrollbar-props.ts
export interface OverlayScrollbarProps {
  readonly axis: "horizontal" | "vertical";
  readonly scrollElement: HTMLElement | null;
  readonly contentSizeKey: string | number;
  readonly dataCyPrefix: string;
}
```

Props implemented by Svelte component, no provider/lease/code prop. Pure preview owns failed-image display only. key is presentation identity; dataCyPrefix provided uniquely by host, all descendants suffix it. Preserve existing labels/style/keyboard behavior; host defaults emptyLabel to existing copy. Scrollbar coordinate helper moves unchanged to focused shared-svelte-ui/geometry/index.ts; no Battle import survives.

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

### Contract `releaseValidation`

```ts
// src/shell/release-validation.ts; pure public producer entry, no UI/IO imports
import type { CardDefinition } from "../cards/index.ts";
import type { StoryRelease } from "../story/ports/index.ts";
import type { BattleRuntimeInput } from "../battle/ports/index.ts";
export interface ReleaseValidationInput {
  readonly chapterCards: readonly CardDefinition[];
  readonly runtimeCards: readonly CardDefinition[];
  readonly story: StoryRelease;
  readonly runtime: BattleRuntimeInput;
  readonly previousStory: StoryRelease | null;
}
export interface VerifiedPublishCandidate {
  readonly schemaVersion: 1;
  readonly manifestVersion: string;
  readonly previousManifestVersion: string | null;
  readonly validation: "passed";
}
export declare function validateReleaseData(input: ReleaseValidationInput): void;
```

validateReleaseData invokes validateCardConsistency, validatePublishedDecks, validateStoryRelease, validateStoryContinuity when previousStory exists, and validateBattleRuntime. Uses Decks-owned PROTOTYPE_RULESET, not Shell-authored quantity rules. Failure Error("CONTENT_SEMANTIC_INVALID"). Publisher reruns validation/source freshness before writing pointer; `progressive/validation.json` records VerifiedPublishCandidate, never substitutes a stamp for validation. previousManifestVersion must equal remote pointer manifest digest used for CAS; null only first publication with no remote pointer, never HTTP/network failure inference. Existing same candidate pointer is idempotent success without rewriting. Release sequence >1 requires previous run. Scripts import this public pure entry, never Story/Battle internals or UI barrels.

**Errors:** Any new invariant failure blocks implementation acceptance; quote failing command/error exactly. Missing generated assets report exact file and existing acquisition command, never claim whole-suite pass from focused tests. No error-code expansion here.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** Production Chromium entry index.html → Shell local selector readiness → installed semantic adapters → all lazy domains/Worker → DOM+IndexedDB+Cache/SW/network trace. Trace artifacts prove actual production paths, not solely mocked components. Real R2 publication/native install beyond Chromium automation remains MISSING and out of scope.

## TDD

- [ ] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [ ] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [ ] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Boundary matrix | positive public + negative foreign/type/dynamic imports | all target constraints enforced |
| Offline required-only | installed release, all requests blocked | Story/editor/collection/real duel work |
| Release crash proof | all migration/selector interruption hooks | only coherent old/new pair visible |
| Cleanup preservation | all domain data populated | save/deck/settings hashes unchanged |
| SW consent multitab | two builds, two tabs, no/yes approval | no unapproved takeover, no active-session interruption |
| Budgets/privacy | production build and hidden material fixtures | existing budgets pass; no identity leakage |

## Impl steps

- [x] P1. Run exact full source boundary/export/data-cy checks with negative fixture cases. Validation: 97/97; no blanket exception or no-op pass.
- [x] P2. Run focused predecessor suites, typecheck/lint/format only intended files, real-WASM integration. Validation: headless full pass, aggregate 285/285, native core 11/11; superseded zero-test file deleted rather than fabricated.
- [x] P3. Build private app and run Chromium production fixtures, two SW builds and crash/reopen cases; retain local screenshots/traces and metadata paths in artifacts. Validation: `T11-EVIDENCE/native-core/`, `native-paths.txt`; observations report five domains, real duel, media requests `[]`.
- [x] P4. Run full existing check:headless/check:browser when T1 canonical assets present. Validation: headless pass; browser command attempted twice, component/build/reproducibility pass, legacy E2E blockers/20-minute bound recorded verbatim.
- [x] P5. Update durable architecture/docs and manual checklist with tracked source/ADR links, implementation commit references only when actual commit exists. Validation: full predecessor SHAs cited; no durable ephemeral links, creds, or rights assertion.

## Validation

- [x] V1. Tests/checks pass; exact commands below executed directly or as stages of aggregate scripts. Validation:114 browser exit0 (1269 components,139 E2E,41 acceptance,build/budgets/reproducibility);115 headless exit0 (types/lint/format,220 legacy,2732 unit including boundaries/data-cy/chunks,54 integration,vendor/assets/snapshot);116 native core11/11. RED44/106/111 evidence retained; no `--passWithNoTests`.

```sh
npx vitest run tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/domain-chunk-closure.test.ts --reporter=verbose
npm run typecheck
npm run vendor:verify
npm run build
npm run test:core
npm run check:headless
npm run check:browser
```

- [x] V2. UI/CLI observation: native screenshots/traces/DB-cache-network JSON retained under `T11-EVIDENCE/native-core/`; source-only inspection not claimed.
- [x] V3. No silent-failure swallow on added path. Validation: approved shop identity and private verified-manifest memo add no catch/fallback; current row/digest validation and existing per-file failure mappings retained. `T11-REPAIR-EVIDENCE/41-memo-regression.log`: 136 focused tests pass.
- [x] V4. App functional: focused core routes 11/11 and boundary negative fixtures pass; unrelated legacy browser failures reported verbatim, not hidden.
- [x] V5. Commit msg draft retained: `test(architecture): prove offline release and module invariants`. No commit/stage/push performed per task.
