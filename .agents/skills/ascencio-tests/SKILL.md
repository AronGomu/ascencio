---
name: ascencio-tests
description: Select and run tests related to changes in Ascencio. Use for local testing, validation, test pipeline requests, and validation before committing or merging.
---

# Ascencio tests

## Scope

Locally, "run tests", "run the pipeline", "validate", and "test and merge" authorize tests related to the changes. Run the full application suite only when the owner very explicitly asks for it. Do not interpret a request to merge as permission to run everything.

## Execute

Run commands from the repository root with Node 26 or newer.

1. Run `npm run test:context`, then read `generated/tests/branch-context.json`. Those are all branch changes.
2. Use this context to select tests for the task's changed behavior and affected consumers. Execute exact related files with `npm test -- --tests <test-files>`.
3. Start the selected run asynchronously and monitor its output. On test failure, spawn a bug-fix subagent with the failing command, log, relevant requirements and assigned files. Once fix applied, subagent rerun ascencio-tests skill process on their reduced scope. The main agent keeps the remaining selected tests running while the subagent diagnoses and fixes the issue.

Examples:

```sh
npm run test:context
npm test -- --tests tests/unit/stage-layout.test.ts tests/unit/global-styles.test.ts
npm test -- --base origin/main --list
```
