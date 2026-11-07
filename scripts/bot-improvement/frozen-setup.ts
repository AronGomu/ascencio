import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FrozenSetup } from "./session-contract.ts";
import { digest, identity, schedule } from "./session-fixtures.ts";

export async function verifyFrozen(root: string): Promise<FrozenSetup> {
  const frozen = JSON.parse(
    await readFile(path.join(root, "manifest.json"), "utf8"),
  ) as FrozenSetup;
  const { identity: expected, ...body } = frozen;
  if (frozen.schemaVersion !== 1 || identity(body) !== expected)
    throw new Error("Frozen manifest identity mismatch");
  for (const [file, hash] of Object.entries(frozen.files)) {
    if (path.isAbsolute(file) || file.split(/[\\/]/).includes(".."))
      throw new Error("Unsafe frozen file path");
    if (digest(await readFile(path.join(root, file))) !== hash)
      throw new Error(`Frozen input mismatch: ${file}`);
  }
  if (
    frozen.matches.length !== 500 ||
    frozen.matches.some((m) => m.games.length !== 4) ||
    identity(frozen.matches) !==
      identity(
        schedule(
          frozen.setupSeed,
          frozen.target.deck,
          frozen.opponents.map((b) => b.deck),
        ),
      )
  )
    throw new Error("Frozen schedule mismatch");
  return frozen;
}
