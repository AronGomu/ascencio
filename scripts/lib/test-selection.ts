import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export type TestRunner =
  "node" | "vitest" | "release" | "native" | "acceptance" | "resource";

export function testRunner(file: string): TestRunner | null {
  if (/^tests\/[^/]+\.test\.ts$/.test(file)) return "node";
  if (/^tests\/(unit|component|integration)\/.+\.test\.ts$/.test(file))
    return "vitest";
  if (/^tests\/release-gates\/.+\.test\.ts$/.test(file)) return "release";
  for (const runner of ["native", "acceptance", "resource"] as const) {
    if (file.startsWith(`e2e/e2e-${runner}/`) && file.endsWith(".spec.ts"))
      return runner;
  }
  return null;
}

function gitFiles(root: string, args: string[]): string[] {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean);
}

export function repositoryFiles(root: string): string[] {
  return [
    ...new Set(
      gitFiles(root, [
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ]),
    ),
  ];
}

export function changedFiles(root: string, base: string | null): string[] {
  let revision = "HEAD";
  if (base !== null) {
    const commit = execFileSync(
      "git",
      ["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`],
      { cwd: root, encoding: "utf8" },
    ).trim();
    revision = execFileSync("git", ["merge-base", "HEAD", commit], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  }
  return [
    ...new Set([
      ...gitFiles(root, [
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        revision,
        "HEAD",
        "--",
      ]),
      ...gitFiles(root, [
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        "HEAD",
        "--",
      ]),
      ...gitFiles(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
    ]),
  ].sort();
}

export function relativeFile(root: string, input: string): string {
  const file = path
    .relative(root, path.resolve(root, input))
    .replaceAll("\\", "/");
  if (
    !file ||
    file === ".." ||
    file.startsWith("../") ||
    path.isAbsolute(file)
  ) {
    throw new Error(`File must be inside the repository: ${input}`);
  }
  return file;
}

const globalConfig = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
  "vitest.release.config.ts",
  "eslint.config.js",
]);

export function selectTests(root: string, changed: string[], files: string[]) {
  const inventory = new Set([...files, ...changed]);
  const dependencies = new Map<string, Set<string>>();
  const extensions = [
    "",
    ".ts",
    ".js",
    ".svelte",
    ".css",
    "/index.ts",
    "/index.js",
  ];
  function resolveReference(from: string, reference: string): string | null {
    const clean = reference.split("?")[0];
    if (!clean) return null;
    const roots = clean.startsWith(".") ? [path.posix.dirname(from), ""] : [""];
    for (const directory of roots) {
      const candidate = path.posix.normalize(path.posix.join(directory, clean));
      const candidates = candidate.endsWith(".js")
        ? [candidate.slice(0, -3) + ".ts", candidate]
        : [candidate];
      for (const name of candidates) {
        for (const extension of extensions) {
          if (inventory.has(name + extension)) return name + extension;
        }
      }
    }
    return null;
  }
  for (const file of files) {
    if (
      !/^(src|scripts|tests|e2e)\//.test(file) ||
      !/\.(ts|js|mjs|svelte|css)$/.test(file)
    )
      continue;
    let source: string;
    try {
      source = readFileSync(path.join(root, file), "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        continue;
      throw error;
    }
    if (file.endsWith(".svelte")) {
      source = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
        .map((match) => match[1])
        .join("\n");
    }
    const refs = new Set<string>();
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      false,
    );
    function visit(node: ts.Node): void {
      if (ts.isStringLiteralLike(node)) {
        const resolved = resolveReference(file, node.text);
        if (resolved !== null && resolved !== file) refs.add(resolved);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (file.endsWith(".css")) {
      for (const match of source.matchAll(
        /@import\s+(?:url\()?['"]([^'"]+)['"]/g,
      )) {
        if (match[1]) {
          const resolved = resolveReference(file, match[1]);
          if (resolved !== null) refs.add(resolved);
        }
      }
    }
    dependencies.set(file, refs);
  }
  const selected = new Map<string, string[]>();
  const covered = new Set<string>();
  for (const test of files.filter((file) => testRunner(file) !== null)) {
    const reachable = new Set<string>();
    const pending = [test];
    while (pending.length > 0) {
      const next = pending.pop();
      if (next === undefined || reachable.has(next)) continue;
      reachable.add(next);
      pending.push(...(dependencies.get(next) ?? []));
    }
    const reasons = changed.filter(
      (file) => !globalConfig.has(file) && reachable.has(file),
    );
    if (reasons.length > 0) {
      selected.set(test, reasons);
      for (const file of reasons) covered.add(file);
    }
  }
  const uncovered = changed.filter(
    (file) =>
      !covered.has(file) &&
      !/\.(md|ya?ml)$/.test(file) &&
      !file.startsWith(".agents/"),
  );
  return { selected, uncovered };
}
