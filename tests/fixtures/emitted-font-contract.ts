import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

/** Resolve emitted @font-face URLs; HTTP 200 HTML fallback is never a font. */
export async function expectEmittedFonts(page: Page, appUrl: string) {
  await page.goto(appUrl);
  const fonts = await page.evaluate(() => {
    const result: { family: string; url: string }[] = [];
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const source = rule.style.getPropertyValue("src");
        const url = /url\(["']?([^"')]+)["']?\)/.exec(source)?.[1];
        if (url)
          result.push({
            family: rule.style
              .getPropertyValue("font-family")
              .replace(/["']/g, ""),
            url: new URL(url, sheet.href ?? document.baseURI).href,
          });
      }
    }
    return result;
  });
  for (const [family, filename] of [
    ["Forum", "forum-latin"],
    ["Source Serif 4", "source-serif-4-latin"],
  ] as const) {
    const font = fonts.find((font) => font.family === family);
    expect(font, family).toBeDefined();
    const url = new URL(font!.url);
    expect(url.origin).toBe(new URL(appUrl).origin);
    expect(url.pathname).toMatch(
      new RegExp(
        `^${new URL(appUrl).pathname}assets/${filename}-[A-Za-z0-9_-]+\\.woff2$`,
      ),
    );
    const response = await page.request.get(url.href);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(
      /font\/woff2|application\/font-woff/,
    );
    const bytes = await response.body();
    expect(bytes.subarray(0, 4).toString()).toBe("wOF2");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      createHash("sha256")
        .update(await readFile(`src/assets/fonts/${filename}.woff2`))
        .digest("hex"),
    );
    expect(
      await page.evaluate(
        async (family) =>
          (await document.fonts.load(`16px "${family}"`)).some(
            (font) => font.status === "loaded",
          ),
        family,
      ),
    ).toBe(true);
  }
}
