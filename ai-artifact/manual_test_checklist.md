# Manual Test Checklist

## T1 utility_bar_rework

- [ ] Run `npm run dev`, open `#/story`, start New Game
- [ ] Utility bar shows exactly 5 buttons: History, Auto, Skip, Hide UI, and a gear icon (no Save / Load / Settings / Pause text buttons)
- [ ] Auto button tooltip reads "Not functional yet" (hover); button text is "Auto" only, no "experimental"
- [ ] Skip button tooltip reads "Not functional yet" (hover); button text is "Skip" only, no "experimental"
- [ ] Gear button has `aria-label="Open menu"` (inspect element); clicking it opens the pause overlay
- [ ] Click "Hide UI": dialogue box, History, Auto, Skip, and gear button disappear; only the toggle remains on screen; toggle text changes to "Show UI"; no floating button appears bottom-right
- [ ] Click "Show UI": dialogue and all other buttons return to screen; toggle text reverts to "Hide UI"
- [ ] While UI is hidden, pressing Enter / Space and clicking the stage do not advance the dialogue
- [ ] History button still opens the history overlay

## T2 floating_gear_menu

- [ ] Run `npm run dev`, open `#/story`, start New Game; verify NO floating gear button appears on narrative screen (only the narrative bar gear is present)
- [ ] Navigate to map (advance through all beats or use browser console to resume with map state); verify a circular gear button appears fixed top-right corner
- [ ] The top-right gear button has `aria-label="Open menu"` (inspect element); `data-cy="story-global-menu"` present; `data-cy="story-global-pause"` absent in DOM
- [ ] Clicking the top-right gear opens the overlay; overlay heading reads "Menu" (not "Paused")
- [ ] Overlay contains buttons: Resume, Save, Load, Settings, Return to Title — all functional
- [ ] Close button reads "Close Menu" (not "Close Paused")
- [ ] Gear button absent on title screen, load screen, and end screen
- [ ] Gear button present on pre-battle, battle-mock, outcome, and reward screens

## T3 title_return_to_menu

- [ ] Run `npm run dev`, open `#/story`; verify a "Main menu" button appears in the title nav after "Settings"
- [ ] Click "Main menu" from the title screen; browser navigates to `#/` (shell home screen)
- [ ] Navigate back to `#/story`; title screen loads normally; existing buttons (New Game, Load, Settings) remain functional
- [ ] Verify "Main menu" button has `data-cy="story-title-main-menu"` (inspect element)

## T4 economy_state_save_v2

State + persistence only — no shop UI exists yet, so every check below is done through DevTools.

- [ ] Run `npm run dev`, open `#/story`, start New Game, then open the gear menu and Save to `manual:1`
- [ ] DevTools → Application → IndexedDB → `ygo-story-saves` → `saves` → `manual:1`: record shows `schemaVersion: 2`
- [ ] Same record's `state` carries `dp: 1000`, `boosters: {}`, `collection: {}`, and `shopReturnScreen` / `shopSetId` / `openedCards` / `openingMode` all `null`
- [ ] Simulate an older save: in the DevTools console, read `manual:1`, set `schemaVersion` to `1`, `delete` the seven fields above from `state`, put it back under key `manual:1`, then reload `#/story`
- [ ] Load screen still lists the slot with its original chapter label, and Load resumes at the same screen and beat as before the edit (no progress lost, no "save is unreadable" message)
- [ ] Re-save that slot and confirm the stored record is back at `schemaVersion: 2` with `dp: 1000` and the empty maps
- [ ] Simulate a newer build: set a slot's `schemaVersion` to `3`, reload, and confirm the story reports the save as incompatible rather than deleting it or crashing
- [ ] Play the existing prologue path end to end once (New Game → map → Old Arena → duel → outcome → reward): autosave, checkpoint and Continue all still work

## T5 shop_location_greeting

- [ ] Run `npm run dev`, open `#/story`, start New Game, advance to the map (or use gear → Continue on an existing save at the map)
- [ ] Verify a "Card Shop" hotspot appears on the map image (expected position near 62% / 72%) and a "Card Shop" row appears in the location sidebar list
- [ ] Click the Card Shop hotspot or sidebar row; verify the greeting screen opens (dialogue box visible, no duel loading)
- [ ] First beat text contains "Welcome in. Shipment day"; speaker line reads "Shopkeeper"
- [ ] Click the stage (or press Enter / Space) to advance to the second beat: text contains "Buying packs? Selling doubles? Either way, DP talks."
- [ ] Click the stage once more; dialogue box disappears; a menu nav appears with three buttons: "Buy Cards", "Sell Cards", and "Leave Shop"
- [ ] "Buy Cards" button is **enabled** (T9 wired it); clicking it opens the set browser screen
- [ ] "Sell Cards" button is still disabled and shows tooltip "Coming in a later slice" on hover
- [ ] Click "Leave Shop"; map screen reloads with all previous state intact (objective, choice acknowledgment, locations unchanged)
- [ ] Gear button (top-right) is accessible from the greeting screen
- [ ] Double-clicking the stage does not advance two beats at once (only one advance per click event)
- [ ] Old-arena and archive map hotspots still route to the pre-battle screen as before

## T6 story_top_bar

- [ ] Run `npm run dev`, open `#/story`; verify NO top bar (`data-cy="story-top-bar"`) is visible on the title screen
- [ ] Start New Game; narrative screen shows top-left bar with `1000 DP` text, a shop bag icon, and a deck icon
- [ ] Click the shop icon; greeting screen opens ("Welcome in. Shipment day"); the shop icon is now hidden (bar still shows DP + deck icon only)
- [ ] Click "Leave Shop" on the greeting screen; returns to the map; top bar shows again with shop icon
- [ ] Navigate to the map; top bar shows `1000 DP`, shop icon, and deck icon
- [ ] Click the deck icon; browser navigates to `#/decks`; pressing Back returns to `#/story` (story state retained in memory)
- [ ] Verify title, load, pre-battle, battle-mock, outcome, reward, and end screens do NOT show the top bar
- [ ] Inspect element: shop button has `aria-label="Open shop"`, deck button has `aria-label="Open deck builder"`, icons carry `aria-hidden="true"`
- [ ] `data-cy="story-top-bar-shop"` absent while on any `shop-*` screen; present on narrative and map
- [ ] Gear menu (top-right) still opens on map/pre-battle as before; no visual overlap with top bar

## T7 shop_data_contracts

This slice is contracts-only (pure TypeScript modules, no UI surface). No manual browser steps are required.

The three modules — `src/story/shop/data/shop-rarity.ts`, `src/story/shop/data/shop-pricing.ts`, and `src/story/shop/data/pack-generator.ts` — are verified entirely by unit tests (`tests/unit/story/shop-data.test.ts`). Run `npx vitest run tests/unit/story/shop-data.test.ts` to confirm all 5 automated assertions pass.

## T8 set_data_asset_loader

- [ ] Run `npm run dev`; in a new terminal run `curl http://localhost:5173/story/shop-sets.v1.json | head -5` — verify JSON with `"version":1` and `"sets":[` is returned
- [ ] Open the browser network tab; navigate to `#/story`; confirm no request to `/story/shop-sets.v1.json` is made on story load (loader not wired yet — T9 wires it)
- [ ] Confirm `public/story/shop-sets.v1.json` contains exactly 50 sets: `node -e "const d=JSON.parse(require('fs').readFileSync('public/story/shop-sets.v1.json','utf8')); console.log(d.sets.length, 'sets')"`
- [ ] Verify first 3 sets have `released: true` (LOB, MRD, PSV) and all others have `released: false`: `node -e "const d=JSON.parse(require('fs').readFileSync('public/story/shop-sets.v1.json','utf8')); console.log(d.sets.filter(s=>s.released).map(s=>s.id))"`
- [ ] Confirm no card entry in any set has a rarity outside the ShopRarity union: `node -e "const valid=new Set(['common','rare','super-rare','ultra-rare','secret-rare','ultimate-rare','ghost-rare']); const d=JSON.parse(require('fs').readFileSync('public/story/shop-sets.v1.json','utf8')); const bad=d.sets.flatMap(s=>s.cards.filter(c=>!valid.has(c.rarity))); console.log(bad.length===0?'OK':bad)"`

## T9 set_browser_buy

- [ ] Run `npm run dev`, open `#/story`, start New Game, navigate to the map, open Card Shop
- [ ] Click through both shopkeeper beats; "Buy Cards" button is now enabled (not disabled) — click it to open the set browser
- [ ] Set browser shows a "Loading sets…" spinner on first visit (one network request to `/story/shop-sets.v1.json`), which resolves into the full browse screen
- [ ] "Latest Released" row shows 3 tiles in newest-first order: Pharaoh's Servant, Metal Raiders, Legend of Blue-Eyes White Dragon
- [ ] Unreleased sets appear in the full grid below, dimmed and with a 🔒 glyph — clicking them does nothing (no dialog opens)
- [ ] Click a released set tile (e.g. "Legend of Blue-Eyes White Dragon"); a dialog opens with the set name as the heading and "100 DP / pack"
- [ ] Click "Buy 1 · 100 DP" — dialog closes, DP pill in top bar drops by 100 (from 1000 to 900); re-open dialog to confirm button still works
- [ ] Click "Buy 10 · 1000 DP" (requires ≥ 1000 DP) — DP drops by 1000
- [ ] Set custom input to 3 and click "Buy 3" — DP drops by 300
- [ ] With DP < 100: "Buy 1" and "Buy 10" and "Buy N" buttons are all disabled; a red error line reads "Not enough DP…"
- [ ] "View card list" button is disabled with tooltip "Coming in a later slice"
- [ ] Close the dialog with the "Close" button or Escape key; returns to set browser
- [ ] "← Back" button in set browser returns to the shopkeeper greeting screen
- [ ] Switch device to airplane mode (or DevTools → Network → Offline) and revisit the shop: set browser still renders using the cached JSON (Cache Storage entry `story-shop-data`)
- [ ] Reload in offline mode with cache cleared → error state appears with a "Retry" button; going online and clicking Retry loads the grid
- [ ] DP pill in the top bar updates live after every purchase without requiring navigation
- [ ] Gear button (top-right) remains accessible from the set browser and dialog screens
