# Application tests

All application test sources, fixtures, configuration, and runners live under `test/`.

| Directory        | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `unit/`          | Isolated application logic                                      |
| `component/`     | Svelte components                                               |
| `integration/`   | Interacting modules and real engine fixtures                    |
| `tooling/`       | Node tooling and test-runner regressions                        |
| `release-gates/` | Explicit release-readiness checks                               |
| `e2e/`           | Playwright application, native, acceptance, and resource suites |
| `fixtures/`      | Sample content, decks, transcripts, and fixture components      |
| `helpers/`       | Shared fixture builders and test servers                        |
| `config/`        | Vitest and Playwright configuration                             |
| `runner/`        | Selection, execution, reporting, and native acceptance runners  |

Generated logs, reports, coverage, screenshots, traces, and videos belong under `.tmp/test/`, which is ignored by Git.

## Select and run related tests

Use [the project test skill](../.agents/skills/ascencio-tests/SKILL.md).

```bash
npm run test:context
npm test -- --tests test/tooling/run-tests.test.ts test/integration/headless-controller.test.ts
npm test -- --tests test/component/CardPreviewPanel.test.ts --list
```

Branch context is written to `.tmp/test/reports/branch-context.json`.
Local run logs are written to `.tmp/test/logs/local-runs/`.

## Configuration

The npm scripts and targeted runner pass the configuration path explicitly.
For direct commands, use the configuration under `test/config/`:

```bash
npx vitest run --config test/config/vitest.config.ts test/unit/domain-boundaries.test.ts
npx playwright test --config test/config/playwright.native.config.ts --list
```

`npm run test:browser:collection` checks browser discovery without launching browsers.
The [browser suite guide](e2e/README.md) identifies active and historical browser suites.

## Scope

Run the full suite only when explicitly requested by the owner.
Validate locally; remote CI is disabled.
Rust tests embedded in implementation modules remain beside those modules; native acceptance runners are under `test/runner/native/`.
