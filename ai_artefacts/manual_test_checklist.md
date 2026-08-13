## T1 pixel-geometry-model

- [ ] Confirm existing duel field renderer looks unchanged at supported viewport sizes.
- [ ] Confirm keyboard field navigation behaves identically at small and large viewport sizes.
- [ ] Confirm Link-free duel omits both shared Extra Monster Zones from render-layout data.

## T2 conditional-chromium-acceptance-harness

- [x] Unknown or missing scenario shows explicit failure marker without fallback board (automated Chromium equivalent passed).
- [x] Normal production build keeps `index.html` behavior and excludes acceptance entry/scenario IDs.
- [x] Dedicated Chromium harness renders real field components for EMZ, no-EMZ, and Defense scenarios.
