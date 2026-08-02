# Duel Field Performance Baseline

> Status: DF-16 accepted automated evidence
> Scope: DOM field parity/perf/resource gate before Phaser removal

## Pinned profile

- Browser: Playwright Chromium `149.0.7827.55` (bundled Nix browser path `/nix/store/h45s5azy1vb1afd0r9m6h1zmgjwx6fhs-playwright-browsers`).
- OS/runtime: Linux headless.
- Viewport: `1280×720`.
- Device scale factor: `1`.
- CDP CPU throttling: `4`.
- Network throttle: none after fixture/app load.
- Warm-up runs: `5`.
- Measured runs: `30`.
- Percentiles: nearest-rank.

## Mark boundaries

- Semantic fixture seam: `parseDuelWorkerEvent` validates each public `state` fixture before store reduction and component render.
- Update→paint: accepted public browser event observed, then next paint after two `requestAnimationFrame` callbacks.
- Input feedback: focus request on field target, then next paint after two `requestAnimationFrame` callbacks.

## Thresholds

| Metric                   |                                                                                      Gate |
| ------------------------ | ----------------------------------------------------------------------------------------: |
| Update→paint p95         |                                                                                  `<50 ms` |
| Input feedback p95       |                                                                                 `<100 ms` |
| Normal prompt long tasks |                                                                             none `>50 ms` |
| Object URLs              | active set equals mounted blobs; no obsolete active URL overlap after restart/tray cycles |
| Global listeners         |                          active global listener count unchanged after restart/tray cycles |

## Recorded DF-16 run

Source artifact: `test-results/df-16-results.json`.

| Workload                    |       p50 |       p95 | Long tasks | Resource result                                            |
| --------------------------- | --------: | --------: | ---------: | ---------------------------------------------------------- |
| Normal prompt update→paint  | `26.3 ms` | `29.1 ms` |        `0` | pass                                                       |
| Normal input feedback       | `24.9 ms` | `31.1 ms` |        n/a | pass                                                       |
| 60-card/tray resource cycle |       n/a |       n/a |        n/a | object URL growth `0`; active matches mounted before/after |
| Restart burst               |       n/a |       n/a |        n/a | listener growth `0`; dropped frames `0`                    |

Heap after garbage collection: `5,061,244` bytes before cycle, `5,164,040` bytes after cycle. Active object URLs matched mounted blobs before/after with no obsolete URL overlap; active/mounted counts remained `5`; revoked count advanced from `5` to `10`. Global active listeners remained `30`.

## Phaser removal gate

Automated decision: **pass** for DF-16. DF-17 may start only if `npm run check` plus Chromium DF-16 evidence remain green; thresholds above must not change silently.
