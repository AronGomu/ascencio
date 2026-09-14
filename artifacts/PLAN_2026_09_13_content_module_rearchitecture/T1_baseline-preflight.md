# T1: Baseline, fixtures, operator preflight

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** none  
**Commit outcome:** Safe clean implementation lane and reproducible local fixtures exist before source migration.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: Safe clean implementation lane and reproducible local fixtures exist before source migration.

C3. Out of scope here: No implementation refactor, package version changes, merge/push, production publication, disposal of dirty work.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [ ] R1. Frontload owner-only prerequisites: intended private/public eligibility, R2 account/custom domain/CORS/budget approval/credential presence if later live publish desired. Record present/missing only. Local fake-R2 acceptance needs no live credential.
- [ ] R2. Do not fast-forward dirty root or blanket-merge T7. Recheck target SHA and choose clean isolated implementation lane from target-main; preserve every root/T7 byte. No history rewrite/stash/reset/clean/mass-commit. Main remains delivery target.
- [ ] R3. Inventory target-main Content coupling and T7-unique salvage by exact path, hash, decision keep/adapt/not-needed; inspect before copying. Do not read/store unrelated private file contents. Never treat old plan states as code evidence.
- [ ] R4. Create deterministic in-memory HTTP fixture builder from schema3 contract below; per-file digest data, missing-required/optional variants, request log, fake R2 CAS transport. Real engine integration uses canonical generated snapshot, not fake WASM.
- [ ] R5. Baseline exact checks and generated-asset availability; obtain local asset setup up front or mark real-WASM/browser final acceptance blocked with precise missing path/command. No package upgrade or public deployment.

## Inputs

I1. AGENTS.md; docs/ADR/045_ADR_single_branch_trunk_development.md; package.json; scripts/lib/asset-delivery/player-payload.ts

I2. Root 25d761f; origin/main/core-integrate 010401956d; dirty T7 bf3bce5; source scout reports in artifacts/GRILL_2026_09_13_content_module_rearchitecture/

I3. docs/assets/asset-delivery-setup.md; scripts/lib/asset-delivery/config.ts; content/asset-publication-approval.json path only (never copy credential contents)

**From Depends:** none; baseline and fixtures produced here.

## Interface contract (level 5)

**Produces:** fixture, wire.

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

### Consumes — binding predecessor contracts

No predecessor production API; existing inspected source/fixture dependencies above.

**Errors:** Preflight unresolved owner-only live setup recorded DEPLOYMENT_PREREQUISITE_MISSING; never blocks local fixtures. Unsafe cwd or moving baseline -> IMPLEMENTATION_BASELINE_UNSAFE, no mutations. Fixture unknown URL -> HTTP 404, malformed fixture options -> Error("PROGRESSIVE_FIXTURE_INVALID").

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** Existing producer trigger scripts/content-catalog.ts:1-16 → scripts/lib/asset-delivery/content-cli.ts:13-68 → player-payload.ts:24-59 → generated run. New fixture receives exact content/files and content/manifests URLs locally, observes requests[]; remote hosting trace MISSING and deliberately out of acceptance.

## TDD

- [ ] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised.
- [ ] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions.
- [ ] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Fixture contract red/green | missing then implemented createProgressiveFixture | initial failure; deterministic pointer/manifest/file hashes thereafter |
| Required/optional variants | missingRequired true / optionalMedia false | request log proves missing required differs from optional omission |
| No remote effect | fake endpoint + publisher dry run | no external requests/PutObject |
| Baseline preservation | before/after original root/T7 path+hash inventory | selected source bytes identical; no staged unrelated path |

## Impl steps

- [ ] P1. Record safe implementation cwd, actual SHAs, dirty-file path/status baseline, selected source-file SHA-256 inventory in artifacts/BASELINE_content_module_rearchitecture.md. Verify: no original worktree mutation.
- [ ] P2. Write fixture contract test first; missing builder must fail import/test. Add smallest builder with canonical digests and explicit failures. Verify: unit fixture test green.
- [ ] P3. Run npm ci only in authorized clean implementation cwd when lock/deps missing; no global install. Run local producer/setup verification against fixture-only paths; verify no remote writes.
- [ ] P4. Run boundary baseline + vendor:verify; probe canonical snapshot inputs used by installed-runtime-wasm fixtures. Verify: exact outcomes recorded, missing assets not called passed.
- [ ] P5. Lock implementation scheduler: one writer per cwd; T2/T4 and T6/T7 may be advisory parallel only. Verify: all human-owned prerequisites collected here, deployment outside acceptance.

## Validation

- [ ] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`.

```sh
npx vitest run tests/unit/progressive-fixture.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose
npm run vendor:verify
```

- [ ] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof.
- [ ] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures.
- [ ] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden.
- [ ] V5. Commit msg draft: `test(content): establish reproducible migration baseline`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit during planning.
