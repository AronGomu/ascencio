/** Read-only completion verification, shared by coordinator resume and worker finalization. */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { digest, identity } from "./session-fixtures.ts";
import type { Job } from "./typescript-match-worker.ts";
import {
  verifyNativeGame,
  verifyNativeMatch,
} from "./typescript-native-evidence.ts";
async function optional(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function verifyNativeCompletion(
  output: string,
  job: Job,
  item: Job["matches"][number],
  pendingMarker?: { files: Record<string, string> },
) {
  const base = path.join(output, "matches", item.match.id),
    marker = pendingMarker ?? (await optional(path.join(base, "done.json")));
  if (!marker) return false;
  const expected = [
    "native/match.log",
    ...[1, 2, 3, 4].map((n) => `native/games/game-${n}/game.log`),
  ];
  const files: string[] = [];
  async function visit(root: string) {
    for (const e of await readdir(root, { withFileTypes: true })) {
      const f = path.join(root, e.name);
      if (e.isSymbolicLink()) throw Error("Symlink native evidence");
      if (e.isDirectory()) await visit(f);
      else if (e.isFile() && e.name !== "done.json")
        files.push(path.relative(base, f));
      else if (!e.isFile()) throw Error("Invalid native evidence entry");
    }
  }
  await visit(base);
  if (
    identity(files.sort()) !==
      identity(Object.keys(marker.files ?? {}).sort()) ||
    expected.some((f) => !files.includes(f)) ||
    files.some(
      (f) =>
        !expected.includes(f) &&
        !/^bugs\/match-[0-9]+(?:-game-[1-4])?-[a-z_]+\.json$/.test(f),
    )
  )
    throw Error("Native completion file set changed");
  const match = verifyNativeMatch(
    await readFile(path.join(base, "native/match.log"), "utf8"),
    job,
    item,
  );
  for (const file of files) {
    const bytes = await readFile(path.join(base, file));
    if (marker.files[file] !== digest(bytes))
      throw Error("Native completion bytes changed");
    if (file.endsWith("game.log")) {
      const game = verifyNativeGame(bytes.toString()),
        n = Number(/game-(\d+)/.exec(file)![1]);
      if (
        game.neutral.game_id !== `${item.match.id}-game-${n}` ||
        identity(game.neutral) !== identity(match.refs[n - 1]!.checkpoint_game)
      )
        throw Error("Native match/game reference mismatch");
    }
  }
  return true;
}
