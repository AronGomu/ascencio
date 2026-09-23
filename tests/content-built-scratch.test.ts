import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmod,
  cp,
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
import { promisify } from "node:util";
import config from "../playwright.content-built.config.ts";

const exec = promisify(execFile);
const markerText =
  "This CORE artifact has no public-distribution approval. Keep it private.\n";

async function fixture(t: TestContext) {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/content-built-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts/lib"), { recursive: true });
  for (const file of [
    "scripts/content-built-setup.ts",
    "scripts/content-built-teardown.ts",
    "scripts/lib/content-built-scratch.ts",
  ])
    await cp(file, path.join(root, file));
  await writeFile(path.join(root, "package.json"), '{"type":"module"}');
  return {
    root,
    scratch: path.join(root, ".tmp/t6-installed-built-subpath"),
    token: randomUUID(),
  };
}

function setup(root: string, token: string) {
  return exec(process.execPath, ["scripts/content-built-setup.ts"], {
    cwd: root,
    env: { ...process.env, CONTENT_BUILT_TOKEN: token },
  });
}

function teardown(root: string, token: string) {
  return exec(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "const { default: teardown } = await import('./scripts/content-built-teardown.ts'); await teardown();",
    ],
    { cwd: root, env: { ...process.env, CONTENT_BUILT_TOKEN: token } },
  );
}

test("ordinary build marker never authorizes private harness deletion", async (t) => {
  const { root, scratch, token } = await fixture(t);
  await mkdir(scratch, { recursive: true });
  await writeFile(
    path.join(scratch, "PRIVATE_DEPLOYMENT_ONLY.txt"),
    markerText,
  );
  await writeFile(path.join(scratch, "user.txt"), "keep");
  await assert.rejects(
    teardown(root, token),
    /Refusing to remove unowned scratch/,
  );
  assert.equal(await readFile(path.join(scratch, "user.txt"), "utf8"), "keep");
});

test("unmarked existing private scratch refuses teardown", async (t) => {
  const { root, scratch, token } = await fixture(t);
  await mkdir(scratch, { recursive: true });
  await writeFile(path.join(scratch, "user.txt"), "keep");
  await assert.rejects(
    teardown(root, token),
    /Refusing to remove unowned scratch/,
  );
  assert.equal(await readFile(path.join(scratch, "user.txt"), "utf8"), "keep");
});

test("private subpath server claims ownership before build; Vite and byte checks use nested output", async () => {
  assert.ok(Array.isArray(config.webServer));
  const server = config.webServer[1];
  assert.ok(server);
  assert.match(server.command, /^node scripts\/content-built-setup\.ts && /);
  assert.match(
    server.command,
    /--outDir \.tmp\/t6-installed-built-subpath\/dist/g,
  );
  assert.match(process.env.CONTENT_BUILT_TOKEN ?? "", /^[a-f0-9-]{36}$/);
  assert.match(
    await readFile("e2e-content/built-installer.spec.ts", "utf8"),
    /dist: "\.tmp\/t6-installed-built-subpath\/dist"/,
  );
});

test("existing scratch blocks configured server before any build command", async (t) => {
  const { root, scratch, token } = await fixture(t);
  await mkdir(scratch, { recursive: true });
  await writeFile(path.join(scratch, "user.txt"), "keep");
  await writeFile(
    path.join(scratch, "PRIVATE_DEPLOYMENT_ONLY.txt"),
    markerText,
  );
  const bin = await fixtureCommands(root);
  assert.ok(Array.isArray(config.webServer));
  await assert.rejects(
    exec("sh", ["-c", config.webServer[1]!.command], {
      cwd: root,
      env: {
        ...process.env,
        CONTENT_BUILT_TOKEN: token,
        PATH: `${bin}:${process.env.PATH}`,
      },
    }),
    /Refusing to claim existing scratch/,
  );
  await assert.rejects(lstat(path.join(root, "build-started")), {
    code: "ENOENT",
  });
  await assert.rejects(lstat(path.join(scratch, ".content-built-owner")), {
    code: "ENOENT",
  });
  assert.equal(await readFile(path.join(scratch, "user.txt"), "utf8"), "keep");
});

async function fixtureCommands(root: string, failBuild = false) {
  const bin = path.join(root, "bin");
  await mkdir(bin);
  const vite = path.resolve("node_modules/vite/bin/vite.js");
  await writeFile(
    path.join(bin, "npm"),
    `#!${process.execPath}
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
writeFileSync("build-started", "yes");
${failBuild ? "process.exit(7);" : `const result = spawnSync(process.execPath, [${JSON.stringify(vite)}, "build", ...process.argv.slice(5)], { stdio: "inherit" }); process.exit(result.status ?? 1);`}
`,
  );
  await writeFile(
    path.join(bin, "npx"),
    `#!${process.execPath}
import { writeFileSync } from "node:fs";
writeFileSync("preview-args.json", JSON.stringify(process.argv.slice(2)));
`,
  );
  for (const file of ["npm", "npx"]) await chmod(path.join(bin, file), 0o755);
  return bin;
}

test("configured setup, real disposable Vite build, exact-token teardown preserve ownership", async (t) => {
  const { root, scratch } = await fixture(t);
  const token = process.env.CONTENT_BUILT_TOKEN!;
  const bin = await fixtureCommands(root);
  await writeFile(
    path.join(root, "index.html"),
    "<html><body>Disposable fixture</body></html>",
  );
  assert.ok(Array.isArray(config.webServer));
  await exec("sh", ["-c", config.webServer[1]!.command], {
    cwd: root,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(
    await readFile(path.join(scratch, ".content-built-owner"), "utf8"),
    token,
  );
  assert.match(
    await readFile(path.join(scratch, "dist/index.html"), "utf8"),
    /Disposable fixture/,
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(root, "preview-args.json"), "utf8")),
    [
      "vite",
      "preview",
      "--outDir",
      ".tmp/t6-installed-built-subpath/dist",
      "--host",
      "127.0.0.1",
      "--port",
      "4404",
      "--strictPort",
    ],
  );
  await assert.rejects(
    teardown(root, randomUUID()),
    /Refusing to remove unowned scratch/,
  );
  await teardown(root, token);
  await assert.rejects(lstat(scratch), { code: "ENOENT" });
  await teardown(root, token);
});

test("failed configured build retains token for safe teardown; preview never starts", async (t) => {
  const { root, scratch, token } = await fixture(t);
  const bin = await fixtureCommands(root, true);
  assert.ok(Array.isArray(config.webServer));
  await assert.rejects(
    exec("sh", ["-c", config.webServer[1]!.command], {
      cwd: root,
      env: {
        ...process.env,
        CONTENT_BUILT_TOKEN: token,
        PATH: `${bin}:${process.env.PATH}`,
      },
    }),
    { code: 7 },
  );
  await assert.rejects(lstat(path.join(root, "preview-args.json")), {
    code: "ENOENT",
  });
  await teardown(root, token);
  await assert.rejects(lstat(scratch), { code: "ENOENT" });
});

test("stale and concurrent runs cannot claim or delete each other's private scratch", async (t) => {
  const { root, scratch, token } = await fixture(t);
  const tokens = [token, randomUUID()];
  const results = await Promise.allSettled(
    tokens.map((value) => setup(root, value)),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  const owner = await readFile(
    path.join(scratch, ".content-built-owner"),
    "utf8",
  );
  const foreign = tokens.find((value) => value !== owner)!;
  await assert.rejects(
    setup(root, owner),
    /Refusing to claim existing scratch/,
  );
  await assert.rejects(
    teardown(root, foreign),
    /Refusing to remove unowned scratch/,
  );
  await teardown(root, owner);
});

test("private scratch rejects symlink parent, directory and ownership marker", async (t) => {
  const { root, scratch, token } = await fixture(t);
  const outside = path.join(root, "outside");
  const marker = path.join(outside, ".content-built-owner");
  await mkdir(outside);
  await writeFile(marker, token);
  await writeFile(path.join(outside, "user.txt"), "keep");
  await symlink(outside, path.join(root, ".tmp"), "dir");
  await assert.rejects(setup(root, token), /unsafe scratch parent/);
  await assert.rejects(teardown(root, token), /unsafe scratch parent/);
  await rm(path.join(root, ".tmp"));
  await mkdir(path.join(root, ".tmp"));
  await symlink(outside, scratch, "dir");
  await assert.rejects(
    setup(root, token),
    /Refusing to claim existing scratch/,
  );
  await assert.rejects(
    teardown(root, token),
    /Refusing to remove unowned scratch/,
  );
  await rm(scratch);
  await mkdir(scratch);
  await symlink(marker, path.join(scratch, ".content-built-owner"));
  await assert.rejects(
    teardown(root, token),
    /Refusing to remove unowned scratch/,
  );
  assert.equal(await readFile(path.join(outside, "user.txt"), "utf8"), "keep");
});

test("missing or malformed token cannot claim or remove private scratch", async (t) => {
  const { root, scratch, token } = await fixture(t);
  await assert.rejects(setup(root, ""), /CONTENT_BUILT_TOKEN is invalid/);
  await assert.rejects(lstat(scratch), { code: "ENOENT" });
  await setup(root, token);
  await assert.rejects(teardown(root, ""), /CONTENT_BUILT_TOKEN is invalid/);
  const env = { ...process.env };
  delete env.CONTENT_BUILT_TOKEN;
  await exec(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "const { default: teardown } = await import('./scripts/content-built-teardown.ts'); await teardown();",
    ],
    { cwd: root, env },
  );
  assert.equal(
    await readFile(path.join(scratch, ".content-built-owner"), "utf8"),
    token,
  );
  await teardown(root, token);
});
