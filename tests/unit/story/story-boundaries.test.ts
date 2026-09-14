import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const storyRoot = path.resolve("src/story");

/* What the visual novel may reach for outside itself, mirroring the rule
   `tests/unit/domain-boundaries.test.ts` enforces across every domain: shared
   deck/card contracts, pure shared presentation, the one type-only battle
   module that names a duel result, and public shell/deck-selection entries.
   Everything else the app ships — the duel's `app/`, `duel/`, `field/`,
   `worker/` and `storage/` internals under `src/battle/`, shell internals, the
   deck editor — is a boundary break, because story loads as its own lazy chunk.

   T3 moves card-preview presentation from the shell into pure shared Svelte UI.
   Story also accepts the public `CardImageSource` port as an injected type-only
   input; neither entry grants access to a connected provider implementation. */
function reachableFromStory(target: string): boolean {
  return (
    target === "src/battle/battle-contracts.ts" ||
    target === "src/shell/index.ts" ||
    target === "src/deck-select/index.ts" ||
    target === "src/content/index.ts" ||
    target === "src/cards/index.ts" ||
    target === "src/cards/images/index.ts" ||
    target === "src/shared-svelte-ui/card-preview/index.ts" ||
    // T2 source relocation preserves the existing static SVG import, not a code API.
    target === "assets/story/chapter-01/city-map-placeholder.svg" ||
    [
      "index",
      "contracts/index",
      "repository/index",
      "editing/index",
      "validation/index",
      "catalog/index",
    ].some((entry) => target === `src/decks/${entry}.ts`)
  );
}

describe("story source boundary", () => {
  /* The visual novel used to ship as its own HTML document. It now lives
     inside the single app, so the guarantee flips: the second entry point
     must be gone, not present. */
  it("has no entry document or mount script of its own", async () => {
    await expect(stat("prototype.html")).rejects.toThrow();
    await expect(stat(path.join(storyRoot, "main.ts"))).rejects.toThrow();
    await expect(stat(path.join(storyRoot, "index.ts"))).resolves.toBeDefined();
  });

  it("keeps no reviewer harness", async () => {
    await expect(stat(path.join(storyRoot, "review"))).rejects.toThrow();
    await expect(
      stat(path.join(storyRoot, "components/VisualDirectionBoards.svelte")),
    ).rejects.toThrow();
    for (const file of await findSourceFiles(storyRoot)) {
      const source = await readFile(file, "utf8");
      expect(
        /ReviewDrawer|ReviewLauncher|review-presets|review-link/.test(source),
        `${path.relative(storyRoot, file)} still references reviewer tooling`,
      ).toBe(false);
    }
  });

  it("reaches outside itself only through approved public entries", async () => {
    const files = await findSourceFiles(storyRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const imports = source.matchAll(
        /(?:from\s+|import\s*)["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g,
      );
      for (const match of imports) {
        const specifier = match[1] ?? match[2]!;
        if (!specifier.startsWith(".")) continue;
        const target = path
          .relative(
            path.resolve("."),
            path.resolve(path.dirname(file), specifier),
          )
          .split(path.sep)
          .join("/");
        if (target.startsWith("src/story/")) continue;
        expect(
          reachableFromStory(target),
          `${path.relative(storyRoot, file)} imports ${target} from outside the visual novel`,
        ).toBe(true);
      }
    }
  });

  it("sizes story surfaces from their shell container, not viewport units", async () => {
    const files = await findLayoutSourceFiles(storyRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const viewportUnits =
        source.match(/\b\d*\.?\d+(?:s|d|l)?v[hw]\b/gi) ?? [];
      expect(
        viewportUnits,
        `${path.relative(storyRoot, file)} contains viewport units: ${viewportUnits.join(", ")}`,
      ).toEqual([]);
    }
  });
});

async function findSourceFiles(root: string): Promise<string[]> {
  return findFiles(root, /\.(?:ts|svelte)$/);
}

async function findLayoutSourceFiles(root: string): Promise<string[]> {
  return findFiles(root, /\.(?:css|svelte|ts)$/);
}

async function findFiles(root: string, extension: RegExp): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const file = path.join(root, entry.name);
      return entry.isDirectory()
        ? findFiles(file, extension)
        : extension.test(entry.name)
          ? [file]
          : [];
    }),
  );
  return nested.flat();
}
