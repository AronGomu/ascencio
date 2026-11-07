import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

test("native cleanup previews, then removes staged content without touching user data", () => {
  const target = mkdtempSync(path.join(os.tmpdir(), "ascencio-native-stage-"));
  temporary.push(target);
  mkdirSync(path.join(target, "game-content"));
  mkdirSync(path.join(target, "user-data"));
  writeFileSync(
    path.join(target, ".ascencio-native-stage"),
    "ascencio-native-stage-v1\n",
  );
  writeFileSync(path.join(target, "game-content", "release.json"), "{}\n");
  writeFileSync(
    path.join(target, "game-content", "card-library.sqlite"),
    "content",
  );
  writeFileSync(path.join(target, "user-data", "user-data.sqlite"), "save");

  run(target);
  expect(
    existsSync(path.join(target, "game-content", "card-library.sqlite")),
  ).toBe(true);
  run(target, "--delete");
  expect(existsSync(path.join(target, "game-content"))).toBe(false);
  expect(
    readFileSync(path.join(target, "user-data", "user-data.sqlite"), "utf8"),
  ).toBe("save");
});

function run(target: string, ...extra: string[]): void {
  execFileSync(
    process.execPath,
    ["scripts/clean-native-content.ts", "--target", target, ...extra],
    {
      cwd: root,
      stdio: "pipe",
    },
  );
}
