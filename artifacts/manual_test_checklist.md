# Manual test checklist

## Progressive content, saves, media, and CORE lifecycle (T11)

Use a disposable Chromium profile, approved private release fixtures, and loopback origin. Required data enables play; optional media and every update remain explicit.

- [ ] C1. Open `#/install-content`; click **Check updates**, then **Install required data**, then **Activate content**. Verify each phase changes only after its click; Story, Free Play, Deck Editor, Collection, and a real duel open after activation. Reload offline; verify all five remain usable with zero optional-media requests.
- [ ] C2. Pause a required or media download, close the tab, then reopen Content & Updates. Verify job is shown paused and no network resumes until **Resume required download** or **Resume media download** is clicked. Resume; verify completed files are reused while interrupted file restarts.
- [ ] C3. With saves in manual slots, autosave, and pre-duel checkpoint, activate a forward-compatible release. Verify beat position remaps by semantic beat ID while economy, decks, timestamps, and slot revisions persist. Repeat with corrupt/future save, quota failure, cancellation after seal, and selector conflict; verify old content/save pair remains selected.
- [ ] C4. Keep Story or duel open in tab A; attempt activation or cleanup from tab B. Verify immediate active-session block and no queued commit after tab A closes. From Main Menu, run **Delete unused assets**, then confirm **Delete all assets**; verify saves, Decks, settings, CORE shell caches, and unknown/legacy cache entries persist while playable Content selection clears.
- [ ] C5. Discover an incompatible CORE candidate; verify approval refuses without changing installed play. Discover a compatible candidate; verify no download or install occurs before **Approve CORE update**. Close every app tab, reopen offline, and verify old controller survives unapproved candidate while approved waiting controller activates only on cold reopen.

## Chapter 1 installed gameplay

These checks require verified Chapter 1 installation. Source-module Chromium covers both out-of-pool seat rejections (zero engine duels), calibrates its counter with a valid duel. Separate private built-app Chromium covers root/subpath install → Free Play → emitted Worker → terminal surrender without source imports or instrumentation. Manual items remain unchecked. Story save/narrative migration is outside T6.

- [ ] M1. In a fresh private browser profile, install Chapter 1, then open free play. Verify only installed Chapter 1 Starter and Chapter 1 Practice chapter tiles appear. Practice Bot defaults to Chapter 1 Practice. Double-click each chapter tile; verify read-only refusal, no editor opens. Open its menu; verify Open/Rename/Delete disabled, Duplicate available, no local-default star. Copy must never say Bundled/preset.
- [ ] M2. Select each of Practice Bot, Blaze Circuit, and Vault Warden. Verify the named persona remains distinct; each assigns Chapter 1 Practice. The shared practice tile must show installed chapter provenance, never Bundled. Override the opponent deck with Chapter 1 Starter; verify the persona remains selected. Select Blaze Circuit again; verify the opponent returns to Chapter 1 Practice.
- [ ] M3. Start a duel with the default pair. Verify 40 Main cards per seat, no Extra/Side cards, normal AI turns, no missing-card/script/protocol error.
- [ ] M4. Start a new story game in a disposable profile. Verify Chapter 1 Starter is granted with exactly its 40 owned copies, 1000 DP, no Extra/Side cards. Open a fresh free-play library; verify the same starter is created once and set as default.
- [ ] M5. Using exported copies of test saves only, open a legacy v1/v2 save twice. Verify the historical Starter Deck payload and maximum-count inventory top-up remain identical between reads; wallet and checkpoint remain unchanged. Verify reads do not rewrite the stored record.
- [ ] M6. Open copies of existing v3/v4 saves and nonempty free-play libraries, including a custom-only library with no default. Verify decks, revisions, inventory, currency, default choice, and checkpoint remain unchanged. Existing decks are not retroactively replaced with Chapter 1 cards.
- [ ] M7. Open the admin test-deck action in a disposable profile. Verify its explicitly requested new deck matches the installed default starter deck. Verify “Launch installed duel” opens installed Free Play without creating a deck. Do not reset an existing personal library.

## Assumptions

A1. Checklist remains human-run; unchecked boxes make no manual-pass claim.
A2. Private local/Chromium evidence establishes no publication rights, native mobile result, or live-host approval.


## Asset roots and profiles (T2 local candidate)

No hosted upload, upstream refresh, or owner-original cleanup belongs to these checks. Use a disposable checkout for mutations.

- [ ] A1. Run `npm run assets:migrate -- --plan`; inspect exact source/destination/size/SHA entries. Verify no source changes. Apply only in the disposable checkout; verify receipt hashes, all originals preserved. Run again with identical inputs; verify same-byte adoption.
- [ ] A2. Place different destination bytes before apply. Verify `ASSET_LOCAL_CONFLICT`, original/destination unchanged, no other planned destination copied.
- [ ] A3. Add unused `.psd` under a managed root; run `npm run assets:profiles:sync`. Verify inventory includes bytes as dev-only regardless Git ignore state. Remove only the disposable test input afterward.
- [ ] A4. Preview exact-file and tree promotions to an authored target profile. Apply, repeat; verify stable profile bytes, no asset moves, no silent reassignment. Add a tree child; verify next scan includes it.
- [ ] A5. Run `npm run assets:profiles:sync -- --check`. Deleting an explicitly declared file must produce `ASSET_REFERENCE_MISSING`. Initial profile selects extant optional media only; absent optional art must not be fabricated or made mandatory from gameplay metadata.
- [ ] A6. Build at `/ygo-story-duel/`; verify fonts, full/cropped cards, card back, runtime manifests, frozen Worker/WASM retain their browser URLs. Verify original source/provenance paths cannot be fetched through direct or Vite `@fs` source paths. Automated Chromium URL/hash/font + real-Worker smoke covers this path.
- [ ] A7. Repeat migration fault/retry fixtures on Windows/macOS filesystems. Unsupported hardlinks must fail `ASSET_LOCAL_CONFLICT`, never fall back to overwriting rename. After real process interruption, confirm process exit before removing only the exact stale lock; retry the original plan. Verify full-copy/link recovery matches clean-run inventory with no UUID temp bytes. Partial/mismatched/unowned temps must remain untouched behind `ASSET_RECOVERY_REQUIRED`; normal inventory/profile/common-lock writers stay blocked. Preserve pending marker and affected files for owner inspection, never bypass the gate by deleting metadata.
- [ ] A8. In disposable fixtures, verify empty-directory case/Unicode aliases fail before any migration copy; long valid basenames succeed with independent short temps; derived paths exceeding 512 bytes fail preview before copying. Remove only fixture-owned inputs afterward.

## Deterministic local bundles (T3 candidate)

No publish/install/remote commands. These checks do not certify gameplay or distribution rights.

- [ ] B1. Run `npm run assets:bundle -- --target dev`. Verify final JSON snapshot SHA; `npm run content:verify` must pass. Inspect pinned DevManifest: every safe managed-root original appears, including unclassified bytes.
- [ ] B2. Run same command with a different `TZ`; verify identical snapshot/archive SHA. In a disposable fixture, change only file modes/insertion order; verify byte identity.
- [ ] B3. Run `npm run content:catalog`. Unmapped selected set names must fail explicitly; never invent IDs or drop duplicate-membership sets to pass. With complete fixture input, inspect exact source digest records and chapter IDs.
- [ ] B4. With explicit prepared fixture, run `npm run content:pack -- --empty-history`; inspect core exclusion, chapter policy set IDs, runtime dependency, bounded part refs. `content:verify` must validate all objects. Missing history input must fail; retained release objects must remain byte-identical.
- [ ] B5. Only on an approved disk, run `node tests/fixtures/asset-delivery-large.ts --directory /approved-disk/new-fixture --bytes 4294967297`. Record stdout with peak RSS/archive hashes/disk requirement. 10 GiB variant uses `--bytes 10737418240`, requires at least 50.5 GiB free. Actual >4 GiB proof remains pending until this runs; small ZIP64 fixtures are not equivalent.
