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
