# Desktop setup: Windows, macOS and Linux

Use Node.js 26+, npm, Git and stable Rust installed through rustup. Install the
native dependencies listed in [Tauri's prerequisites](https://v2.tauri.app/start/prerequisites/).

| Platform      | Native prerequisites                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Windows       | Visual Studio Build Tools with Desktop development with C++, Windows SDK, and WebView2. Use the MSVC Rust toolchain.                  |
| macOS         | Xcode Command Line Tools (`xcode-select --install`); full Xcode for iOS.                                                              |
| Ubuntu/Debian | `build-essential`, `pkg-config`, `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libxdo-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`. |

Allow at least 35 GB free space for images, conversion fixtures, native resources
and compiler outputs. Initial downloads need network access. No GitHub SSH key or
publisher credentials are needed for the HTTPS clone.

## Clone and prepare

These commands work in PowerShell and Unix shells. Use a short checkout path on
Windows; the clone options preserve frozen vendor bytes and permit long paths.

```sh
git -c core.longpaths=true clone -c core.longpaths=true -c core.autocrlf=false https://github.com/aronGomu/ascencio.git
cd ascencio
npm ci
npm run setup
npm run build
```

Setup restores tracked authoring/configuration inputs, acquires pinned engine and
card sources, downloads card artwork, card backs and set artwork, converts content
to readable packs, and checks the tracked critical release. It does not open the
app. Existing author edits and installed user data are preserved. Conversion can
take tens of minutes on Windows. Missing provider artwork uses existing app
placeholders; malformed responses are rejected.

Downloads are resumable. `npm run setup -- --offline` uses complete existing
caches. A partially created readable package must be moved aside before retrying;
the command reports its exact path. Release hash mismatch requires investigating
source/provider drift and preparing a new reviewed package version. Setup never
silently repins a release.

The historical SQLite conversion fixtures exceed ZIP32 with the complete image
catalog, so setup deliberately omits the legacy combined archive. The native app
uses JSON snapshots and live media, and does not need that archive.

## Run and validate

```sh
npm test
npm run test:native:rust
npx playwright install chromium webkit
npm run test:browser:native-bridge
```

On Linux, install browser OS dependencies with `npx playwright install --with-deps
chromium webkit`. Browser tests are headless native IPC fixtures. They exercise
startup, card previews and duels but do not establish actual desktop window or
physical device acceptance.

`npm start` builds through Tauri and then opens the desktop app. `npm start --
--debug` builds/opens the debug binary. `npm start -- --headless --debug` only builds
the standalone executable and opens no window. The desktop GUI itself has no
headless gameplay service. Use browser fixtures and Rust tests for unattended
validation. `npm run native:desktop:dev` explicitly opens development mode.

## Source inputs

`content/bootstrap-inputs/` preserves the original authoring documents, normalized
sets and boosters, Chapter 1 decks, and the available story map. Downloaded card
definitions, scripts and media remain ignored. Current release inputs were
recovered from the repository's pre-migration history and normalized against the
pinned Project Ignis catalog. Future content edits should update these tracked
inputs, regenerate packages, and review new release versions and hashes.

The platform CI matrix checks source acquisition, filesystem/launcher fixtures,
types, Rust tests and frontend production builds on Windows, macOS and Linux.
It uses `setup --sources-only` to avoid duplicating the multi-GB artwork archive
on small hosted runners. Full setup, native resource builds and complete test
suites require the disk budget above. Local validation on a Windows host does
not establish successful execution on the other operating systems.
