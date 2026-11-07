# Remaining environment evidence

## Full application content staging / packaged startup

The supplied parent snapshots are version 1.1.2; this checkout's unchanged trust
anchor pins 1.1.3. The immutable bot baseline was captured against the supplied
1.1.2 snapshot and continues to use exactly that identity. Neither the baseline
nor the trust anchor was changed to make a test pass.

Attempted browser command (Node 26):

```sh
DEV_PORT=4215 node node_modules/vite/bin/vite.js --config config/vite.config.ts --mode browser-dev
```

With a read-only link to the parent's staged content, startup fails with:

```text
BROWSER_CONTENT_STAGE_MISMATCH: run npm run content:stage:native
```

Attempted packaged-protocol build:

```sh
TAURI_CONFIG='{"build":{"frontendDist":"../.tmp/bot-smoke-web"}}' \
  cargo build --release --features tauri/custom-protocol,native-acceptance --manifest-path tauri/Cargo.toml
```

The normal content build guard fails at `tauri/build.rs:10`:

```text
assertion `left == right` failed: staged release must match tracked trust anchor
```

For card-library, staged bytes/hash are 52,823,469 /
`f8d93a62d536a1c29854b5a585b3188da564b68d01846e821639f423e32b4ab5`;
the trust anchor requires 52,959,480 /
`18319d7f69f758eb269d98a9ab3f952846a0563d377102a299a2ae3cf48e4374`.
Freeplay and chapter-01 also have different hashes and versions. The parent
readable source `card-library/pack.json` itself declares 1.1.2, so recompiling that
source does not supply the missing 1.1.3 input. Parent/shared files were not changed.

The bot-only instrumentation application **does** compile and run using the
packaged frontend protocol and bundled AI resources, with no staged game content;
its real engine/content comes from the explicit fixture server. Both Rust paths
completed all 40 smoke games there. This verifies packaged bot delivery and IPC,
not full packaged game startup. The ordinary native frontend release build and
its payload/budget verification pass. Full application startup acceptance needs
content matching the existing trust anchor; it remains outstanding.

The actual Freeplay component was separately inspected at 1280×800 and 820×900
using `node scripts/bot-experiment/serve-ui.ts` and
`/test/helpers/bot-experiment/ui.html`. Its isolated fixture deliberately supplies
placeholder card imagery. AI selection remained visible, changing it preserved
both deck seats, and no browser errors occurred. A grid-row defect found during
that inspection was corrected; `freeplay-ai-selection.png` retains the desktop
layout. This is presentation evidence, not an engine smoke substitute.

## Browser process-wide memory

The optimized browser fixture was served with COOP `same-origin` and COEP
`require-corp`. `crossOriginIsolated` was true. Calling
`performance.measureUserAgentSpecificMemory()` after 100 saved decisions with a
loaded bot and identical inputs failed for both TypeScript and WASM:

```text
SecurityError: Failed to execute 'measureUserAgentSpecificMemory' on 'Performance': performance.measureUserAgentSpecificMemory is not available.
```

See `browser-typescript-memory.json` and `browser-wasm-memory.json`. A main-page
`performance.memory` sample would exclude the bot Worker and is not presented as
bot memory. Browser WASM linear memory is reported separately. Native Tauri
whole-process-tree RSS is measured for all three runtimes, plus native child RSS;
RSS sums include shared pages more than once. Comparable browser-wide memory
remains outstanding on a browser that permits this API or exposes per-target
process accounting. No missing measurement is counted as a success.

## Existing Story media test failures

The related AppShell file ran 65 tests: 63 passed, including the new startup-menu
AI dependency case. Two Story collection media tests failed:

- `keeps Story collection media lazy and releases selected preview on navigation`:
  expected no media acquire call, observed one.
- `cancels pending Story collection preview media on navigation`: expected one
  acquire call, observed two.

To distinguish a regression from existing behavior, the exact
`6e4bd045:src/shell/AppShell.svelte` was temporarily restored, those two tests were
run with Vitest's name filter, and the implementation file was restored immediately
in a `finally` block. Both assertions failed identically against that base file.
No Story media behavior was changed. The AppShell test fixture also lacked the
existing main menu's `__APP_BUILD_ID__` global; the fixture now supplies it, avoiding
an unrelated error-boundary loop while exercising the new menu requirement.
