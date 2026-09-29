import { createHash } from "node:crypto";
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const ROOT_FILES = [
  "index.html",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
] as const;
const VENDOR_APP_ROOT = "vendor/ocgcore-wasm/0.1.2";

/**
 * Hash logical paths and bytes, not checkout paths or link spellings. Symlinks
 * must stay inside the project or explicitly authorized fixture source roots.
 * Ancestor aliases are rejected, never silently skipped or recursively followed.
 */
export function appBuildIdentity(
  projectRoot: string,
  authorizedSourceRoots: readonly string[] = [],
): string {
  const roots = [projectRoot, ...authorizedSourceRoots].map((root) =>
    realpathSync(root),
  );
  const within = (file: string, root: string): boolean => {
    const relative = path.relative(root, file);
    return (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    );
  };
  function filesUnder(
    relative: string,
    ancestors = new Set<string>(),
  ): string[] {
    const absolute = path.join(projectRoot, relative);
    const real = realpathSync(absolute);
    if (!roots.some((root) => within(real, root)))
      throw new Error(`APP_BUILD_SYMLINK_ESCAPE:${relative}`);
    if (ancestors.has(real))
      throw new Error(`APP_BUILD_SYMLINK_CYCLE:${relative}`);
    if (statSync(absolute).isFile()) return [relative];
    const next = new Set(ancestors).add(real);
    return readdirSync(absolute)
      .sort()
      .flatMap((entry) => filesUnder(path.join(relative, entry), next));
  }

  const hash = createHash("sha256");
  const files = [
    ...ROOT_FILES.flatMap((file) => filesUnder(file)),
    ...filesUnder("src"),
    // Conservative helper coverage includes transitive build-plugin inputs.
    ...filesUnder("scripts/lib").filter((file) =>
      /\.(?:[cm]?ts|[cm]?js|json)$/.test(file),
    ),
    ...filesUnder("assets/app").filter(
      (file) => file !== "assets/app/content-bootstrap.json",
    ),
    ...filesUnder(VENDOR_APP_ROOT).filter(
      (file) => /\.[cm]?js$/.test(file) || file.endsWith("/package.json"),
    ),
  ].sort();
  for (const file of files) {
    const normalized = file.split(path.sep).join("/");
    const bytes = readFileSync(path.join(projectRoot, file));
    hash.update(`${normalized}\0${bytes.byteLength}\0`);
    hash.update(bytes);
  }
  return `0.1.0+${hash.digest("hex").slice(0, 12)}`;
}
