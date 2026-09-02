# T1: Real YGO card back asset + wiring

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** none
**Commit outcome:** Deck/extra stacks and every hidden card render the real Yu-Gi-Oh! card back image; SVG fallback survives offline/no-fetch.

## Context (self-contained)

- Goal: fix owner feedback round on Duel Field (`feedback.md` § Duel Field, item 3): "Replace the card back placeholder by actual YGO card back. Fetch asset online if needed."
- This slice: asset acquisition script + serving route + `cardBackUrl` wiring. Visual sizing of stacks is T3's job — do not touch `StackControl.svelte`.
- Out of scope here: stack width (T3), empty-stack rendering (T4), any `vendor/` change.
- Assumptions in force: A9 — image NOT committed; fetched into ignored `generated/`, `redistributionApproved: false` mirror of card-art pipeline. SVG fallbacks stay as offline fallback (do NOT delete the constants).

## Requirements

- One-shot script downloads the official card back image to `generated/card-images/card-back.jpg`.
- Dev server + production build serve it at `runtime/images/card-back.jpg`.
- When the file is served OK, every surface that shows a card back uses it; when absent (offline, fetch never ran, 404), existing SVG data-URL fallbacks render exactly as today.
- Both existing SVG sources stay in code as fallback: `src/battle/app/components/DuelField.svelte:92` (`DEFAULT_CARD_BACK`, teal) and `src/battle/app/images/card-image-cache.ts:74,324` (`svgDataUrl("Card back", …)`, purple/gold).

## Inputs

- `scripts/download-images.ts`, `scripts/lib/` — existing fetch-script conventions (follow their style: node fetch, checksum optional, idempotent skip when file exists).
- `scripts/lib/vite-runtime-assets.ts:293` `runtimeSourcePath` — URL allowlist; `:105` `copyRuntimeAssets` — build-output copy.
- `src/battle/app/images/card-image-cache.ts` — `cardBackUrl` produced at `:74` (placeholder library) and `:324` (archive library).
- `src/battle/app/App.svelte:1516` — passes `imageLibrary?.cardBackUrl ?? ""` into `DuelField`.
- Candidate source URLs (verify with `curl -fsI` at impl time, pick first that returns 200 image/jpeg or png; record chosen URL + sha256 in the script header):
  - `https://images.ygoprodeck.com/images/cards/back_high.jpg`
  - `https://ms.yugipedia.com/e/e5/Back-EN.png`
  - If neither works: stop, report blocker with the curl output (red-team gap G2 — no source pinned in repo).

## Interface contract (level 5)

- **Produces:**
  - Script `scripts/download-card-back.ts`, run via `node --experimental-strip-types scripts/download-card-back.ts` (match invocation style of sibling scripts — inspect `package.json` scripts and mirror). Behavior: file exists → print skip + exit 0; else download → write `generated/card-images/card-back.jpg` → print sha256. Non-200 → exit 1 with URL + status on stderr.
  - `runtimeSourcePath` new case, exact:
    ```ts
    if (normalized === "images/card-back.jpg") {
      return path.join(projectRoot, "generated/card-images/card-back.jpg");
    }
    ```
  - `copyRuntimeAssets`: copy the file into `dist/runtime/images/card-back.jpg` when present; absent file must not fail the build.
  - `card-image-cache.ts`: archive library (`:324` region) exposes `cardBackUrl = new URL("runtime/images/card-back.jpg", document.baseURI).toString()` after a successful availability probe (`fetch(url, { method: "HEAD" })` ok) — else keeps existing `svgDataUrl(...)` value. Probe is async at library creation, no per-card fetches.
- **Consumes:** `DuelField` prop `cardBackUrl: string` (unchanged shape); `CardControl`/`StackControl`/`MaterialCard`/`HandZoomOverlay` consume it via existing props — no prop changes.
- **Errors:** probe failure → silent fallback to SVG (this is the one accepted swallow: offline is a normal state, log nothing per existing library style). Script failure → non-zero exit + stderr message.
- **Invariants:** main thread never touches engine (untouched); no card identity leaks (a back is identity-free by definition); `generated/` stays gitignored.
- **Integration links:** trigger `card-image-cache.ts` library creation → dispatch `HEAD ${base}runtime/images/card-back.jpg` → receive `vite-runtime-assets.ts` middleware (dev) / static `dist/runtime/images/card-back.jpg` (prod) → observe deck stack `<img data-cy="stack-control-art-p0:deck">` `src` ends with `runtime/images/card-back.jpg` in Chromium.

## TDD

1. **Red** — unit test `runtimeSourcePath("…", "images/card-back.jpg")` resolves to the generated path; component test: library with successful probe yields runtime `cardBackUrl`; failed probe yields SVG.
2. **Green** — impl above.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| unit vite-runtime-assets | `images/card-back.jpg` | resolves `generated/card-images/card-back.jpg` |
| unit vite-runtime-assets | `images/../card-back.jpg` | `null` (traversal guard holds) |
| unit card-image-cache | probe fetch resolves ok | `cardBackUrl` = runtime URL |
| unit card-image-cache | probe rejects / 404 | `cardBackUrl` = existing SVG data URL |
| e2e (only if asset fetched locally) | duel start | deck stack img src ends `runtime/images/card-back.jpg` |

## Impl steps

- [ ] 1. Verify source URL with `curl -fsI`, pin URL + sha256 in script header.
- [ ] 2. Write `scripts/download-card-back.ts`; run it; confirm file at `generated/card-images/card-back.jpg`.
- [ ] 3. Red tests for `runtimeSourcePath` + probe; then impl route + `copyRuntimeAssets` + probe.
- [ ] 4. Chromium evidence: deck/extra stacks show real back in dev server.

## Validation

- [ ] tests pass: `npm run check:headless` (or targeted `npx vitest run tests/unit/…`)
- [ ] manual check: dev server, duel start, real card back visible; delete `generated/card-images/card-back.jpg` → SVG fallback, no console error
- [ ] silent-failure sites added: probe fallback (kept — offline is normal state, documented above); `copyRuntimeAssets` absent-file skip (kept — asset optional by design). No others.
- [ ] app functional — no broken path
- [ ] commit msg draft: `feat(duel-field): serve real YGO card back with SVG offline fallback`
