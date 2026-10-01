import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  symlink,
  truncate,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAssetRestructure,
  hashFile,
  planAssetRestructure,
} from "../../../scripts/lib/sqlite-content/asset-restructure.ts";

vi.mock("node:fs/promises", async (original) => ({
  ...(await original<typeof fs>()),
}));

const pendingPath = "generated/content-packages/asset-move-pending.json";
const receiptPath = "generated/content-packages/asset-move-receipt.json";
const roots: string[] = [];
async function workspace(): Promise<string> {
  const root = await mkdtemp(
    path.join(tmpdir(), "ascencio-asset-restructure-"),
  );
  roots.push(root);
  await put(root, "assets/core/app-icon.svg", "icon");
  await put(root, "src/assets/fonts/app.woff2", "font");
  await put(root, "assets/shared/data/current/catalog/cards/00.json", "[]");
  await put(root, "assets/shared/data/current/scripts/cards/00.json", "{}");
  await put(root, "assets/shared/data/current/strings/en.json", "{}");
  await put(root, "assets/shared/data/current/images/00.json", "[]");
  await put(root, "assets/shared/data/current/manifest.json", "{}");
  await put(root, "assets/shared/data/current/manifest.sha256", "digest");
  await put(root, "assets/shared/runtime/current/manifest.json", "{}");
  await put(root, "assets/shared/card-images/full/1.jpg", "full");
  await put(root, "assets/shared/card-images/cropped/1.jpg", "crop");
  await put(root, "assets/shared/card-back.jpg", "back");
  await put(root, "assets/shared/set-images/set.jpg", "set");
  await put(root, "assets/story/chapter-01/map.svg", "map");
  await put(
    root,
    "assets/battle/engine/current/lib/ocgcore.sync.wasm",
    "acquired",
  );
  await put(root, "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm", "vendor");
  await put(root, "content/authoring/card-set-source.json", "{}");
  await put(
    root,
    "content/authoring/ygoprodeck-cardsets-2026-09-12.json",
    "{}",
  );
  await put(root, "content/authoring/chapter-one-gameplay.json", "{}");
  await put(root, "content/authoring/chapter-one-story.json", "{}");
  await put(root, "content/authoring/chapter-one-corrections.json", "{}");
  await put(root, "content/authoring/chapter-one-set-media.json", "{}");
  await put(root, "content/authoring/chapter-policy.json", "{}");
  await put(root, "content/authoring/release-date-evidence.json", "{}");
  await put(root, "content/authoring/superseded-six-era-mapping.json", "{}");
  await put(root, "content/chapter-selections.json", "{}");
  await put(root, "content/core-bootstrap.json", "{}");
  await put(root, "content/distribution-evidence.json", "retained");
  await put(root, "content/setup-evidence.json", "retained");
  await put(root, "content/README.md", "retained");
  await put(root, "content/duel-core/config.json", "{}");
  await put(root, "content/freeplay/config.json", "{}");
  await put(root, "content/freeplay/decks.json", "[]");
  await put(root, "public/story/shop-sets.v1.json", "{}");
  await put(
    root,
    "src/battle/duel/presets/decks/chapter-one-practice.ydk",
    "chapter-practice",
  );
  await put(
    root,
    "src/battle/duel/presets/decks/chapter-one-starter.ydk",
    "chapter-starter",
  );
  await put(
    root,
    "src/battle/duel/presets/decks/player.ydk",
    "freeplay-player",
  );
  await put(
    root,
    "src/battle/duel/presets/decks/opponent.ydk",
    "freeplay-opponent",
  );
  return root;
}
async function put(
  root: string,
  relative: string,
  value: string,
): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value);
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("asset source restructure", () => {
  it("hashes every byte across 1 MiB chunks and a partial final chunk", async () => {
    const root = await workspace();
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 17);
    for (let index = 0; index < bytes.length; index++)
      bytes[index] = index % 251;
    const file = path.join(root, "chunked-hash.bin");
    await writeFile(file, bytes);
    expect(await hashFile(file)).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  });

  it("inventories every source, excludes vendor, copies with hashes, preserves originals", async () => {
    const root = await workspace();
    const planned = await planAssetRestructure(root);
    expect(planned.kind).toBe("ok");
    if (planned.kind !== "ok") return;
    expect(planned.value.files.length).toBeGreaterThan(20);
    expect(
      planned.value.files.some(({ source }) => source.startsWith("vendor/")),
    ).toBe(false);
    expect(
      planned.value.retained.map(({ path: retainedPath }) => retainedPath),
    ).toEqual([
      "content/README.md",
      "content/distribution-evidence.json",
      "content/duel-core/config.json",
      "content/freeplay/config.json",
      "content/freeplay/decks.json",
      "content/setup-evidence.json",
    ]);
    expect(planned.value.unknown).toEqual([]);
    const applied = await applyAssetRestructure(root, planned.value);
    expect(applied.kind).toBe("ok");
    if (applied.kind !== "ok") return;
    expect(applied.value.files).toEqual(planned.value.files);
    for (const file of planned.value.files) {
      expect(await readFile(path.join(root, file.source))).toEqual(
        await readFile(path.join(root, file.destination)),
      );
    }
    expect(
      await readFile(
        path.join(root, "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
        "utf8",
      ),
    ).toBe("vendor");
  });

  it("rejects differing destinations without clobbering", async () => {
    const root = await workspace();
    const planned = await planAssetRestructure(root);
    if (planned.kind !== "ok") throw new Error("plan failed");
    await put(root, "assets/app/app-icon.svg", "occupied");
    const result = await applyAssetRestructure(root, planned.value);
    expect(result).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_IDENTITY_CONFLICT",
        path: "assets/app/app-icon.svg",
      },
    });
    expect(
      await readFile(path.join(root, "assets/app/app-icon.svg"), "utf8"),
    ).toBe("occupied");
    expect(
      await readFile(path.join(root, "assets/core/app-icon.svg"), "utf8"),
    ).toBe("icon");
  });

  it("rejects identical destinations without ownership evidence", async () => {
    const root = await workspace();
    const planned = await planAssetRestructure(root);
    if (planned.kind !== "ok") throw new Error("plan failed");
    const first = planned.value.files[0]!;
    await put(
      root,
      first.destination,
      await readFile(path.join(root, first.source), "utf8"),
    );
    expect(await applyAssetRestructure(root, planned.value)).toEqual({
      kind: "failed",
      error: { code: "PACKAGE_IDENTITY_CONFLICT", path: first.destination },
    });
    expect(await readFile(path.join(root, first.destination))).toEqual(
      await readFile(path.join(root, first.source)),
    );
  });

  async function interrupted(linked = false) {
    const root = await workspace();
    const planned = await planAssetRestructure(root);
    if (planned.kind !== "ok") throw new Error("plan failed");
    const first = planned.value.files[0]!;
    const realLink = fs.link;
    vi.spyOn(fs, "link").mockImplementation(async (from, to) => {
      if (to === path.join(root, first.destination)) {
        if (linked) await realLink(from, to);
        throw Object.assign(new Error("fixture interruption"), { code: "EIO" });
      }
      return realLink(from, to);
    });
    expect((await applyAssetRestructure(root, planned.value)).kind).toBe(
      "failed",
    );
    vi.restoreAllMocks();
    const pending = JSON.parse(
      await readFile(path.join(root, pendingPath), "utf8"),
    );
    return { root, plan: planned.value, first, pending };
  }

  it.each([false, true])(
    "recovers genuine owned interruption, linked=%s",
    async (linked) => {
      const { root, plan, pending } = await interrupted(linked);
      expect((await applyAssetRestructure(root, plan)).kind).toBe("ok");
      await expect(
        readFile(path.join(root, pendingPath)),
      ).rejects.toMatchObject({ code: "ENOENT" });
      await expect(
        readFile(path.join(root, pending.temp)),
      ).rejects.toMatchObject({ code: "ENOENT" });
      const before = await readFile(path.join(root, receiptPath));
      expect((await applyAssetRestructure(root, plan)).kind).toBe("ok");
      expect(await readFile(path.join(root, receiptPath))).toEqual(before);
      for (const file of plan.files)
        expect(await hashFile(path.join(root, file.destination))).toBe(
          await hashFile(path.join(root, file.source)),
        );
    },
  );

  it("resumes verified partial owned copy without deleting original", async () => {
    const { root, plan, first, pending } = await interrupted();
    await truncate(path.join(root, pending.temp), 2);
    expect((await applyAssetRestructure(root, plan)).kind).toBe("ok");
    expect(await hashFile(path.join(root, first.destination))).toBe(
      first.sha256,
    );
    expect(await hashFile(path.join(root, first.source))).toBe(first.sha256);
  });

  it.each([
    "schema",
    "plan",
    "mapping",
    "temp",
    "inode",
    "hash",
    "extra",
    "symlink",
    "parent-symlink",
  ])("preserves forged pending state: %s", async (kind) => {
    const { root, plan, pending } = await interrupted();
    const originalTemp = path.join(root, pending.temp);
    const tempBytes = await readFile(originalTemp);
    if (kind === "schema") pending.schemaVersion = 99;
    if (kind === "plan") pending.planSha256 = "0".repeat(64);
    if (kind === "mapping") pending.destination = "assets/app/unrelated.svg";
    if (kind === "temp") pending.temp = "../unrelated";
    if (kind === "inode") pending.ino = "0";
    if (kind === "hash") await writeFile(originalTemp, "corrupt");
    if (kind === "extra") pending.unrecognized = true;
    await put(root, pendingPath, JSON.stringify(pending));
    if (kind === "symlink") {
      await put(root, "unrelated.json", JSON.stringify(pending));
      await rm(path.join(root, pendingPath));
      await symlink(
        path.join(root, "unrelated.json"),
        path.join(root, pendingPath),
      );
    }
    if (kind === "parent-symlink") {
      await fs.rename(
        path.join(root, "generated/content-packages"),
        path.join(root, "unrelated-directory"),
      );
      await symlink(
        path.join(root, "unrelated-directory"),
        path.join(root, "generated/content-packages"),
      );
    }
    const before = await readFile(path.join(root, pendingPath));
    expect((await applyAssetRestructure(root, plan)).kind).toBe("failed");
    expect(await readFile(path.join(root, pendingPath))).toEqual(before);
    expect(await readFile(originalTemp)).toEqual(
      kind === "hash" ? Buffer.from("corrupt") : tempBytes,
    );
  });

  it("preserves unrelated pending and completed receipt files", async () => {
    for (const relative of [pendingPath, receiptPath]) {
      const root = await workspace();
      const planned = await planAssetRestructure(root);
      if (planned.kind !== "ok") throw new Error("plan failed");
      await put(root, relative, "unrelated user bytes");
      expect((await applyAssetRestructure(root, planned.value)).kind).toBe(
        "failed",
      );
      expect(await readFile(path.join(root, relative), "utf8")).toBe(
        "unrelated user bytes",
      );
    }
  });
  it.each([false, true])(
    "recovers after completed receipt, temp removed=%s",
    async (removed) => {
      const { root, plan, pending } = await interrupted();
      const actual = fs.unlink;
      vi.spyOn(fs, "unlink").mockImplementation(async (file) => {
        if (file === path.join(root, removed ? pendingPath : pending.temp))
          throw Object.assign(new Error("fixture cleanup interruption"), {
            code: "EIO",
          });
        return actual(file);
      });
      expect((await applyAssetRestructure(root, plan)).kind).toBe("failed");
      const receipt = JSON.parse(
        await readFile(path.join(root, receiptPath), "utf8"),
      );
      expect(receipt.files).toHaveLength(1);
      vi.restoreAllMocks();
      expect((await applyAssetRestructure(root, plan)).kind).toBe("ok");
    },
  );

  it("preserves fully matching legacy completed receipt byte-identically", async () => {
    const root = await workspace();
    const planned = await planAssetRestructure(root);
    if (planned.kind !== "ok") throw new Error("plan failed");
    expect((await applyAssetRestructure(root, planned.value)).kind).toBe("ok");
    const value = JSON.parse(
      await readFile(path.join(root, receiptPath), "utf8"),
    );
    delete value.planSha256;
    await put(root, receiptPath, JSON.stringify(value));
    const before = await readFile(path.join(root, receiptPath));
    expect((await applyAssetRestructure(root, planned.value)).kind).toBe("ok");
    expect(await readFile(path.join(root, receiptPath))).toEqual(before);
  });

  it("rejects forged out-of-order pending without copying or consuming it", async () => {
    const { root, plan, pending } = await interrupted();
    const next = plan.files[1]!;
    const oldTemp = path.join(root, pending.temp);
    pending.temp = `${next.destination}.asset-copy-${pending.temp.split(".asset-copy-")[1]}`;
    pending.source = next.source;
    pending.destination = next.destination;
    pending.sha256 = next.sha256;
    await mkdir(path.dirname(path.join(root, pending.temp)), {
      recursive: true,
    });
    await fs.rename(oldTemp, path.join(root, pending.temp));
    await writeFile(
      path.join(root, pending.temp),
      await readFile(path.join(root, next.source)),
    );
    await put(root, pendingPath, JSON.stringify(pending));
    const before = await readFile(path.join(root, pendingPath));
    expect((await applyAssetRestructure(root, plan)).kind).toBe("failed");
    expect(await readFile(path.join(root, pendingPath))).toEqual(before);
    await expect(
      readFile(path.join(root, next.destination)),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["source", "destination", "temp"])(
    "rejects symlink at %s without consuming pending",
    async (which) => {
      const { root, plan, pending } = await interrupted();
      const relative = pending[which];
      const bytes = await readFile(path.join(root, pending.source));
      await put(root, "unrelated-target", bytes.toString());
      if (which !== "destination") await rm(path.join(root, relative));
      await symlink(
        path.join(root, "unrelated-target"),
        path.join(root, relative),
      );
      const before = await readFile(path.join(root, pendingPath));
      expect((await applyAssetRestructure(root, plan)).kind).toBe("failed");
      expect(await readFile(path.join(root, pendingPath))).toEqual(before);
      expect(await readFile(path.join(root, "unrelated-target"))).toEqual(
        bytes,
      );
    },
  );

  it("rejects same-byte replacement temp with different inode", async () => {
    const { root, plan, pending } = await interrupted();
    const temp = path.join(root, pending.temp);
    const bytes = await readFile(temp);
    await fs.rename(temp, `${temp}.original`);
    await writeFile(temp, bytes, { mode: 0o600 });
    const before = await readFile(path.join(root, pendingPath));
    expect((await applyAssetRestructure(root, plan)).kind).toBe("failed");
    expect(await readFile(path.join(root, pendingPath))).toEqual(before);
    expect(await readFile(temp)).toEqual(bytes);
    expect(await readFile(`${temp}.original`)).toEqual(bytes);
  });

  it("rejects forged plan ownership before copying", async () => {
    const root = await workspace();
    const planned = await planAssetRestructure(root);
    if (planned.kind !== "ok") throw new Error("plan failed");
    const plan = {
      ...planned.value,
      files: planned.value.files.map((file, index) =>
        index ? file : { ...file, ownership: "app" as const },
      ),
    };
    expect(await applyAssetRestructure(root, plan)).toEqual({
      kind: "failed",
      error: { code: "PACKAGE_INVALID" },
    });
  });
  it("recovers pending publication interruption without deleting metadata alias", async () => {
    const root = await workspace();
    const planned = await planAssetRestructure(root);
    if (planned.kind !== "ok") throw new Error("plan failed");
    const actual = fs.unlink;
    vi.spyOn(fs, "unlink").mockImplementation(async (file) => {
      if (String(file).startsWith(path.join(root, `${pendingPath}.`)))
        throw Object.assign(new Error("fixture publication interruption"), {
          code: "EIO",
        });
      return actual(file);
    });
    expect((await applyAssetRestructure(root, planned.value)).kind).toBe(
      "failed",
    );
    vi.restoreAllMocks();
    const directory = path.join(root, "generated/content-packages");
    const alias = (await fs.readdir(directory)).find(
      (name) =>
        name.startsWith("asset-move-pending.json.") && name.endsWith(".tmp"),
    )!;
    const before = await readFile(path.join(directory, alias));
    expect((await applyAssetRestructure(root, planned.value)).kind).toBe("ok");
    expect(await readFile(path.join(directory, alias))).toEqual(before);
  });
});
