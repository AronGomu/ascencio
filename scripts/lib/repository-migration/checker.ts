import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { MigrationManifest } from "./manifest.ts";

const protectedPaths = [
  "vendor/",
  ".github/skills/",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
];
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const matches = (file: string, entry: string) =>
  entry.endsWith("/") ? file.startsWith(entry) : file === entry;

function git(root: string, args: string[]): Buffer {
  return execFileSync("git", args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
}

// Refuse traversal and symlink ancestors, including for destinations that do not exist yet.
function localPath(root: string, file: string): string {
  if (
    !file ||
    file.includes("\\") ||
    file.includes("\0") ||
    path.posix.isAbsolute(file) ||
    path.posix.normalize(file) !== file ||
    file.split("/").some((part) => part === ".." || part === ".") ||
    file.startsWith(".git/") ||
    file === ".git"
  ) {
    throw new Error(`Unsafe migration path: ${file}`);
  }
  let current = root;
  for (const part of file.split("/").filter(Boolean)) {
    current = path.join(current, part);
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink())
      throw new Error(`Symlink migration path: ${file}`);
  }
  return current;
}

function validate(root: string, manifest: MigrationManifest): void {
  if (manifest.version !== 1)
    throw new Error("Unsupported migration manifest version");
  const writes = [
    ...manifest.moves.flatMap((move) => [move.from, move.to]),
    ...manifest.deletions,
    ...manifest.consumers.map((consumer) => consumer.path),
  ];
  if (new Set(writes).size !== writes.length)
    throw new Error("Overlapping migration writes");
  for (const file of [
    ...writes,
    ...manifest.exclusions,
    ...manifest.requiredResources.map((resource) => resource.path),
    ...manifest.referenceChecks.flatMap((check) => [
      ...check.paths,
      ...check.exceptions.map((exception) => exception.path),
    ]),
    ...manifest.protectedPathExceptions.map((exception) => exception.path),
  ])
    localPath(root, file);
  for (const exception of [
    ...manifest.protectedPathExceptions,
    ...manifest.referenceChecks.flatMap((check) => check.exceptions),
  ]) {
    if (!exception.reason.trim())
      throw new Error(`Exception needs a reason: ${exception.path}`);
  }
  for (const file of writes) {
    if (file.startsWith("vendor/ocgcore-wasm/0.1.2/"))
      throw new Error(`Frozen vendor path: ${file}`);
    const protectedFile =
      protectedPaths.some((entry) => matches(file, entry)) ||
      protectedPaths.includes(path.posix.basename(file));
    if (
      manifest.exclusions.some((entry) => matches(file, entry)) ||
      (protectedFile &&
        !manifest.protectedPathExceptions.some(
          (exception) => exception.path === file,
        ))
    )
      throw new Error(`Excluded migration write: ${file}`);
  }
  for (const resource of [...manifest.moves, ...manifest.requiredResources]) {
    if (!/^[a-f0-9]{64}$/.test(resource.sha256))
      throw new Error("Resource requires a SHA-256 pin");
  }
  for (const consumer of manifest.consumers) {
    if (
      consumer.replacements.some(
        (replacement) =>
          !replacement.from || replacement.from === replacement.to,
      )
    )
      throw new Error(`Invalid replacement: ${consumer.path}`);
  }
  for (const check of manifest.referenceChecks) {
    if (!check.text || !check.paths.length)
      throw new Error("Reference checks require text and owned paths");
  }
}

function replace(
  bytes: Buffer,
  consumer: MigrationManifest["consumers"][number],
): Buffer {
  let text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes))
    throw new Error(`Consumer is not UTF-8: ${consumer.path}`);
  for (const replacement of consumer.replacements) {
    if (!text.includes(replacement.from))
      throw new Error(
        `Replacement not found in ${consumer.path}: ${replacement.from}`,
      );
    text = text.replaceAll(replacement.from, replacement.to);
  }
  return Buffer.from(text);
}

/** Apply only explicit file moves/deletions and literal replacements. Preflight all inputs before writing. */
export function applyMigration(
  root: string,
  manifest: MigrationManifest,
): void {
  validate(root, manifest);
  const updates = manifest.consumers.map((consumer) => ({
    path: consumer.path,
    bytes: replace(readFileSync(localPath(root, consumer.path)), consumer),
  }));
  for (const move of manifest.moves) {
    if (hash(readFileSync(localPath(root, move.from))) !== move.sha256)
      throw new Error(`Source content mismatch: ${move.from}`);
    if (existsSync(localPath(root, move.to)))
      throw new Error(`Destination exists: ${move.to}`);
  }
  for (const file of manifest.deletions) {
    if (!lstatSync(localPath(root, file)).isFile())
      throw new Error(`Deletion must be a file: ${file}`);
  }
  for (const move of manifest.moves) {
    mkdirSync(path.dirname(localPath(root, move.to)), { recursive: true });
    renameSync(localPath(root, move.from), localPath(root, move.to));
  }
  for (const update of updates)
    writeFileSync(localPath(root, update.path), update.bytes);
  for (const file of manifest.deletions) unlinkSync(localPath(root, file));
}

/** Read-only, deterministic local guard. With base, also audits every changed path and consumer byte. */
export function checkMigration(
  root: string,
  manifest: MigrationManifest,
  options: { base?: string } = {},
): string[] {
  validate(root, manifest);
  const errors: string[] = [];
  for (const resource of [
    ...manifest.requiredResources,
    ...manifest.moves.map((move) => ({ path: move.to, sha256: move.sha256 })),
  ]) {
    const file = localPath(root, resource.path);
    if (!existsSync(file))
      errors.push(`Missing required resource: ${resource.path}`);
    else if (
      !lstatSync(file).isFile() ||
      hash(readFileSync(file)) !== resource.sha256
    )
      errors.push(`Resource content mismatch: ${resource.path}`);
  }
  for (const file of [
    ...manifest.moves.map((move) => move.from),
    ...manifest.deletions,
  ]) {
    if (existsSync(localPath(root, file)))
      errors.push(`Retired path still exists: ${file}`);
  }
  const files = [
    ...new Set(
      git(root, [
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ])
        .toString("utf8")
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
  for (const check of manifest.referenceChecks) {
    for (const file of files.filter((file) =>
      check.paths.some((entry) => matches(file, entry)),
    )) {
      if (check.exceptions.some((exception) => exception.path === file))
        continue;
      const absolute = localPath(root, file);
      if (!existsSync(absolute) || !lstatSync(absolute).isFile()) continue;
      const lines = readFileSync(absolute, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (line.includes(check.text))
          errors.push(
            `Unresolved migrated reference: ${file}:${index + 1}: ${check.text}`,
          );
      });
    }
  }
  if (options.base) {
    const base = git(root, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${options.base}^{commit}`,
    ])
      .toString("utf8")
      .trim();
    const allowed = new Set([
      ...manifest.moves.flatMap((move) => [move.from, move.to]),
      ...manifest.deletions,
      ...manifest.consumers.map((consumer) => consumer.path),
    ]);
    const changed = new Set(
      [
        ...git(root, ["diff", "--name-only", "--no-renames", "-z", base, "--"])
          .toString("utf8")
          .split("\0"),
        ...git(root, ["ls-files", "--others", "--exclude-standard", "-z"])
          .toString("utf8")
          .split("\0"),
      ].filter(Boolean),
    );
    for (const file of [...changed].sort())
      if (!allowed.has(file))
        errors.push(`Undeclared migration change: ${file}`);
    for (const consumer of manifest.consumers) {
      const expected = replace(
        git(root, ["show", `${base}:${consumer.path}`]),
        consumer,
      );
      const file = localPath(root, consumer.path);
      if (!existsSync(file) || !readFileSync(file).equals(expected))
        errors.push(`Unexpected consumer content: ${consumer.path}`);
    }
  }
  return [...new Set(errors)].sort();
}
