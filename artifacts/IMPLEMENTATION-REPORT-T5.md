# T5 implementation report — progressive storage

Status: **done; parent independent review required**

## Outcome

`ProgressiveContentStore` now stages immutable path+version files into Cache Storage plus receipt-gated IndexedDB rows, resumes only explicit exact-UUID requests, seals verified required chapter closure without activation, reads offline with `baseUrl: null`, and exposes caller-locked cleanup. Required jobs never request media.

T4 dependency: accepted commit `5c2ddff`. T1–T3 baseline: `e338808`.

## Changed paths

- `src/content/contracts/progressive-content-store.ts`
- `src/content/index.ts`
- `src/content/storage/content-cache.ts`
- `src/content/storage/content-database.ts`
- `src/content/storage/progressive-content-store.ts`
- `src/content/storage/progressive-storage-validation.ts`
- `src/shell/screens/InstallContentScreen.svelte`
- `tests/component/content-installer.test.ts`
- `tests/fixtures/progressive-storage.ts`
- `tests/unit/domain-boundaries.test.ts`
- `tests/unit/progressive-download.test.ts`
- `tests/unit/progressive-storage.test.ts`
- `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T5_progressive-storage.md`
- `artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md`
- `artifacts/IMPLEMENTATION-REPORT-T5.md`
- `artifacts/T5-EVIDENCE/red-vitest.log` (ignored `*.log` runtime evidence)
- `artifacts/T5-EVIDENCE/green-vitest.log` (ignored `*.log` runtime evidence)
- `artifacts/T5-EVIDENCE/typecheck.log` (ignored `*.log` runtime evidence)
- `artifacts/T5-EVIDENCE/content-regressions.log` (ignored `*.log` runtime evidence)
- `artifacts/T5-EVIDENCE/eslint.log` (ignored `*.log` runtime evidence)
- `artifacts/T5-EVIDENCE/prettier.log` (ignored `*.log` runtime evidence)
- `artifacts/T5-EVIDENCE/diff-check.log` (ignored `*.log` runtime evidence)
- `artifacts/T5-EVIDENCE/staging.log` (ignored `*.log` runtime evidence)
- `artifacts/T5-EVIDENCE/status.log` (ignored `*.log` runtime evidence)

## TDD evidence

### Red

Command:

```sh
npx vitest run tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose
```

Exit: `1`. Result: 13 failed, 39 passed. Intended failures: `openProgressiveContentStore is not a function`; frozen Content public API lacked new export. Evidence: `artifacts/T5-EVIDENCE/red-vitest.log`.

### Green

Same command. Exit: `0`. Result: 3 files, 55 tests passed. Evidence: `artifacts/T5-EVIDENCE/green-vitest.log`.

Runtime assertions executed through `fake-indexeddb`, local HTTP fixture transport, and Response-backed Cache transport:

- HTTP: max four concurrent file GETs; every file request uses `credentials: "omit"` and `redirect: "error"`; required job emits zero media GETs; interrupted file GET repeats wholly while completed GETs stay at one.
- Cache: unchanged path+version bodies receive zero second-release GETs; receipt-backed corrupt body rejects `CONTENT_INTEGRITY_FAILED`; Cache.put-before-IDB-receipt quota fault does not grant failed file reuse.
- IndexedDB: DB `ygo-content-files-v1` contains exactly `manifests`, `files`, `jobs`, `receipts`; no `active`; required job persists three file rows; dependency-closed chapter job persists five; cleanup preserves legacy DB and unknown cache key.
- Resume/locks: persisted request keeps original manifest version after latest advances; normalized chapter IDs are sorted dependency closure; cancellation persists `paused`; resume mismatch rejects `CONTENT_JOB_CONFLICT`; live per-job Web Lock prevents false paused reconciliation; downloads acquire shared cleanup lock.
- Seal: receipt digest is 64 lowercase hex; selected closure actual bytes are reread and hashed before seal/verify; optional media absence does not block.

## Commands and exit codes

| Command | Exit | Result |
| --- | ---: | --- |
| `graphify query "T5 progressive storage content module architecture files related tests boundaries"` | 0 | Graph-first context query completed |
| Focused Vitest command, red | 1 | Intended missing-implementation failure |
| `npx tsc --noEmit` during implementation | 0 | TypeScript green |
| Focused Vitest command, final green | 0 | 55/55 |
| `npm run typecheck` | 0 | 0 errors; 4 pre-existing Svelte warnings |
| `npx vitest run tests/unit/content-installer.test.ts tests/unit/content-storage.test.ts tests/unit/progressive-manifest.test.ts tests/unit/progressive-fixture.test.ts tests/component/content-installer.test.ts --reporter=verbose` | 0 | 66/66 affected Content regressions |
| Targeted `npx eslint` over all changed TS/Svelte paths | 0 | No findings |
| Targeted `npx prettier --check` over all changed TS/Svelte paths | 0 | All matched |
| `graphify . --update` | 0 | Incremental graph updated; tool reported pre-existing/incomplete semantic extraction warnings |
| `git diff --check` | 0 | No whitespace errors |
| `git diff --cached --quiet` | 0 | No staged files |

`npm run typecheck` warnings remain unchanged: `src/story/shop/ShopSellScreen.svelte` standard `line-clamp`; unused fixture exports in `tests/fixtures/BattleFacadeProbe.svelte` and `tests/fixtures/DeckEditorProbe.svelte`. Affected regression run emitted existing `CONTENT_RESPONSE_CANCEL_FAILED` stderr inside passing legacy mid-body failure test.

## Public-contract decision

Parent approved exact T5 names. New public `DownloadProgress` and `DownloadJob` match T5 contract. Incompatible legacy shapes remain unchanged under `LegacyDownloadProgress` and `LegacyDownloadJob`; exact legacy Shell/component consumers migrated aliases only. Runtime legacy flow remains unchanged until T9.

## Assumptions

- Parent-approved compile-time alias migration is narrow compatibility path for unavoidable public-name collision.
- Cleanup caller owns application-exclusive lock followed by `ygo-content-download-v1` exclusive lock. Downloads acquire shared `ygo-content-download-v1` plus exact per-job UUID lock. Cleanup methods neither acquire locks nor run automatically.
- Cache transport fixture implements browser Cache request/Response behavior in-process; real Chromium Cache Storage/Web Locks remain parent review or later browser-gate evidence.
- Media-kind request remains structurally supported by exact contract; no automatic media acquisition or UI was added.

## Swallowed-error inventory

No `|| true`, empty catch, redirected failure, or unobserved Promise exists on added path.

Retained catches, all explicit:

- JSON/schema parse catches map to exact `CONTENT_INVALID_MANIFEST`.
- quota, abort, storage, and remote transport catches map to enumerated `ContentError` values with `name`/`code`/`message` fixed; raw remote text/path never enters errors.
- verified-cache integrity catch converts only `CONTENT_INTEGRITY_FAILED` into whole-file refetch on explicit download; all other errors rethrow.
- queue catch records first failure, aborts sibling work, persists `paused` or `failed`, then rethrows exact error.
- open failure closes DB then rethrows.

## Residual risks

- Real Chromium Cache Storage and Web Locks were not run in this source-only T5 slice; fake-indexeddb/local transport tests prove state mechanics, not browser implementation behavior.
- Full repository suite and browser suite were not requested/run. Targeted existing Content regressions passed.
- T9 activation remains intentionally absent. New receipts grant staging only; legacy active selector is untouched.
- Cleanup methods depend on caller lock order by contract; T10 Shell coordination is not implemented.

## Scope/staging

No T6+ implementation, semantic domain import, producer/publisher edit, vendor/config change, commit, push, deploy, or system apply. Pre-existing untracked artifacts preserved. No staged files expected; final command evidence appended below.
