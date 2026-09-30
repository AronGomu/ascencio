# Ascencio: 42 open PRs reviewed

**Done — all 42 PRs merged into remote `main` after explicit confirmation.** Zero rejected/closed without merge; zero open PRs remain. Code verdict: 41 Approve, #34 Approve with nits. No blocking code defect found. [Merge receipts / SHAs](ascencio-pr-merge-results.html).

## Evidence first

| Validation | Observed result | Evidence file |
|---|---|---|
| Open inventory | #26–#67, 42 total | `inventory.json`, `final-remote-state.json` |
| Reviewed base | `2d721a50177994fb5003cf90b012e67a19842623` | `base-sha.txt` |
| Final remote main | `3dbc1ce937ad83865a08622ef1b7070117539718` | `post-merge-verification.json` |
| Merge verification | 42 merge commits; 93 paths match reviewed aggregate; 42 branches retained; 0 open PRs | `merge-receipts.jsonl`, `post-merge-verification.json` |
| PR head drift during review | None | `final-remote-state.json` |
| Independent source review | Six domain/security reviewers; extra #34 adjudication | `review-*.md` |
| Individual integration | 42 conflict-free three-way trees | `validation-26.json` … `validation-67.json` |
| Targeted per-PR suites | All pass, including legacy Node suites | `validation-*.json`, `retry-*.log` |
| Changed-file ESLint / Prettier | All pass | `validation-*.json` |
| Combined changed Vitest suites, locked deps | 419 tests / 39 files pass | `combined-locked-tests.log` |
| Domain / data-cy boundaries | 87 tests / 2 files pass | `combined-boundaries.log` |
| Combined typecheck, locked deps | 0 errors; 4 warnings | `combined-locked-typecheck.log` |
| Combined production build / budgets | Pass | `combined-build.log` |
| Chromium PWA retry regression | 1 pass | `pwa-retry-e2e.log`, `pwa-browser-evidence/` |
| GitHub mergeability | 42 MERGEABLE / UNSTABLE | `final-remote-state.json` |
| GitHub full-gate | All 42 fail before test gates | `ci-summary-*.json`, `ci-*.log` |

Evidence folder: `artifacts/pr-review-20260921/`. Folder name is batch identifier; review executed 2026-09-23.

## Shared CI failure — not 42 code defects

Every CI run failed in `Regenerate and verify the pinned snapshot`:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

Remaining headless/browser steps never ran remotely. Local targeted checks do not prove entire skipped suite. Recommended normal gate: repair shared asset-download prerequisite, rerun CI. Closing 42 otherwise valid fixes solely for this shared failure would discard useful work without addressing cause.

Initial local typecheck error was **validation-environment mismatch**, not main regression: copied installed `@types/node` 26 differed from lockfile 24. Isolated `npm ci --offline` restored exact locked deps; repeated aggregate typecheck/targeted tests passed. Initial Vite symlink-resolution failures plus publisher timeout were resolved without source edits; original failure evidence retained.

## #34 adjudication

Low severity, non-blocking: expanded `git remote get-url origin` can reject equivalent URLs under normal `insteadOf` rules. Hostile local Git config can evade best-effort consistency check; parent previously trusted any valid local repo. PR disclaims provenance guarantee; production commit pin remains enforced. Optional follow-up: raw-origin comparison plus rewrite regressions. Parent rejected original request-changes severity after independent review. See #34 report.

## PR decisions

All rows merged after explicit acceptance of shared red CI. “Approve” means code review approval, not passing full CI. Individual review reports preserve pre-merge snapshots; this index plus merge receipts records final state.

| PR | Change | Code verdict | Local evidence | Report |
|---|---|---|---|---|
| [26](https://github.com/AronGomu/ascencio/pull/26) | fix(battle): keep installed deck rows revision-consistent | Approve | Tests/lint/format pass | [Review](ascencio-pr-26-review.html) |
| [27](https://github.com/AronGomu/ascencio/pull/27) | fix(decks): preserve modified order across clock rollback | Approve | Tests/lint/format pass | [Review](ascencio-pr-27-review.html) |
| [28](https://github.com/AronGomu/ascencio/pull/28) | fix(content): cancel rejected progressive response streams | Approve | Tests/lint/format pass | [Review](ascencio-pr-28-review.html) |
| [29](https://github.com/AronGomu/ascencio/pull/29) | fix(assets): reject unknown image download options | Approve | Tests/lint/format pass | [Review](ascencio-pr-29-review.html) |
| [30](https://github.com/AronGomu/ascencio/pull/30) | fix(assets): reject catalog records in wrong shards | Approve | Tests/lint/format pass | [Review](ascencio-pr-30-review.html) |
| [31](https://github.com/AronGomu/ascencio/pull/31) | fix(delivery): restore missing objects on idempotent publish | Approve | Tests/lint/format pass | [Review](ascencio-pr-31-review.html) |
| [32](https://github.com/AronGomu/ascencio/pull/32) | fix(build): serve CORE metadata URLs with query strings | Approve | Tests/lint/format pass | [Review](ascencio-pr-32-review.html) |
| [33](https://github.com/AronGomu/ascencio/pull/33) | fix(shell): ignore stale story deck context reads | Approve | Tests/lint/format pass | [Review](ascencio-pr-33-review.html) |
| [34](https://github.com/AronGomu/ascencio/pull/34) | fix(assets): reject mismatched source caches safely | Approve with nits | Tests/lint/format pass | [Review](ascencio-pr-34-review.html) |
| [35](https://github.com/AronGomu/ascencio/pull/35) | fix(story): clear filtered previews without rescanning on hover | Approve | Tests/lint/format pass | [Review](ascencio-pr-35-review.html) |
| [36](https://github.com/AronGomu/ascencio/pull/36) | fix(protocol): prevent hidden effect card identity leaks | Approve | Tests/lint/format pass | [Review](ascencio-pr-36-review.html) |
| [37](https://github.com/AronGomu/ascencio/pull/37) | fix(projection): redact opponent cards when position conceals them | Approve | Tests/lint/format pass | [Review](ascencio-pr-37-review.html) |
| [38](https://github.com/AronGomu/ascencio/pull/38) | fix(opponent): finish valid toggle selections | Approve | Tests/lint/format pass | [Review](ascencio-pr-38-review.html) |
| [39](https://github.com/AronGomu/ascencio/pull/39) | fix(content): reject unsafe progressive MIME values | Approve | Tests/lint/format pass | [Review](ascencio-pr-39-review.html) |
| [40](https://github.com/AronGomu/ascencio/pull/40) | fix(content): cancel rejected install responses | Approve | Tests/lint/format pass | [Review](ascencio-pr-40-review.html) |
| [41](https://github.com/AronGomu/ascencio/pull/41) | fix(story): classify interrupted save writes as unavailable | Approve | Tests/lint/format pass | [Review](ascencio-pr-41-review.html) |
| [42](https://github.com/AronGomu/ascencio/pull/42) | perf(story): index shop rarities for sale browsing | Approve | Tests/lint/format pass | [Review](ascencio-pr-42-review.html) |
| [43](https://github.com/AronGomu/ascencio/pull/43) | fix(decks): preserve manual order through membership history | Approve | Tests/lint/format pass | [Review](ascencio-pr-43-review.html) |
| [44](https://github.com/AronGomu/ascencio/pull/44) | fix(pwa): recover from incomplete first precache | Approve | Tests/lint/format pass | [Review](ascencio-pr-44-review.html) |
| [45](https://github.com/AronGomu/ascencio/pull/45) | fix(battle): stop dialog selections at engine maximum | Approve | Tests/lint/format pass | [Review](ascencio-pr-45-review.html) |
| [46](https://github.com/AronGomu/ascencio/pull/46) | fix(battle): isolate concurrent Worker watchdogs | Approve | Tests/lint/format pass | [Review](ascencio-pr-46-review.html) |
| [47](https://github.com/AronGomu/ascencio/pull/47) | fix(battle): normalize debug-run storage failures | Approve | Tests/lint/format pass | [Review](ascencio-pr-47-review.html) |
| [48](https://github.com/AronGomu/ascencio/pull/48) | fix(content): release session lease when reader closes | Approve | Tests/lint/format pass | [Review](ascencio-pr-48-review.html) |
| [49](https://github.com/AronGomu/ascencio/pull/49) | fix(content): signal cancellation when release is disposed | Approve | Tests/lint/format pass | [Review](ascencio-pr-49-review.html) |
| [50](https://github.com/AronGomu/ascencio/pull/50) | fix(story): preserve read progress across open sessions | Approve | Tests/lint/format pass | [Review](ascencio-pr-50-review.html) |
| [51](https://github.com/AronGomu/ascencio/pull/51) | fix(shell): preserve unrelated settings across stale sessions | Approve | Tests/lint/format pass | [Review](ascencio-pr-51-review.html) |
| [52](https://github.com/AronGomu/ascencio/pull/52) | fix(story): reject queued stale deck saves | Approve | Tests/lint/format pass | [Review](ascencio-pr-52-review.html) |
| [53](https://github.com/AronGomu/ascencio/pull/53) | fix(shared-ui): reset effect scroll when preview changes | Approve | Tests/lint/format pass | [Review](ascencio-pr-53-review.html) |
| [54](https://github.com/AronGomu/ascencio/pull/54) | fix(asset-delivery): reject malformed numeric prerelease versions | Approve | Tests/lint/format pass | [Review](ascencio-pr-54-review.html) |
| [55](https://github.com/AronGomu/ascencio/pull/55) | fix(assets): bind archive verification to object digest | Approve | Tests/lint/format pass | [Review](ascencio-pr-55-review.html) |
| [56](https://github.com/AronGomu/ascencio/pull/56) | fix(content): reject noncanonical producer candidates | Approve | Tests/lint/format pass | [Review](ascencio-pr-56-review.html) |
| [57](https://github.com/AronGomu/ascencio/pull/57) | fix(assets): reject changed profile selection before sync write | Approve | Tests/lint/format pass | [Review](ascencio-pr-57-review.html) |
| [58](https://github.com/AronGomu/ascencio/pull/58) | fix(decks): reject unusable cards at published-deck boundary | Approve | Tests/lint/format pass | [Review](ascencio-pr-58-review.html) |
| [59](https://github.com/AronGomu/ascencio/pull/59) | fix(field): derive pile preview from actual top card | Approve | Tests/lint/format pass | [Review](ascencio-pr-59-review.html) |
| [60](https://github.com/AronGomu/ascencio/pull/60) | fix(deck-editor): isolate modal keys from background shortcuts | Approve | Tests/lint/format pass | [Review](ascencio-pr-60-review.html) |
| [61](https://github.com/AronGomu/ascencio/pull/61) | fix(content): honor cancellation before activation commit | Approve | Tests/lint/format pass | [Review](ascencio-pr-61-review.html) |
| [62](https://github.com/AronGomu/ascencio/pull/62) | fix(assets): contain runtime verification within snapshot root | Approve | Tests/lint/format pass | [Review](ascencio-pr-62-review.html) |
| [63](https://github.com/AronGomu/ascencio/pull/63) | fix(shell): settle all started story clears before reset returns | Approve | Tests/lint/format pass | [Review](ascencio-pr-63-review.html) |
| [64](https://github.com/AronGomu/ascencio/pull/64) | fix(decks): separate Ritual summon frames from spell properties | Approve | Tests/lint/format pass | [Review](ascencio-pr-64-review.html) |
| [65](https://github.com/AronGomu/ascencio/pull/65) | fix(deck-select): navigate from active seat deck | Approve | Tests/lint/format pass | [Review](ascencio-pr-65-review.html) |
| [66](https://github.com/AronGomu/ascencio/pull/66) | fix(battle): expire transient field feedback at its duration | Approve | Tests/lint/format pass | [Review](ascencio-pr-66-review.html) |
| [67](https://github.com/AronGomu/ascencio/pull/67) | fix(battle): disable pile controls while response is pending | Approve | Tests/lint/format pass | [Review](ascencio-pr-67-review.html) |

## Assumptions

A1. “All PRs” means currently open PRs, not historical merged/closed PRs.

A2. Code approval excludes undisclosed hostile-local-filesystem guarantees; documented scope controls severity. Scenario coverage gaps remain in individual reports.

A3. Local dirty source/config files preserved; never used as PR code. Remote merge commits authorized separately. No local source edits, staging, branch deletion, history rewrites, or branch-protection bypass. Local checkout not pulled; `origin/main` fetched.

## Files / cleanup

F1. New deliverables: `artifacts/pr-review-20260921/`; rendered per-PR reports plus index under `.pi/artifacts/ascencio-pr-*.html`.

F2. Removed only owned `.tmp/pr-review-20260921/` snapshots/scripts after retaining logs plus browser evidence. Cleanup inventory: `scratch-cleanup.json`.

F3. `graphify` query attempted; unavailable: `/bin/bash: line 1: graphify: command not found`. Direct Git/source review substituted.

## Execution result

User confirmed merge of all 42 reviewed heads despite shared CI failure. Each command used `gh pr merge --merge --match-head-commit`; verified exact first/second parents after every merge. Final tree matches reviewed aggregate. No blocker remains for requested merge task; shared CI asset failure remains unresolved.

Removed owned `.tmp/pr-merge-20260923/merge.py` plus empty scratch directory. Local dirty checkout preserved, not advanced to remote main.
