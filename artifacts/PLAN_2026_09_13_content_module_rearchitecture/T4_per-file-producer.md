# T4: Deterministic per-file producer and safe publisher

**Plan:** `./artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`  
**Depends:** T1  
**Commit outcome:** Producer emits immutable per-file release; local fake R2 proves files→manifest→pointer ordering and concurrency.

## Context (self-contained)

C1. Goal: canonical Cards, focused Decks APIs, pure shared UI, Shell-only Content composition, immutable progressive files, explicit media/updates, forward-safe saves. Main delivery target; salvage useful T7 source only.

C2. This slice: Producer emits immutable per-file release; local fake R2 proves files→manifest→pointer ordering and concurrency.

C3. Out of scope here: No public deployment, remote prune, dev ZIP format removal, runtime/vendor loader changes, signing, speculative future chapter creation.

C4. Assumptions in force: no deployed ZIP bridge; existing legacy bytes/saves/settings preserved. Optional media never gates play; explicit downloads only. Activation/CORE reload Main Menu-only, every active domain tab blocks. Code contracts below are proposed target, not existing APIs.

C5. One writer per cwd; dependencies permit advisory parallel analysis, not shared-worktree concurrent mutation. No root/T7 dirty file overwrite, history rewrite, system apply or live deployment. Existing source path references default to target-main `010401956d` established by T1; T7-only paths labeled.

## Requirements

- [x] R1. Reuse canonical asset-root/profile selection and PayloadFile raw/derived bytes; replace player ZIP packaging only, preserve developer archive commands. No source/public directory sweep fallback. Evidence: progressive CLI uses `scanAssetProfiles` + `playerPayload`; legacy `assets:bundle` regressions pass in `artifacts/T4-EVIDENCE/producer-regressions.log`.
- [x] R2. Implement schema3 manifest, stable pointer and full SHA-256 path identity; required roles derived from payload ownership, not extension-only guesses. 50,000 file fixture accepted within 32 MiB; preserve runtime parser caps. Evidence: focused Node + manifest logs; 50,000 accepted, 50,001 rejected.
- [x] R3. Add content:publish entry with explicit --check dry run; immutable conditional create, verify existing same-key digest/length, manifest after files, pointer CAS last. releaseSequence must exceed current except identical idempotent retry. Candidate records validated predecessor manifestVersion; publish requires equality with manifestVersion in pointer fetched for CAS. Stale predecessor rejects PUBLISH_CONFLICT even if candidate sequence is larger; fresh validation against actual predecessor required before retry. Evidence: ordering, idempotence, same-ETag concurrency, stale predecessor, immutable conflict cases pass in `green-node-tests.log`.
- [x] R4. Source freshness rehashes real canonical inputs/derived metadata before compare. CI test flips one source byte after freeze; verifier must fail stale, not pass internally consistent old run. Evidence: direct + CLI stale-source assertions return `CONTENT_SOURCE_STALE` in `green-node-tests.log`.
- [x] R5. No real R2 upload/deploy during acceptance. Test SDK transport locally with ETag CAS, retry/collision/error injection. Rights approval/config required for live command, secrets absent from stdout/run metadata. T8 later adds domain continuity prepublish validation; live mode remains blocked until that validator wired. Evidence: injected `S3ProgressiveTransport` fake tests; CLI `--check` reports semantic block; live path checks approval/config/credentials then refuses without T8 validation.

## Inputs

I1. scripts/lib/asset-delivery/player-payload.ts:7-59; source-mapping.ts:19-31; bundle-locked.ts:52-115; canonical-json.ts

I2. scripts/content-pack.ts; scripts/content-verify.ts; scripts/lib/asset-delivery/content-cli.ts:13-68

I3. scripts/lib/asset-delivery/config.ts:1-42; setup.ts:12-60; package.json AWS SDK; docs/ADR/092_ADR_immutable_per_file_content_delivery.md

**From Depends:** T1 leaves `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T1_baseline-preflight.md` contract implemented at exact `src/`/`tests/` paths embedded below; predecessor ticket need not be opened.

## Interface contract (level 5)

**Produces:** wire.

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

**Errors:** CLI exit 0 success, 1 failure; exact stderr codes CONTENT_SOURCE_STALE, CONTENT_INVALID_MANIFEST, CONTENT_PREVIOUS_RELEASE_REQUIRED, PUBLISH_CONFLICT, PUBLISH_IMMUTABLE_CONFLICT, PUBLISH_NETWORK_FAILED, PUBLISH_APPROVAL_REQUIRED, PUBLISH_SEMANTIC_VALIDATION_REQUIRED. No silent retry of conditional conflict; network retry max 2 attempts, immutable key idempotent.

**Invariants:** requirements R1–R5 plus exact contract notes above. No future component may silently widen an entrypoint or change predecessor error/nullability/ordering semantics.

**Integration links:** scripts/content-pack.ts → playerPayload source/digest seam → generated/asset-delivery/runs/<uuid>/progressive/manifest.json + pointer.json + objects/ → scripts/content-publish.ts SDK conditional PutObject (credentials maintainer env only) → fake-R2 recorded object rows/ETag/latest pointer. Live observe MISSING, excluded. Public URL path = existing publicBaseUrl plus content/...; R2 key = keyPrefix plus same suffix.

## TDD

- [x] D1. Red — write named test cases from Test plan first; execute focused command and capture intended failure. No passing test for behavior not yet exercised. Evidence: `artifacts/T4-EVIDENCE/red-node-tests.log` (`ERR_MODULE_NOT_FOUND`, exit 1).
- [x] D2. Green — minimum scoped implementation makes same assertions pass. Preserve existing regressions. Evidence: 10 focused Node tests, 3 focused Vitest tests, 34 producer regressions pass.
- [x] D3. Refactor — only new duplication/unused imports caused by this slice; rerun exact tests. No adjacent cleanup. Evidence: targeted Prettier/ESLint clean; exact tests rerun after final edits.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Determinism | shuffled same source files | manifest/object bytes identical |
| Stale generation | change source byte after pack | CONTENT_SOURCE_STALE |
| 50,000 entries | bounded synthetic inventory | parse accepts; 50,001 rejected |
| Publish failure | file upload fails before manifest | latest pointer unchanged |
| Concurrent publisher | N+1 and N+2 based same ETag | one CAS wins; loser PUBLISH_CONFLICT; no regression |
| Published predecessor binding | candidate validated against release1; remote current release2 adds references | PUBLISH_CONFLICT before any latest-pointer write; revalidation mandatory |
| Immutable identity | existing key different bytes | PUBLISH_IMMUTABLE_CONFLICT; no overwrite |

## Impl steps

- [x] P1. Red: deterministic output, single-byte invalidation, 50k entries, no pointer-before-files, stale concurrent publisher. Verify: old ZIP output fails target schema. Evidence: red missing-module log precedes implementation; final named cases plus schema2 rejection pass.
- [x] P2. Build focused progressive-payload/manifest producer at existing payload seam; add bounded schema parser. Verify: same inputs identical bytes independent clock/host/order. Evidence: deterministic source creation-order test passes; T1 bounded parser reused unchanged.
- [x] P3. Implement content:pack --release-sequence N --core-min N --core-max-exclusive N [--previous-run PATH]; content:verify --run PATH --check-sources; strict CLI/help tests. Verify: sequence>1 requires previous run and no implicit empty history. Evidence: CLI help log + real fixture pack/verify regression + predecessor test.
- [x] P4. Implement content:publish --run PATH [--check], SDK transport put-if-absent/head/get/pointer-if-match. Verify: fake R2 handles 412/CAS races/idempotent recovery; no overwrites of divergent immutable bytes. Evidence: local fake S3 command transport tests pass.
- [x] P5. Wire CI freshness tests, print candidate run path/digests only. Verify: no credentials or raw auth headers in logs, no published-success claim without conditional pointer success. Evidence: root `tests/*.test.ts` freshness case, bounded CLI JSON fields, pointer success returned only after CAS.

## Acceptance repair — retry1

State: **R1–R3 repaired; checks passed; independent review pending.** Parent approved bounded findings in `artifacts/REVIEW-T4.md`; route `openai-codex/gpt-6-astra:high` after failed Sol-high acceptance. T5 not started; P1/T1–T3 unchanged.

- [x] A1. Red regressions precede source repair. Verify: `artifacts/T4-REPAIR-EVIDENCE/red-node-tests.log`, exit 1; 10 intended failures/11 passes. R1 `CONTENT_SOURCE_STALE`; R2 nine missing-rejection failures. R3 already passes existing correct implementation.
- [x] A2. Historic predecessor integrity independent of current sources; current candidate verify/publish still fresh. Verify: changed-source successor, corrupted historic object, stale candidate/no-remote assertions pass in `green-node-tests.log`.
- [x] A3. Exact inventory-derived manifest roster/descriptors enforced before object/remote reads. Verify: parsed valid frozen fixtures; omitted optional payload, role/required, packIds, MIME, snapshot, chapter title/description, story descriptor, invalid inventory reject; publish SDK calls remain zero.
- [x] A4. Same-length immutable collision executes GET/hash rejection without overwrite. Verify: one GET for byte-flipped key; divergent SHA-256, same length, unchanged stored bytes, no pointer in `green-node-tests.log`.
- [x] A5. Final checks plus repair report. Verify: Node 55/55; Vitest 41/41; typecheck 0 errors/4 pre-existing warnings; targeted Prettier/ESLint/diff/staging exit 0; 2015 tracked baseline hashes unchanged. `artifacts/IMPLEMENTATION-REPORT-T4-repair.md`; exact commands/output/exit codes in repair evidence dir.

### Review gate

- [ ] G1. Independent acceptance. Verify: parent/reviewer accepts R1–R3 repair; T5 remains blocked until explicit acceptance.

## Validation

- [x] V1. Tests/checks pass; run exact commands below after test paths exist. Record red and green output, no `--passWithNoTests`. Evidence: `artifacts/T4-EVIDENCE/red-node-tests.log`, `green-node-tests.log`, `green-manifest-vitest.log`, `cli-help.log`, `typecheck.log`.

```sh
node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts
npx vitest run tests/unit/progressive-manifest.test.ts --reporter=verbose
npm run content:pack -- --help
npm run content:publish -- --help
```

- [x] V2. UI/CLI observation: execute integration trace and observe stated DOM/DB/cache/network/CLI result; screenshots/traces local under artifacts. Source-only inspection not runtime proof. Evidence: CLI pack/verify runs against canonical fixture; CLI dry-run + fake SDK call trace asserted by executable tests.
- [x] V3. No silent-failure swallow on added path: list every retained `|| true`, empty catch, redirected failure, unobserved Promise with justification, or `none`. Existing out-of-scope sites stay; newly connected paths surface failures. Inventory: none.
- [x] V4. App functional: this slice's routes/consumers pass regression tests; boundary fixture rejects forbidden imports; unrelated baseline failure reported verbatim, not hidden. Evidence: 130 parser/fixture/boundary tests pass in `content-boundary-regressions.log`; typecheck 0 errors/4 pre-existing warnings.
- [x] V5. Commit msg draft: `feat(content): publish immutable files without ZIP churn`. Commit only after implementation authorization/evidence; intentional paths only, no secrets/generated assets/unrelated dirt. No commit created; staging empty.
