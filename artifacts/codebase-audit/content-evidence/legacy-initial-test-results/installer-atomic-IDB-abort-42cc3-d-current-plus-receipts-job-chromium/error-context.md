# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: installer.spec.ts >> atomic IDB abort during CAS preserves old current plus receipts/job
- Location: e2e-content/installer.spec.ts:172:1

# Error details

```
Error: page.evaluate: TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:4402/src/content/index.ts
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - alert [ref=e4]: This session stopped because its required data became unavailable. Your saved progress was not replaced.
  - main [ref=e6]:
    - paragraph [ref=e7]: Private prototype · v0.1
    - heading "ASCENCIO" [level=1] [ref=e8]
    - paragraph [ref=e9]: One signal. One duel. More than one way forward.
    - navigation "Main menu" [ref=e10]:
      - button "New Game" [disabled] [ref=e11]
      - button "Continue" [disabled] [ref=e12]
      - button "Load" [disabled] [ref=e13]
      - button "Content & Updates" [ref=e14] [cursor=pointer]
      - button "Settings" [ref=e15] [cursor=pointer]
      - button "Free Play" [disabled] [ref=e16]
    - status [ref=e17]: Content configuration is invalid. Gameplay remains locked.
    - paragraph [ref=e18]: Press F11 for fullscreen.
  - region "Notifications"
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | import { contentInstallFixture } from "../tests/fixtures/content-install-fixture.ts";
  3   | import type {
  4   |   ContentInstaller,
  5   |   CoreBootstrap,
  6   |   InstalledRuntimeReceipt,
  7   |   ManifestRef,
  8   |   RuntimeSnapshotRef,
  9   | } from "../src/content/index.ts";
  10  | 
  11  | declare global {
  12  |   interface Window {
  13  |     contentInstaller: ContentInstaller;
  14  |     preparation: unknown;
  15  |     preparedReceipt: InstalledRuntimeReceipt;
  16  |     releaseLease: () => void;
  17  |     legacyBattle: IDBDatabase;
  18  |     battleBlocked: boolean;
  19  |   }
  20  | }
  21  | async function boot(page: Page, realActivation = false) {
  22  |   const fixture = await contentInstallFixture({ realRuntime: realActivation });
  23  |   fixture.bootstrap = {
  24  |     ...fixture.bootstrap,
  25  |     delivery: {
  26  |       ...fixture.bootstrap.delivery!,
  27  |       baseUrl: "http://127.0.0.1:4402/",
  28  |     },
  29  |   };
  30  |   await page.route("http://127.0.0.1:4402/content/**", async (route) => {
  31  |     const bytes = fixture.objects.get(
  32  |       new URL(route.request().url()).pathname.slice(1),
  33  |     );
  34  |     await route.fulfill({
  35  |       status: bytes ? 200 : 404,
  36  |       body: bytes ? Buffer.from(bytes) : "missing",
  37  |     });
  38  |   });
  39  |   await page.goto("/");
  40  |   await initialize(page, fixture.bootstrap, realActivation);
  41  |   return fixture;
  42  | }
  43  | async function initialize(
  44  |   page: Page,
  45  |   bootstrap: CoreBootstrap,
  46  |   realActivation = false,
  47  | ) {
> 48  |   return page.evaluate(
      |               ^ Error: page.evaluate: TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:4402/src/content/index.ts
  49  |     async ({ bootstrap, realActivation }) => {
  50  |       const api = await import(
  51  |         /* @vite-ignore */ String("/src/content/index.ts")
  52  |       );
  53  |       const result = await api.createContentInstaller({
  54  |         bootstrap,
  55  |         savedRefs: { read: async () => ({ kind: "ok", value: [] }) },
  56  |         activation: realActivation
  57  |           ? (
  58  |               await import(
  59  |                 /* @vite-ignore */ String(
  60  |                   "/src/shell/adapters/runtime-activation.ts",
  61  |                 )
  62  |               )
  63  |             ).createRuntimeActivationPort()
  64  |           : {
  65  |               prepare: async (ref: unknown) => ({ kind: "ok", value: ref }),
  66  |             },
  67  |       });
  68  |       if (result.kind !== "ok") throw new Error(JSON.stringify(result));
  69  |       window.contentInstaller = result.value;
  70  |     },
  71  |     { bootstrap, realActivation },
  72  |   );
  73  | }
  74  | const install = (page: Page) =>
  75  |   page.evaluate(() =>
  76  |     window.contentInstaller.download(
  77  |       { kind: "chapter", chapterId: "chapter-01" },
  78  |       () => undefined,
  79  |     ),
  80  |   );
  81  | 
  82  | test("installer commits whole closure only in real Cache/IDB", async ({
  83  |   page,
  84  | }) => {
  85  |   const fixture = await boot(page);
  86  |   expect(await install(page)).toEqual({
  87  |     kind: "complete",
  88  |     content: fixture.content,
  89  |   });
  90  |   expect(await page.evaluate(() => window.contentInstaller.current())).toEqual({
  91  |     kind: "ok",
  92  |     value: { generation: 1, current: fixture.content, previous: null },
  93  |   });
  94  |   await page.reload();
  95  |   await initialize(page, fixture.bootstrap);
  96  |   expect(
  97  |     await page.evaluate(() => window.contentInstaller.inspect("chapter-01")),
  98  |   ).toMatchObject({ kind: "ready" });
  99  |   await page.screenshot({
  100 |     path: "artifacts/CORE_ACCEPTANCE/T4/installer-core-locked.png",
  101 |   });
  102 | });
  103 | 
  104 | test("quota Cache.put failure leaves real current unchanged", async ({
  105 |   page,
  106 | }) => {
  107 |   await boot(page);
  108 |   await page.evaluate(() => {
  109 |     const native = Cache.prototype.put;
  110 |     Cache.prototype.put = function (request, response) {
  111 |       if (String(request).includes("/__content/files/"))
  112 |         return Promise.reject(
  113 |           new DOMException("Injected quota", "QuotaExceededError"),
  114 |         );
  115 |       return native.call(this, request, response);
  116 |     };
  117 |   });
  118 |   expect(await install(page)).toMatchObject({
  119 |     kind: "failed",
  120 |     code: "CONTENT_QUOTA_EXCEEDED",
  121 |   });
  122 |   expect(
  123 |     await page.evaluate(() => window.contentInstaller.current()),
  124 |   ).toMatchObject({ value: { generation: 0, current: null } });
  125 |   expect(
  126 |     await page.evaluate(async () => {
  127 |       const db = await new Promise<IDBDatabase>((resolve) => {
  128 |         const r = indexedDB.open("ygo-story-content");
  129 |         r.onsuccess = () => resolve(r.result);
  130 |       });
  131 |       const count = await new Promise<number>((resolve) => {
  132 |         const r = db.transaction("receipts").objectStore("receipts").count();
  133 |         r.onsuccess = () => resolve(r.result);
  134 |       });
  135 |       db.close();
  136 |       return count;
  137 |     }),
  138 |   ).toBe(0);
  139 | });
  140 | 
  141 | test("quota IDB receipt write aborts whole install transaction", async ({
  142 |   page,
  143 | }) => {
  144 |   await boot(page);
  145 |   await page.evaluate(() => {
  146 |     const native = IDBObjectStore.prototype.put;
  147 |     IDBObjectStore.prototype.put = function (value, key) {
  148 |       if (this.name === "receipts")
```