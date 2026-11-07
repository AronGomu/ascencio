import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { acquireAssetDeliveryLock } from "../../scripts/lib/asset-delivery/local-lock.ts";
import {
  previewMigration,
  applyMigration,
} from "../../scripts/lib/asset-delivery/migrate.ts";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const digest = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function put(root: string, file: string, bytes: string | Uint8Array) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), bytes);
}
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  await mkdir(path.join(repo, ".tmp"), { recursive: true });
  const root = await mkdtemp(path.join(repo, ".tmp/migration-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, "package.json", '{"version":"0.1.0"}');
  return root;
}

test("Migration collision: preview/apply preserve every original and reject differing destinations before first copy", async (t) => {
  const root = await fixture(t);
  await put(root, "generated/assets/current/a.json", "a");
  await put(root, "generated/set-images/z.jpg", "z");
  const plan = await previewMigration(root);
  assert.equal(plan.files.length, 2);
  await put(root, "assets/shared/set-images/z.jpg", "edited");
  await assert.rejects(previewMigration(root), {
    message: "ASSET_LOCAL_CONFLICT",
  });
  await assert.rejects(applyMigration(root, plan), {
    message: "ASSET_LOCAL_CONFLICT",
  });
  await assert.rejects(
    readFile(path.join(root, "assets/shared/data/current/a.json")),
    { code: "ENOENT" },
  );
  assert.equal(
    await readFile(path.join(root, "generated/set-images/z.jpg"), "utf8"),
    "z",
  );
  assert.equal(
    await readFile(path.join(root, "assets/shared/set-images/z.jpg"), "utf8"),
    "edited",
  );
});

test("Migration source hash and membership guards reject changes; no receipt or copied bytes", async (t) => {
  const root = await fixture(t);
  await put(root, "generated/set-images/a.jpg", "a");
  const plan = await previewMigration(root);
  await put(root, "generated/set-images/a.jpg", "b");
  await assert.rejects(applyMigration(root, plan), {
    message: "ASSET_SOURCE_CHANGED",
  });
  await put(root, "generated/set-images/a.jpg", "a");
  await put(root, "generated/set-images/b.jpg", "b");
  await assert.rejects(applyMigration(root, plan), {
    message: "ASSET_SOURCE_CHANGED",
  });
  await assert.rejects(
    readFile(
      path.join(root, "generated/asset-delivery/migration-receipt.json"),
    ),
    { code: "ENOENT" },
  );
});

test("Migration retry adopts crash output without receipt; source mutation never overwritten", async (t) => {
  const root = await fixture(t);
  await put(root, "generated/set-images/a.jpg", "a");
  const plan = await previewMigration(root);
  await put(root, "assets/shared/set-images/a.jpg", "a");
  const receipt = await applyMigration(root, plan);
  assert.equal(receipt.completed[0]?.sha256, digest("a"));
  assert.equal(
    await readFile(path.join(root, "generated/set-images/a.jpg"), "utf8"),
    "a",
  );
});

test("Public Node CLI help/invalid flags emit exact final AssetResult and exit status", () => {
  for (const script of ["migrate-assets"]) {
    const help = spawnSync(
      process.execPath,
      [path.join(repo, `scripts/${script}.ts`), "--help"],
      { encoding: "utf8" },
    );
    assert.equal(help.status, 0, help.stderr);
    assert.equal(JSON.parse(help.stdout).status, "ok");
    for (const args of [["--wat"], ["--help", "--wat"]]) {
      const bad = spawnSync(
        process.execPath,
        [path.join(repo, `scripts/${script}.ts`), ...args],
        { encoding: "utf8" },
      );
      assert.equal(bad.status, 2, bad.stderr);
      assert.deepEqual(JSON.parse(bad.stdout), {
        status: "failed",
        code: "ASSET_ARGUMENT_INVALID",
        path: null,
      });
    }
  }
});

test("Migration race: destination appears at exclusive install, differing bytes survive", async (t) => {
  const { default: fs } = await import("node:fs/promises");
  const { syncBuiltinESMExports } = await import("node:module");
  const root = await fixture(t);
  await put(root, "generated/set-images/a.jpg", "incoming");
  const plan = await previewMigration(root);
  const original = fs.link;
  fs.link = async (from, to) => {
    await writeFile(to, "author-edit");
    return original(from, to);
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(applyMigration(root, plan), {
      message: "ASSET_LOCAL_CONFLICT",
    });
  } finally {
    fs.link = original;
    syncBuiltinESMExports();
  }
  assert.equal(
    await readFile(path.join(root, "assets/shared/set-images/a.jpg"), "utf8"),
    "author-edit",
  );
  assert.deepEqual(await readdir(path.join(root, "assets/shared/set-images")), [
    "a.jpg",
  ]);
});

test("Migration copy guard detects external source mutation, removes own temp, leaves originals", async (t) => {
  const { default: fs } = await import("node:fs/promises");
  const { syncBuiltinESMExports } = await import("node:module");
  const root = await fixture(t);
  await put(root, "generated/set-images/a.jpg", "incoming");
  const plan = await previewMigration(root);
  const original = fs.open;
  fs.open = async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args);
    if (path.basename(String(args[0])).startsWith(".m-") && args[1] === "wx") {
      const write = handle.write.bind(handle);
      handle.write = (async (
        buffer: Buffer,
        offset: number,
        length: number,
        position: number,
      ) => {
        const result = await write(buffer, offset, length, position);
        await writeFile(
          path.join(root, "generated/set-images/a.jpg"),
          "author-edit",
        );
        return result;
      }) as typeof handle.write;
    }
    return handle;
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(applyMigration(root, plan), {
      message: "ASSET_SOURCE_CHANGED",
    });
  } finally {
    fs.open = original;
    syncBuiltinESMExports();
  }
  assert.equal(
    await readFile(path.join(root, "generated/set-images/a.jpg"), "utf8"),
    "author-edit",
  );
  assert.deepEqual(
    await readdir(path.join(root, "assets/shared/set-images")),
    [],
  );
});

test("Migration filesystem without exclusive hardlinks fails closed, no rename fallback", async (t) => {
  const { default: fs } = await import("node:fs/promises");
  const { syncBuiltinESMExports } = await import("node:module");
  const root = await fixture(t);
  await put(root, "generated/set-images/a.jpg", "a");
  const plan = await previewMigration(root);
  const original = fs.link;
  fs.link = async () => {
    throw Object.assign(new Error("unsupported"), { code: "ENOTSUP" });
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(applyMigration(root, plan), {
      message: "ASSET_LOCAL_CONFLICT",
    });
  } finally {
    fs.link = original;
    syncBuiltinESMExports();
  }
  assert.deepEqual(
    await readdir(path.join(root, "assets/shared/set-images")),
    [],
  );
});

test("Migration crash before/after link and before receipt is retryable after explicit stale-lock recovery", async (t) => {
  for (const phase of ["copy", "link", "receipt"]) {
    const root = await fixture(t);
    await put(root, "generated/assets/current/a.json", "a");
    const plan = await previewMigration(root);
    const clean = await fixture(t);
    await put(clean, "generated/assets/current/a.json", "a");
    const expected = await applyMigration(clean, await previewMigration(clean));
    const script = `
      import fs from 'node:fs/promises';
      import { syncBuiltinESMExports } from 'node:module';
      import { applyMigration } from ${JSON.stringify(new URL("../../scripts/lib/asset-delivery/migrate.ts", import.meta.url).href)};
      const phase=${JSON.stringify(phase)};
      const open=fs.open;
      fs.open=async(...args)=>{
        const handle=await open(...args);
        if(phase==='copy' && args[1]==='wx' && /\\/\\.m-[^/]+$/.test(String(args[0]).replaceAll('\\\\','/'))) {
          const write=handle.write.bind(handle);
          handle.write=async(...values)=>{ await write(...values); process.exit(73); };
        }
        return handle;
      };
      const method=phase==='link'?'link':'rename', original=fs[method];
      fs[method]=async(...args)=>{ if(phase!=='link') { if(phase==='receipt' && String(args[1]).replaceAll('\\\\','/').endsWith('/migration-receipt.json')) process.exit(73); return original(...args); } await original(...args); process.exit(73); };
      syncBuiltinESMExports();
      await applyMigration(${JSON.stringify(root)},${JSON.stringify(plan)});
    `;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      { encoding: "utf8" },
    );
    assert.equal(child.status, 73, child.stderr);
    await assert.rejects(applyMigration(root, plan), { message: "ASSET_BUSY" });
    // Fixture-only owner recovery: child exited, remove only its exact known lock.
    await unlink(path.join(root, "generated/.locks/asset-delivery"));
    if (phase !== "receipt") {
      await assert.rejects(acquireAssetDeliveryLock(root), {
        message: "ASSET_RECOVERY_REQUIRED",
      });
      await assert.rejects(
        applyMigration(root, { schemaVersion: 1, files: [] }),
        { message: "ASSET_RECOVERY_REQUIRED" },
      );
    }
    const receipt = await applyMigration(root, plan);
    assert.equal(receipt.completed[0]?.sha256, digest("a"));
    assert.equal(
      await readFile(
        path.join(root, "generated/assets/current/a.json"),
        "utf8",
      ),
      "a",
    );
    assert.equal(
      await readFile(
        path.join(root, "assets/shared/data/current/a.json"),
        "utf8",
      ),
      "a",
    );
    assert.deepEqual(receipt, expected);
    assert.deepEqual(
      await readdir(path.join(root, "assets/shared/data/current")),
      ["a.json"],
    );
  }
});

test("Migration temp cleanup error is surfaced, receipt not claimed, retry adopts verified output", async (t) => {
  const { default: fs } = await import("node:fs/promises");
  const { syncBuiltinESMExports } = await import("node:module");
  const root = await fixture(t);
  await put(root, "generated/set-images/a.jpg", "a");
  const plan = await previewMigration(root);
  const original = fs.unlink;
  fs.unlink = async (file) => {
    if (
      path.basename(String(file)).startsWith(".m-") ||
      String(file).endsWith(".migration-tmp")
    )
      throw Object.assign(new Error("cleanup denied"), { code: "EPERM" });
    return original(file);
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(applyMigration(root, plan), { code: "EPERM" });
  } finally {
    fs.unlink = original;
    syncBuiltinESMExports();
  }
  await assert.rejects(
    readFile(
      path.join(root, "generated/asset-delivery/migration-receipt.json"),
    ),
    { code: "ENOENT" },
  );
  assert.equal((await applyMigration(root, plan)).completed.length, 1);
});

test("CLI distinguishes expected disk/permission errors from unexpected faults without raw error leakage", async () => {
  const { assetCli } = await import("../../scripts/lib/asset-delivery/cli.ts");
  for (const [code, expected, exit] of [
    ["ENOSPC", "ASSET_DISK_FULL", 2],
    ["EPERM", "ASSET_LOCAL_CONFLICT", 2],
    ["UNKNOWN", "ASSET_CONFIG_INVALID", 1],
  ] as const) {
    const lines: string[] = [];
    const result = await assetCli(
      "migrate",
      async () => {
        throw Object.assign(new Error("raw-private-detail"), { code });
      },
      (line) => lines.push(line),
    );
    assert.equal(result, exit);
    assert.deepEqual(JSON.parse(lines[0]!), {
      status: "failed",
      code: expected,
      path: null,
    });
    assert.ok(!lines.join().includes("raw-private-detail"));
  }
});

test("Migration preflight rejects empty-directory case/Unicode aliases before any copy", async (t) => {
  for (const [old, existing] of [
    ["src/story/assets/é/test.svg", "assets/story/é"],
  ]) {
    const root = await fixture(t);
    await put(root, "generated/assets/current/a.json", "a");
    await put(root, old!, "source");
    const plan = await previewMigration(root);
    await mkdir(path.join(root, existing!), { recursive: true });
    await assert.rejects(previewMigration(root), {
      message: "ASSET_PATH_UNSAFE",
    });
    await assert.rejects(applyMigration(root, plan), {
      message: "ASSET_PATH_UNSAFE",
    });
    await assert.rejects(
      readFile(path.join(root, "assets/shared/data/current/a.json")),
      { code: "ENOENT" },
    );
    assert.deepEqual(await readdir(path.join(root, existing!)), []);
    assert.equal(await readFile(path.join(root, old!), "utf8"), "source");
  }
});

test("Migration independent temp supports long basenames and preflights derived 512-byte boundary", async (t) => {
  const root = await fixture(t);
  const long = `${"z".repeat(220)}.jpg`;
  await put(root, "generated/set-images/a.jpg", "a");
  await put(root, `generated/set-images/${long}`, "long");
  const plan = await previewMigration(root);
  assert.equal((await applyMigration(root, plan)).completed.length, 2);
  assert.deepEqual(await readdir(path.join(root, "assets/shared/set-images")), [
    "a.jpg",
    long,
  ]);
  for (const parentBytes of [472, 473]) {
    const fixtureRoot = await fixture(t);
    // Temp basename is 39 bytes, independent of the destination basename.
    const prefix = "assets/story/";
    const parents = `${"p".repeat(220)}/${"q".repeat(parentBytes - prefix.length - 221)}`;
    const from = `src/story/assets/${parents}/x`;
    await put(fixtureRoot, from, "x");
    await put(fixtureRoot, "generated/assets/current/a.json", "a");
    if (parentBytes === 472) {
      const accepted = await previewMigration(fixtureRoot);
      await applyMigration(fixtureRoot, accepted);
      assert.equal(
        await readFile(
          path.join(fixtureRoot, `assets/story/${parents}/x`),
          "utf8",
        ),
        "x",
      );
    } else {
      await assert.rejects(previewMigration(fixtureRoot), {
        message: "ASSET_PATH_UNSAFE",
      });
      await assert.rejects(
        readFile(path.join(fixtureRoot, "assets/shared/data/current/a.json")),
        { code: "ENOENT" },
      );
    }
  }
});

test("CLI nullish/non-Error throws still emit one final sanitized AssetResult", async () => {
  const { assetCli } = await import("../../scripts/lib/asset-delivery/cli.ts");
  for (const thrown of [null, undefined, "raw-private-detail", 17, {}]) {
    const lines: string[] = [];
    const exit = await assetCli(
      "migrate",
      async () => {
        throw thrown;
      },
      (line) => lines.push(line),
    );
    assert.equal(exit, 1);
    assert.deepEqual(
      lines.map((line) => JSON.parse(line)),
      [{ status: "failed", code: "ASSET_CONFIG_INVALID", path: null }],
    );
  }
});

test("Migration recovery leaves partial, replaced-inode and unknown temps untouched behind the gate", async (t) => {
  for (const phase of [
    "partial",
    "unknown",
    "replaced",
    "linked",
    "malformed",
  ]) {
    const root = await fixture(t);
    await put(root, "generated/assets/current/a.json", "complete");
    const plan = await previewMigration(root);
    const script = `
      import fs from 'node:fs/promises';
      import { syncBuiltinESMExports } from 'node:module';
      import { applyMigration } from ${JSON.stringify(new URL("../../scripts/lib/asset-delivery/migrate.ts", import.meta.url).href)};
      const phase=${JSON.stringify(phase)};
      const open=fs.open;
      fs.open=async(...args)=>{
        const handle=await open(...args);
        if(args[1]==='wx' && /\\/\\.m-[^/]+$/.test(String(args[0]).replaceAll('\\\\','/'))) {
          if(phase==='unknown') process.exit(73);
          const write=handle.write.bind(handle);
          handle.write=async(buffer,offset,length,position)=>{
            await write(buffer,offset,phase==='partial'?3:length,position);
            process.exit(73);
          };
        }
        return handle;
      };
      syncBuiltinESMExports();
      await applyMigration(${JSON.stringify(root)},${JSON.stringify(plan)});
    `;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      { encoding: "utf8" },
    );
    assert.equal(child.status, 73, child.stderr);
    await unlink(path.join(root, "generated/.locks/asset-delivery"));
    const marker = "generated/asset-delivery/migration-pending.json";
    const pending = JSON.parse(
      await readFile(path.join(root, marker), "utf8"),
    ) as { temporary: string; identity: unknown };
    const temporary = path.join(root, pending.temporary);
    if (phase === "unknown") assert.equal(pending.identity, null);
    if (phase === "replaced") {
      const { open } = await import("node:fs/promises");
      const old = await open(temporary, "r");
      try {
        await unlink(temporary);
        await writeFile(temporary, "complete");
      } finally {
        await old.close();
      }
    }
    if (phase === "linked") {
      await unlink(temporary);
      await symlink(
        path.join(root, "generated/assets/current/a.json"),
        temporary,
      );
    }
    if (phase === "malformed") await put(root, marker, '{"unknown":true}');
    const markerBytes = await readFile(path.join(root, marker));
    const tempBytes = await readFile(temporary);
    for (let retry = 0; retry < 2; retry++) {
      await assert.rejects(applyMigration(root, plan), {
        message: "ASSET_RECOVERY_REQUIRED",
      });
      await assert.rejects(acquireAssetDeliveryLock(root), {
        message: "ASSET_RECOVERY_REQUIRED",
      });
      assert.deepEqual(await readFile(temporary), tempBytes);
      assert.deepEqual(await readFile(path.join(root, marker)), markerBytes);
      await assert.rejects(
        readFile(path.join(root, "generated/.locks/asset-delivery")),
        { code: "ENOENT" },
      );
    }
    assert.equal(
      await readFile(
        path.join(root, "generated/assets/current/a.json"),
        "utf8",
      ),
      "complete",
    );
    await assert.rejects(
      readFile(path.join(root, "assets/shared/data/current/a.json")),
      { code: "ENOENT" },
    );
  }
});

test("Unknown operational-shaped originals fail recovery without filename-based omission or deletion", async (t) => {
  for (const basename of [
    "a.json.00000000-0000-0000-0000-000000000000.migration-tmp",
    ".m-00000000-0000-0000-0000-000000000000",
  ]) {
    const root = await fixture(t);
    const file = `assets/shared/data/current/${basename}`;
    await put(root, file, "author-bytes");
    await assert.rejects(previewMigration(root), {
      message: "ASSET_RECOVERY_REQUIRED",
      path: file,
    });
    assert.equal(await readFile(path.join(root, file), "utf8"), "author-bytes");
  }
  const root = await fixture(t);
  await put(root, "assets/story/author.migration-tmp", "original");
  assert.deepEqual((await previewMigration(root)).files, []);
  assert.equal(
    await readFile(
      path.join(root, "assets/story/author.migration-tmp"),
      "utf8",
    ),
    "original",
  );
});

test("Owned migration handle preserves bounded partial writes on ENOSPC, EFBIG and zero progress", async (t) => {
  const { default: fs } = await import("node:fs/promises");
  const { syncBuiltinESMExports } = await import("node:module");
  for (const failure of ["ENOSPC", "EFBIG", "zero", "short-success"]) {
    const root = await fixture(t);
    const bytes = Buffer.from(
      Array.from({ length: 1024 * 1024 + 17 }, (_, i) => i % 251),
    );
    await put(root, "generated/assets/current/a.json", bytes);
    const plan = await previewMigration(root);
    const original = fs.open;
    let writes = 0;
    const handles: Awaited<ReturnType<typeof fs.open>>[] = [];
    fs.open = async (...args: Parameters<typeof fs.open>) => {
      const handle = await original(...args);
      const writable =
        typeof args[1] === "number"
          ? (args[1] & 3) !== 0
          : typeof args[1] === "string" && /[w+a]/.test(args[1]);
      if (path.basename(String(args[0])).startsWith(".m-") && writable) {
        handles.push(handle);
        const write = handle.write.bind(handle);
        handle.write = (async (
          buffer: Buffer,
          offset: number,
          length: number,
          position: number,
        ) => {
          writes++;
          assert.ok(length <= 1024 * 1024);
          if (writes === 3 && failure !== "short-success") {
            if (failure === "zero") return { bytesWritten: 0, buffer };
            throw Object.assign(new Error("injected write failure"), {
              code: failure,
            });
          }
          return write(buffer, offset, Math.min(length, 65_537), position);
        }) as typeof handle.write;
      }
      return handle;
    };
    syncBuiltinESMExports();
    try {
      if (failure === "short-success") await applyMigration(root, plan);
      else
        await assert.rejects(applyMigration(root, plan), {
          message: "ASSET_RECOVERY_REQUIRED",
        });
    } finally {
      fs.open = original;
      syncBuiltinESMExports();
    }
    assert.equal(handles.length, 1, "owned temp must not reopen or truncate");
    assert.equal(handles[0]!.fd, -1, "owned handle must close");
    assert.ok(writes >= 3);
    assert.deepEqual(
      await readFile(path.join(root, "generated/assets/current/a.json")),
      bytes,
    );
    const marker = path.join(
      root,
      "generated/asset-delivery/migration-pending.json",
    );
    if (failure === "short-success") {
      assert.deepEqual(
        await readFile(path.join(root, "assets/shared/data/current/a.json")),
        bytes,
      );
      await assert.rejects(readFile(marker), { code: "ENOENT" });
    } else {
      const markerBytes = await readFile(marker);
      const pending = JSON.parse(markerBytes.toString()) as {
        temporary: string;
      };
      const partial = await readFile(path.join(root, pending.temporary));
      assert.deepEqual(partial, bytes.subarray(0, 131_074));
      await assert.rejects(acquireAssetDeliveryLock(root), {
        message: "ASSET_RECOVERY_REQUIRED",
      });
      await assert.rejects(applyMigration(root, plan), {
        message: "ASSET_RECOVERY_REQUIRED",
      });
      assert.deepEqual(await readFile(marker), markerBytes);
      assert.deepEqual(
        await readFile(path.join(root, pending.temporary)),
        partial,
      );
      await assert.rejects(
        readFile(path.join(root, "assets/shared/data/current/a.json")),
        { code: "ENOENT" },
      );
    }
  }
});
