import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const storyRoot = path.resolve("src/story");

/* What the visual novel may reach for outside itself, mirroring the rule
   `tests/unit/domain-boundaries.test.ts` enforces across every domain: the
   shared deck-data library, and the one type-only battle module that names a
   duel result. Everything else the app ships — the duel's `app/`, `duel/`,
   `field/`, `worker/` and `storage/` internals under `src/battle/`, the shell,
   the deck editor — is a boundary break, because the story is loaded as its
   own lazy chunk and a value import would drag that chunk in with it. */
function reachableFromStory(target: string): boolean {
  return (
    target === "src/battle/battle-contracts.ts" ||
    target.startsWith("src/decks/")
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

  it("reaches outside itself only for deck data and the duel result contract", async () => {
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
});

async function findSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const file = path.join(root, entry.name);
      return entry.isDirectory()
        ? findSourceFiles(file)
        : /\.(?:ts|svelte)$/.test(entry.name)
          ? [file]
          : [];
    }),
  );
  return nested.flat();
}
