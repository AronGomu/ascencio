# Startup I/O foundation manual acceptance

Status: pending native release/device acceptance. Existing owner deletion of `artifacts/manual_test_checklist.md` was preserved; this sibling captures this slice's checks without recreating that deleted document.

- [ ] A1. Linux desktop, disposable app-data, release build, tracing disabled: navigate Freeplay, Story and Deck Editor and save a deck; existing behavior remains usable, no `__ASCENCIO_IO_TRACE__` accessor exists.
- [ ] A2. Linux desktop, disposable app-data, `ASCENCIO_IO_TRACE=1`: export a complete combined snapshot after reaching the menu; native/frontend session IDs match, both have `baseline-ready`, neither has ADR-104 `ready`.
- [ ] A3. Same profile: enter Freeplay, return home, reenter, then enter Story and Deck Editor; exported capture records registry/content rereads and `verify-startup-io.ts ... baseline-ready` fails with `CRITICAL_READ_AFTER_READY`.
- [ ] A4. Same profile: save deck/settings and export again; native trace exposes user JSON metadata/read-before-write. Save payloads, search terms and absolute user paths do not appear in trace events.
- [ ] A5. Fresh native process per sample: record first-install, installed cold/warm launch, New Game, Continue, first duel and reentry timings with cache conditions and native/webview memory. Startup/memory budgets follow measured evidence.
- [ ] A6. Physical mobile, app-managed disposable profile: repeat timing and capture/export checks; record device, OS/webview, package/mod sizes and memory separately. A browser bridge cannot satisfy this check.
