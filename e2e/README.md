# End-to-end browser suites

All Playwright suites live under this root.

| Directory | Configuration | Purpose |
|---|---|---|
| `e2e-global/` | `playwright.config.ts` | Production-build tests for the complete application shell and its domains |
| `e2e-acceptance/` | `playwright.acceptance.config.ts` | Isolated Chromium visual and interaction scenarios served through `acceptance.html` |
| `e2e-core/` | `playwright.core.config.ts` | Chromium PWA, offline shell, core-source and update-consent lifecycle tests |

The acceptance suite is intentionally separate from the global suite because it enables the build-time `ACCEPTANCE_SCENARIOS=1` harness and targets the dedicated acceptance entry point. It is a populated active suite, not a placeholder directory.

Ordinary Playwright results and HTML reports are written beneath `generated/tests/`, grouped by suite. The core suite keeps its repair evidence beneath `artifacts/T10-EVIDENCE/` because that evidence is an explicit review deliverable.
