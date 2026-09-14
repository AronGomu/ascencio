# T6: Story semantic input and forward save generations

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T3, T5  
**Commit outcome:** Story boots from semantic input with optional media; all supported saves can prepare a sealed forward generation.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: Story boots from semantic input with optional media; all supported saves can prepare a sealed forward generation.

C3. Out of scope here: No story rewrite/new chapters, changed economy/ownership, raw legacy binding migration, activation selector, historical game selector.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [ ] R1. Story owns document/release validation, shop set metadata, story binding, save generations. Remove ALL Content imports from Story including reducer/handoff/repository/collection type aliases, not only component props.
- [ ] R2. Shell-owned story adapter reads staged Content and translates into StoryRelease/StoryMedia; StoryApp required release + generation repository inputs trusted. Missing optional map/set image returns null, never blocks narrative/shop.
- [ ] R3. Copy-on-write generation prepares all five supported slots in one Story tx, seals only after complete parse/migration; active-generation startup verifies semantic descriptor rather than original mutable slot hashes. Preserve old generation/legacy raw slots; no selected active Story pointer.
- [ ] R4. Forward migration preserves whole StoryState and story-owned decks/economy/checkpoints. narrativeIndex maps by semantic beat ID from stored source descriptor. Missing removed IDs or corrupt/future slot rejects whole migration; no dropped slot, starter grant, balance change.
- [ ] R5. All manual/autosave/checkpoint/Story deck-editor/openStoryDeckContext/handoff/admin paths use injected generation repository. Normal writes require held Shell lifecycle lease; Story does not acquire Content locks or inspect manifests. Legacy save status visible, preserved.

## Inputs

I1. Target-main src/story/StoryApp.svelte; collection/collection-cards.ts; shop/shop-data.ts; T7 content/installed-story.ts and InstalledStoryApp.svelte

I2. T7 saves/story-save-contracts.ts:17-63,130-180; saves/story-save-repository.ts:50-215; model/story-state.ts:57-112; handoff/story-handoff.ts

I3. Current producer ChapterGameplay/ChapterSet/ChapterStoryDocument fields in src/content/contracts/ (wire semantics relocate; domain API never imports them)

**From Depends:** T3 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T3_shared-presentation.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.; T5 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T5_progressive-storage.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** story, saves.

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

**Errors:** Story release/migration/storage errors as contracts. Preserve standard save result unions and stale-write UI. Async read/list failure dispatched visibly to Shell or local save error surface, never list=[] on failed DB.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** Story save button/autosave/pre-duel handoff → injected GenerationSaveRepository.write(slot,state,revision,story) → IDB generationSaves [generationId,slot] parsed/CAS → saved revision UI. Activation caller later prepare(source,target) → Story migration → one tx all slots+seal → verifySeal; never selector write. Existing source anchors saves/story-save-repository.ts:171-215 and model/story-state.ts:57-112.

## TDD

- [ ] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [ ] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [ ] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Optional Story media | valid story, acquireMap null | narrative/map UI usable, placeholder |
| All-slot COW | 5 schema6 saves with economy/decks/checkpoint | 5 prepared saves; old hashes identical |
| Narrative continuity | insert beat before saved beat | saved semantic beat preserved at new index |
| Migration refusal | removed beat / unknown schema / corrupt slot | STORY_MIGRATION_FAILED; old pair unchanged |
| CAS and lease | stale tab write during preparation | serialized/blocked; no overwritten source |
| Active-generation reopen | activate, normal write/clear, reopen against same StoryRelease | verifyActiveGeneration succeeds without comparing old preparation seal; missing generation fails |
| Legacy preservation | schema1–5 in old saves | bytes unchanged; incompatible shown, not guessed |

## Impl steps

- [ ] P1. Red: null map boots; all five slots copy; missing beat rejects; old bytes unchanged after abort/quota; Content import fixture fails. Verify: failures hit current coupled source.
- [ ] P2. Create pure StoryRelease/parser/continuity validator, semantic map/set media ports; Shell adapter maps wire fields without implementing Story rules. Verify: shop rarity/printing metadata and defaults preserved.
- [ ] P3. Add DB v2 generations/generationSaves stores without changing saves. Implement prepare/verifySeal/repository plus strict slot/descriptor validation. Verify: COW crash boundaries, stale CAS, no active pointer.
- [ ] P4. Inject StoryApp and collection/shop/handoff/Story deck contexts; replace old read-only Shell save scanner by Story public saves entry where appropriate. Verify: every save path bound to same generation.
- [ ] P5. Run migration/component tests and boundary enforcement. Expose narrow pure ports/saves/validation entries without eager Story UI. Verify: no runtime Content type or path in Story source.

## Validation

- [ ] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/unit/story/story-release.test.ts tests/unit/story/save-generations.test.ts tests/unit/story/story-save-repository.test.ts tests/component/story/installed-story.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose
npm run typecheck
```

- [ ] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [ ] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [ ] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [ ] V5. Commit msg draft: `feat(story): stage forward saves without overwriting progress`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.
