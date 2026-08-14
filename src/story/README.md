# Visual novel domain

The narrative/map/campaign UI domain of the single app. Content is still the
authored prologue that started life as a disposable prototype; the code is now
a production domain of the shell, not a separate entry document.

## Run

```bash
npm run dev
```

Open the app and select **Visual novel** from the home hub, or go straight to
`#/story`. Production-like review uses `npm run build` then `npm run preview`
and the same `#/story` route.

## Boundaries

- Public contract is `index.ts`: the domain root component plus `StoryState`
  and `EncounterId`. Nothing outside `src/story/` deep-imports past it.
- The domain imports no production duel domain (`app`, `duel`, `field`,
  `storage`, `worker`); `tests/unit/story/story-boundaries.test.ts` enforces it.
- `styles.css` is scoped to `.story-app` so it cannot repaint the duel or deck
  editor that the shell mounts in the same document.
- Progress lives in one `localStorage` record under `ygo.story.v1`. The
  developer console at `#/admin` can reset it.

## Known limits

- Battle is an explicit mock boundary; no Worker, WASM, or real duel
  integration yet.
- Save data is one `localStorage` record, not the production save schema.
- Auto and Skip are labeled experiments, not functional automation.
- Audio is absent; disabled controls reserve evaluation space only.
- Story, names, visuals, title, rewards, and state are provisional
  English-only samples.

## Placeholder asset provenance

`assets/city-map-placeholder.svg` and CSS-rendered character/background/reward
art were authored in-repo. No third-party media, fonts, music, card art, or
redistribution rights are implied. Replace or delete all placeholder assets
before public use.
