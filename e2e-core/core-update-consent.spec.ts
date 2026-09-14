import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const evidence = process.env.T10_REPAIR_EVIDENCE ?? "artifacts/T10-EVIDENCE";
const appUrl = "http://127.0.0.1:4400/";

async function selectShell(page: Page, version: "a" | "b") {
  const response = await page.request.post(
    `${appUrl}__test/shell-version/${version}`,
  );
  expect(response.ok()).toBe(true);
}

async function openControlled(page: Page): Promise<void> {
  await page.goto(appUrl);
  await expect(page.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await page.evaluate(async () => await navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null)))
    await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true);
}

async function shellCaches(page: Page): Promise<readonly string[]> {
  return page.evaluate(async () =>
    (await caches.keys())
      .filter((name) => name.startsWith("ygo-core-shell-"))
      .sort(),
  );
}

async function controllerIdentity(page: Page) {
  return page.evaluate(async () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) throw new Error("Service worker controller missing");
    return await new Promise<{
      buildId: string;
      coreContentApiVersion: number;
    }>((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error("CORE controller identity timeout"));
      }, 3000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(event.data);
      };
      controller.postMessage("CORE_BUILD_IDENTITY", [channel.port2]);
    });
  });
}

test("CORE cold consent: unapproved build cannot install after all tabs close", async ({
  context,
  page,
}) => {
  await selectShell(page, "a");
  await openControlled(page);
  const buildA = await controllerIdentity(page);
  const metadataA = await (
    await page.request.get(`${appUrl}core-release.json`)
  ).json();
  expect(buildA).toEqual({
    buildId: metadataA.buildId,
    coreContentApiVersion: metadataA.coreContentApiVersion,
  });
  const [oldCache] = await shellCaches(page);
  expect(oldCache).toBeTruthy();

  await selectShell(page, "b");
  const metadataB = await (
    await page.request.get(`${appUrl}core-release.json`)
  ).json();
  expect(metadataB.buildId).not.toBe(buildA.buildId);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error("Service worker is missing");
    await registration.update();
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.waiting?.state ?? null;
      }),
    )
    .toBeNull();
  expect(await shellCaches(page)).toEqual([oldCache]);

  await page.close();
  await new Promise((resolve) => setTimeout(resolve, 750));
  const cold = await context.newPage();
  await cold.goto(appUrl);
  await expect(cold.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  expect(await shellCaches(cold)).toEqual([oldCache]);
  expect(await controllerIdentity(cold)).toEqual(buildA);
  await context.setOffline(true);
  await cold.reload();
  await expect(cold.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  expect(await controllerIdentity(cold)).toEqual(buildA);
  await context.setOffline(false);

  await cold.locator('[data-cy="main-menu-install-content"]').click();
  await cold.locator('[data-cy="content-check-updates"]').click();
  await expect(cold.locator('[data-cy="core-approve-update"]')).toBeEnabled();
  await cold.evaluate(() => {
    const original = ServiceWorkerRegistration.prototype.update;
    ServiceWorkerRegistration.prototype.update = async function () {
      const row = await new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open("ygo-application-state", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["coreApproval", "selection"]);
          const approved = tx.objectStore("coreApproval").get("approved");
          const selected = tx.objectStore("selection").get("active");
          tx.oncomplete = () => {
            resolve({
              approval: approved.result,
              selection: selected.result ?? { generation: 0 },
              observedAt: Date.now(),
            });
            db.close();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
      Object.assign(window, { approvalBeforeUpdate: row });
      return original.call(this);
    };
  });
  await cold.locator('[data-cy="core-approve-update"]').click();
  await expect
    .poll(() =>
      cold.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.waiting?.state ?? null;
      }),
    )
    .toBe("installed");
  const persisted = await cold.evaluate(
    () =>
      (
        window as unknown as {
          approvalBeforeUpdate: {
            approval: { approvedAt: number; selectionGeneration: number };
            selection: { generation: number };
            observedAt: number;
          };
        }
      ).approvalBeforeUpdate,
  );
  expect(persisted.approval).toEqual({
    ...metadataB,
    approvedAt: expect.any(Number),
    selectionGeneration: persisted.selection.generation,
  });
  expect(persisted.approval.approvedAt).toBeGreaterThan(0);
  expect(persisted.approval.approvedAt).toBeLessThanOrEqual(
    persisted.observedAt,
  );
  expect(await controllerIdentity(cold)).toEqual(buildA);
  await cold.screenshot({ path: `${evidence}/core-approved-waiting.png` });

  await cold.close();
  await new Promise((resolve) => setTimeout(resolve, 750));
  const approved = await context.newPage();
  await approved.goto(appUrl);
  await expect(approved.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await expect
    .poll(async () => await shellCaches(approved))
    .not.toEqual([oldCache]);
  expect(await shellCaches(approved)).toHaveLength(1);
  const buildB = await controllerIdentity(approved);
  expect(buildB).toEqual({
    buildId: metadataB.buildId,
    coreContentApiVersion: metadataB.coreContentApiVersion,
  });
  await context.setOffline(true);
  await approved.reload();
  await expect(approved.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  expect(await controllerIdentity(approved)).toEqual(buildB);
  await writeFile(
    `${evidence}/core-native-observations.json`,
    JSON.stringify(
      {
        buildA,
        buildB,
        metadataA,
        metadataB,
        approvalBeforeUpdate: persisted,
        coldUnapprovedController: buildA,
        approvedWaitingController: buildA,
        approvedOfflineController: buildB,
      },
      null,
      2,
    ) + "\n",
  );
});
