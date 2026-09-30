# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oracle-slow-leak.spec.ts >> installed media >> mounted card image leases return to baseline across tray, restart, and destroy
- Location: e2e/oracle-slow-leak.spec.ts:1248:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  2
+ Received  + 14

  Object {
-   "notRevoked": Array [],
-   "stillActive": Array [],
+   "notRevoked": Array [
+     "blob:http://127.0.0.1:4518/1898c6b1-2ce5-4f0f-9c54-4dcec2313d7d",
+     "blob:http://127.0.0.1:4518/5f0eb76a-66ec-43a7-87fe-09da67b9e0bd",
+     "blob:http://127.0.0.1:4518/7a71bd9d-347b-4546-972f-1b6488d47257",
+     "blob:http://127.0.0.1:4518/3d099b31-9f97-4a77-bb5f-73127bf18871",
+     "blob:http://127.0.0.1:4518/63a4db0d-1f9f-4468-b9fb-77dd200b090c",
+   ],
+   "stillActive": Array [
+     "blob:http://127.0.0.1:4518/1898c6b1-2ce5-4f0f-9c54-4dcec2313d7d",
+     "blob:http://127.0.0.1:4518/5f0eb76a-66ec-43a7-87fe-09da67b9e0bd",
+     "blob:http://127.0.0.1:4518/7a71bd9d-347b-4546-972f-1b6488d47257",
+     "blob:http://127.0.0.1:4518/3d099b31-9f97-4a77-bb5f-73127bf18871",
+     "blob:http://127.0.0.1:4518/63a4db0d-1f9f-4468-b9fb-77dd200b090c",
+   ],
  }

Call Log:
- Timeout 30000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - main [ref=e5]:
    - paragraph [ref=e6]: Private prototype · v0.1
    - heading "ASCENCIO" [level=1] [ref=e7]
    - paragraph [ref=e8]: One signal. One duel. More than one way forward.
    - navigation "Main menu" [ref=e9]:
      - button "New Game" [ref=e10] [cursor=pointer]
      - button "Continue" [disabled] [ref=e11]
      - button "Load" [ref=e12] [cursor=pointer]
      - button "Content & Updates" [ref=e13] [cursor=pointer]
      - button "Settings" [ref=e14] [cursor=pointer]
      - button "Free Play" [ref=e15] [cursor=pointer]
    - status [ref=e16]: Installed content is ready.
    - paragraph [ref=e17]: Press F11 for fullscreen.
  - region "Notifications"
```

# Test source

```ts
  1245 | 
  1246 | test.describe("installed media", () => {
  1247 |   test.use({ installedMedia: true });
  1248 |   test("mounted card image leases return to baseline across tray, restart, and destroy", async ({
  1249 |     page,
  1250 |   }, testInfo) => {
  1251 |     await openDuel(page);
  1252 |     await startPresetDuel(page);
  1253 |     await enableDuelHud(page);
  1254 |     await expect(
  1255 |       page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  1256 |     ).toBeVisible({
  1257 |       timeout: 120_000,
  1258 |     });
  1259 |     await expect
  1260 |       .poll(async () => {
  1261 |         const state = await mountedImageLeaseState(page);
  1262 |         return state.activeCount > 0 && state.activeMatchesMounted;
  1263 |       })
  1264 |       .toBe(true);
  1265 |     const baseline = await mountedImageLeaseState(page);
  1266 |     const revokedBefore = await page.evaluate(
  1267 |       () => window.__duelCapture.imageUrls.revoked.length,
  1268 |     );
  1269 | 
  1270 |     const ownExtra = page.getByRole("button", {
  1271 |       name: /Open Your Extra Deck tray, \d+ cards/,
  1272 |     });
  1273 |     if ((await ownExtra.count()) > 0) {
  1274 |       await ownExtra.click();
  1275 |       await expect(
  1276 |         page.getByRole("region", { name: "Your Extra Deck tray" }),
  1277 |       ).toBeVisible();
  1278 |       await page
  1279 |         .getByRole("button", { name: "Close Your Extra Deck tray" })
  1280 |         .click();
  1281 |       await expect
  1282 |         .poll(async () => mountedImageLeaseState(page))
  1283 |         .toEqual(baseline);
  1284 |     }
  1285 | 
  1286 |     await surrenderThroughMenu(page);
  1287 |     await expect(
  1288 |       page.getByRole("heading", { name: "Duel surrendered" }),
  1289 |     ).toBeVisible();
  1290 |     await page.getByRole("button", { name: "Start another duel" }).click();
  1291 |     await expect(
  1292 |       page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  1293 |     ).toBeVisible({
  1294 |       timeout: 120_000,
  1295 |     });
  1296 |     await expect
  1297 |       .poll(async () => {
  1298 |         const state = await mountedImageLeaseState(page);
  1299 |         return state.activeCount > 0 && state.activeMatchesMounted;
  1300 |       })
  1301 |       .toBe(true);
  1302 |     const restarted = await mountedImageLeaseState(page);
  1303 |     expect(restarted.activeUrls).not.toEqual(baseline.activeUrls);
  1304 |     expect(
  1305 |       restarted.activeUrls.filter((url) => baseline.activeUrls.includes(url)),
  1306 |     ).toEqual([]);
  1307 |     expect(
  1308 |       await page.evaluate(() => window.__duelCapture.imageUrls.revoked.length),
  1309 |     ).toBeGreaterThan(revokedBefore);
  1310 | 
  1311 |     const captureIdentity = await page.evaluateHandle(
  1312 |       () => window.__duelCapture,
  1313 |     );
  1314 |     const formerDuelUrls = await page.evaluate(() => [
  1315 |       ...window.__duelCapture.imageUrls.active,
  1316 |     ]);
  1317 |     expect(formerDuelUrls.length).toBeGreaterThan(0);
  1318 |     test.fail();
  1319 |     await page.evaluate(() => { URL.revokeObjectURL = () => undefined; });
  1320 |     // Hash navigation unmounts the duel without replacing its instrumented document.
  1321 |     await page.evaluate(() => {
  1322 |       window.location.hash = "/";
  1323 |     });
  1324 |     await expect(page.locator('[data-cy="main-menu-title"]')).toBeVisible();
  1325 |     await expect(page.locator('[data-cy="duel-field"]')).toHaveCount(0);
  1326 |     expect(
  1327 |       await captureIdentity.evaluate(
  1328 |         (capture) => capture === window.__duelCapture,
  1329 |       ),
  1330 |     ).toBe(true);
  1331 |     await expect
  1332 |       .poll(() =>
  1333 |         page.evaluate(
  1334 |           (urls) => ({
  1335 |             stillActive: urls.filter((url) =>
  1336 |               window.__duelCapture.imageUrls.active.has(url),
  1337 |             ),
  1338 |             notRevoked: urls.filter(
  1339 |               (url) => !window.__duelCapture.imageUrls.revoked.includes(url),
  1340 |             ),
  1341 |           }),
  1342 |           formerDuelUrls,
  1343 |         ),
  1344 |       )
> 1345 |       .toEqual({ stillActive: [], notRevoked: [] });
       |        ^ Error: expect(received).toEqual(expected) // deep equality
  1346 |     const evidence = await page.evaluate(
  1347 |       (urls) => ({
  1348 |         created: window.__duelCapture.imageUrls.created.length,
  1349 |         revoked: window.__duelCapture.imageUrls.revoked.length,
  1350 |         active: window.__duelCapture.imageUrls.active.size,
  1351 |         formerDuelLeaseCount: urls.length,
  1352 |         formerDuelLeasesRevoked: urls.every((url) =>
  1353 |           window.__duelCapture.imageUrls.revoked.includes(url),
  1354 |         ),
  1355 |         sameDocumentCapture: true,
  1356 |         destinationActiveLeases: [
  1357 |           ...window.__duelCapture.imageUrls.active,
  1358 |         ].filter((url) => !urls.includes(url)).length,
  1359 |       }),
  1360 |       formerDuelUrls,
  1361 |     );
  1362 |     await captureIdentity.dispose();
  1363 |     const evidencePath = testInfo.outputPath("df-13-object-url-lifecycle.json");
  1364 |     await writeFile(
  1365 |       evidencePath,
  1366 |       JSON.stringify({ baseline, restarted, ...evidence }, null, 2),
  1367 |     );
  1368 |     await testInfo.attach("df-13-object-url-lifecycle", {
  1369 |       path: evidencePath,
  1370 |       contentType: "application/json",
  1371 |     });
  1372 |   });
  1373 | });
  1374 | 
  1375 | test.describe("installed media", () => {
  1376 |   test.use({ installedMedia: true });
  1377 |   test("slow image preload cannot delay a legal Worker response", async ({
  1378 |     page,
  1379 |   }, testInfo) => {
  1380 |     await page.addInitScript(() => {
  1381 |       const match = Cache.prototype.match;
  1382 |       let release!: () => void;
  1383 |       const wait = new Promise<void>((resolve) => {
  1384 |         release = resolve;
  1385 |       });
  1386 |       Object.assign(window, { releaseImageReads: release });
  1387 |       Cache.prototype.match = async function (request, options) {
  1388 |         const url = request instanceof Request ? request.url : String(request);
  1389 |         if (/\/runtime\/images\/\d+\.jpg$/.test(url)) {
  1390 |           Object.assign(window, { imageReadBlocked: true });
  1391 |           await wait;
  1392 |         }
  1393 |         return match.call(this, request, options);
  1394 |       };
  1395 |     });
  1396 |     await openDuel(page);
  1397 |     await startPresetDuel(page);
  1398 |     await page.waitForFunction(
  1399 |       () =>
  1400 |         (window as unknown as { imageReadBlocked?: boolean }).imageReadBlocked,
  1401 |     );
  1402 |     const controls = page.locator('[data-cy="duel-field"][data-prompt-kind]');
  1403 |     await expect(controls).toBeVisible({ timeout: 120_000 });
  1404 |     await expect(controls.getByRole("button").first()).toBeEnabled();
  1405 |     const field = page.getByRole("region", { name: "Duel field" });
  1406 |     await expect(field.getByRole("img").first()).toHaveAttribute(
  1407 |       "src",
  1408 |       /^data:image\/svg\+xml/,
  1409 |     );
  1410 |     const capture = await readCapture(page);
  1411 |     const prompt = capture.events.find(
  1412 |       (event) => event.type === "prompt",
  1413 |     ) as unknown as CapturedPromptEvent;
  1414 |     await page.locator('[data-cy="field-end-turn-button"]').click();
  1415 |     await expect
  1416 |       .poll(
  1417 |         async () =>
  1418 |           (await readCapture(page)).commands.filter(
  1419 |             (command) =>
  1420 |               command.type === "respond" &&
  1421 |               command.promptId === prompt.prompt.id,
  1422 |           ).length,
  1423 |       )
  1424 |       .toBe(1);
  1425 |     const evidencePath = testInfo.outputPath("df-13-nonblocking-input.json");
  1426 |     await writeFile(
  1427 |       evidencePath,
  1428 |       JSON.stringify(
  1429 |         {
  1430 |           imagePreloadSettled: false,
  1431 |           workerResponseCount: 1,
  1432 |           fieldImageSource: await field
  1433 |             .getByRole("img")
  1434 |             .first()
  1435 |             .getAttribute("src"),
  1436 |         },
  1437 |         null,
  1438 |         2,
  1439 |       ),
  1440 |     );
  1441 |     await testInfo.attach("df-13-nonblocking-input", {
  1442 |       path: evidencePath,
  1443 |       contentType: "application/json",
  1444 |     });
  1445 |     await page.evaluate(() =>
```