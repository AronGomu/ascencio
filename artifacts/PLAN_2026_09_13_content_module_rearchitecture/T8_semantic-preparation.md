# T8: Shell composes completed semantic validators

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T6, T7  
**Commit outcome:** One preparation flow verifies required release semantics, builds pinned consumer adapters, removes Content→Decks exception.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: One preparation flow verifies required release semantics, builds pinned consumer adapters, removes Content→Decks exception.

C3. Out of scope here: No activation/save mutation, duplicate business rules in Shell, Content contracts exposed to domains, UI redesign.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [x] R1. Inventory every old verifyGameplay check; assign structural path/hash checks Content, card metadata consistency Cards, token/quantity/zone Decks, story/default/ref/continuity Story, runtime support/ABI Battle. No check deleted merely to satisfy imports.
- [x] R2. Implement prepareRelease and Shell adapters; optional refs validated structurally but bytes never required. Return pinned complete domain inputs, not global raw reader exposed to domains.
- [x] R3. Canonical chapter/runtime card/text consistency and union conflict/dedup/default semantics preserved; whole runtime never unlocks uninstalled chapter cards. Required semantic failure prevents candidate readiness.
- [x] R4. Remove semantic wire contract/parser ownership from Content public surface; producer imports domain pure public validators plus Shell composition only through purpose-built pure validation entry, not UI. Content itself stays import-independent.
- [x] R5. Add same semantic/continuity validation to official producer verification/publisher precondition; previous official release descriptor required when releaseSequence>1. Record its manifestVersion in verified run metadata; T4 publisher binds that exact digest to CAS predecessor pointer, not arbitrary local previous-run. Runtime no downloaded code migrations.

## Inputs

I1. T2 Cards/Decks validators and EditorCatalogInput; T6 Story ports/parser/continuity; T7 BattleRuntimeSource/parser/validator

I2. Target-main src/content/install/verify-gameplay.ts:1-190; load-installed-gameplay.ts:34-127; src/shell/core/core-gate.ts:53-145

I3. src/content/parsers/chapter-gameplay.ts; chapter-story-document.ts; scripts/lib/asset-delivery/player-payload.ts

**From Depends:** T6 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T6_story-save-generations.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.; T7 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T7_battle-runtime.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** candidate, releaseValidation.

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

### Contract `editor`

```ts
// src/deck-editor/ports/editor-catalog-input.ts; exported by src/deck-editor/ports/index.ts
import type { Cards } from "../../cards/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type { DeckCardLists } from "../../decks/contracts/index.ts";
export interface EditorCatalogInput {
  readonly cards: Cards;
  readonly images: CardImageSource;
  readonly starter: Readonly<{ name: string; cards: DeckCardLists }>;
}
```

DeckEditorApp receives required `catalogInput: EditorCatalogInput`; Shell supplies it for free-play/story contexts. Existing route/context/callback props remain. No fallback runtimeCatalog fetch, no direct Content imports, no image readiness gate. Story ownership still narrows Cards through Decks CardOwnership; full allowed chapter catalog does not grant ownership.

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

No Content types/paths/receipts; script.name is engine semantic script filename (e.g. c123.lua), not content-store path. Shell adapter loads+decodes whole frozen-compatible runtime support, allowedCardCodes selected chapter union only. wasmBinary transferred once per fresh source.load; source returns fresh ArrayBuffer so replay/restart cannot reuse detached buffer. requiredScripts comes from verified script index plus global inventory for whole runtime support pool, sorted unique names; missing indexed card/global script rejects BATTLE_RUNTIME_INVALID, genuinely unindexed normal card remains valid. Cards/text/scripts cloned; race decimal -> bigint only inside Worker engine adapter, linkMarker -> link_marker there. Parse IPC rejects invalid/oversized/duplicate data before engine initialization; retain existing runtime bounds, pure validateBattleRuntime checks supported pool, dependency/script/globals/string presence and supported version. Repair clarification: asynchronous Battle-owned validateFrozenBattleExecutable hashes exact frozen vendor-manifest/WASM bytes before preparation or producer/publisher readiness. Synchronous validateReleaseData signature remains unchanged; it does not hash bytes. Main thread never imports OcgCoreAdapter runtime. Worker initializes engine, ABI checks actual getVersion, preloads callbacks synchronously; no Content re-verification. Existing progress channel, error codes snapshot_validation_failed/engine_initialization_failed/dependency_resolution_failed and diagnostics preserved. New input parse failure exact Error("BATTLE_RUNTIME_INVALID"); source required read failure reaches Shell APP_REQUIRED_INPUT_FAILED.

**Errors:** Required/semantic errors mapped APP_REQUIRED_INPUT_FAILED preserving non-public cause. Optional-media failures reported warning+null only. Publisher semantic error CONTENT_SEMANTIC_INVALID; no raw paths/remote text in player errors.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** StagedContent from T5 → Shell prepareRelease → ContentReader required bytes → Cards/Decks/Story/Battle pure validators → PreparedRelease → T9 activation caller. Observe validator spies plus invalid fixture rejection; producer validate-release-data uses same pure semantics before fake-R2 pointer commit. Existing verifier src/content/install/verify-gameplay.ts:1-190 is parity ledger source.

## TDD

- [x] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [x] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [x] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Validation parity | each old verifier failure branch | same rejection category, owned validator exercised |
| Optional media | referenced valid manifest media absent locally | candidate ready, null media |
| Conflict | same ID different chapter definition | APP_REQUIRED_INPUT_FAILED |
| Domain-independent Content | any sibling import/type import/dynamic import | boundary rejects |
| Stale predecessor | locally valid old predecessor, different published predecessor | PUBLISH_CONFLICT; no pointer change |
| Official continuity | previous beat/set/card removed | publication blocked; previous pointer unchanged |

## Impl steps

- [x] P1. Red: unsupported token/wrong zone/copy limit, conflicting chapter ID, mismatched runtime text, missing media metadata vs missing media bytes. Verify: inventory names old branch and replacement test.
- [x] P2. Build Shell adapters under src/shell/adapters/; move/reuse pure validators into proper owner, avoid copied rules. Verify: no foreign internals or new synchronous engine calls.
- [x] P3. Implement prepareRelease over staged Content plus consumer validators; track object URL leases per adapter, dispose idempotently. Verify: all input providers pinned to same release receipt.
- [x] P4. Replace Content verifyGameplay/loadInstalledGameplay semantic ownership; keep structural parser/integrity code. Remove explicit Content→Decks allowance, enforce only application/adapters import Content. Verify: negative AST fixtures.
- [x] P5. Wire producer semantic validation via src/shell/application/validate-release-data.ts pure entry (no DOM/IDB/network imports); official continuity check previous→next. Verify: publish refuses omitted/failed semantic validation.

## Validation

- [x] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose
node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts
npm run typecheck
```

- [x] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [x] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [x] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [x] V5. Commit msg draft: `refactor(shell): compose semantic validation outside Content`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.

## Completion evidence

- E1. RED: `artifacts/T8-EVIDENCE/red-vitest.log` and `red-node.log`, both exit `1`, capture missing T8 contracts/behavior before implementation.
- E2. GREEN: exact Vitest command passes 53/53; exact Node command passes 26/26; `npm run test:legacy` passes 198/198. Logs and exit files: `artifacts/T8-EVIDENCE/`.
- E3. Quality: typecheck exits `0` with 4 pre-existing warnings; scoped ESLint/Prettier, `git diff --check`, vendor diff, staging checks exit `0`.
- E4. CLI trace: fake injected S3 transport test passes 1/1; no real endpoint contacted. `validation.json` forgery and stale predecessor tests pass without pointer mutation.
- E5. Known unrelated build budget remains: current `118072 > 115000`; accepted-baseline reproduction is worse at `130862 > 115000`. Graph update deferred due known external `429 RESOURCE_EXHAUSTED`; no backend update attempted.

## Bounded repair evidence — acceptance pending independent review

- [x] R1. Publisher rights cover every declared metadata source digest, file-only `metadata` approvals, frozen inventory identity, upload-byte hashes, immediate pre-CAS complete verification on every CAS attempt. Verify: exact Node suite 47/47, fake CLI mutation/invalid cases, exact errors/zero pointer writes/closure.
- [x] R2. Executable/history trust verified. Verify: wrong-WASM/wrong-vendor producer/preparation/publisher cases; strict decreasing predecessor sequence; iterative 4096-release + 64-GiB work budget; cap/cap+1 cheap checks; SHA-matched initial-source replay reproduces old equal-sequence acceptance.
- [x] R3. Media/staged contracts repaired. Verify: four shared read/Blob slots, queued exact DOMException, nested immutable staged snapshot before first await, pinned lazy media, dispose/release revoke once.
- [x] R4. Legacy Content type laundering removed without UI redesign. Verify: Shell consumer view models, Content impl in application/adapters, negative export/type alias/multi-hop fixtures; 40-row old verifier branch/owner/test matrix at `artifacts/T8-REPAIR-EVIDENCE/verifyGameplay-parity.md`.
- [x] R5. Checked validation evidence captured. Verify: focused Vitest 101/101; Node 47/47; legacy 220/220; affected unit 147/147; progressive storage 126/126; component/editor 376/376; bootstrap follow-up 56/56; typecheck 0 errors/4 inherited warnings; scoped quality/vendor/diff checks. `npm run build:verify` now passes with Shell 95987/115000 bytes after lazy bootstrap split, no budget-limit increase. T11 retains broader build/delivery acceptance ownership.

### Independent acceptance

- [ ] A1. Reviewer accepts repaired ticket. Verify: independent review of `artifacts/IMPLEMENTATION-REPORT-T8-repair.md` + `artifacts/T8-REPAIR-EVIDENCE/`. Prior initial completion evidence remains historical, not self-acceptance.
