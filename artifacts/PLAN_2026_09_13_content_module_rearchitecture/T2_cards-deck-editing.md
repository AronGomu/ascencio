# T2: Canonical Cards with Cards-backed deck editing

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T1  
**Commit outcome:** Deck editing uses canonical immutable Cards through focused Decks APIs; no Decks/Deck Editor Content imports.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: Deck editing uses canonical immutable Cards through focused Decks APIs; no Decks/Deck Editor Content imports.

C3. Out of scope here: No deck schema rewrite, quantity-rule change, card-data authoring, new search feature, domain visibility rule change.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [ ] R1. Move CardCode brand/constructor to Cards; all Battle imports reference same brand, no branded-number casts that hide drift. Immutable record/text/frame/masks become Cards-owned, no vendor runtime import.
- [ ] R2. Keep Decks data/history/quantity/ownership behavior; expose focused named public entries, migrate foreign deep imports except exact pre-existing Content verifier debt scheduled for T8. Keep deck-builder-specific VM/query projection under Decks catalog entry, not canonical Cards ownership.
- [ ] R3. Add cardsDeckCatalog and Shell adapter from existing installed payload to Cards. Existing wire fields scope=record.ot, text preserved, images represented semantically. Transitional Shell adapter may read current installed API until T5/T8; domains may not.
- [ ] R4. Require EditorCatalogInput on DeckEditorApp, no runtimeCatalog/direct fetch fallback. Start with required catalog and null optional art; Story ownership/context and starter seeding unchanged.
- [ ] R5. Every changed consumer remains functional; freeze Cards/Decks public entries, incoming Content restrictions for migrated domains now; no broad exception allowing future Content imports.

## Inputs

I1. src/battle/duel/contracts/ids.ts:1-28; src/decks/catalog/ocg-card-mapper.ts:7-55,100-180; src/decks/catalog/ocg-mask.ts; src/decks/card-frame.ts

I2. src/decks/deck-contracts.ts; deck-repository.ts; deck-validation.ts; deck-resolver.ts; src/deck-editor/DeckEditorApp.svelte

I3. Target-main src/decks/catalog/installed-gameplay-cards.ts; src/shell/core/core-gate.ts; tests/unit/decks/

**From Depends:** T1 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T1_baseline-preflight.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** cards, images, decks, editor.

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

### Focused public-entry inventory

| Entry | Exact named export set / retained source authority |
| --- | --- |
| `src/cards/index.ts` | CardCode, cardCode, CardDefinition, CardImageRef, CardImageVariant, Cards, createCards, parseCardDefinitions, validateCardConsistency, CardFrame, cardFrameOf, CARD_FRAME_COLORS |
| `src/cards/classification/index.ts` | OCG_TYPE, OCG_ATTRIBUTE, OCG_RACE, hasOcgType (existing constants/behavior verbatim) |
| `src/cards/images/index.ts` | CardImageLease, CardImageSource |
| `src/decks/contracts/index.ts` | deckId, DeckId, DeckZone, DeckIssueSeverity, DeckValidationIssue, DeckValidationSummary, DeckCardLists, DeckRecord, ValidatedDeckSnapshot, ResolveDeckResult, DeckCardUpdate, DeckHistory, StoredDeck, DeckAutosaveRecord, cloneCardLists |
| `src/decks/repository/index.ts` | DeckRepository, IndexedDbDeckRepository, DeckStorageError, DeckRevisionConflictError, DeckMigrationError, DECK_DATABASE_NAME, MAXIMUM_DECK_AUTOSAVES, DeckContext, resolveDeckRepository, resolveDeck |
| `src/decks/editing/index.ts` | emptyDeckHistory, pushDeckUpdate, redoDeckUpdate, undoDeckUpdate, MAXIMUM_DECK_NAME_LENGTH, SortDirection, SortMode, FIFTEEN_CARD_GRID, mainDeckGridPlan, DeckGridPlan, applyDeckCommand, createBlankDeck, derivedDeckName, normalizeDeckName, DeckCommand, ensureStarterDeck, STARTER_DECK_LIST, STARTER_DECK_NAME, exportYdk, ydkFilename, importYdk, MAXIMUM_YDK_SOURCE_LENGTH, YdkImportResult, LEGACY_STARTER_DECK_LIST (named export of existing legacy YDK only) |
| `src/decks/validation/index.ts` | validateDeckDraft, validatePublishedDecks, validationDigest, DeckValidationInput, PROTOTYPE_RULESET, quantityLimit, catalogByCode, PinnedDeckRuleset, unlimitedCardOwnership, CardOwnership |
| `src/decks/catalog/index.ts` | cardsDeckCatalog, DeckBuilderCardView, deckBuildableCards, buildDeckCatalogIndex, filterQuickDeckCatalogIndex, filterDeckCatalogIndex, catalogTypeOptions, EMPTY_CATALOG_FILTERS, DeckCatalogFilters, EMPTY_ADVANCED_DECK_CATALOG_FILTERS, advancedDeckCatalogOptions, DeckCatalogQuery, EMPTY_DECK_CATALOG_QUERY, AdvancedDeckCatalogFilters, AdvancedDeckCatalogOptions, CardTrait, LinkMarkerRule, NameMatch, SpellProperty, SummonFrame, TrapProperty, CatalogTypeTag, numericCriterionError, NumericCriterion, NumericOperator |
| `src/decks/index.ts` | Existing minimal root named exports retained; no new code export widens eager closure. Root is compatibility seam, never backdoor for internals. |

### Consumes — binding predecessor contracts

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

**Errors:** Cards errors per contract. Existing DeckStorageError/DeckRevisionConflictError/DeckMigrationError and DeckValidationIssue codes/messages preserved verbatim; no new missing-art validation issue.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** Current target-main DeckEditorApp imports installedDeckCatalog → Content InstalledGameplay. New Shell catalog adapter dispatches EditorCatalogInput prop → DeckEditorApp → DeckBuilderController catalog/store → visible catalog rows and persisted DeckRepository save. No process crossing except existing IndexedDB repository; use fake-indexeddb plus rendered editor evidence.

## TDD

- [ ] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [ ] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [ ] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Canonical card definition | two conflicting same-code records | CARDS_INVALID_DEFINITION |
| Mapping parity | normal/XYZ/link/spell/trap fixture | same labels/stats/classification/race conversion |
| Editor required-only boot | catalog present, images null | library/catalog/edit/save usable; placeholder |
| Ownership preserved | Story collection has 1 copy; deck asks 2 | not-owned error unchanged |
| Boundary negative fixture | Decks imports Content / Cards imports Decks | rejected by AST resolver |

## Impl steps

- [ ] P1. Red: duplicate definition, brand use, mapping equivalence, editor missing-media startup, illegal Decks deep imports. Verify: failures demonstrate old source behavior.
- [ ] P2. Extract Cards definitions/masks/frame; change Battle brand exports without changing CardInstanceId. Verify: existing card visibility/mapper tests green.
- [ ] P3. Add exact Decks sub-entry exports and update imports across source/tests. Replace foreign raw starter-YDK import by named history-source export only where legacy save code still needs it. Verify: module resolution/API freeze.
- [ ] P4. Create Shell catalog adapter, inject EditorCatalogInput, preserve free-play/story repositories and validation inputs. Verify: editor component tests, no Content import in Decks/Editor.
- [ ] P5. Run focused tests/typecheck; record migration debt only for still-unmigrated Story/Battle until T6/T7. Verify: no new exceptional edges, no eager gameplay budget growth.

## Validation

- [ ] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/unit/cards.test.ts tests/unit/decks/ocg-card-mapper.test.ts tests/unit/decks/deck-validation.test.ts tests/unit/decks/deck-repository-context.test.ts tests/component/deck-editor/installed-catalog-boot.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose
npm run typecheck
```

- [ ] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [ ] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [ ] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [ ] V5. Commit msg draft: `refactor(cards): give immutable definitions one owner`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.
