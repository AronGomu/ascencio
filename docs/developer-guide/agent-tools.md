# Agent inspection and iteration tools

Run from the project root with Node 26+ and Python 3. Commands inspect published metadata rather than decoding gameplay logs. JSON output includes an observation timestamp; it is a snapshot, not continuous monitoring.

## Run status

```sh
npm run agent:status -- SESSION
node scripts/agent-tools/session-tools.mjs replay-status REPLAY_POOL_OUTPUT
```

Pass the session directory containing `control.json`. Budget totals come from its attempts, deduplicated completions, and effective limits. Analysis coverage comes from published slice packets and completed reports. Unpublished preparation and unknown replay counts are explicitly unknown. Ownership metadata is shown when available; absence does not prove a process is dead. Status never removes locks, modifies budgets or asserts integrity of gameplay. Read the recorded timing fields as ledger values, not measured current CPU time.

## Small performance fixtures

```sh
npm run bot:perf:smoke -- FIXTURE_SESSION FRESH_OUTPUT
npm run bot:perf:confirm -- FIXTURE_SESSION FRESH_OUTPUT
npm run bot:perf:integrated -- FIXTURE_SESSION FRESH_OUTPUT
```

Smoke runs four matches with two workers once. Confirmation runs twelve matches twice in reversed backend order. Integrated runs twenty-five matches once. Every comparison uses a fresh output suffix, native full evidence and a two-minute TypeScript bound. The comparator includes the Rust reference and may build it. These are diagnostic fixed worker counts, not production calibration. The integrated command measures simulation; follow the implementation plan to add preparation and report ingestion. No command launches a 2,500-match benchmark or exhaustive calibration automatically.

## Bounded source reading

```sh
npm run agent:read -- DOCUMENT.md
npm run agent:read -- DOCUMENT.md 'Exact heading text'
```

The first form returns headings and line numbers. The second returns one section until the next heading at the same or higher level, capped at 24 KB. Use a smaller subsection or explicit `rg`/`sed` range if it exceeds that cap. This avoids truncated combined skill reads. For source code, use bounded symbol/range reads directly.

## Review source snapshots

```sh
npm run agent:snapshot -- .tmp/review-pins.json SOURCE_A SOURCE_B
npm run agent:recheck -- .tmp/review-pins.json
```

Snapshot the relevant files before inspecting code. Recheck before delivering findings. Exit code 2 means files changed or disappeared: reread those files and update affected findings. Snapshot files are exclusive and must use a fresh path. These are read-only source checks, not worktree locks; concurrent edits remain possible after a recheck.

## Documentation guard

```sh
npm run docs:check -- docs/FILE.md docs/FILE.html
```

The existing local pre-commit validation invokes this check for changed Markdown and HTML, including documentation-only commits. It checks relative file links, HTML fragment targets, duplicate HTML IDs and balanced explicit HTML tags. It ignores external URLs, root-relative links and Markdown anchors. Use explicit closing tags in authored HTML. Explicit `data-theme="dark"` pages must declare a background. The guard does not claim accessibility or visual correctness; verify actual computed colors with the optional browser check below when changing a theme.

```sh
node scripts/agent-tools/check-theme.mjs docs/FILE.html
```

## Document ownership

The performance retrospective owns historical observations and rationale. The implementation plan owns ordered actions, acceptance criteria and current progress. Link between them instead of copying measurements. The short root `AGENTS.md` routes to `docs/repository-map.md`, which owns the detailed tree. Keep durable documentation linked from `docs/README.md`.

## Offline analysis performance fixture

```sh
node scripts/bot-improvement/benchmark-analysis-evidence.ts FINALIZED_PAYLOAD FRESH_OUTPUT
```

Copies twelve finalized matches into three isolated fixtures, measures first publication and completed resume separately, and checks identical returned evidence across all stages. Producer files stay unchanged. Output records source/input provenance, monotonic elapsed time, CPU, RSS, event/loss counts and result fingerprints. Copying and provenance capture are outside measured stages. This measures analysis verification/publication only; it does not measure simulation, analyst work or replay.

### Combined improvement-workflow fixture

`node scripts/bot-improvement/benchmark-improvement-workflow.ts --source FROZEN_SESSION --out FRESH_OUTPUT --matches 25 --workers 2` copies verified initial frozen inputs into an isolated diagnostic fixture, then measures full native evaluation, target-loss preparation, claims and complete mechanical report ingestion. It validates every emitted loss view and resumes completed evidence without adding reservations. Counts are bounded to 1–25 matches; use four for a smoke check. The source fixture/session remains read-only. This uses the original frozen target, not later promoted versions. Reports deliberately classify every loss as unclear and are not AI analysis or promotion evidence. Setup, verification and resume are reported separately. The output includes `measurements.json`, all gameplay and mechanical reports; the destination must be outside an existing budgeted run.
