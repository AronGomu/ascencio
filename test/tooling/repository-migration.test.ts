import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyMigration,
  checkMigration,
} from "../../scripts/lib/repository-migration/checker.ts";
import type { MigrationManifest } from "../../scripts/lib/repository-migration/manifest.ts";
import {
  changedFiles,
  repositoryFiles,
  selectTests,
} from "../runner/lib/test-selection.ts";

const schema = Buffer.from("<schema>\r\n  preserved bytes\r\n</schema>\n");
const sha256 = createHash("sha256").update(schema).digest("hex");
function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(path.join(os.tmpdir(), "ascencio-migration-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file: string, bytes: string | Buffer) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), bytes);
  };
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  write("schemas/bot-evaluation/v1/example.xsd", schema);
  write(
    "src/consumer.ts",
    'const schema = "schemas/bot-evaluation/v1/example.xsd";\n',
  );
  write(
    "docs/history.md",
    "Previously schemas/bot-evaluation/v1/example.xsd\n",
  );
  write("package-lock.json", '{"old":"schemas/bot-evaluation/v1/example.xsd"}');
  write(
    ".github/skills/impeccable/template.md",
    "schemas/bot-evaluation/v1/example.xsd",
  );
  write("obsolete.txt", "delete intentionally");
  write("test/tooling/bot-evaluation-tooling.test.ts", "");
  write("test/tooling/repository-migration.test.ts", "");
  git("init", "-q");
  git("add", ".");
  git(
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "baseline",
  );
  const base = git("rev-parse", "HEAD");
  const manifest: MigrationManifest = {
    version: 1,
    moves: [
      {
        from: "schemas/bot-evaluation/v1/example.xsd",
        to: "tools/bot-evaluation/schemas/v1/example.xsd",
        sha256,
      },
    ],
    deletions: ["obsolete.txt"],
    consumers: [
      {
        path: "src/consumer.ts",
        replacements: [
          {
            from: "schemas/bot-evaluation/v1/example.xsd",
            to: "tools/bot-evaluation/schemas/v1/example.xsd",
          },
        ],
      },
    ],
    exclusions: ["vendor/"],
    protectedPathExceptions: [],
    requiredResources: [
      { path: "tools/bot-evaluation/schemas/v1/example.xsd", sha256 },
    ],
    referenceChecks: [
      {
        text: "schemas/bot-evaluation/",
        paths: ["src/", "docs/"],
        exceptions: [
          {
            path: "docs/history.md",
            reason: "Historical record of the former layout",
          },
        ],
      },
    ],
  };
  return { root, write, git, base, manifest };
}

test("fixture migration preserves bytes, deletes only declared files and updates only owned consumers", (t) => {
  const { root, manifest, base } = fixture(t);
  const protectedFiles = [
    "package-lock.json",
    ".github/skills/impeccable/template.md",
    "docs/history.md",
  ];
  const before = protectedFiles.map((file) =>
    readFileSync(path.join(root, file)),
  );
  applyMigration(root, manifest);
  assert.deepEqual(checkMigration(root, manifest, { base }), []);
  assert.deepEqual(
    readFileSync(path.join(root, manifest.moves[0]!.to)),
    schema,
  );
  assert.equal(existsSync(path.join(root, "obsolete.txt")), false);
  protectedFiles.forEach((file, index) =>
    assert.deepEqual(readFileSync(path.join(root, file)), before[index]),
  );
});

for (const file of [
  "package-lock.json",
  ".github/skills/impeccable/template.md",
]) {
  test(`prevents and detects unintended edits to ${file}`, (t) => {
    const { root, manifest, base, write } = fixture(t);
    const bad = structuredClone(manifest);
    bad.consumers.push({
      path: file,
      replacements: [{ from: "schemas/", to: "changed/" }],
    });
    assert.throws(() => applyMigration(root, bad), /Excluded migration write/);
    assert.ok(
      existsSync(path.join(root, manifest.moves[0]!.from)),
      "preflight must precede writes",
    );
    applyMigration(root, manifest);
    write(file, "accidental broad replacement");
    assert.ok(
      checkMigration(root, manifest, { base }).includes(
        `Undeclared migration change: ${file}`,
      ),
    );
  });
}

test("nested dependency metadata needs an explicit reasoned exception", (t) => {
  const { root, manifest, write } = fixture(t);
  write("nested/package-lock.json", "old");
  manifest.consumers.push({
    path: "nested/package-lock.json",
    replacements: [{ from: "old", to: "new" }],
  });
  assert.throws(
    () => applyMigration(root, manifest),
    /Excluded migration write/,
  );
  manifest.protectedPathExceptions.push({
    path: "nested/package-lock.json",
    reason: "This migration intentionally updates this owned workspace lock",
  });
  applyMigration(root, manifest);
  assert.equal(
    readFileSync(path.join(root, "nested/package-lock.json"), "utf8"),
    "new",
  );
});

test("missing and modified resources fail clearly, including the CLI before commit", (t) => {
  const { root, manifest, write } = fixture(t);
  applyMigration(root, manifest);
  const resource = manifest.requiredResources[0]!.path;
  write(resource, "corruption");
  assert.ok(
    checkMigration(root, manifest).includes(
      `Resource content mismatch: ${resource}`,
    ),
  );
  rmSync(path.join(root, resource));
  assert.ok(
    checkMigration(root, manifest).includes(
      `Missing required resource: ${resource}`,
    ),
  );
  write("manifest.json", JSON.stringify(manifest));
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("scripts/check-repository-migration.ts"),
      "check",
      "manifest.json",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Missing required resource: tools\/bot-evaluation\/schemas\/v1\/example.xsd/,
  );
});

test("unresolved references fail while exact documented historical exceptions pass", (t) => {
  const { root, manifest, write } = fixture(t);
  applyMigration(root, manifest);
  assert.deepEqual(checkMigration(root, manifest), []);
  write("src/forgotten.ts", '"schemas/bot-evaluation/v1/example.xsd"');
  assert.match(
    checkMigration(root, manifest).join("\n"),
    /Unresolved migrated reference: src\/forgotten.ts:1/,
  );
  manifest.referenceChecks[0]!.exceptions = [];
  assert.match(checkMigration(root, manifest).join("\n"), /docs\/history.md:1/);
});

test("base audit catches extra edits within an allowed consumer", (t) => {
  const { root, manifest, base, write } = fixture(t);
  applyMigration(root, manifest);
  write(
    "src/consumer.ts",
    readFileSync(path.join(root, "src/consumer.ts"), "utf8") +
      "unrelated edit\n",
  );
  assert.ok(
    checkMigration(root, manifest, { base }).includes(
      "Unexpected consumer content: src/consumer.ts",
    ),
  );
});

test("unsafe paths and frozen vendor writes fail before any move", (t) => {
  const { root, manifest } = fixture(t);
  for (const destination of [
    "../escape",
    "vendor/ocgcore-wasm/0.1.2/resource",
  ]) {
    const bad = structuredClone(manifest);
    bad.moves[0]!.to = destination;
    assert.throws(
      () => applyMigration(root, bad),
      /Unsafe migration path|Frozen vendor path/,
    );
  }
  symlinkSync(os.tmpdir(), path.join(root, "linked"));
  const bad = structuredClone(manifest);
  bad.moves[0]!.to = "linked/resource";
  assert.throws(() => applyMigration(root, bad), /Symlink migration path/);
  assert.ok(existsSync(path.join(root, manifest.moves[0]!.from)));
});

test("Git renames and deletions immediately select the existing evaluator regression", (t) => {
  const { root, manifest, git } = fixture(t);
  applyMigration(root, manifest);
  git("add", "-A");
  const changes = changedFiles(root, null);
  assert.ok(changes.includes(manifest.moves[0]!.from));
  assert.ok(changes.includes(manifest.moves[0]!.to));
  let plan = selectTests(root, changes, repositoryFiles(root));
  assert.ok(
    plan.selected
      .get("test/tooling/bot-evaluation-tooling.test.ts")
      ?.includes(manifest.moves[0]!.from),
  );
  rmSync(path.join(root, manifest.moves[0]!.to));
  plan = selectTests(root, [manifest.moves[0]!.to], repositoryFiles(root));
  assert.deepEqual(
    plan.selected.get("test/tooling/bot-evaluation-tooling.test.ts"),
    [manifest.moves[0]!.to],
  );
  for (const file of [
    "tools/bot-evaluation/src/xml.rs",
    "scripts/bot-evaluation/generate-schemas.py",
    "config/migrations/evaluator-schemas.json",
  ]) {
    assert.ok(
      selectTests(root, [file], repositoryFiles(root)).selected.has(
        "test/tooling/bot-evaluation-tooling.test.ts",
      ),
    );
  }
});

test("retained evaluator manifest verifies all thirteen repository schemas", () => {
  const manifest = JSON.parse(
    readFileSync("config/migrations/evaluator-schemas.json", "utf8"),
  ) as MigrationManifest;
  assert.equal(manifest.requiredResources.length, 13);
  assert.deepEqual(checkMigration(process.cwd(), manifest), []);
});
