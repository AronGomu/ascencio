## T1 pixel-geometry-model

- [ ] Confirm existing duel field renderer looks unchanged at supported viewport sizes.
- [ ] Confirm keyboard field navigation behaves identically at small and large viewport sizes.
- [ ] Confirm Link-free duel omits both shared Extra Monster Zones from render-layout data.

## T2 conditional-chromium-acceptance-harness

- [ ] Open an unknown or missing acceptance scenario and confirm a visible error appears with no fallback board.
- [ ] Open the normal app and confirm its startup and duel experience remain unchanged.
- [ ] Open the deterministic EMZ, no-EMZ, and Defense harness scenarios and confirm each field renders visually as expected.

## T3 pixel-board-rendering

- [ ] Open real duel; confirm square zone outlines plus concentric card slots stay aligned.
- [ ] Resize duel boundary; confirm board recomputes without oscillation or clipped floating windows.
- [ ] Hover face-up Defense plus face-down Set cards; confirm art rotates while outer card centre plus hover scale stay fixed.
- [ ] Use keyboard focus, card actions, stack preview, hand drag; confirm controls remain actionable.

## T4 full-hands-overlay-scrollbar

- [ ] Use wheel/trackpad to reach offscreen cards in a 20-card hand.
- [ ] Use Arrow navigation to reach offscreen hand cards; confirm focus scrolls them into view.
- [ ] Drag an actionable hand card after scrolling; confirm drag still starts and completes.
- [ ] Drag the overlay thumb; confirm the hand viewport scrolls without changing card height.

## T5 geometry-anchored-phases

- [ ] Confirm EMZ phase groups flank both shared zones without overlap.
- [ ] Confirm no-EMZ phases form one centered Draw→Standby→Main 1→Battle→Main 2 run.
- [ ] Confirm End turn aligns board inner-right edge in both profiles.
- [ ] Use keyboard to reach each legal phase control plus End turn; confirm each activates same offered choice.

## T6 right-rail-replaces-header

- [ ] Confirm right-rail Options opens menu/settings during active duel.
- [ ] Confirm rail status stays additive; active prompt remains sole decision UI.
- [ ] Confirm reduced-motion mode keeps three waiting dots visible and static.

## T7 full-height-shell

- [ ] Confirm preview, field, rail fill one viewport-height row with no page scrollbar.
- [ ] Resize among 1366×768, 1920×1080, 2560×1440; confirm field stays centered between preview and rail.
- [ ] Drag floating field windows to each edge, resize narrower; confirm windows reclamp inside field.

## T8 preview-overlay-scrollbar

- [ ] Focus effect text; confirm PageDown and End scroll it, focus ring stays visible, and overlay thumb is absent from Tab order.
- [ ] Compare short and long effect text; confirm paragraph width stays fixed and overlay thumb appears only for long text.
- [ ] Drag overlay thumb; confirm effect text scrolls while panel remains inside one viewport-height row.

## T9 persisted-display-settings-v2

- [ ] Toggle zone outlines and counts off; confirm zone names, focus, legality, selection, and drop halos remain intact.
- [ ] Reload; confirm both display choices remain off.
- [ ] Reset settings; reload; confirm both display choices return on.
- [ ] Clear site data; confirm display settings, decks, and floating-window positions return to defaults.

## T10 approved-browse-dialog-shell

- [ ] Confirm browse actions remain usable through approved shell.
- [ ] Confirm alphabetical sorting never requests or reveals hidden card art or identity.
- [ ] Confirm browse dismisses through outside press, Escape, header ×, and footer Cancel.
- [ ] Confirm 6-card row centers; overflow row retains 8px edges at field widths.

## T11 card-tiles-projected-choice-menu

- [ ] Confirm duplicate menu reaches every choice with Tab, Arrow keys, Home, and End; Escape returns focus to tile trigger.
- [ ] Confirm Details previews card without emitting an engine response.
- [ ] Confirm hidden cards reveal no identity in art alt text, labels, or menus.
- [ ] Confirm first and last zoomed card menus remain clickable inside dialog.

## T12 target-chrome-collapse

- [ ] Confirm target draft survives outside press, Escape, collapse, and expansion.
- [ ] Confirm target collapse stays anchored and expansion remains inside resized field boundary.
- [ ] Confirm target shows no ×, conditional Cancel, dynamic source notice, and privacy-safe sorting.
- [ ] Confirm browse still dismisses through outside press, Escape, ×, and Cancel.

## T14 selection-ui-integration

- [ ] Confirm off-field exact-single clicks draft only, then Validate submits; mounted-field exact-single still submits immediately.
- [ ] Confirm range Validate enables inclusively, while maximum lock disables only unselected opaque choices.
- [ ] Confirm selected duplicate choices remain removable one opaque ID at a time; final tile unselect suppresses zoom until pointerleave.
- [ ] Confirm sorting, collapse, outside press, and Escape preserve target draft without answering prompt.
- [ ] Confirm hidden opponent targets expose no identity or art while unavailable/selected state remains perceivable without color alone.

## T15 card-list-chromium-acceptance

- [x] Confirm attached wide browse, mixed target, max-locked target, and 320px responsive screenshots are readable.
- [x] Confirm keyboard route focus remains visible and no hidden card identity appears.
- [x] Confirm startup, duel actions, browse, target Validate, and reload settings remain functional.

## T1 merge-duel-field-branch

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/` — the duel starts directly, no blank screen and no "Application could not start" alert.
- [ ] On that duel, confirm the field uses the merged pixel geometry: square zone outlines with concentric card slots, aligned rows, no clipped board edge.
- [ ] Confirm the right status rail is present and the old duel header bar is gone.
- [ ] Confirm the whole duel fits exactly one viewport (no page scrollbar) at your normal window size, then resize taller/shorter and confirm it still fits.
- [ ] Open a stack zone (Deck / Graveyard / Banished) to raise the card-list dialog; confirm cards render as tiles, sorting/browse chrome appears, and Escape closes it.
- [ ] Open Settings, toggle a field-display option, reload the page, and confirm the toggle survived (persisted display settings v2).
- [ ] Open `http://localhost:4300/#/decks` — the Deck Editor library renders and the duel does not start. (Route renamed from `#/prototype/deck-builder` by T2; the surface was renamed from "deck-builder prototype" to "Deck Editor" by T8.)
- [ ] Open `http://localhost:4300/#/story` — the visual-novel title screen renders. (Corrected by T7: this was `prototype.html`, which no longer exists.)
- [ ] Run `npm run build` and confirm it exits 0 — this proves the repaired `vite.config.ts` still emits the `app` (`index.html`) bundle. (Corrected by T7: the `prototype` input was removed, so only one bundle is expected now.)
- [ ] Confirm `dist/index.html` exists after that build and `dist/prototype.html` does NOT. (Corrected by T7.)

## T2 shell-routes-and-mount

- [ ] Run `npm run dev` (default `DEV_PORT=4300`). Open `http://localhost:4300/#/` — the duel starts directly, exactly as before, with no "Application could not start" alert.
- [ ] Open `http://localhost:4300/#/duel` — the duel starts here too.
- [ ] Confirm the duel still fills exactly one viewport height with no page scrollbar (the `100svh` grid moved from `#app[data-app-entry="duel"]` to `.shell-region--duel`).
- [ ] Open `http://localhost:4300/#/decks` — the Deck Editor library renders and no duel starts. (Corrected by T8: this used to say "deck-builder prototype".)
- [ ] Open `http://localhost:4300/#/story` — the visual-novel title screen renders. (Corrected by T7: this used to be the `Not available yet` placeholder.)
- [ ] Open `http://localhost:4300/#/admin` — the page shows only the text `Not available yet`.
- [ ] Open `http://localhost:4300/#/nope` — it falls back to home, which currently renders the duel.
- [ ] Open `http://localhost:4300/#/prototype/deck-builder` — this old route is gone; it must now fall back to the duel, NOT the deck builder.
- [ ] From the duel, edit the address-bar hash to `#/decks` and press Enter without reloading — the shell swaps to the deck builder in place (hashchange routing).
- [ ] Then edit the hash back to `#/duel` without reloading — the shell swaps back to the duel.
- [ ] Play a few actions in the duel (draw/summon/end turn) and confirm it is fully usable with an empty browser console (no errors).
- [ ] Create and edit a deck in the deck builder, reload, and confirm the edit persisted and the console is empty.
- [ ] Open `http://localhost:4300/#/story` — the visual novel is served from `index.html` like every other domain. (Corrected by T7: this line used to point at `prototype.html`, which T7 deleted.)
- [ ] In DevTools, confirm `document.querySelector("#app").dataset.appShell === "ready"`.
- [ ] Run `npm run build` and confirm it exits 0.

## T3 design-tokens

T3 is a pure indirection refactor: every colour, radius and font-size in
`src/styles/app.css` now resolves from `src/styles/tokens.css`. Nothing may
look different. Every item below is a "did it stay the same" check — take a
screenshot before checking out this branch if you want a strict A/B.

- [ ] Run `npm run dev` and open `http://localhost:4300/#/duel`. The page background is still the dark navy with the blue radial glow in the top-left corner.
- [ ] The duel field board is still the dark green felt with its diagonal gradient and centre radial sheen — not flat, not a different hue.
- [ ] Empty zones still show their dashed pale-green outlines; zone count badges still read in off-white.
- [ ] Hover a card in your hand: the halo/zoom behaves as before and the card art border is still the pale near-white hairline.
- [ ] Trigger a legal action (e.g. summon): actionable zones and cards still show the GREEN halo, not orange.
- [ ] Select a card in a prompt: the selected halo is still ORANGE and overrides the green.
- [ ] Tab to a field control and confirm the keyboard focus ring is still the warm amber outline (`--focus-ring`), visually distinct from both green and orange.
- [ ] Drag a card over a legal drop zone: the drop-candidate fill is still translucent green and darkens on hover.
- [ ] Open the card-list dialog (click a zone with a pile): header, body, footer, scrollbar thumb/track colours and the tile borders are all unchanged.
- [ ] In the card-list dialog, hover a tile (orange border) and confirm an unavailable target tile still shows RED through hover and focus.
- [ ] Open the card preview panel: panel background, art frame and effect-text colours are unchanged; art is still bounded by viewport height.
- [ ] Check the status rail and the phase strip / End turn button: chip fills, text colours and the amber "warning" button hover are unchanged.
- [ ] Force an error (or view a known error/result panel): the error panel is still red-bordered on dark maroon, the recoverable variant still amber-bordered, the result panel still teal-bordered.
- [ ] Confirm no element has visibly different CORNER ROUNDING — `border-radius` values of 0.35/0.6/0.9rem were swapped for `--radius-sm/md/lg`.
- [ ] Confirm no label or badge changed SIZE — font sizes of 0.72/0.85/1.25rem were swapped for `--text-xs/sm/lg`.
- [ ] Play one full turn and confirm the browser console stays empty (no missing-variable or CSS parse warnings).

## T4 responsive-stage

T4 gives the whole product one layout law: above 1024px CSS width the app is a
centred 16:9 "stage" with `--bg` letterbox bars filling the leftover space;
below 1024px the shell publishes a mobile mode instead. The duel now measures
the stage, not the viewport. The portrait duel rotation and the deck portrait
layout are NOT in this ticket — below 1024px you should only see the mode
change and the stage scale down, not a re-laid-out duel.

Note for the T3 checks above: on a window whose aspect ratio is not 16:9 the
app is now bordered by black bars. Colours inside the stage are unchanged; the
bars themselves are expected and are not a T3 regression.

Run `npm run dev` and open `http://localhost:4300/#/duel` for every item.

- [ ] Resize the window to roughly 1920x1080 (or any 16:9 shape): there are NO bars — the app fills the window edge to edge.
- [ ] Resize to a tall/square window (e.g. 1920x1200, or just drag the bottom edge down): horizontal bars appear above and below the app, equal height, background matches the page background.
- [ ] Resize to a short/wide window (e.g. 1280x600): vertical bars appear left and right, equal width, and the duel shrinks to stay inside them.
- [ ] At every desktop size above: no scrollbar ever appears on the page itself, on either axis. Spin the mouse wheel over the field and over the bars — the page must not move.
- [ ] Inspect the stage element (`[data-cy="app-stage"]` in devtools) at each desktop size: `data-stage-mode` reads `stage`.
- [ ] Narrow the window below 1024px while keeping it wider than it is tall (e.g. 900x500): `data-stage-mode` reads `mobile-landscape` and the app is still a 16:9 box, just smaller, with bars top and bottom.
- [ ] Narrow to a portrait shape (e.g. 500x900): `data-stage-mode` reads `mobile-portrait`, ALL bars vanish, and the app fills the whole window. The duel is expected to look cramped here — its portrait layout is a later ticket.
- [ ] Rotate a phone/tablet (or use devtools device emulation) from portrait to landscape and back: the mode attribute flips between `mobile-portrait` and `mobile-landscape` without needing a page reload.
- [ ] Start a duel from the deck picker at 1920x1200: the picker, the field, the status rail and the card preview all sit INSIDE the stage — nothing is drawn over the bars.
- [ ] Play a full turn (summon, set, attack, end turn) at 1280x600: every control is reachable and clickable, and the field never spills outside the bars.
- [ ] Open the card-list dialog by clicking a zone with a pile at 1920x1200: the dialog stays inside the stage and can still be dragged/collapsed/closed.
- [ ] Open `http://localhost:4300/#/decks` and resize between the sizes above: the deck editor scrolls INSIDE the stage (its own scrollbar), and the page itself still never scrolls.
- [ ] Drag the window edge slowly across the 1024px boundary: the mode switches once, cleanly, with no flicker or stuck bars.

## T5 home-hub-and-settings

Run `npm run dev` and open `http://localhost:4300/` (no hash) for every item.

- [ ] The first screen is the hub: a "YGO Story Duel Simulator" title with four buttons — Story, Decks, Duel, Settings. NO deck picker and NO duel appear here.
- [ ] Click Duel: the URL becomes `#/duel` and the deck picker loads; start a duel and play a turn — the duel behaves exactly as before.
- [ ] Press the browser Back button from the duel: you return to the hub and the duel is gone.
- [ ] Click Decks: the URL becomes `#/decks` and the deck editor loads.
- [ ] Click Story: the URL becomes `#/story` and the "Not available yet" placeholder shows (the visual novel moves here in a later ticket).
- [ ] Type `http://localhost:4300/#/nonsense` in the address bar: you land back on the hub, not on an error.
- [ ] Click Settings on the hub: a settings dialog opens with a Fullscreen switch reading "Off" and a Close button.
- [ ] Click the Fullscreen switch: it reads "On". Close the dialog, reopen it — it still reads "On" (the choice is remembered).
- [ ] Reload the page: the browser does NOT jump to fullscreen on its own, and a tip appears on the hub explaining that fullscreen needs one click.
- [ ] Click "Go fullscreen" in the tip: the browser enters fullscreen.
- [ ] Leave fullscreen (Esc) and reload: the tip does NOT come back. Any first click or keypress in the app now re-applies fullscreen.
- [ ] Turn the Fullscreen switch back to "Off" in Settings and reload: no tip, and clicking around never forces fullscreen.
- [ ] With fullscreen preferred and the tip showing, click "Not now" instead: the tip disappears and does not return after a reload.
- [ ] In devtools Application → Local Storage, confirm a `ygo.ui.v3` entry exists after changing a setting.
- [ ] Zone outlines/counts you set previously inside the duel settings are still what you left them (the v2 display settings carry forward).

## T6 admin-console

Run `npm run dev`. The console is a developer surface: it is never linked from the game, so it is reached only by typing the URL.

- [ ] From the hub at `http://localhost:4300/`, look over the whole screen and open Settings: there is NO Admin/Console/Developer button anywhere.
- [ ] Press Tab repeatedly through the hub and the settings dialog: focus never lands on an admin control.
- [ ] Do the same sweep inside `#/duel` and `#/decks`: no admin control appears there either.
- [ ] Type `http://localhost:4300/#/admin` in the address bar: a "Developer console" screen loads with a warning line and three sections — Routes, State jumps, Resets.
- [ ] The console stays inside the 16:9 stage (letterbox bars are untouched) and scrolls with its own scrollbar if the window is short; the page itself never scrolls.
- [ ] In Routes, click `#/` → the hub loads. Type `#/admin` again, click `#/duel` → the deck picker loads. Type `#/admin` again, click `#/decks` → the deck editor loads. Type `#/admin` again, click `#/story` → the "Not available yet" placeholder shows.
- [ ] Back on `#/admin`, click "Seed test deck & open decks": the deck editor opens and the library lists a deck named "Admin test deck".
- [ ] Open that deck: it holds 40 Main-deck cards.
- [ ] Return to `#/admin` and click "Launch preset duel": the duel route opens with the normal deck picker, and no extra deck was written to the library.
- [ ] Return to `#/admin` and click "Open story": the visual-novel title screen shows. (Corrected by T7: this used to land on the placeholder.)
- [ ] Click "Reset…" next to "Deck library": nothing is deleted yet — a "Delete for good" button and a "Cancel" button appear in its place.
- [ ] Click "Cancel": the row returns to a single "Reset…" button. Visit `#/decks` — "Admin test deck" is STILL there. A single stray click must never delete data.
- [ ] Back on `#/admin`, click "Reset…" on "Deck library", then click "Reset…" on "Shell settings": only ONE row is armed at a time — the deck-library confirm disappears.
- [ ] Press Cancel, then arm "Deck library" again and click "Delete for good": the status line reads "Cleared Deck library." Visit `#/decks` — the library shows "No local decks".
- [ ] Repeat the arm-then-confirm flow for each remaining row (Duel snapshots, Shell settings, Story saves): each one asks for a separate confirmation and reports "Cleared …" when done. (Corrected by T7: the story row exists. Corrected by T13: it is now labelled "Story saves" and deletes the `ygo-story-saves` database, not a local-storage key.)
- [ ] After clearing "Shell settings", check devtools Application → Local Storage: the `ygo.ui.v3` entry is gone, and reloading the hub shows default settings.
- [ ] After clearing "Duel snapshots", start a duel from `#/duel` and play a turn: the duel still works (the snapshot store rebuilds itself).
- [ ] Reload `#/admin` after every reset: the console still loads and normal play from the hub is unaffected.

## T7 story-domain-migration

Reach the story

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/` — the home hub appears; click its Visual novel entry and the URL becomes `#/story`.
- [ ] Open `http://localhost:4300/#/story` directly — the title screen "Echoes of the Draw" renders with New Game / Load / Settings, and focus starts on New Game.
- [ ] Confirm there is NO "Start full flow" screen, no "Jump to screen or state" button, and no "Reviewer tools" drawer anywhere in the story.
- [ ] Open `http://localhost:4300/prototype.html` — it must NOT serve the visual novel any more (the second entry document is deleted).
- [ ] With DevTools Network open, load `#/story` and confirm no `.wasm` request and no `runtime/` request fires, and no Worker appears under Application → Workers. The story must not boot the duel engine.

Walk the prologue

- [ ] Click New Game — the first narrative beat ("Rain turned …") renders with the utility bar (History, Save, Load, Settings, Pause).
- [ ] Press Enter repeatedly (about 13 times) until "Choose your response" appears, and confirm the first choice button takes focus on its own.
- [ ] Pick "I trust you" — the acknowledgment about earning trust appears.
- [ ] Press Enter until the "City signal map" heading appears, and confirm the earlier-choice line mentions your trust.
- [ ] Select Old Arena from the location list — the "Rin's Echo" briefing appears. Go back and select it again from the map hotspots — the same briefing appears.
- [ ] Click Start Duel — the mock "Existing duel experience placeholder" appears. This is expected: the real duel handoff is a later ticket.
- [ ] Click Simulate Player Win → "Signal broken" → Continue story → "Signal Cipher" reward, with an "Autosave complete" status.
- [ ] Click Continue to updated map — the map now says "Archive available".
- [ ] Click Save progress → Confirm overwrite — "Save complete" appears; close the dialog.
- [ ] Reload the page — the title screen offers Continue; click it and you land back on the updated map.
- [ ] Click End prototype — the end screen appears; confirm its buttons read "Replay from the title" and "Return to the updated map" (there is no launcher any more), and that Replay returns you to the title screen.

Overlays and layout

- [ ] From a narrative beat, open History, Settings, Save and Load in turn: each opens a dialog, focus lands on its Close button, Escape closes it, and focus returns to the button you opened it from.
- [ ] Confirm the Settings dialog no longer shows a "Reviewer state: …" line.
- [ ] Open the pause menu, press Shift+Tab then Tab — focus cycles inside the dialog and never escapes to the page behind it.
- [ ] Open Load, click "Delete manual slot 1" — the confirmation is the only modal on screen; Escape dismisses it and leaves the Load dialog open.
- [ ] Resize the window to a tall/narrow shape (about 375×667) on the map screen — no horizontal scrollbar, and every location button is at least 44×44 px.
- [ ] Resize to a wide window that is NOT 16:9 (for example 1920×1200) — the story stays inside the letterboxed stage; the "Open pause menu" button and any overlay must not spill into the black bars above or below the stage.

Nothing else regressed

- [ ] Open `#/duel` and play a few actions — the duel looks and behaves exactly as before; story styling has not leaked into its buttons or background.
- [ ] Open `#/decks`, create and edit a deck — the deck editor looks and behaves exactly as before.
- [ ] Open `#/admin` — the storage list shows a "Story saves" row; arm and confirm its reset, then check DevTools Application → IndexedDB: `ygo-story-saves` is gone and `#/story` starts from a fresh title screen with no Continue. (Corrected by T13: story progress moved out of local storage into IndexedDB, so this row and this DevTools panel replaced the old `ygo.story.v1` key.)
- [ ] Confirm the browser console is empty across all of the above.

## T8 deck-editor-domain-migration

Reach the Deck Editor

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/` — the home hub appears; click its "Decks" entry and the URL becomes `#/decks`.
- [ ] Open `http://localhost:4300/#/decks` directly — the "Deck Library" heading renders (an empty library says "No local decks"). The browser tab title reads "Deck Editor · YGO Story Duel Simulator", not "Deck Builder Prototype".
- [ ] Confirm there is NO "Prototype review states" panel in the bottom-right corner and no "State fixture" dropdown anywhere in the deck editor.
- [ ] Confirm the deck editor still looks exactly as it did before this ticket — this was a move, not a restyle.

Build and save a deck

- [ ] Click "Create deck", name it `Manual T8`, confirm — the editor opens with Catalog / Build deck / Select a card panels.
- [ ] Check the address bar: the URL is now `#/decks/<some-id>`, NOT `#/decks`.
- [ ] Type `Blue-Eyes` into the catalog Name search, drag "Blue-Eyes White Dragon" onto the Main Deck drop area — Deck counts shows `Main 1` and the Autosave chip reads "Saved locally".
- [ ] Press Undo then Redo — the count goes 0 then back to 1, and the deck stays "Saved locally".
- [ ] Focus the Main Deck card, press Space, then click "Drop picked card in Side Deck" — the card moves and the counts follow.
- [ ] Edit the "Deck name" field to `Manual T8 Renamed` and click elsewhere to blur — the name sticks.

Deep link, reload and Back

- [ ] Copy the `#/decks/<id>` URL, reload the page — the same deck reopens directly, without bouncing through the library.
- [ ] Press the browser Back button — you land on the library at `#/decks` and the editor is gone.
- [ ] Press Forward — the same deck reopens.
- [ ] Open `http://localhost:4300/#/decks/no-such-deck` — a "Deck not found" page appears with a "Back to Deck Library" link; click it and the library at `#/decks` renders with your decks intact.

Import and export

- [ ] From the library, click "Import YDK", set the deck name to `Manual T8 Import`, paste `#main` / `99999999` / `#extra` / `!side` (one per line) into "Or paste YDK text", click "Preview import" then "Replace deck cards" — the editor opens on the imported deck and shows a "Missing card 99999999" tile.
- [ ] Confirm the URL moved to that imported deck's `#/decks/<id>`, then reload — the missing-card tile is still there.
- [ ] Click "Export" in the editor — the dialog warns the deck is invalid; copy to clipboard, then Close.
- [ ] Back in the library, use the per-row "Export" action on another deck — the YDK text dialog opens for that deck and Close returns focus to the row.

Library CRUD

- [ ] From the library, "Duplicate" a deck — the copy opens in the editor and the URL points at the copy, not the original.
- [ ] Return to the library, "Rename" a deck — the renamed deck opens and the URL points at it.
- [ ] Return to the library, "Delete" a deck, confirm in the dialog — the row disappears; reload and confirm it stays gone.

Admin console jump

- [ ] Open `http://localhost:4300/#/admin`, click "Seed test deck & open it" — the editor opens directly on the seeded deck (name "Admin test deck") and the URL is `#/decks/admin-test-deck`.
- [ ] Back on `#/admin`, arm and confirm the "Deck library" reset, then click the `#/decks` route button — the library shows "No local decks".

Nothing else regressed

- [ ] Open `#/duel` and play a few actions — the duel looks and behaves exactly as before.
- [ ] Open `#/story` and click through a couple of beats — unchanged.
- [ ] Confirm the browser console is empty across all of the above.

## T9 battle-facade

The duel now mounts through `src/battle/index.ts` instead of being imported
directly by the shell. Nothing about the duel itself changed, so every check
below is a "did the indirection cost anything?" check.

Reach the duel through the facade

- [ ] Run `npm run dev` (default `DEV_PORT=4300`) and open `http://localhost:4300/#/duel` — the deck picker appears exactly as before.
- [ ] Open DevTools → Elements and confirm `[data-cy="shell-region-duel"]` contains `[data-cy="battle-root"]`, which contains `[data-cy="app-main"]`.
- [ ] Confirm the duel field, right rail and card preview column sit in exactly the same places as before this ticket — the facade must not have moved a single pixel.
- [ ] Navigate from the home hub's "Duel" entry instead of the URL — same result.

Play a full duel unchanged

- [ ] Pick a non-default pair (e.g. Burning Abyss vs Shaddoll), click "Start duel" — the duel loads and the first prompt arrives.
- [ ] Play several actions, including a placement and an End turn — responses are accepted, one per prompt, with no double-submits.
- [ ] Open the right rail's options → Settings, toggle "Show duel HUD" and "Show workspace" on and off — both still work and the layout returns to normal.

End-of-duel paths still work

- [ ] Finish or force a duel to a result — the result dialog appears; click "Restart" and a fresh duel starts with the same decks.
- [ ] Start another duel, open options → Menu → Surrender and confirm — the duel ends and the result dialog appears.
- [ ] From the result dialog click "Change decks" — the deck picker returns.
- [ ] From the result dialog click "Download diagnostics" — a diagnostics file downloads and the "Diagnostics downloaded" message appears.

No leaked or duplicated Worker

- [ ] With a duel running, open DevTools → Sources → Threads (or the Performance panel's thread list) and note exactly ONE duel worker.
- [ ] Navigate away to `#/` (home), then back to `#/duel` — still exactly one duel worker, not two; the previous one is gone.
- [ ] Repeat the leave/return cycle three times — the worker count stays at one and memory does not climb with each cycle.
- [ ] Confirm the browser console is empty across all of the above.

Story-handoff placeholder

- [ ] Open `http://localhost:4300/#/duel/session/anything` — the standalone duel (deck picker) renders, and DevTools shows a visually hidden `[data-cy="battle-session-pending"]` marker inside the duel region. This is the placeholder T19 replaces with a real handoff; it is expected to look identical to `#/duel`.

## T10 domain-boundary-enforcement

This ticket adds no UI. It makes the ADR-022 domain boundaries machine-enforced,
so the only thing to confirm by hand is that the rules actually bite.

Confirm the rule fails on a real violation

- [ ] Create `src/deck-editor/__probe.ts` containing a single line:
      `import TitleScreen from "../story/screens/TitleScreen.svelte";`
- [ ] Run `npm run lint` — it exits non-zero and names the file with
      "Reach the visual novel through `src/story/index.ts` (ADR-022 domain boundary)".
- [ ] Run `npx vitest run tests/unit/domain-boundaries.test.ts` — `no deep cross-domain imports`
      fails and lists `src/deck-editor/__probe.ts -> src/story/screens/TitleScreen.svelte`.
- [ ] Delete `src/deck-editor/__probe.ts`, re-run both commands — both exit 0.
- [ ] In your editor, confirm the ESLint error also appears inline on the import line
      while the probe file exists.

Confirm a public API cannot widen silently

- [ ] Add `export const scratch = 1;` to `src/story/index.ts`.
- [ ] Run `npx vitest run tests/unit/domain-boundaries.test.ts` — `story public API is exact`
      fails, showing `scratch` as an unexpected export.
- [ ] Remove the line and re-run — 9 tests pass.

Nothing else regressed

- [ ] Open `#/duel`, `#/decks` and `#/story` in turn — all three still mount and behave
      exactly as in T7–T9; the browser console stays empty.

## T11 data-cy-contract-extension

Machine-verified: `tests/unit/data-cy-coverage.test.ts` now scans `src/battle/`, `src/shell/`,
`src/deck-editor/` and `src/story/` for presence, kebab-case and uniqueness.

Confirm the uniqueness check bites

- [ ] Change one `data-cy` in `src/story/screens/TitleScreen.svelte` to duplicate another in
      the same file (e.g. `story-title-tagline` → `story-title-heading`).
- [ ] Run `npx vitest run tests/unit/data-cy-coverage.test.ts` — `static data-cy values are
      unique across the contract roots` fails with
      `story-title-heading: src/story/screens/TitleScreen.svelte, src/story/screens/TitleScreen.svelte`.
- [ ] Revert the change and re-run — 32 tests pass.

Nothing else regressed

- [ ] Open `#/`, `#/decks`, `#/story` and `#/admin` — layout, styling and behaviour are
      unchanged; `data-cy` is a test hook only.

## T12 deck-production-database

The deck store moved from `ygo-story-duel-deck-builder-prototype` to
`ygo-story-decks`. On the first load after this ticket, any decks a player
already built are copied across, verified, and only then is the old database
deleted. That copy only ever runs against data that already exists, so it
cannot be exercised by opening a clean browser profile — every check below
needs a seeded prototype database.

Machine-verified: `tests/unit/decks/deck-database-migration.test.ts` covers the
absent / already-migrated / interrupted / diverged / empty / copy-failure /
verify-failure / delete-failure states, and
`e2e/deck-editor.spec.ts` → `a prototype deck database is migrated on first
load` runs the happy path in real Chromium. What follows is the human pass over
a real profile with real DevTools.

Seed a prototype deck database (pick ONE path)

- [ ] Path A — faithful. In a scratch worktree at the pre-ticket commit
      (`git worktree add /tmp/pre-t12 5ab14b8 && cd /tmp/pre-t12 && npm ci`),
      run `npm run dev` on the SAME port this branch uses (default
      `DEV_PORT=4300`, so same origin), open `http://localhost:4300/#/decks`,
      create a deck named `Survivor`, drag one Blue-Eyes White Dragon into the
      Main Deck, and wait for "Saved locally". Stop that dev server.
- [ ] Path B — fast. Run `npm run dev` on this branch, open
      `http://localhost:4300/#/decks`, and paste this into the DevTools console
      (it writes the OLD database with the OLD schema directly):

      ```js
      await (async () => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open("ygo-story-duel-deck-builder-prototype", 1);
          r.onupgradeneeded = () => {
            const d = r.result.createObjectStore("decks", { keyPath: "id" });
            d.createIndex("updatedAt", "updatedAt");
            d.createIndex("name", "name");
            r.result.createObjectStore("histories", { keyPath: "deckId" });
            r.result.createObjectStore("preferences", { keyPath: "key" });
          };
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const t = db.transaction(["decks", "histories", "preferences"], "readwrite");
        t.objectStore("decks").put({
          schemaVersion: 1, id: "survivor", revision: 1, name: "Survivor",
          main: [89631139], extra: [], side: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          validation: { status: "errors", issues: [], rulesetRevision: "prototype-2026-01" },
          importedNeedsReview: false,
        });
        t.objectStore("histories").put({
          deckId: "survivor", history: { undo: [], redo: [], nextSequence: 1 },
        });
        t.objectStore("preferences").put({ key: "last-opened-deck", value: "survivor" });
        await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
        db.close();
      })();
      ```

- [ ] Before reloading, open DevTools → Application → IndexedDB and confirm you
      can see `ygo-story-duel-deck-builder-prototype`. If `ygo-story-decks` is
      also listed with decks in it, right-click → Delete database first: a
      populated target is the "already migrated" case, not the one under test.

Confirm the decks survived the rename

- [ ] Run `npm run dev` on THIS branch and open `http://localhost:4300/#/decks`
      (a reload is enough if the server was already running).
- [ ] The Deck Library lists `Survivor`. It must NOT say "No local decks" —
      that would mean the decks were stranded in the old database.
- [ ] Click `Survivor` — the editor opens, "Deck name" reads `Survivor` and
      Deck counts shows `Main 1`. Opening the deck reads its history record, so
      this also proves the migration copied more than the deck row.
- [ ] Press Undo — it is disabled or a no-op (the seeded history is empty) and
      nothing errors.
- [ ] DevTools → Application → IndexedDB: `ygo-story-decks` is present and
      `ygo-story-duel-deck-builder-prototype` is GONE. Use the refresh button on
      the IndexedDB node if the tree looks stale.
- [ ] In the console, `(await indexedDB.databases()).map((d) => d.name)` lists
      `ygo-story-decks` and does not list the prototype name.

Confirm it does not run twice

- [ ] Reload the page — `Survivor` is still listed exactly once. A second
      `Survivor` row would mean the migration re-ran and duplicated.
- [ ] Create a second deck named `After Migration`, reload — both decks are
      listed once each, and the prototype database has not reappeared.

Confirm a failed migration blocks instead of losing decks (optional, ~2 min)

- [ ] Re-seed the prototype database with Path B above, and this time also
      delete `ygo-story-decks` in DevTools.
- [ ] In a SECOND tab on the same origin, paste this and leave the tab open —
      it holds the old database open, which is what blocks its deletion:

      ```js
      window.hold = await new Promise((res, rej) => {
        const r = indexedDB.open("ygo-story-duel-deck-builder-prototype", 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      ```

- [ ] Back in the first tab, load `#/decks`. Instead of the library you get a
      blocking panel headed "Your decks were not moved", explaining the
      prototype database could not be deleted, reassuring you nothing was
      deleted, and offering a "Retry" button.
- [ ] DevTools: BOTH databases exist, and `ygo-story-decks` already contains
      `Survivor`. Nothing was lost.
- [ ] Close the second tab, click "Retry" in the first — the library renders
      with `Survivor`, and the prototype database is now gone.

Admin console follows the rename

- [ ] Open `http://localhost:4300/#/admin`, click "Seed test deck & open it" —
      the editor opens on "Admin test deck". DevTools shows that deck inside
      `ygo-story-decks`, and no prototype database was created.
- [ ] Back on `#/admin`, arm and confirm the "Deck library" reset, then open
      `#/decks` — the library says "No local decks", and DevTools shows
      `ygo-story-decks` is gone. Before this ticket this button cleared the
      prototype database, so a reset that leaves your decks in place is the
      failure to watch for.

Nothing else regressed

- [ ] Deck create / rename / duplicate / delete / import YDK / export YDK all
      behave exactly as in T8.
- [ ] Open `#/duel` and `#/story` — unchanged; neither reads the deck database.
- [ ] The browser console stays empty across all of the above.

## T13 story-saves-repository

Story progress moved out of the single `ygo.story.v1` local-storage record into
an IndexedDB database, `ygo-story-saves`, holding one versioned record per
slot. Prototype progress under the old key is deliberately **not** migrated: a
player who used the story before this ticket starts from a fresh title screen,
and a leftover `ygo.story.v1` entry is expected and harmless.

The save/load overlays are unchanged, so they still drive the single manual
slot — which is now stored as `manual:1`. The store also carries `manual:2`,
`manual:3` and `checkpoint:pre-duel`; nothing writes those three yet (the duel
handoff is T19), so an empty `manual:2` in DevTools is correct.

Machine-verified: `tests/unit/story/story-save-repository.test.ts` covers the
round trip, revision increments, stale-write refusal, unknown schema version,
corrupt records, a quota failure, a write that aborts mid-transaction, and an
unusable IndexedDB. `e2e/story.spec.ts` covers save → reload → load and
corrupt-slot recovery in Chromium. The checks below are the ones a machine
cannot make: that the DevTools panel shows what you expect and that the app
still feels right.

Run `npm run dev` and use `http://localhost:5173` (or the port Vite prints).

Where to look in DevTools

- [ ] Open DevTools → Application → Storage → IndexedDB. Before touching the
      story there is no `ygo-story-saves` database (delete it first if a
      previous run left one).
- [ ] Open `#/story` and let the title screen render. Refresh the IndexedDB
      panel — `ygo-story-saves` now exists with one object store, `saves`,
      and no records. Opening the story must never create a save on its own.

A save survives a reload

- [ ] Click "New Game", advance a few beats with Enter, and note the line of
      dialogue currently on screen.
- [ ] Click "Save", then "Confirm overwrite" — the overlay reports "Save
      complete. Manual slot 1 updated."
- [ ] In DevTools → IndexedDB → `ygo-story-saves` → `saves`, refresh: there is
      exactly one record, keyed `manual:1`. Expand it — it has
      `schemaVersion: 1`, `slot: "manual:1"`, `revision: 1`, a `savedAt`
      timestamp, and a `state` object whose `narrativeIndex` matches how far
      you advanced.
- [ ] Reload the page (F5). The title screen now offers "Continue".
- [ ] Click "Load", then "Load manual slot 1" — you land on the same beat you
      noted above, not back at the start.
- [ ] Save again from the same spot and re-check the record: still exactly one
      `manual:1` record, now `revision: 2`. A second record, or a record list
      that keeps growing, is the failure to watch for.

The autosave slot is separate

- [ ] Play through to a duel (map → Old Arena → Start Duel → Simulate Player
      Win → Continue story). The reward screen reports "Autosave complete at
      stable story boundary."
- [ ] In DevTools there are now two records: `manual:1` and `autosave`. Neither
      `manual:2`, `manual:3` nor `checkpoint:pre-duel` exists.
- [ ] Reload and click "Continue" — you resume from the autosave (the updated
      map), because it was written more recently than the manual save.

A corrupt save costs you the slot, not the app

- [ ] With the story open, paste this into the DevTools console:
      `indexedDB.open("ygo-story-saves",1).onsuccess=e=>{const d=e.target.result;d.transaction("saves","readwrite").objectStore("saves").put("garbage","manual:1");}`
- [ ] Reload the page. A red banner appears naming `manual:1` and the reason;
      the title screen still renders and "New Game" still plays. A blank screen
      or a thrown error in the console is the failure to watch for.
- [ ] Click "Reset prototype storage" in that banner — the banner clears and
      DevTools shows the `saves` store is empty again.

Admin console clears it

- [ ] Open `#/admin`. The storage list has a "Story saves" row (there is no
      longer a "Story progress" row).
- [ ] Save some story progress first, then arm and confirm the "Story saves"
      reset. The console reports it cleared.
- [ ] In DevTools → Application → IndexedDB, `ygo-story-saves` is gone — not
      merely empty. Open `#/story`: the title screen has no "Continue".
- [ ] Do the same reset **while `#/story` is open in a second tab**, then
      switch to that tab and reload — it comes up on a fresh title screen
      rather than hanging. A tab that holds the database open must not block
      the reset indefinitely.

Nothing else regressed

- [ ] Play the prologue end to end once: title → narrative → choice → map →
      Old Arena → duel mock → outcome → reward → updated map → End prototype.
- [ ] Open the pause menu, History, Settings, Save and Load overlays — each
      opens, traps focus, closes on Escape, and returns focus to the button
      that opened it.
- [ ] Open Load and delete manual slot 1 — the confirmation closes, the slot
      reads "Manual slot 1 · Empty", and the `manual:1` record is gone from
      DevTools while `autosave` is untouched.
- [ ] Open `#/duel` and play a few actions, and `#/decks` and edit a deck —
      both behave exactly as before; neither reads or writes `ygo-story-saves`.
- [ ] The browser console stays empty across all of the above.

## T14 deck-editor-portrait-layout

Below 1024px CSS width the deck editor is no longer a dead end: it drops the
three-column desktop grid for a single tabbed pane (Catalog / Deck / Details)
with a persistent header, and adds a touch model — tap a catalog card to add
it, tap a deck card to open a move/remove menu. At and above 1024px absolutely
nothing changes; that is the main thing to confirm.

Use a real browser window resize or DevTools device toolbar. The breakpoint is
CSS width, so a landscape phone under 1024px also gets tabs.

Tabs and the persistent header (390x844)

- [ ] Open `#/decks`, create a deck named "Portrait Manual", and shrink the
      window to 390x844. The editor opens on the **Deck** tab; the "Desktop
      viewport required" screen is gone for good.
- [ ] The header above the tabs shows deck name, Main/Extra/Side counts, the
      deck status and the autosave status. Switch to Catalog and then Details —
      the header stays put and keeps showing the same counts on every tab.
- [ ] Exactly one pane is on screen at a time: on Catalog the deck grid is
      absent, not merely scrolled away.
- [ ] Tab the keyboard focus into the tab strip and press Left/Right arrows —
      the selection follows focus through Catalog, Deck, Details and wraps.

Tap to add (390x844)

- [ ] On the Catalog tab, filter by "Blue-Eyes" and tap the card. The Main
      count goes to 1, the autosave reads "Saved locally", and you are still on
      the Catalog tab so the next card is one tap away.
- [ ] Tap the same card twice more (Main 3), then tap it a fourth time. Nothing
      is added; the app announces "Copy limit 3 reached" and shows you the card
      on the Details tab.
- [ ] Filter for "Gate Guardians Combined" (a Fusion monster) and tap it — it
      lands in the **Extra** Deck, not the Main Deck.

Tap to move and remove (390x844)

- [ ] On the Deck tab, tap a card sitting in the Main Deck. A menu opens naming
      the card. It offers Side Deck (enabled), Extra Deck (disabled, with a
      reason) and Remove; it does **not** offer Main Deck.
- [ ] Choose Side Deck — Main drops by one, Side rises by one.
- [ ] Tap the card in the Side Deck: this time Main Deck is enabled (its home
      zone) and Extra is not. Press Escape instead of choosing — the menu closes
      and nothing moved.
- [ ] Tap it again and choose Remove — the count drops. Press Undo in the
      header: it comes back. Press Redo: it goes again. Autosave keeps saying
      "Saved locally" throughout.

Layout at the sizes that matter

- [ ] At 360x640, 390x844 and 768x1024 in turn: no horizontal scrollbar and no
      content clipped at the right edge, on all three tabs. The header wraps
      onto more rows rather than pushing the page sideways.
- [ ] Rotate to landscape under 1024px wide (e.g. 844x390) — still tabs, still
      no sideways scroll.
- [ ] Tap targets are comfortable: tabs, menu items and card tiles are all
      easily hit with a thumb (44px floor).
- [ ] Import and Export still open from the header at 390x844 and still work.

Desktop is untouched (1440x900)

- [ ] Widen to 1440x900. All three panels are back side by side, with no tab
      strip anywhere.
- [ ] Click a catalog card — it only **selects** (details fill the right panel).
      No card is added and no tap menu appears. Adding is still drag or the
      keyboard pick-and-drop path.
- [ ] Drag a card from the catalog into the Main Deck drop area — works as
      before. Focus a card, press Space, then click "Drop picked card in Side
      Deck" — works as before.
- [ ] Undo/redo, import, export, rename and the Deck Library round trip all
      behave exactly as they did before this ticket.
- [ ] Resize from 1440 wide down past 1024 and back up without reloading — the
      editor swaps between panels and tabs each way, keeping the open deck and
      its edits.

## T15 duel-portrait-rotation

Below 1024px CSS width, a **portrait** viewport now plays the duel on a stage
turned a quarter turn clockwise. Landscape below the breakpoint, and every
desktop size, are deliberately unchanged.

Setup

- [ ] Use a real phone if you have one (or Chrome DevTools device toolbar,
      iPhone 12 Pro / 390x844). Hold it **upright**.
- [ ] Clear site data first, so the one-time rotation notice is still pending.
- [ ] Open `#/duel`.

Portrait: the turn itself (390x844)

- [ ] The deck picker is reachable: scroll the duel area if needed and press
      Start. Nothing is clipped out of reach.
- [ ] Once the duel loads, the board runs **down** the long axis of the phone —
      the player's side is on one long edge, the opponent's on the other. To
      read it you tilt your head (or the phone), not squint at a shrunken board.
- [ ] The board is centred: neither end of the field is cropped by the screen
      edge, and there are equal bars above and below it.
- [ ] The page itself never scrolls in any direction — no page scrollbar, and
      dragging a finger on the background does not move the page.

Portrait: taps land where you look (this is the row that matters)

- [ ] Tap a monster zone. The zone **you touched** reacts — not the one that
      would be there if the board were unturned (that would be a zone roughly a
      quarter turn away).
- [ ] Tap several cards in your hand, one at a time. Each time, the card under
      your finger is the one that previews/selects. Work along the whole hand,
      including the cards nearest each screen edge.
- [ ] Tap a graveyard/deck pile. The pile under your finger opens.
- [ ] Tap an action chip on a card. The chip under your finger fires, and not a
      neighbouring one.

Portrait: dragging, hands, dialogs and overlays

- [ ] Drag a card from your hand onto a highlighted zone. Two things must both
      be true: the ghost card **stays under your finger** the whole way (it must
      not shoot off at right angles to your movement), and the card is played
      into the zone you dropped it on.
- [ ] Drag a card and release it over nothing. The ghost settles back onto the
      card it came from, not onto some other part of the board.
- [ ] Swipe the hand band sideways (along the hand's own direction, as drawn).
      It scrolls, and the overlay scrollbar thumb tracks your finger rather than
      running the opposite way.
- [ ] Drag the overlay scrollbar thumb itself. The band scrolls the way you
      drag it.
- [ ] Open the zone-list / decision window and drag it by its handle. It follows
      your finger; it does not travel at right angles to the drag, and it stays
      clamped inside the board.
- [ ] Open a dialog/backdrop (e.g. a duel result or prompt dialog). It covers
      the board and reads the same way up as the board, not the phone.
- [ ] Trigger a target/attack line (attack or target something). The line is
      drawn between the two cards involved, not across the board at a right
      angle.

Portrait: the rotation notice

- [ ] The one-time notice explaining the turn is visible when you first arrive.
- [ ] It does not block play: tap the board *through* the notice's background —
      the card/zone underneath still responds. Only its "Got it" button
      intercepts a tap.
- [ ] Press "Got it". The notice disappears.
- [ ] Reload the page in portrait. The notice does not come back.

Keyboard (portrait, with a bluetooth keyboard or in DevTools)

- [ ] Tab through the duel controls. The order is the same as on desktop — the
      turn changed nothing about the sequence.
- [ ] Arrow-key navigation across the field still moves between controls, and
      the focus ring is visible on the control that has focus.

Reduced motion

- [ ] Enable "reduce motion" in the OS/browser. Reload in portrait. Nothing
      animates the turn, and the rotation notice appears without a fade.

Unchanged: small landscape (844x390)

- [ ] Turn the phone sideways (or set 844x390). The board is **not** turned — it
      is the ordinary 16:9 stage, scaled down, exactly as before this ticket.
- [ ] No rotation notice appears in landscape.
- [ ] (Known, pre-existing and out of scope: at this size the deck picker screen
      is taller than the stage, so Start can sit below the visible area. This is
      unchanged by this ticket — only portrait gained a scrollable duel region.)

Unchanged: desktop (1440x900 and 1920x1080)

- [ ] The duel looks and behaves exactly as before: same field size, same
      spacing, same preview panel and right rail.
- [ ] Drag a card onto a zone — ghost, drop and settle behave exactly as before.
- [ ] Drag the decision window by its handle — it follows the pointer exactly
      as before.
- [ ] Target/attack lines are drawn exactly as before.

## T16 unified-visual-restyle

### `#/` Home screen — desktop (1920×1080)
- [ ] Home screen background and typography match the duel dark-blue-teal palette; no white or light-mode remnants.
- [ ] Buttons use the consistent token-driven style (teal primary, transparent secondary).
- [ ] Focus ring is amber (`--focus-ring: #f6c177`) when tabbing through navigation links.

### `#/` Home screen — portrait (390×844)
- [ ] Layout remains readable; colours and typography unchanged from desktop palette.

### `#/story` Visual novel — desktop
- [ ] Background gradients derive from the duel palette (dark navy blues and teals); no bright alien colours.
- [ ] Dialogue box uses `var(--bg)` with ~91% opacity — dark background, legible white text.
- [ ] Speaker name tag has dark `var(--surface-chain)` background and `var(--accent)` teal text.
- [ ] Thought-bubble left border is purple (`var(--stack-accent): #9f8deb`).
- [ ] Story buttons match global style: teal fill, dark text, amber focus ring.
- [ ] Pause/overlay backdrop is near-black with slight transparency.
- [ ] Overlay panel uses `var(--surface-raised)` — same dark-navy as duel side panels.

### `#/story` Visual novel — portrait (390×844)
- [ ] Dialogue box fills width correctly; text remains legible on dark background.
- [ ] Choice buttons stack and are fully tappable (≥44px targets).

### `#/decks` Deck editor — desktop
- [ ] Card tiles: normal state uses dark navy (`var(--surface-raised)`), hover/selected uses slightly lighter `var(--surface-highlight)` with teal border.
- [ ] Card limit badges: 0-limit is burgundy (`var(--danger-border)`), 1-limit is pink (`var(--danger)`), 2-limit is gold (`var(--selected)`), 3-limit is teal (`var(--accent)`).
- [ ] Filter/search inputs have dark navy background (`var(--surface-chain)`) with legible white text.
- [ ] Validation warning panel uses `var(--warning-surface)` background with `var(--warning-border)` border (amber tones).
- [ ] Error states (missing card, import error) use `var(--danger-surface)` background.
- [ ] Dialog panels use `var(--surface)` background with dark shadow.

### `#/decks` Deck editor — portrait (390×844)
- [ ] Tab mode (card catalog / workspace / zones) switches work; pane heights correct.
- [ ] No colour regressions in portrait tab layout.

### `#/duel` Duel field — desktop
- [ ] Field geometry (card sizes, zone sizes, spacing, gaps) unchanged from pre-T16 baseline.
- [ ] Legal zones are green (`var(--legal): #7ee2a8` border + glow).
- [ ] Selected zones/cards are amber-gold (`var(--selected): #ffd580` border + glow).
- [ ] Keyboard nav focus ring is white (`var(--ink)`), distinct from legal/selected.
- [ ] Feedback halos are teal (`var(--accent)`).
- [ ] Attack lines are red (`var(--danger)`), default lines are teal (`var(--accent)`).
- [ ] Card limit badge colours on field cards look right (green/pink/gold/teal).

### `#/duel` Duel field — portrait (390×844)
- [ ] Field rotates 90° clockwise (T15 behaviour preserved).
- [ ] Field geometry in rotated mode unchanged; zone targets remain tappable.
- [ ] Semantic colours (legal/selected) unchanged in rotated mode.

### `#/admin` Admin console — desktop
- [ ] Panel renders with dark-blue token-driven background; no visual regressions.
- [ ] Inputs and buttons consistent with the rest of the product.

### Cross-domain coherence check
- [ ] Navigating `#/ → #/story → #/decks → #/duel → #/admin` feels like one product — consistent dark palette, button style, focus ring, typography throughout.
- [ ] No jarring colour shifts between domain transitions.

## T17 worker-card-list-start-contract

The Worker now starts a duel from an explicit validated card list as well as
from a bundled preset. No UI produces a card list yet (the deck picker is a
later slice), so the checks below are: the preset path must be indistinguishable
from before, and a forged illegal list must fail visibly instead of starting a
broken duel.

### `#/duel` Preset duel unchanged
- [ ] Pick any deck pair in the picker and press Start — the duel initializes and the first prompt appears exactly as before.
- [ ] Play a few prompts, then Restart — the duel restarts and reaches a first prompt again.
- [ ] Surrender — the duel ends with the usual surrender result, no error banner.
- [ ] Reload the page with a pair already chosen — the duel auto-starts as before.

### Invalid card list fails visibly
No UI can build a card list yet, and the app exposes no console handle on the
duel Worker, so this check needs one temporary edit. In
`src/battle/app/stores/duel-store.ts`, inside `startCurrentDuel`, replace the player
argument passed to `client.startDuel` with a forged list whose last code is not
in the packaged snapshot, run `npm run dev`, open `#/duel`, and press Start:

```ts
// TEMPORARY — revert after this check
{
  kind: "cards",
  main: [...Array.from({ length: 39 }, (_, i) => 46986414 + (i % 3)), 909090],
  extra: [],
  side: [],
}
```
- [ ] The duel does **not** start: no field appears and no prompt arrives.
- [ ] A visible error is shown (not a silent no-op, not a blank screen, not a stuck loading state).
- [ ] The error text names the offending code `909090` and says the card is outside the active snapshot.
- [ ] After the refusal, revert the edit, reload, choose a normal preset pair and press Start — it still works, and the Worker was not left wedged.

### Hidden information
- [ ] With a duel running, nothing in the DevTools console, network tab, or Worker message log shows the opponent's deck list — only counts (deck size, extra-deck size) and cards the opponent has actually revealed on the field.

## T18 deck-picker-local-decks

The pre-duel picker now offers bundled decks **plus every local deck this build
can actually play**, and starting a local deck dispatches its card list to the
Worker instead of a preset id.

Corrected 2026-08-16 by T22: this section originally said no local deck could
ever qualify on this build, because the deck editor built from a 24-card
hand-written catalog while the packaged art covered the six bundled decks
(120 codes) — only 8 cards in both, capped below the 40-card Main minimum. The
editor now derives its catalog from the packaged set itself, so a deck you can
build is a deck this build can draw. **Every step below that expected a local
deck to be hidden has been rewritten accordingly**; see `## T22
local-deck-playability` for the full flow.

### `#/duel` Bundled flow unchanged
- [ ] Open `#/duel`. The picker appears with a **Bundled decks** group holding all six decks in both columns, and no empty "Your decks" heading anywhere.
- [ ] The picker is never briefly empty and Start is never briefly disabled while the page settles.
- [ ] Pick a pair, press Start — the duel initializes and reaches the first prompt exactly as before.
- [ ] Reload with a pair already chosen — the same pair is still selected.
- [ ] Surrender, then Change decks — the picker returns with the same pair selected and does not auto-start.

### Build a deck and duel with it
- [ ] Go to `#/decks`, create or import a deck, and fill the Main Deck to 40 legal cards so the editor reports no errors.
- [ ] Go to `#/duel`. The deck appears under **Your decks**, can be picked for either or both seats, and Start runs a duel whose opening hand is drawn from those cards.

### A deck the ruleset refuses is never offered
- [ ] In `#/decks`, build a deck with only 39 Main cards (or 4 copies of one card).
- [ ] Go to `#/duel` — the deck is absent from the picker. It is not shown greyed out, and there is no message about it.
- [ ] Return to `#/decks` — the deck is exactly as you left it. Nothing was renamed, repaired, re-saved, or deleted to make it playable.

### No local decks at all
- [ ] Open `#/admin`, click **Reset Deck library** and confirm, so no local deck exists.
- [ ] Go to `#/duel` — only the Bundled decks group renders. There is no "Your decks" heading, no empty list, and Start still works.

### A chosen deck that disappears
- [ ] With a local deck selected in the picker (or seed the same effect by editing `ygo.ui.v2` in localStorage and setting `decks.playerKey` to `local:no-such-deck:1`), reload `#/duel`.
- [ ] The picker falls back to the default bundled pair, and a single notice explains that a deck you had chosen is no longer available.
- [ ] The notice appears **once** — clicking any deck clears it, and it does not come back on the next click.
- [ ] Start then runs the bundled pair normally.

### Persistence shape
- [ ] After choosing a pair, `localStorage["ygo.ui.v2"]` holds `decks: { playerKey: "preset:…", opponentKey: "preset:…" }` — keys, not bare deck ids, and never a copy of any card list.
- [ ] A payload written by an older build (`decks: { player: "nekroz", opponent: "shaddoll" }`) still loads with that pair selected.
- [ ] Display settings survive: toggle zone outlines off in `#/duel`, reload, and confirm they are still off (the payload version stays `2` precisely so the shell's settings migration keeps working).

## T19 story-duel-handoff

The visual novel stops mocking battles. Starting an encounter writes a
verified pre-duel checkpoint, hands the duel to the shell on a route of its
own (`#/duel/session/{handoffId}`), and takes exactly one result back.

### Start an encounter and play it
- [ ] Open `#/story`, play (or load) through to the **City signal map**, and click **Old Arena**.
- [ ] The briefing reads "Your progress is saved before the duel starts." There are no reviewer or "Simulate …" buttons anywhere in the story.
- [ ] Click **Start Duel**. The address bar changes to `#/duel/session/<id>` and the story screen is replaced by the duel.
- [ ] The **deck picker** appears, with the pair you last used already selected (bundled `mvp-player` / `mvp-opponent` on a fresh profile).
- [ ] Press **Start** — the duel loads and reaches the first prompt exactly as `#/duel` does.

### Each outcome branch
- [ ] **Surrender** (right rail → Options → Surrender → confirm). The story comes back on "Duel paused", the address bar returns to `#/story`, and no reward is granted. **Return to map** puts you back on the map with your progress intact.
- [ ] **Win** the duel. The story shows "Signal broken", then **Continue story** reveals the Signal Cipher reward, and **Continue to updated map** opens the Archive route.
- [ ] **Lose** the duel. The story shows "Signal endures" — a different scene from the win — and still continues to the reward.
- [ ] **Technical failure:** with a duel running, open DevTools → Application → Service/Workers (or the Sources ▸ Threads panel) and terminate the duel Worker. The story shows "Connection interrupted" and says this is not an authored loss. It must **never** show "Signal endures". **Retry duel** starts a fresh duel from the picker.

### Reload mid-duel (the crash-safety check)
- [ ] Start a story encounter and press Start so a duel is actually running.
- [ ] Reload the page (F5) while the duel is on screen.
- [ ] The address bar still holds the same `#/duel/session/<id>`, and the same encounter restarts — the deck picker comes back, not a blank screen and not the title screen.
- [ ] Finish or surrender that duel: the story resumes with the progress you had before the duel, not from the beginning.

### A checkpoint that cannot be trusted
- [ ] Paste `#/duel/session/does-not-exist` into the address bar. You land on `#/story` with the story's last stable state — never a blank screen and never half a duel.
- [ ] In DevTools → Application → IndexedDB → `ygo-story-saves` → `saves`, replace the `checkpoint:pre-duel` value with the string `not a checkpoint`, then open a session route. You land on `#/story`; the other slots (`manual:1`, `autosave`) are untouched and still load.
- [ ] Edit `checkpoint:pre-duel`'s `state.pendingHandoffId` to a different id and open the original session route. You land on `#/story` rather than resuming someone else's duel.

### Checkpoint write failure
- [ ] In DevTools → Application → Storage, set a tiny quota (or use a private window with storage blocked), then start an encounter.
- [ ] **No duel starts.** The story shows "The duel did not start" with the reason and a **Try again** button. **Try again** re-runs the whole handoff; **Return to map** goes back safely.

### The other two domains are untouched
- [ ] `#/duel` still opens the standalone duel, and finishing or surrendering there does **not** navigate anywhere.
- [ ] `#/decks` is unchanged.
- [ ] Opening `#/duel` on a fresh profile does not download the story chunk (DevTools → Network, filter `story`).

## T20 duel-source-relocation

Pure file move: the duel's source now lives under `src/battle/` (`app/`, `duel/`,
`field/`, `worker/`, `storage/`). No behavior changed, so this is a short
"nothing fell off the shelf" pass. Run `npm run dev` first.

- [ ] `#/duel` loads, the deck picker appears, **Start** reaches the first prompt,
      and a card can be played. That proves the Worker entry still resolves after
      the move — it is the one thing a wrong path would break silently.
- [ ] Rotate to portrait (DevTools device toolbar, 375×667). The duel still shows
      the rotated stage and the rotation notice, and taps land on the card you
      aimed at rather than an offset one.
- [ ] `#/story` → start an encounter → **Start Duel**. The duel opens and the
      story resumes after you surrender.
- [ ] `#/decks` opens and a deck can be edited and saved.
- [ ] Acceptance harness: `npx playwright test --config=playwright.acceptance.config.ts`
      is green, or open `acceptance.html?scenario=field-emz` from a preview build
      and confirm the deterministic field renders.
- [ ] DevTools → Network on a fresh load of `#/`: the duel chunk is **not**
      downloaded until you open `#/duel`.

## T21 restore-build-budgets

Build-gate change only; nothing in the app moved. The whole check is one command.

- [ ] `npm run build` finishes green and its last block prints the four
      measurements, e.g. `"chunkBytes": { "shell": 78142, "battle": 405950,
      "deck-editor": 101881, "story": 60195 }`. `npm run build:verify` alone
      re-checks an existing `dist/` without rebuilding.
- [ ] A breach fails the build with the offending budget named and both numbers
      shown, e.g.
      `Error: battle domain closure exceeds its production budget: 501234 > 488750 bytes`.
      A domain chunk missing from the build fails the same way rather than
      counting as zero: `Browser build did not emit the story domain chunk`.
- [ ] The ceilings live in `scripts/lib/domain-chunk-closure.ts` (per domain)
      and `scripts/verify-browser-build.ts` (shell). Raising one means
      re-measuring from a clean build, not nudging the number until it passes.

## T22 local-deck-playability

A deck you build in `#/decks` can now be played at `#/duel`. Nothing about the
picker's filter changed — it still shows a local deck only when `resolveDeck`
calls it `ready` and every code in it is one this build can draw. What changed
is the editor's catalog: it used to be a 27-card hand-written fixture that
barely overlapped the packaged art, and it is now derived at build time from
the packaged card set itself. The editor offers **120 cards — 85 Main-deck and
35 Extra-deck** — and every one of them has packaged art and text, so a legal
deck is by construction a drawable one.

Sanity numbers to expect while testing: 85 Main-deck cards at up to three
copies each is 252 possible Main cards against a 40-card minimum, and the
catalog's search/filter panel now lists real Attributes, Races and subtypes
rather than the fixture's handful.

### Build a deck from scratch and duel with it
- [ ] Open `#/decks`. Press **Create deck**, name it (e.g. `Manual T22`), confirm with **Create**.
- [ ] The catalog panel lists real cards — search `Nekroz`, `Shaddoll`, `Spellbook` or `Burning Abyss` and each returns several distinct cards with names and effect text.
- [ ] Add cards until **Deck counts** reads `Main 40`. Fastest route: search a name, focus the tile, press `Space` to pick it up, then **Drop picked card in Main Deck**; repeat, or add three copies of ~14 different cards.
- [ ] The validation panel shows no **errors**. Warnings such as "Extra Deck is empty", "Side Deck is empty" and "uses placeholder art" are expected and do not block anything.
- [ ] Wait for **Saved locally**.
- [ ] Go to `#/duel`. A **Your decks** group renders below **Bundled decks**, holding `Manual T22` in both the player and opponent columns.
- [ ] Click `Manual T22` in **Your deck**. It becomes selected (`aria-pressed="true"`), and no start error appears.
- [ ] Press **Start**. The duel initializes and reaches the first prompt — the field renders, both life-point totals are up, and your hand is drawn from the cards you picked, not from a bundled deck.
- [ ] Hover a card in your hand: the preview panel shows that card's real name and effect text.
- [ ] Surrender, then **Change decks** — `Manual T22` is still selected and the picker does not auto-start.

### Import a YDK and duel with it
- [ ] From `#/decks`, press **Import deck** in the library, give it a name, and paste a `#main` list of 40 codes taken from the editor's own catalog.
- [ ] **Preview import** reports no unknown codes.
- [ ] **Commit** — the deck opens in the editor and saves.
- [ ] `#/duel` offers it under **Your decks**, and Start duels with it.

### The filter still refuses what it should
- [ ] In `#/decks`, build a deck with only 39 Main cards (or four copies of one card).
- [ ] `#/duel` does not list it. It is absent, not greyed out, and there is no message about it.
- [ ] Return to `#/decks` — the deck is exactly as you left it. Nothing was renamed, repaired, re-saved or deleted to make it playable.
- [ ] Import a YDK holding a code the editor does not know (e.g. `99999999`). Preview flags it as unknown, and a deck saved with it is never offered at `#/duel`.

### Bundled decks are unaffected
- [ ] With no local deck at all (use `#/admin` → **Reset Deck library**), `#/duel` renders only the **Bundled decks** group — no empty "Your decks" heading — and Start works.
- [ ] Pick a bundled pair and duel: unchanged from before this slice.

### Build gate
- [ ] `npm run build` finishes green. Its last block prints roughly
      `"chunkBytes": { "shell": 78321, "battle": 365853, "deck-editor": 150849, "story": 60195 }`.
- [ ] The deck-editor domain grew because it now ships the packaged card set
      (~58 kB of masks plus names and effect text, in a chunk it shares with the
      duel); its budget was raised deliberately from 143,750 to 201,250 bytes in
      `scripts/lib/domain-chunk-closure.ts`. The battle domain *shrank* from
      405,950 to 365,853 because the same change ended a three-way duplication
      of the card-text manifest inside its closure; its ceiling was not touched.

## T1 field-spell-zone-address

Automated proof already exists (`tests/unit/duel-field.test.ts`,
`tests/integration/field-spell-activation.test.ts` — the latter drives a real
`ygopro-core` WASM duel and asserts the board still maps after the activation).
These steps confirm the same fix in a browser, which no automated suite covers.

### Field survives a field-spell activation
- [ ] `npm run dev`, open the printed URL, go to `#/duel`.
- [ ] Pick **Spellbook** as your deck, any opponent deck, and Start.
- [ ] Play to your Main Phase 1 and activate **The Grand Spellbook Tower** from your hand.
- [ ] The duel field stays mounted. The panel headed **Duel field unavailable**
      (`data-cy="app-field-error-panel"`) never appears.
- [ ] The Tower renders inside your **Field Zone** — the single slot left of your
      monster row — not in a Spell/Trap slot and not missing.
- [ ] Prompts keep rendering on the field itself; you are not pushed into the
      dialog-only fallback where every action goes through a decision box.

### The duel continues normally afterwards
- [ ] Answer the Tower's follow-up prompts and pass to the End Phase. The field
      is still mounted and still shows the Tower in the Field Zone.
- [ ] Take one more turn: summon a monster and set a Spell/Trap. Both land in
      their own slots; the Field Zone still holds only the Tower.

## T2 unsupported-message-abort

Automated coverage exists and is the hard gate
(`tests/integration/xyz-overlay-progression.test.ts` drives three real
`ygopro-core` WASM duels through an Xyz Summon and asserts no
`unsupported_message`; `tests/integration/spellbook-duel-progression.test.ts`
plays a scripted Spellbook duel to its result). These steps confirm the same
fix in a browser, which no automated suite covers.

### A duel with an Xyz Summon is not stopped by a technical failure
- [ ] `npm run dev`, open the printed URL, go to `#/duel`.
- [ ] Pick **Burning Abyss** as your deck, any opponent deck, and Start.
- [ ] Play until you can Xyz Summon (two Level 3 Burning Abyss monsters, for
      example **Dante, Traveler of the Burning Abyss**). Complete the summon,
      including the zone-selection prompt.
- [ ] The duel keeps running. The panel reporting a technical failure
      (`data-cy="app-error-panel"`) never appears and the duel does not end.
- [ ] Open the browser console: no `duel.worker.command.failed` entry with
      `code: 'unsupported_message'`, and no `duel.worker.detached` entry.

### The Xyz monster shows the materials it carries
- [ ] The summoned Xyz monster renders in a Monster Zone with its overlay
      materials attached, not as a bare monster and not with its materials
      still sitting in the zones they were summoned from.
- [ ] The zones the materials came from are now empty.
- [ ] Activate an effect that detaches a material (Dante's effect, for
      example). The material count drops by one, the detached card appears in
      the Graveyard, and the duel continues.

### A story duel survives the same flow
- [ ] Go to `#/story`, start the duel the story hands off, and play several
      turns past the first Xyz Summon.
- [ ] The duel is never stopped by a technical failure and the connection to
      the duel worker is never reported as interrupted.


## T3 deck-search-private-identity

- [ ] Start a dev duel and activate a card that searches the deck (e.g. Spellbook Magician of Prophecy effect, or any search-style effect). Confirm the target list dialog shows real card art and names for your own deck cards, not "Face-down card".
- [ ] After confirming the search choice, open the deck browse list and confirm those cards now show as face-down again (the prompt-attested identity is gone once the prompt resolves and the deck shuffles).

## T4 extra-deck-facedown-top

- [ ] Start a dev duel and observe both deck stacks (own and opponent). Each non-empty deck stack shows the card-back image, not a face-up card art.
- [ ] Observe both extra deck stacks. Each non-empty extra deck stack shows the card-back image (same back art as the deck), not a face-up card art.
- [ ] Open the GY (graveyard) browse list — the top card in the GY stack shows face-up art (regression: public piles unchanged).
- [ ] Open the extra deck browse list — the list still shows own card names/art face-up (browse of private piles is intentionally allowed; only the stack tile face is hidden).

## T5 center-hand-cards

- [ ] Open the duel at `http://localhost:4173` (or dev server) with a 5-card starting hand — the hand cluster is horizontally centered under the duel field middle (visually sits in the center of the hand band, not packed to the left).
- [ ] Draw cards until the hand overflows (≥ 10–12 cards at 1920×1080) — the scrollbar appears and scrolling left/right reaches both the first and last card.
- [ ] Opponent hand (top band) with 5 cards also appears centered.

## T6 zoom-gating-known-facedown

- [ ] Run `npm run dev` and open the duel at `http://localhost:4173` (or configured dev port).
- [ ] Hover over an opponent's set (face-down) card on the spell/trap row — the card must NOT zoom (no scale-up) and must show NO name label at the bottom.
- [ ] Hover over an opponent's face-down monster — same: no zoom, no label.
- [ ] Hover over your own set card (face-down spell/trap) — the card MUST zoom (scale 1.35) and MUST show the card name label at the bottom.
- [ ] Hover over a face-up card (own or opponent's visible) — zoom and label both present (regression check).
- [ ] Hover over cards in the opponent hand band — no zoom, no label (opponent hand cards have no code).
- [ ] Confirm the browser console shows no errors during the above.
