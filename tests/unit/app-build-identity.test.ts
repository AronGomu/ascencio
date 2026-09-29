import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appBuildIdentity } from "../../scripts/lib/app-build-identity.ts";

const FILES = [
  "assets/app/app-icon.svg",
  "assets/app/download-links.json",
  "assets/app/fonts/forum-latin.woff2",
  "assets/app/content-bootstrap.json",
  "tsconfig.json",
  "scripts/lib/asset-delivery/verify-bundle.ts",
  "assets/content/chapter-01/media/city-map-placeholder.svg",
  "content/core-bootstrap.json",
  "generated/content-packages/card-library/1.0.0.sqlite",
  "index.html",
  "package-lock.json",
  "package.json",
  "vite.config.ts",
  "scripts/lib/app-build-identity.ts",
  "scripts/lib/vite-core-content.ts",
  "scripts/lib/vite-sync-core.ts",
  "src/main.ts",
  "vendor/ocgcore-wasm/0.1.2/dist/index.js",
  "vendor/ocgcore-wasm/0.1.2/dist/ocgcore.sync-MMMSWPBB.js",
  "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm",
  "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.mjs",
  "vendor/ocgcore-wasm/0.1.2/package.json",
] as const;

async function fixture(prefix: string): Promise<string> {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp", prefix));
  for (const file of FILES) {
    const absolute = path.join(root, file);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(
      absolute,
      file === "assets/app/fonts/forum-latin.woff2" ||
        file === "assets/app/download-links.json"
        ? await readFile(path.resolve(file))
        : `fixture:${file}\n`,
    );
  }
  return root;
}

describe("app build identity", () => {
  it("depends on app paths and bytes, never checkout path or mtime", async () => {
    const first = await fixture("app-id-a-");
    const second = await fixture("app-id-b-");
    try {
      await utimes(path.join(second, "src/main.ts"), new Date(0), new Date(0));
      expect(appBuildIdentity(first)).toBe(appBuildIdentity(second));
      await writeFile(path.join(second, "src/main.ts"), "changed\n");
      expect(appBuildIdentity(first)).not.toBe(appBuildIdentity(second));
    } finally {
      await Promise.all([
        rm(first, { recursive: true, force: true }),
        rm(second, { recursive: true, force: true }),
      ]);
    }
  });

  it("excludes hosted bootstrap, package media, and package-owned OCG WASM", async () => {
    const root = await fixture("app-id-content-");
    try {
      const baseline = appBuildIdentity(root);
      await writeFile(
        path.join(
          root,
          "assets/content/chapter-01/media/city-map-placeholder.svg",
        ),
        "changed media\n",
      );
      await writeFile(
        path.join(root, "content/core-bootstrap.json"),
        "changed bootstrap\n",
      );
      await writeFile(
        path.join(root, "generated/content-packages/card-library/1.0.0.sqlite"),
        "changed package database\n",
      );
      await writeFile(
        path.join(root, "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
        "changed wasm\n",
      );
      expect(appBuildIdentity(root)).toBe(baseline);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    "vendor/ocgcore-wasm/0.1.2/dist/index.js",
    "vendor/ocgcore-wasm/0.1.2/dist/ocgcore.sync-MMMSWPBB.js",
    "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.mjs",
  ])("includes frozen loader JavaScript %s", async (loader) => {
    const root = await fixture("app-id-loader-");
    try {
      const baseline = appBuildIdentity(root);
      await writeFile(path.join(root, loader), "changed loader\n");
      expect(appBuildIdentity(root)).not.toBe(baseline);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("app identity inputs and containment", () => {
  it.each([
    "assets/app/fonts/forum-latin.woff2",
    "assets/app/download-links.json",
    "tsconfig.json",
    "scripts/lib/asset-delivery/verify-bundle.ts",
  ])("hashes existing app input %s", async (file) => {
    const root = await fixture("app-id-input-");
    try {
      const before = appBuildIdentity(root);
      await writeFile(path.join(root, file), "changed existing input\n");
      expect(appBuildIdentity(root)).not.toBe(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects source symlink escape without explicit authorization", async () => {
    const root = await fixture("app-id-escape-");
    const outside = await fixture("app-id-outside-");
    try {
      await symlink(path.join(outside, "src"), path.join(root, "src/escape"));
      expect(() => appBuildIdentity(root)).toThrow("APP_BUILD_SYMLINK_ESCAPE");
    } finally {
      await Promise.all(
        [root, outside].map((dir) => rm(dir, { recursive: true, force: true })),
      );
    }
  });
});

describe("app identity authorized source fixtures", () => {
  it("accepts asset-free fixture source symlink only with explicit repo source authorization", async () => {
    const root = await fixture("app-id-source-link-");
    try {
      await symlink(path.resolve("src"), path.join(root, "src/repo-source"));
      expect(() => appBuildIdentity(root)).toThrow("APP_BUILD_SYMLINK_ESCAPE");
      const allowed = [path.resolve("src")];
      expect(appBuildIdentity(root, allowed)).toBe(
        appBuildIdentity(root, allowed),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects ancestor symlink cycles deterministically", async () => {
    const root = await fixture("app-id-cycle-");
    try {
      await symlink(path.join(root, "src"), path.join(root, "src/cycle"));
      expect(() => appBuildIdentity(root)).toThrow("APP_BUILD_SYMLINK_CYCLE");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("excludes app hosted-bootstrap payload", async () => {
    const root = await fixture("app-id-app-bootstrap-");
    try {
      const before = appBuildIdentity(root);
      await writeFile(
        path.join(root, "assets/app/content-bootstrap.json"),
        "changed hosted payload",
      );
      expect(appBuildIdentity(root)).toBe(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
