import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* T16: story, deck editor and shell all resolve colour from tokens.css.
   These hex values are the token values from tokens.css; change a token
   and this test catches the contrast regression before it ships. */
const TOKENS = (() => {
  const css = readFileSync("src/styles/tokens.css", "utf8");
  const read = (name: string): string => {
    const match = css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m"));
    if (!match) throw new Error(`Token not found: ${name}`);
    return match[1]!.trim();
  };
  return {
    bg: read("--bg"),
    surface: read("--surface"),
    surfaceRaised: read("--surface-raised"),
    text: read("--text"),
    muted: read("--muted"),
    accent: read("--accent"),
    inkOnAccent: read("--ink-on-accent"),
    focusRing: read("--focus-ring"),
    danger: read("--danger"),
    borderLight: read("--border-light"),
  };
})();

describe("story contrast tokens", () => {
  it.each([
    ["text", "bg", 4.5],
    ["muted", "bg", 4.5],
    ["text", "surfaceRaised", 4.5],
    ["accent", "bg", 4.5],
    ["inkOnAccent", "accent", 4.5],
  ] as const)(
    "%s on %s meets normal text contrast",
    (foreground, background, required) => {
      expect(
        contrast(TOKENS[foreground], TOKENS[background]),
      ).toBeGreaterThanOrEqual(required);
    },
  );

  it.each([
    ["focusRing", "bg", 3],
    ["borderLight", "surfaceRaised", 3],
    ["danger", "bg", 3],
  ] as const)(
    "%s against %s meets non-text contrast",
    (foreground, background, required) => {
      expect(
        contrast(TOKENS[foreground], TOKENS[background]),
      ).toBeGreaterThanOrEqual(required);
    },
  );
});

describe("deck editor contrast tokens", () => {
  it.each([
    ["text", "surfaceRaised", 4.5],
    ["text", "surface", 4.5],
    ["muted", "surface", 4.5],
    ["accent", "surface", 4.5],
  ] as const)(
    "%s on %s meets normal text contrast",
    (foreground, background, required) => {
      expect(
        contrast(TOKENS[foreground], TOKENS[background]),
      ).toBeGreaterThanOrEqual(required);
    },
  );

  it.each([
    ["danger", "surface", 3],
    ["accent", "surfaceRaised", 3],
  ] as const)(
    "%s against %s meets non-text contrast",
    (foreground, background, required) => {
      expect(
        contrast(TOKENS[foreground], TOKENS[background]),
      ).toBeGreaterThanOrEqual(required);
    },
  );
});

describe("shell contrast tokens", () => {
  it.each([
    ["text", "bg", 4.5],
    ["muted", "bg", 4.5],
    ["accent", "bg", 4.5],
  ] as const)(
    "%s on %s meets normal text contrast",
    (foreground, background, required) => {
      expect(
        contrast(TOKENS[foreground], TOKENS[background]),
      ).toBeGreaterThanOrEqual(required);
    },
  );
});

function contrast(left: string, right: string): number {
  const luminance = (hex: string): number => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)!
      .map((value) => Number.parseInt(value, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return (
      0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
    );
  };
  const [bright, dark] = [luminance(left), luminance(right)].sort(
    (a, b) => b - a,
  );
  return (bright! + 0.05) / (dark! + 0.05);
}
