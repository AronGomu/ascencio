import { dirname, resolve, relative } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import ts from "typescript";

function sources(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = `${root}/${entry.name}`;
    return entry.isDirectory()
      ? sources(path)
      : /\.(ts|svelte)$/.test(path)
        ? [path]
        : [];
  });
}

it("retired-progressive-browser: obsolete Content public entry is absent", () => {
  expect(existsSync("src/content/index.ts")).toBe(false);
});

it("retired-progressive-browser: closed Shell and browser storage implementations are absent", () => {
  const retired = [
    "src/shell/application/application-service.ts",
    "src/shell/application/application-selector.ts",
    "src/shell/application/application-readiness.ts",
    "src/shell/application/application-state.ts",
    "src/shell/application/application-locks.ts",
    "src/shell/application/content-actions.ts",
    "src/shell/application/prepared-release.ts",
    "src/shell/application/selected-gameplay.ts",
    "src/shell/application/legacy-content.ts",
    "src/shell/core/legacy-shell-application.ts",
    "src/shell/core/menu-saves.ts",
    "src/shell/adapters/progressive-release-data.ts",
    "src/shell/adapters/progressive-release-media.ts",
    "src/content/storage/progressive-content-store.ts",
  ];
  expect(retired.filter(existsSync)).toEqual([]);
  for (const file of existsSync("src/content") ? sources("src/content") : [])
    expect(readFileSync(file, "utf8"), file).not.toMatch(
      /\b(?:indexedDB|CacheStorage|IDBFactory|createObjectURL)\b/,
    );
  const consumers: string[] = [];
  for (const file of sources("src").filter(
    (path) => !path.startsWith("src/content/"),
  )) {
    const text = readFileSync(file, "utf8");
    const script = file.endsWith(".svelte")
      ? (text.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "")
      : text;
    const tree = ts.createSourceFile(
      file,
      script,
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) && node.text.startsWith(".")) {
        const target = relative(
          process.cwd(),
          resolve(dirname(file), node.text),
        );
        if (target.startsWith("src/content/"))
          consumers.push(`${file} -> ${target}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  expect(consumers).toEqual([]);
});

it("retired-progressive-browser: CoreGate has no fixture-only reader or gameplay branch", () => {
  expect(readFileSync("src/shell/core/core-gate.ts", "utf8")).not.toMatch(
    /ShellGameplay|ShellSession|readonly (?:reader|gameplay)\??:/,
  );
  expect(readFileSync("src/shell/AppShell.svelte", "utf8")).not.toMatch(
    /coreGate\.(?:gameplay|reader)|gate\.(?:gameplay|reader)|contentReader|bindCardImages/,
  );
});

it("retired-progressive-browser: Story public migration capability is gone", () => {
  expect(readFileSync("src/story/saves/index.ts", "utf8")).not.toMatch(
    /StoryMigrationPort|StoryGenerationSeal|createStoryMigrationPort/,
  );
  expect(existsSync("src/story/saves/story-migration.ts")).toBe(false);
});

it("native runtime retires browser SQLite and keeps source commands", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const name of [
    "@aws-sdk/client-s3",
    "@aws-sdk/lib-storage",
    "@zip.js/zip.js",
    "wrangler",
    "@sqlite.org/sqlite-wasm",
    "idb",
    "vite-plugin-pwa",
    "workbox-precaching",
  ])
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty(
      name,
    );
  for (const name of ["@noble/hashes", "@tauri-apps/api"])
    expect(pkg.dependencies).toHaveProperty(name);
  for (const name of [
    "assets:setup",
    "assets:bundle",
    "content:catalog",
    "content:pack",
    "content:publish",
    "content:setup:verify",
  ])
    expect(pkg.scripts).not.toHaveProperty(name);
  expect(pkg.scripts["content:export"]).toBe(
    "node scripts/export-content-packages.ts",
  );
  expect(pkg.scripts["content:verify"]).toBe(
    "node scripts/verify-content-package.ts",
  );
  for (const file of [
    "scripts/lib/vite-core-content.ts",
    "scripts/lib/vite-runtime-assets.ts",
    "scripts/lib/vite-source-assets.ts",
    "scripts/content-publish.ts",
    "scripts/lib/asset-delivery/progressive-producer.ts",
    "scripts/lib/asset-delivery/write-archive.ts",
    "src/battle/storage/revision-cache-cleanup.ts",
  ])
    expect(existsSync(file), file).toBe(false);
  expect(readFileSync("vite.config.ts", "utf8")).not.toMatch(
    /prepareCoreDelivery|CONTENT_RUN|core-bootstrap/,
  );
});
