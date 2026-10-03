# Development commands

Use Node 26 or newer. `package.json` is the executable command registry. Names distinguish frontend files, native applications, source acquisition, JSON release content, browser fixtures and retained legacy conversion.

For an ordinary Linux launch, use `npm run native:build-and-start:linux`. Preserve an already-running owner session. Unset acceptance/recovery instrumentation variables for ordinary launches. A plain Cargo release build can still target the development URL; standalone launches require Tauri custom-protocol support.

Pass command arguments after `--`. Conversion and compilation accept `--help`. Legacy commands remain available for historical recovery; they do not define the current gameplay content authority.

| ID | Command | Scope |
| --- | --- | --- |
| C1 | `npm run legacy:assets:inventory` | Scan legacy roots/profiles into an inventory; `--check` checks without writing. |
| C2 | `npm run legacy:assets:profile-promote` | Preview profile delivery-rule changes; `--apply` writes them. No asset moves or publishing. |
| C3 | `npm run legacy:assets:copy-migrate` | Plan/apply hash-guarded copies from historical asset layouts; originals preserved. |
| C4 | `npm run legacy:assets:copy-to-package-roots` | Plan/apply historical asset copies into package-owned roots. |
| C5 | `npm run assets:bootstrap` | Acquire/verify the pinned engine and upstream card/script/string sources; acquire full/cropped card images online; verify full images and generate/verify a source manifest. Set images, card-back art and JSON release staging are separate. |
| C6 | `npm run assets:engine:acquire` | Acquire the pinned engine into tooling storage; does not update frozen vendor files. |
| C7 | `npm run assets:engine:verify-acquired` | Check the acquired engine files against their manifest and WASM header. |
| C8 | `npm run assets:upstream:sync` | Synchronize pinned upstream card/script/string sources and generate acquisition data. Pass `-- --offline` to use local caches without fetching. |
| C9 | `npm run assets:verify-all` | Verify acquisition data, set images and the full-card image archive. |
| C10 | `npm run assets:cards:download-full` | Download/resume full-card JPEG artwork. |
| C11 | `npm run assets:cards:download-cropped` | Download/resume cropped card illustrations. |
| C12 | `npm run assets:cards:download-cropped-reviewed-pool` | Download crops only for the reviewed deck card pool; this is not the installed-content selection. |
| C13 | `npm run assets:cards:verify-full` | Verify full-card archive coverage, JPEG boundaries and download-report consistency; does not verify cropped art. |
| C14 | `npm run assets:card-back:download` | Download optional card-back artwork. |
| C15 | `npm run assets:sets:download-images` | Acquire set artwork and write its manifest. |
| C16 | `npm run assets:sets:verify-images` | Verify set artwork and the reviewed image lock. |
| C17 | `npm run assets:images:pin` | Generate the tracked image digest lock from local shipped card/crop/set artwork; review changes before accepting them. |
| C18 | `npm run vendor:verify` | Verify frozen vendored engine files against their reviewed manifest. |
| C19 | `npm run content:source-manifest:generate` | Generate the acquisition/runtime-source manifest. This does not compile ADR-104 critical JSON snapshots. |
| C20 | `npm run content:source-manifest:verify` | Independently derive and verify the acquisition/runtime-source manifest and files. |
| C21 | `npm run content:shop-sets:fetch-and-generate` | Fetch provider card membership for 50 TCG sets and write shop-set authoring JSON. |
| C22 | `npm run frontend:dev` | Start Vite only; native application development uses `native:desktop:dev`. |
| C23 | `npm run frontend:build` | Verify vendor files, bundle frontend code and verify artifact boundaries/budgets. Output: `generated/build/app/`. Does not build a native executable. |
| C24 | `npm run frontend:bundle` | Run Vite in native frontend mode without the surrounding vendor/artifact checks. |
| C25 | `npm run frontend:verify` | Check the generated frontend artifact, public build boundaries and domain byte budgets. |
| C26 | `npm run frontend:verify-reproducible` | Build twice into isolated output directories and require identical file hashes. |
| C27 | `npm run frontend:preview` | Serve existing built frontend files for inspection/browser fixtures; does not launch Tauri. |
| C28 | `npm run format` | Apply Prettier to the configured source, test, script and root-config files. |
| C29 | `npm run format:check` | Check Prettier without rewriting files. |
| C30 | `npm run lint` | Run ESLint. |
| C31 | `npm run typecheck` | Run TypeScript and Svelte type checks. |
| C32 | `npm run test:tooling` | Run Node tests under `tests/*.test.ts`, including acquisition and migration tooling. |
| C33 | `npm run test:unit-and-performance` | Run Vitest unit tests, then the separately isolated deck-catalog performance suite. |
| C34 | `npm run test:component` | Run Svelte component tests. |
| C35 | `npm run test:integration` | Run integration tests, including real engine/assets where fixtures require them. |
| C36 | `npm run test:browser:native-bridge` | Run Playwright native-IPC browser fixtures using Chromium/WebKit projects. Does not launch a native desktop executable. |
| C37 | `npm run test:browser:visual-acceptance` | Run the isolated Chromium visual acceptance harness. |
| C38 | `npm run test` | Run tooling, unit/performance, component and integration tests. Excludes browser, Rust and actual native desktop/physical acceptance. |
| C39 | `npm run check:headless` | Check formatting/lint/types; run tooling, unit/performance and integration tests; verify vendor, acquisition assets and source manifest. Component tests are in the separate frontend/browser gate. |
| C40 | `npm run check:frontend-and-browser` | Run component tests, frontend build/verification/reproducibility and both browser suites. |
| C41 | `npm run check` | Run both preceding check groups. Excludes Rust, SQLite/JSON parity and actual native desktop/physical acceptance. |
| C42 | `npm run content:convert:sqlite-to-json` | Convert a verified historical SQLite package to readable JSON sources and independent media: `-- <input.sqlite> <new-source-directory>`. |
| C43 | `npm run content:compile:json` | Compile readable sources to critical JSON, source maps and engine digests: `-- <source-directory> <output-directory>`. |
| C44 | `npm run content:verify:sqlite-json-parity` | Compare historical SQLite queries against JSON snapshot queries and check repeatable compilation. |
| C45 | `npm run mods:bundle` | Bundle declared mod files into a new JSON import file: `-- <mod-directory> <new-bundle.json>`. Startup still performs Lua/composition validation. |
| C46 | `npm run mods:audit:wasm-imports` | Inspect frozen WASM imports and loader bindings; write a new report: `-- <new-report.json>`. Not a general proof of script safety. |
| C47 | `npm run legacy:content:export-sqlite` | Produce historical SQLite content packages: `-- --spec <file>`. |
| C48 | `npm run legacy:content:verify-sqlite` | Verify one historical SQLite package: `-- --file <file>`; does not prove cross-package stack validity. |
| C49 | `npm run content:release:pin` | Compile/check source inputs and write tracked `content/critical-release.json`, the application trust anchor. Review the resulting digest changes. |
| C50 | `npm run content:stage:native` | Compile/check inputs against the pinned release and atomically stage readable native resources. |
| C51 | `npm run content:stage:verify-native` | Verify staged critical snapshots and frozen engine buffers against the pinned release. |
| C52 | `npm run content:stage:cleanup` | Preview marked content staging: `-- --target <staging-directory>`. Add `--delete` to delete that stage; installed app-data and saves are outside its scope. |
| C53 | `npm run native:desktop:dev` | Prepare native content and launch Tauri with Vite development hosting. |
| C54 | `npm run native:build-and-start:linux` | Build through the Tauri CLI with `--no-bundle`, then launch the Linux executable. Uses bundled frontend assets; no development server required. |
| C55 | `npm run native:desktop:build` | Run Tauri desktop build/package, including content staging, frontend verification and standalone custom-protocol support. Pass `-- --no-bundle` for an executable without installers. |
| C56 | `npm run native:android:dev` | Run Tauri Android development; requires the platform toolchain/device. |
| C57 | `npm run native:android:build` | Build the Tauri Android application; requires the platform toolchain. |
| C58 | `npm run native:ios:dev` | Run Tauri iOS development on a supported Apple toolchain/device. |
| C59 | `npm run native:ios:build` | Build the Tauri iOS application on a supported Apple toolchain. |
| C60 | `npm run test:native:rust` | Run Cargo tests for the native crate. Opt-in ignored instrumentation tests remain separate. |

`npm test` is equivalent to `npm run test`. Aggregate checks intentionally retain their existing coverage; a successful `check` is not native Rust, actual desktop, external-opener or physical-device acceptance.

Actual desktop recovery uses `node scripts/verify-native-startup-recovery.ts <new-report.json>` with the isolated opt-in native-acceptance build. See [startup I/O evidence](architecture/06-quality/startup-io-evidence.md) for instrumentation and capture limits.
