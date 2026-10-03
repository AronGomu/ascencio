# Visual novel domain

The narrative/map/campaign UI domain of the single app. Content is still the
authored prologue that started life as a disposable prototype; the code is now
a production domain of the shell, not a separate entry document.

## Run

```bash
npm run frontend:dev
```

Open the app and select **Visual novel** from the home hub, or go straight to
`#/story`. Production-like review uses `npm run frontend:build` then `npm run frontend:preview`
and the same `#/story` route.

## Boundaries

- Public contract is `index.ts`: the domain root component, `StoryState`,
  `EncounterId`, and the injected `GenerationSaveRepository` contract. The
  pure `saves/index.ts` entry exposes `createSqliteStoryRepository` and schema-6
  envelope validation; the shell supplies the shared SQLite user-data owner.
- The domain imports no production duel domain (`app`, `duel`, `field`,
  `storage`, `worker`); `tests/unit/story/story-boundaries.test.ts` enforces it.
- `styles.css` is scoped to `.story-app` so it cannot repaint the duel or deck
  editor that the shell mounts in the same document.
- Progress lives in the shared SQLite user-data store's `story` namespace,
  one schema-6 envelope per slot: `manual:1`–`manual:3`, `autosave`, and
  `checkpoint:pre-duel`. Writes use revision checks; checkpoint cleanup must
  match its owned revision. Unreadable or incompatible saves report failure,
  not an empty save. New Game does not depend on reading old saves. Legacy
  IndexedDB stores are not opened, migrated, or deleted.

## Known limits

- Battle is an explicit mock boundary; no Worker, WASM, or real duel
  integration yet.
- The save screens still render fixed placeholder slot summaries; only the
  backing store is real.
- Auto and Skip are labeled experiments, not functional automation.
- Audio is absent; disabled controls reserve evaluation space only.
- Story, names, visuals, title, rewards, and state are provisional
  English-only samples.

## Placeholder asset provenance

`assets/story/chapter-01/city-map-placeholder.svg` and CSS-rendered character/background/reward
art were authored in-repo. No third-party media, fonts, music, card art, or
redistribution rights are implied. Replace or delete all placeholder assets
before public use.
