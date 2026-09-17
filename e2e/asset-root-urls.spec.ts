import { test, expect } from "@playwright/test";
import { expectEmittedFonts } from "../tests/fixtures/emitted-font-contract.ts";

test("canonical source relocation retains emitted font URLs and exact bytes", async ({
  page,
  baseURL,
}) => {
  await expectEmittedFonts(page, baseURL!);
  // Gameplay sources are no longer public CORE URLs. A SPA fallback must not
  // be mistaken for a successful runtime, image, WASM or authoring response.
  for (const logical of [
    "runtime/current/manifest.json",
    "runtime/assets/current/manifest.json",
    "runtime/images/97590747.jpg",
    "runtime/images-cropped/97590747.jpg",
    "runtime/images/card-back.jpg",
    "runtime/engine/ocgcore.sync.wasm",
    "assets/story/PROVENANCE.md",
  ]) {
    const response = await page.request.get(new URL(logical, baseURL).href);
    expect(
      response.status() === 404 ||
        response.headers()["content-type"]?.includes("text/html"),
      logical,
    ).toBe(true);
  }
});
