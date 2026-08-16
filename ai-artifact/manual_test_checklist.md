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
