# Browser fixture suites

Product runtime is Tauri desktop/mobile. Browser suites exercise controlled fixtures; they do not launch the packaged native application or establish physical-device acceptance.

| ID  | Directory      | Configuration / command                                                                 | Current role                                                                                |
| --- | -------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E1  | `native/`      | `test/config/playwright.native.config.ts`; `npm run test:browser:native-bridge`         | Native IPC bridge: Chromium desktop plus WebKit compact, desktop and mobile viewports       |
| E2  | `acceptance/`  | `test/config/playwright.acceptance.config.ts`; `npm run test:browser:visual-acceptance` | Isolated Chromium visual fixtures                                                           |
| E3  | `application/` | No active configuration                                                                 | Retained historical browser/static/PWA scenarios; not evidence from current aggregate gates |
| E4  | `resources/`   | `test/config/playwright.resource.config.ts`; `npm run test:browser:resources`           | Production-build resource lifetime, heap and focus-feedback acceptance fixtures             |

`test/config/playwright.config.ts` delegates to the native configuration. The removed `playwright.core.config.ts` and CORE browser lifecycle suite are historical. Native fixtures require prepared test content; inspect [the bridge specification](native/native-content-bridge.ts) for its resource fixture contract. Generated results are under `.tmp/test/`; paths are configured per suite.

`npm run check:frontend-and-browser` verifies browser test collection, then runs component tests, frontend build/verification/reproducibility and the native and visual acceptance suites. The resource suite remains a separate acceptance command. `npm run check` also runs headless gates. Rust, SQLite/JSON parity and actual native/device acceptance remain separate; see [testing](../../docs/architecture/06-quality/testing.md). Installing Firefox for CI does not configure a Firefox test project.
