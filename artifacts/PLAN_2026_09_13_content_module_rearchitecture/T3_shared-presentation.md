# T3: Prop-only shared preview and scrollbar

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T2  
**Commit outcome:** Battle/editor/story share pure preview/scrollbar; Deck Select no longer imports Decks/Card semantics.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: Battle/editor/story share pure preview/scrollbar; Deck Select no longer imports Decks/Card semantics.

C3. Out of scope here: No redesign, toast/stage business ownership move, reusable mega-component, new animation.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [ ] R1. Move focused components to src/shared-svelte-ui/card-preview/index.ts and scrollbar/index.ts; all imported generic geometry leaves Battle for src/shared-svelte-ui/geometry/index.ts.
- [ ] R2. Shared views accept complete VMs, no lease/imageLibrary/static provider/code/data source props. Host containers own asynchronous image leases, stale results, release on key change/unmount.
- [ ] R3. Preserve appearance and scroll keyboard/pointer behavior; image error placeholder local state remains valid pure-view behavior. All instances get unique dataCyPrefix.
- [ ] R4. Deck Select host VM carries frameColor:string and resolved imageUrl:string|null; remove CardFrame/CARD_FRAME_COLORS imports. Host uses Cards classification; Deck Select itself imports no sibling.
- [ ] R5. Remove preview/scrollbar/preview VM exports from Shell public barrel. Stage/toast coordination remains Shell, not moved into generic shared data API. Register shared root in data-cy/import scans immediately.

## Inputs

I1. src/shell/card-preview/CardPreviewPanel.svelte:8-63; card-preview-view.ts; OverlayScrollbar.svelte:3-7

I2. src/deck-select/DecklistPanel.svelte; deck-select-contracts.ts; src/battle/app/presentation/card-preview.ts

I3. All Shell UI consumers in scout-domain-contracts.md G1-G5; tests/unit/data-cy-coverage.test.ts; src/battle/field/stage-frame.ts

**From Depends:** T2 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T2_cards-deck-editing.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** preview.

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

### Consumes — binding predecessor contracts

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

**Errors:** Optional missing/error media uses null/placeholder contract. Render-time errors follow Shell root boundary; no shared component persistence/network errors or domain-specific catch logic.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** Host hover trigger src/battle/app/presentation/card-preview.ts:1-91 → consumer visibility adapter → CardImageSource.acquire(code,variant,signal) → Shell cache-only adapter → resolved VM prop → shared img/placeholder. Observe DOM plus acquire spy; concealed overlay identityVisible:false must never dispatch acquire.

## TDD

- [ ] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [ ] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [ ] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| No connected shared view | source import to domain or provider prop | boundary fixture rejected |
| Lease race | hover A then B, A resolves last | A released, only B shown |
| Hidden identity | concealed material vs own face-down known card | 0 identifying read for concealed; known own preview retained |
| Scrollbar parity | scaled pointer + PageUp/PageDown/Home/End | existing coordinate and keyboard behavior |
| Instance uniqueness | two previews with stable host prefixes | all rendered data-cy unique |

## Impl steps

- [ ] P1. Red: shared component provider import/source prop rejected; duplicate preview prefixes fail; hidden overlay performs zero lookup. Verify: negative fixtures fail old design.
- [ ] P2. Move generic coordinate helper unchanged; rewire Battle/private consumers through shared geometry public entry. Verify: coordinate/scroll tests.
- [ ] P3. Implement pure preview props; containers build VM and own image acquisition. Verify: race-disposal, image-error, no network acquisition.
- [ ] P4. Update all Battle/Editor/Story/acceptance-harness/Deck Select hosts; freeze Shell removal/shared public exports. Verify: no missed consumers.
- [ ] P5. Run component/privacy/data-cy tests and Chromium parity screenshot when app fixture available. Verify: visual behavior unchanged, unique selectors.

## Validation

- [ ] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/component/OverlayScrollbar.test.ts tests/component/deck-editor/card-preview-pane.test.ts tests/component/deck-editor/catalog-scrollbar.test.ts tests/unit/card-preview.test.ts tests/unit/card-visibility.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/shared-svelte-ui.test.ts --reporter=verbose
npm run typecheck
```

- [ ] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [ ] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [ ] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [ ] V5. Commit msg draft: `refactor(ui): keep shared views independent of domains`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.
