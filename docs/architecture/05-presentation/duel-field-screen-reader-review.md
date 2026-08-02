# Duel-field accessibility review — DF-14

## Status

**Gate = automated Chromium evidence only. No manual testing until DF-17 feature complete.**

Product target is **Chromium-based browsers with PWA support** (Chrome, Edge, Chromium equivalents). Required DF-14 / DF-16 a11y proof is Playwright Chromium keyboard, role/name/state, focus, live-region, target-size, and privacy assertions.

**Explicitly not required / not blocking (entire migration DF-00–DF-17):**

- Any manual playtest or human product walkthrough
- NVDA + Firefox manual review
- VoiceOver + Safari manual review
- Human visual screenshot rubric sign-off
- Firefox/WebKit product acceptance

## Build under review

- Branch: `plan/dom-duel-field-implementation-plan`
- Candidate base: `5edcf23` plus DF-14 working-tree candidate
- Artifact: `test-results/df-14-keyboard-screen-reader.zip`
- Role structure: named `group` plus roving native buttons/focusable named card, zone, stack controls
- Explicit exclusions: no `role="application"`; no `role="grid"`

## Role decision

`role="grid"` remains omitted. Spatial board is not tabular data: hands contain variable overlapping cards, occupied zones replace zone controls, shared Extra Monster Zones sit between player rows, stacks form row edges. Grid row/column announcements would add invented structure. Named group/control announcements retain controller, physical zone, position, legal/selected state, counters, materials.

Decision is **accepted on automated Chromium evidence**. Revisit `grid` only if a Chromium automated a11y defect shows named controls fail spatial context.

## Automated Chromium evidence (blocking)

- Pure reducer covers Arrow keys, Home/End, rows, stacks, shared Extra Monster Zones, hands, empty/occupied replacement, prompt/actionable changes.
- Component checks cover one field tab stop, native Enter/Space, menu Escape/focus return, tray entry/return, intentional prompt focus, persistent field prompt/submit live text, public accessible labels/states, hidden identity absence.
- Chromium checks cover full preset duel using keyboard only, exactly one response per prompt, no field trap, one roving tab stop, visible `:focus-visible`, defense-rotation focus evidence, no application/grid role, ≥44×44 target boxes, 200% zoom focus visibility where covered by suite.
- Extra retry evidence: `PLAYWRIGHT_BROWSERS_PATH=/nix/store/58nx8ipi0v36amc4rgmd09l17iyrvwpm-playwright-browsers npx playwright test e2e/duel-smoke.spec.ts --project=chromium --grep "full preset duel" --timeout=180000` passed in 55.6s after row-local horizontal navigation fix.
- Spatial evidence: `PLAYWRIGHT_BROWSERS_PATH=/nix/store/58nx8ipi0v36amc4rgmd09l17iyrvwpm-playwright-browsers npx playwright test e2e/duel-smoke.spec.ts --project=chromium --grep "spatial field navigation" --timeout=180000` passed in 3.2s.

## Completion rule

DF-14 a11y gate passes when:

1. focused unit/component/nav tests green;
2. Chromium keyboard-only full preset duel green with one response per prompt;
3. role/name/state/privacy/live-region assertions green;
4. artifact `test-results/df-14-keyboard-screen-reader.zip` retained locally as evidence;
5. no open Chromium a11y blocker tickets.

Manual testing of any kind is deferred until **after DF-17**. Do not block DF-15/DF-16/commit/push on human sessions.
