# T9 CORE offline-shell acceptance

## Status

Passed required T9 browser matrix in Chromium on 2026-09-12.

## Evidence

- E1 Base source: `6c3fa7e43ac21f97b2697c0e0e13bb71fad90128` plus uncommitted T9 working tree.
- E2 Ticket: `artifacts/PLAN_2026_09_12_core_installation/T9_offline-shell.md`.
- E3 Clean fixture inputs: positive source copy only; `generated/`, `public/`, acquired runtime/card/image roots absent; each root/subpath server ran `npm ci` plus verified production build.
- E4 Focused command: `npx playwright test -c playwright.core.config.ts --project=chromium --grep "offline|service worker|cold update|subpath"` → 6 passed.
- E5 Full command: `npx playwright test -c playwright.core.config.ts --project=chromium` → 8 passed.

## Observations

- O1 Root plus `/ygo-story-duel/` reopen offline with menu, Settings offline-ready status, installer route.
- O2 Cache inventory contains HTML, all executable JS/CSS closures, fonts, icon, manifest; contains no `content/`, `runtime/`, `__content/`, story image, WASM, ZIP.
- O3 Offline missing content part rejects as network error; index HTML never substitutes.
- O4 Two production app builds create distinct shell caches. Build B reaches `waiting` while either build-A tab remains. B activates plus cleans only old shell cache after both tabs close.
- O5 Forced precache failure makes initial worker `redundant`; Settings visibly reports offline setup failure with no controller/active worker.
- O6 Every emitted app JS file is present in shell cache; local screenshots/traces remain ignored; sanitized machine summary: `artifacts/CORE_ACCEPTANCE/T9/playwright-report.json`.
