import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ESLint } from "eslint";
import {
  AssetDeliveryError,
  failureResult,
} from "../scripts/lib/asset-delivery/failure.ts";

import {
  assertSafePath,
  assertManagedPath,
  assertNoPathCollisions,
  assertSafeParents,
} from "../scripts/lib/asset-delivery/path-guards.ts";

import { parseAssetProfile } from "../scripts/lib/asset-delivery/asset-profile.ts";
import { acquireAssetDeliveryLock } from "../scripts/lib/asset-delivery/local-lock.ts";

import {
  canonicalBytes,
  compareCodePoints,
  MAX_METADATA_BYTES,
  parseJsonBytes,
} from "../scripts/lib/asset-delivery/canonical-json.ts";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

test("canonical metadata smoke: compact UTF-8 plus LF", () => {
  assert.equal(
    new TextDecoder().decode(canonicalBytes({ schemaVersion: 1 })),
    '{"schemaVersion":1}\n',
  );
});

const sha = "a".repeat(64);
const failure = (code: string) => (error: unknown) =>
  error instanceof AssetDeliveryError &&
  error.code === code &&
  error.message === code;
async function fixture(t: test.TestContext): Promise<string> {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/asset-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("canonical metadata rejects ambiguity; code-point sorted keys, not insertion or UTF-16 order", () => {
  const first = { "𐀀": 3, "\ue000": 2, "2": 4, "10": 1 };
  assert.equal(
    Buffer.from(canonicalBytes(first)).toString(),
    '{"10":1,"2":4,"\ue000":2,"𐀀":3}\n',
  );
  assert.deepEqual(
    canonicalBytes({ z: 2, a: { d: 4, b: 3 } }),
    canonicalBytes({ a: { b: 3, d: 4 }, z: 2 }),
  );
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const bad of [
    undefined,
    NaN,
    Infinity,
    1n,
    new Date(),
    { a: undefined },
    [undefined],
    Array(1),
    { a: () => 1 },
    cycle,
    "\ud800",
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(() => canonicalBytes(bad), failure("ASSET_CONFIG_INVALID"));
});

test("cross-platform managed paths reject traversal, devices, forbidden roots, aliases", () => {
  assert.equal(
    assertManagedPath("assets/story/originals/é.psd"),
    "assets/story/originals/é.psd",
  );
  for (const bad of [
    "/a",
    "a/../b",
    "a/./b",
    "a//b",
    "a\\b",
    "C:a",
    "a\0b",
    "a%20",
    "a?b",
    "a#b",
    "CON.jpg",
    "a/LPT9.psd",
    "a/COM¹.txt",
    "a. ",
    "a/",
    "a/aux",
    "a/*",
    "a/\u0001",
  ])
    assert.throws(() => assertSafePath(bad), failure("ASSET_PATH_UNSAFE"));
  for (const bad of [
    "vendor/ocgcore-wasm/a",
    "assets/unknown/a",
    "assets/story/.env",
    "assets/story/.env.local",
    "assets/story/node_modules/a",
    "assets/story/.git/config",
    "assets/shared/key.pem",
  ])
    assert.throws(() => assertManagedPath(bad), failure("ASSET_PATH_UNSAFE"));
  for (const files of [
    ["A/a", "a/b"],
    ["A", "a"],
    ["é", "e\u0301"],
    ["dir", "dir/file"],
    ["a", "a"],
  ])
    assert.throws(
      () => assertNoPathCollisions(files),
      failure("ASSET_PATH_UNSAFE"),
    );
  assertNoPathCollisions(["a/x", "a/y"]);
  assert.equal(assertSafePath("", true), "");
  assert.throws(() => assertSafePath(""), failure("ASSET_PATH_UNSAFE"));
});

test("parent guards reject links before writes; lock serializes common namespace", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "outside"));
  await mkdir(path.join(root, "assets"));
  await symlink(
    path.join(root, "outside"),
    path.join(root, "assets/story"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    assertSafeParents(root, "assets/story/new.psd"),
    failure("ASSET_PATH_UNSAFE"),
  );
  const release = await acquireAssetDeliveryLock(root);
  await assert.rejects(acquireAssetDeliveryLock(root), failure("ASSET_BUSY"));
  await release();
  await (
    await acquireAssetDeliveryLock(root)
  )();
  await writeFile(
    path.join(root, "generated/.locks/asset-delivery"),
    "interrupted",
  );
  await assert.rejects(acquireAssetDeliveryLock(root), failure("ASSET_BUSY"));
});

test("Node SDK imports rejected from browser modules, including dynamic import", async () => {
  const eslint = new ESLint();
  for (const code of [
    'import { S3Client } from "@aws-sdk/client-s3"; void S3Client;',
    'void import("@aws-sdk/lib-storage");',
    'export * from "../../scripts/lib/asset-delivery/source-files.ts";',
  ]) {
    const [result] = await eslint.lintText(code, {
      filePath: "src/shell/asset-boundary-fixture.ts",
    });
    assert(
      result!.messages.some((m) =>
        m.message.includes("Node-only asset delivery"),
      ),
      JSON.stringify(result!.messages),
    );
  }
});

test("strict source profile rejects unknown keys", () => {
  const profile = {
    schemaVersion: 1,
    id: "core",
    dependsOn: [],
    rules: [
      { root: "shared", path: "fonts", kind: "tree", logicalPath: "fonts" },
    ],
  };
  assert.deepEqual(parseAssetProfile(profile), profile);
  assert.throws(
    () =>
      parseAssetProfile({
        ...profile,
        rules: [{ ...profile.rules[0], extra: 1 }],
      }),
    failure("ASSET_CONFIG_INVALID"),
  );
});

test("schema-defined sorted sets reject permutations without reordering arbitrary arrays", async () => {
  const { parseMigrationPlan } =
    await import("../scripts/lib/asset-delivery/migration-plan.ts");
  const rules = ["a", "b"].map((path) => ({
    root: "story",
    path,
    kind: "file",
    logicalPath: `story/${path}`,
  }));
  const profile = { schemaVersion: 1, id: "core", dependsOn: [], rules };
  assert.deepEqual(parseAssetProfile(profile), profile);
  assert.deepEqual(
    parseAssetProfile({ ...profile, rules: [rules[0], rules[0], rules[1]] }),
    profile,
  );
  assert.throws(
    () => parseAssetProfile({ ...profile, rules: [...rules].reverse() }),
    failure("ASSET_CONFIG_INVALID"),
  );
  const migration = {
    schemaVersion: 1,
    files: ["a", "b"].map((name) => ({
      from: `src/story/assets/${name}.svg`,
      to: `assets/story/${name}.svg`,
      bytes: 1,
      sha256: sha,
    })),
  };
  assert.deepEqual(parseMigrationPlan(migration), migration);
  assert.throws(
    () =>
      parseMigrationPlan({
        ...migration,
        files: [...migration.files].reverse(),
      }),
    failure("ASSET_CONFIG_INVALID"),
  );
  assert.equal(
    Buffer.from(canonicalBytes([2, 1, "b", "a"])).toString(),
    '[2,1,"b","a"]\n',
  );
  assert(compareCodePoints("\ue000", "𐀀") < 0);
});

test("caseless Unicode collision checks include capital sharp-S and normalized parent aliases", () => {
  for (const paths of [
    ["straße.psd", "STRAẞE.psd"],
    ["straße.psd", "STRASSE.psd"],
    ["café/straße.psd", "cafe\u0301/STRAẞE.psd"],
    ["straße/a.psd", "STRAẞE/b.psd"],
    ["straẞe", "STRASSE/b.psd"],
    ["σ.psd", "ς.psd"],
  ]) {
    assert.throws(
      () => assertNoPathCollisions(paths),
      failure("ASSET_PATH_UNSAFE"),
    );
    assert.throws(
      () => assertNoPathCollisions([...paths].reverse()),
      failure("ASSET_PATH_UNSAFE"),
    );
  }
  assertNoPathCollisions([
    "straße/a.psd",
    "straße/b.psd",
    "café.psd",
    "cafe.psd",
  ]);
});

test("lock ENOSPC at mkdir/open/write/sync is expected disk-full; handles close and residue remains busy", async (t) => {
  for (const stage of ["mkdir", "open", "writeFile", "sync"] as const) {
    await t.test(stage, async (t) => {
      const root = await fixture(t);
      const originalOpen = fs.open;
      const diskFull = () =>
        Object.assign(new Error("injected disk-full"), { code: "ENOSPC" });
      let opened: Awaited<ReturnType<typeof fs.open>> | undefined;
      let closed = 0;
      const injected =
        stage === "mkdir"
          ? t.mock.method(fs, "mkdir", async () => {
              throw diskFull();
            })
          : t.mock.method(
              fs,
              "open",
              async (...args: Parameters<typeof fs.open>) => {
                if (stage === "open") throw diskFull();
                const handle = await originalOpen(...args);
                opened = handle;
                const close = handle.close.bind(handle);
                t.mock.method(handle, "close", async () => {
                  closed++;
                  await close();
                });
                t.mock.method(handle, stage, async () => {
                  throw diskFull();
                });
                return handle;
              },
            );
      syncBuiltinESMExports();
      try {
        await assert.rejects(
          acquireAssetDeliveryLock(root),
          (error: unknown) => {
            assert.deepEqual(failureResult(error), {
              result: { status: "failed", code: "ASSET_DISK_FULL", path: null },
              exitCode: 2,
            });
            return true;
          },
        );
      } finally {
        injected.mock.restore();
        syncBuiltinESMExports();
      }
      if (stage === "writeFile" || stage === "sync") {
        assert.equal(closed, 1);
        assert.equal(opened!.fd, -1);
        assert(
          (
            await fs.lstat(path.join(root, "generated/.locks/asset-delivery"))
          ).isFile(),
        );
        await assert.rejects(
          acquireAssetDeliveryLock(root),
          failure("ASSET_BUSY"),
        );
      } else {
        assert.equal(closed, 0);
        await assert.rejects(
          fs.lstat(path.join(root, "generated/.locks/asset-delivery")),
          { code: "ENOENT" },
        );
      }
    });
  }
});

test("lock release ENOSPC preserves ownership for successful retry", async (t) => {
  const root = await fixture(t);
  const release = await acquireAssetDeliveryLock(root);
  const injected = t.mock.method(fs, "unlink", async () => {
    throw Object.assign(new Error("injected disk-full"), { code: "ENOSPC" });
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(release(), (error: unknown) => {
      assert.deepEqual(failureResult(error), {
        result: { status: "failed", code: "ASSET_DISK_FULL", path: null },
        exitCode: 2,
      });
      return true;
    });
  } finally {
    injected.mock.restore();
    syncBuiltinESMExports();
  }
  await assert.rejects(acquireAssetDeliveryLock(root), failure("ASSET_BUSY"));
  await release();
  const nextRelease = await acquireAssetDeliveryLock(root);
  await nextRelease();
});

test("source metadata rejects malformed bytes and oversized input", async () => {
  for (const bytes of [new Uint8Array([0xff]), new TextEncoder().encode("{")])
    assert.throws(() => parseJsonBytes(bytes), failure("ASSET_CONFIG_INVALID"));
  assert.throws(
    () => parseJsonBytes(new Uint8Array(MAX_METADATA_BYTES + 1)),
    failure("ASSET_LIMIT_EXCEEDED"),
  );
});

test("canonical cumulative budget rejects wide metadata before oversized joins or UTF-8 output allocation", (t) => {
  let encodes = 0;
  let maxJoinBytes = 0;
  const originalEncode = TextEncoder.prototype.encode;
  t.mock.method(
    TextEncoder.prototype,
    "encode",
    function (this: TextEncoder, input?: string) {
      encodes++;
      return originalEncode.call(this, input);
    },
  );
  const joinDescriptor = Object.getOwnPropertyDescriptor(
    Array.prototype,
    "join",
  )!;
  t.after(() => Object.defineProperty(Array.prototype, "join", joinDescriptor));
  Object.defineProperty(Array.prototype, "join", {
    ...joinDescriptor,
    value: new Proxy(Array.prototype.join, {
      apply(target, receiver, args) {
        const joined = Reflect.apply(target, receiver, args) as string;
        maxJoinBytes = Math.max(maxJoinBytes, Buffer.byteLength(joined));
        return joined;
      },
    }),
  });
  assert.throws(
    () => canonicalBytes(Array(100_000).fill("x".repeat(512))),
    failure("ASSET_LIMIT_EXCEEDED"),
  );
  assert.equal(encodes, 0);
  assert(maxJoinBytes <= MAX_METADATA_BYTES, `oversized join: ${maxJoinBytes}`);
});

test("canonical single-string budget accounts for UTF-8 and JSON escaping before stringify", async (t) => {
  for (const [character, count] of [
    ["x", MAX_METADATA_BYTES],
    ["é", MAX_METADATA_BYTES / 2],
    ["𐀀", MAX_METADATA_BYTES / 4],
    ["\u0001", Math.ceil(MAX_METADATA_BYTES / 6)],
    ['"', MAX_METADATA_BYTES / 2],
  ] as const) {
    await t.test(JSON.stringify(character), (t) => {
      const value = character.repeat(count);
      let stringified = false;
      t.mock.method(
        JSON,
        "stringify",
        new Proxy(JSON.stringify, {
          apply(target, receiver, args) {
            if (args[0] === value) stringified = true;
            return Reflect.apply(target, receiver, args);
          },
        }),
      );
      assert.throws(
        () => canonicalBytes(value),
        failure("ASSET_LIMIT_EXCEEDED"),
      );
      assert.equal(stringified, false);
    });
  }
});

test("canonical exact byte cap includes delimiters/LF; escaping and Unicode bytes stay exact", () => {
  const bytes = canonicalBytes("x".repeat(MAX_METADATA_BYTES - 3));
  assert.equal(bytes.length, MAX_METADATA_BYTES);
  assert.equal(bytes[0], 0x22);
  assert.equal(bytes.at(-2), 0x22);
  assert.equal(bytes.at(-1), 0x0a);
  assert.throws(
    () => canonicalBytes("x".repeat(MAX_METADATA_BYTES - 2)),
    failure("ASSET_LIMIT_EXCEEDED"),
  );
  const small = {
    a: [null, true, false, -0, 0.5, '\u0000\b\t\n\f\r"\\é𐀀'],
    b: { "\ue000": 1, "𐀀": 2 },
  };
  assert.equal(
    Buffer.from(canonicalBytes(small)).toString(),
    `${JSON.stringify(small)}\n`,
  );
});

import {
  schemaFixtures,
  parserNames,
} from "./fixtures/asset-delivery-contracts.ts";

for (const [name, value] of Object.entries(schemaFixtures)) {
  test(`strict ${name}: exact schema, reject unknown keys and unsafe nested integers`, async () => {
    const module = await import(`../scripts/lib/asset-delivery/${name}.ts`);
    const parse = module[parserNames[name as keyof typeof schemaFixtures]] as (
      v: unknown,
    ) => unknown;
    assert.equal(typeof parse, "function");
    assert.deepEqual(parse(value), value);
    assert.throws(
      () => parse({ ...value, unknown: true }),
      failure("ASSET_CONFIG_INVALID"),
    );
    assert.throws(() => parse(null), failure("ASSET_CONFIG_INVALID"));
    const corrupt = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(corrupt);
      if (input !== null && typeof input === "object")
        return Object.fromEntries(
          Object.entries(input).map(([key, item]) => [
            key,
            key === "bytes" ? Number.MAX_SAFE_INTEGER + 1 : corrupt(item),
          ]),
        );
      return input;
    };
    if (JSON.stringify(value).includes('"bytes":'))
      assert.throws(
        () => parse(corrupt(value)),
        failure("ASSET_CONFIG_INVALID"),
      );
  });
}
