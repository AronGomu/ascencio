import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const documentPath = path.resolve(directory, "../PLAN_2026_09_13_content_module_rearchitecture.html");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
  await page.goto(pathToFileURL(documentPath).href);
  assert.equal(await page.locator("details.ticket").count(), 11);
  assert.equal(await page.locator("#adrs > details").count(), 6);
  await page.locator("#search").fill("Story");
  assert.equal(await page.locator("details.ticket:visible").count(), 1);
  await page.locator("#expand").click();
  assert.equal(await page.locator("#T6").getAttribute("open"), "");
  await page.locator("#collapse").click();
  assert.equal(await page.locator("details.ticket[open]").count(), 0);
  await page.locator("#search").fill("");
  await page.goto(`${pathToFileURL(documentPath).href}#T9`);
  assert.equal(await page.locator("#T9").getAttribute("open"), "");
  await page.locator("#collapse").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(directory, "plan-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#T11 > summary").click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.locator("#collapse").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(directory, "plan-mobile.png") });
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(errors, []);
  console.log("PASS: Chromium desktop/mobile; 11 ticket accordions; 6 ADRs; search/expand/collapse/hash navigation; no horizontal page overflow; zero external requests; zero page errors.");
  console.log(`Screenshots: ${path.join(directory, "plan-desktop.png")}; ${path.join(directory, "plan-mobile.png")}`);
} finally {
  await browser.close();
}
