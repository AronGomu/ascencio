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
