# Environment investigation and resolved blockers

## Current application content: resolved

The earlier supplied `generated/readable-content-v1` was 1.1.2 and did not match
the unchanged 1.1.3 trust anchor. That was a stale generated input, not an absent
current source. Current acquired `assets/card-library` and `assets/chapter-01`
were copied read-only from the parent into this checkout (copy-on-write where
available). No shared source, trust anchor or baseline was changed.

The current checkout's `assets/packages.json` was exported into its own
`generated/content-packages` using `exportPackages(..., {archive:false})`.
`exportSqliteSource` converted each package into its own
`generated/readable-content-v1`. Then:

```sh
node scripts/readable-content-release.ts prepare
node scripts/readable-content-release.ts verify-staged
DEV_PORT=4215 node node_modules/vite/bin/vite.js --config config/vite.config.ts --mode browser-dev
npm run frontend:build
cargo build --release --features tauri/custom-protocol,native-acceptance --manifest-path tauri/Cargo.toml
ASCENCIO_NATIVE_ACCEPTANCE=1 ASCENCIO_IO_TRACE=1 ASCENCIO_NATIVE_RECOVERY=reopened \
  XDG_DATA_HOME="$PWD/.tmp/startup-native-data" XDG_CACHE_HOME="$PWD/.tmp/startup-native-cache" \
  timeout 70s tauri/target/release/ascencio
```

All four current snapshots pass the tracked trust anchor. Normal browser startup
reached the main menu and Freeplay, listed the three WASM policies, and accepted
Generalist selection independently of the deck. No additional deck campaign was
started. The actual packaged application reached the main menu with zero global
errors; `packaged-application-startup.json` retains its existing acceptance-hook
report. The bot smoke harness remains separate and uses the immutable baseline's
1.1.2 content identity for its exact saved scenarios.

## Comparable browser memory: resolved with process accounting

Electron's `measureUserAgentSpecificMemory()` still throws SecurityError despite
cross-origin isolation. That API is no longer a completion blocker. The installed
Chromium executable supports a separate headless process and fresh user-data
profile for each target. `run-browser.ts <chromium> memory typescript wasm` runs
identical 100-decision saved inputs, keeps the bot/workload alive, and samples the
entire browser process tree's Linux VmRSS three times, one second apart.

The method includes browser, renderer, utility and Worker processes and counts
shared pages once per process. It is not exclusive allocation or peak memory;
there is no forced GC or disk-cache eviction. Both targets use identical launch
flags and observation points. The retained `browser-*-memory.json` records name
the browser version, every PID/parent/RSS and all samples. The old rejected API
is documented here rather than being presented as a valid measurement.

## Existing Story media test failures

Two related AppShell assertions fail:

- `keeps Story collection media lazy and releases selected preview on navigation`:
  expected no media acquire call, observed one.
- `cancels pending Story collection preview media on navigation`: expected one
  acquire call, observed two.

Both were reproduced against the exact original ticket base
`2e9489fb33b4d60cd4c9a541154362059c8f4bb7:src/shell/AppShell.svelte`, not only the
phase-one commit. The current file was saved, the base file temporarily restored,
and the two tests run with the name filter below. A `finally` block immediately
restored the current implementation. Both assertions failed identically.

```sh
node node_modules/vitest/vitest.mjs run -c test/config/vitest.config.ts \
  test/component/AppShell.test.ts \
  -t 'keeps Story collection media lazy|cancels pending Story collection preview'
```

These are unrelated existing Story media failures, not open bot-runtime defects.
The current AppShell fixture supplies its existing `__APP_BUILD_ID__` global.
