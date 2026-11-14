/** Compare complete actor evidence using the existing strict replay hint rules. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { DecisionReplay } from "../bot-evaluation/decision-replay.ts";
import { parseGameLog, parseMatchLog } from "./game-log.ts";
import { canonicalTree } from "./typescript-native-evidence.ts";
export async function compareNativeRunners(rust: string, typescript: string) {
  const index: Record<string, string> = JSON.parse(
    await readFile(path.join(rust, "matches.json"), "utf8"),
  );
  let games = 0,
    exactGameHashes = 0;
  for (const [id, relative] of Object.entries(index)) {
    const aBase = path.join(rust, relative, "native"),
      bBase = path.join(typescript, "matches", id, "native");
    const aMatch = parseMatchLog(
        await readFile(path.join(aBase, "match.log"), "utf8"),
      ),
      bMatch = parseMatchLog(
        await readFile(path.join(bBase, "match.log"), "utf8"),
      );
    for (let i = 0; i < 2; i++)
      if (
        !isDeepStrictEqual(
          canonicalTree(aMatch.reports[i]!.sideboarding, true),
          canonicalTree(bMatch.reports[i]!.sideboarding, true),
        )
      )
        throw Error(`Sideboard evidence changed for ${id}`);
    for (let n = 1; n <= 4; n++) {
      const a = parseGameLog(
          await readFile(path.join(aBase, `games/game-${n}/game.log`), "utf8"),
        ),
        b = parseGameLog(
          await readFile(path.join(bBase, `games/game-${n}/game.log`), "utf8"),
        );
      const decision = a.actors[0].timeline.entry.find(
        (e) => e.kind === "decision",
      )!;
      const verifier = new DecisionReplay(
        { actor: "a", decision: decision.decision_id!, records: a.actors },
        [0, 1],
      );
      for (let i = 0; i < 2; i++) {
        verifier.initial(i, b.actors[i]!.initial);
        if (
          a.actors[i]!.timeline.entry.length !==
          b.actors[i]!.timeline.entry.length
        )
          throw Error(`Timeline length changed for ${id}/${n}`);
        // Feed complete decision records too. No takeover call is made, so the
        // verifier checks the entire timeline instead of stopping at a decision.
        for (const entry of b.actors[i]!.timeline.entry)
          verifier.event(i, entry);
      }
      exactGameHashes += Number(
        a.neutral.evidence_sha256 === b.neutral.evidence_sha256,
      );
      games++;
    }
  }
  return {
    games,
    exactGameHashes,
    fullTimelinesVerified: true,
    scope:
      "Existing strict replay normalization permits only permutations of consecutive state-free description hints; decisions, state changes and all other events stay ordered.",
  };
}
