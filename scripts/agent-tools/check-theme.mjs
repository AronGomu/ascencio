/* global window */
import process from "node:process";
import console from "node:console";
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ colorScheme: "light" });
  await page.goto(pathToFileURL(path.resolve(process.argv[2])).href);
  const result = await page.evaluate(() => {
    const bg = window.getComputedStyle(
      window.document.documentElement,
    ).backgroundColor;
    const fg = window.getComputedStyle(window.document.body).color;
    const luminance = (c) => {
      const rgb = c
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((x) => {
          x /= 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    return {
      bg,
      fg,
      dark: luminance(bg) < 0.1,
      contrast: (luminance(fg) + 0.05) / (luminance(bg) + 0.05),
    };
  });
  console.log(JSON.stringify(result));
  if (!result.dark || result.bg === "rgba(0, 0, 0, 0)" || result.contrast < 4.5)
    throw Error(
      "Expected an opaque dark background and readable body text even with a light system theme",
    );
} finally {
  await browser.close();
}
