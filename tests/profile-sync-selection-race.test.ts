import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runProfileSync } from "../scripts/lib/asset-delivery/profile-sync.ts";

const repo = fileURLToPath(new URL("../", import.meta.url));

async function put(root: string, file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), `${JSON.stringify(value)}\n`);
}

test("profile sync rejects a nightly selection changed during its scan", async (t) => {
  await mkdir(path.join(repo, ".tmp"), { recursive: true });
  const root = await mkdtemp(path.join(repo, ".tmp/profile-sync-race-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, "package.json", { version: "0.1.0" });
  await put(root, "asset-profiles/nightly.json", {
    schemaVersion: 1,
    profiles: ["core"],
  });
  for (const id of ["core", "runtime"])
    await put(root, `asset-profiles/${id}.json`, {
      schemaVersion: 1,
      id,
      dependsOn: [],
      rules: [],
    });

  const originalLstat = fs.lstat;
  let changed = false;
  fs.lstat = (async (...args: Parameters<typeof fs.lstat>) => {
    if (!changed && String(args[0]) === path.join(root, "assets/battle")) {
      changed = true;
      await put(root, "asset-profiles/nightly.json", {
        schemaVersion: 1,
        profiles: ["runtime"],
      });
    }
    return originalLstat(...args);
  }) as typeof fs.lstat;
  syncBuiltinESMExports();
  try {
    assert.equal(await runProfileSync(root, []), 2);
  } finally {
    fs.lstat = originalLstat;
    syncBuiltinESMExports();
  }

  assert.equal(changed, true);
  await assert.rejects(
    readFile(path.join(root, "generated/asset-delivery/inventory.json")),
    { code: "ENOENT" },
  );
});
