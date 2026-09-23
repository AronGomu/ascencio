import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  createCoreScratch,
  removeCoreScratch,
} from "../scripts/lib/core-source-scratch.ts";

async function fixture(t: TestContext) {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/core-scratch-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    root,
    scratch: path.join(root, ".tmp/core-source-only-test"),
    token: randomUUID(),
  };
}

test("fresh scratch has exclusive per-run ownership; failed build cleans only owned scratch", async (t) => {
  const { root, scratch, token } = await fixture(t);
  await createCoreScratch(root, "test", token);
  assert.equal(
    await readFile(path.join(scratch, ".core-source-only-owner"), "utf8"),
    token,
  );
  await assert.rejects(async () => {
    try {
      await writeFile(path.join(scratch, "build-output"), "partial");
      throw new Error("fixture build failed");
    } finally {
      await removeCoreScratch(root, "test", token);
    }
  }, /fixture build failed/);
  await assert.rejects(lstat(scratch), { code: "ENOENT" });
  await removeCoreScratch(root, "test", token);
});

test("existing unmarked scratch is rejected without claiming or deleting user bytes", async (t) => {
  const { root, scratch, token } = await fixture(t);
  await mkdir(scratch, { recursive: true });
  await writeFile(path.join(scratch, "user.txt"), "keep");
  await assert.rejects(
    createCoreScratch(root, "test", token),
    /Refusing to claim existing scratch/,
  );
  await assert.rejects(
    removeCoreScratch(root, "test", token),
    /Refusing to remove unowned scratch/,
  );
  assert.equal(await readFile(path.join(scratch, "user.txt"), "utf8"), "keep");
  await assert.rejects(lstat(path.join(scratch, ".core-source-only-owner")), {
    code: "ENOENT",
  });
});

test("old marker or another run token never grants cleanup ownership", async (t) => {
  const { root, scratch, token } = await fixture(t);
  await createCoreScratch(root, "test", token);
  await assert.rejects(
    createCoreScratch(root, "test", token),
    /Refusing to claim existing scratch/,
  );
  for (const marker of ["owned-by-core-source-only-harness\n", randomUUID()]) {
    await writeFile(path.join(scratch, ".core-source-only-owner"), marker);
    await assert.rejects(
      removeCoreScratch(root, "test", token),
      /Refusing to remove unowned scratch/,
    );
    assert.equal(
      await readFile(path.join(scratch, ".core-source-only-owner"), "utf8"),
      marker,
    );
  }
});

test("scratch, parent and marker symlinks never grant ownership", async (t) => {
  const { root, scratch, token } = await fixture(t);
  const target = path.join(root, "external");
  await mkdir(target);
  await writeFile(path.join(target, ".core-source-only-owner"), token);
  await symlink(target, path.join(root, ".tmp"), "dir");
  await assert.rejects(
    createCoreScratch(root, "test", token),
    /unsafe scratch parent/,
  );
  await assert.rejects(
    removeCoreScratch(root, "test", token),
    /unsafe scratch parent/,
  );
  await rm(path.join(root, ".tmp"));
  await mkdir(path.join(root, ".tmp"));
  await symlink(target, scratch, "dir");
  await assert.rejects(
    createCoreScratch(root, "test", token),
    /Refusing to claim existing scratch/,
  );
  await assert.rejects(
    removeCoreScratch(root, "test", token),
    /Refusing to remove unowned scratch/,
  );
  await rm(scratch);
  await mkdir(scratch);
  await symlink(
    path.join(target, ".core-source-only-owner"),
    path.join(scratch, ".core-source-only-owner"),
  );
  await assert.rejects(
    removeCoreScratch(root, "test", token),
    /Refusing to remove unowned scratch/,
  );
  assert.equal(
    await readFile(path.join(target, ".core-source-only-owner"), "utf8"),
    token,
  );
});

test("concurrent runs cannot claim or clean one another's scratch", async (t) => {
  const { root, token } = await fixture(t);
  const tokens = [token, randomUUID()];
  const results = await Promise.allSettled(
    tokens.map((value) => createCoreScratch(root, "test", value)),
  );
  const winner = results.findIndex((result) => result.status === "fulfilled");
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  await assert.rejects(
    removeCoreScratch(root, "test", tokens[1 - winner]!),
    /Refusing to remove unowned scratch/,
  );
  await removeCoreScratch(root, "test", tokens[winner]!);
});

test("invalid ids or missing run tokens cannot select scratch", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(
    createCoreScratch(root, "../escape", randomUUID()),
    /CORE_SOURCE_ID is invalid/,
  );
  await assert.rejects(
    createCoreScratch(root, "test", ""),
    /CORE_SOURCE_TOKEN is invalid/,
  );
});
