/** Compare gameplay independently of harmless ordering among engine annotations. */
import { parseGameLog } from "./game-log.ts";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { SaxesParser } from "saxes";
import { identity } from "./session-fixtures.ts";
export async function benchmarkBehavior(output: string, matchIds: string[]) {
  const reports: unknown[] = [];
  for (const match of matchIds) {
    const base = path.join(output, "matches", match);
    const marker = JSON.parse(
      await readFile(path.join(base, "done.json"), "utf8"),
    );
    if (marker.files?.["native/match.log"]) {
      const actors = [[], []] as unknown[][];
      for (let n = 1; n <= 4; n++) {
        const file = `native/games/game-${n}/game.log`,
          bytes = await readFile(path.join(base, file));
        if (
          createHash("sha256").update(bytes).digest("hex") !==
          marker.files[file]
        )
          throw Error("Benchmark game log changed");
        const game = parseGameLog(bytes.toString());
        for (let i = 0; i < 2; i++) {
          const row = game.actors[i]!,
            fields: Record<string, string> = {};
          for (const key of [
            "game_id",
            "status",
            "stage",
            "starting_player",
            "configuration_sha256",
          ])
            fields[key] = String(row[key]);
          for (const key of ["outcome", "engine_reason"])
            fields[`result/${key}`] = String(row.result?.[key] ?? "");
          const opening: string[] = [];
          for (const section of ["main", "extra"] as const)
            for (const code of row.initial?.own_starting_order?.[section]
              ?.card ?? [])
              opening.push(
                `initial/own_starting_order/${section}/card:${code}`,
              );
          const decisions = row.timeline.entry
            .filter((e) => e.kind === "decision")
            .map((e) => ({
              id: e.decision_id,
              choices: (e.selected_choice_ids?.choice_id ?? []).map(String),
            }));
          if (row.status !== "completed" || !decisions.length)
            throw Error("Incomplete benchmark gameplay evidence");
          actors[i]!.push({ fields, opening, decisions });
        }
      }
      for (const [i, actor] of ["a", "b"].entries())
        reports.push({ match, actor, games: actors[i] });
      continue;
    }
    for (const actor of ["a", "b"]) {
      const file = `matches/${match}/player-${actor}.xml`;
      const sha = marker.files?.[file];
      if (typeof sha !== "string")
        throw new Error("Missing benchmark actor evidence");
      const hash = createHash("sha256");
      const parser = new SaxesParser();
      const stack: string[] = [];
      const games: {
        fields: Record<string, string>;
        opening: string[];
        decisions: { id: string; choices: string[] }[];
      }[] = [];
      let game: (typeof games)[number] | undefined,
        entry: { kind: string; id: string; choices: string[] } | undefined,
        text = "";
      parser.on("doctype", () => {
        throw new Error("DTD benchmark evidence unsupported");
      });
      parser.on("opentag", (tag) => {
        stack.push(tag.name);
        text = "";
        if (stack.join("/") === "player-report/games/game") {
          game = { fields: {}, opening: [], decisions: [] };
          games.push(game);
        }
        if (stack.join("/").endsWith("/timeline/entry"))
          entry = { kind: "", id: "", choices: [] };
      });
      parser.on("text", (value) => {
        text += value;
      });
      parser.on("closetag", () => {
        const key = stack.slice(3).join("/");
        if (game) {
          if (
            [
              "game_id",
              "status",
              "stage",
              "starting_player",
              "configuration_sha256",
              "result/outcome",
              "result/engine_reason",
            ].includes(key)
          )
            game.fields[key] = text;
          if (/^initial\/own_starting_order\/(main|extra)\/card$/.test(key))
            game.opening.push(`${key}:${text}`);
          if (entry) {
            if (key === "timeline/entry/kind") entry.kind = text;
            if (key === "timeline/entry/decision_id") entry.id = text;
            if (key === "timeline/entry/selected_choice_ids/choice_id")
              entry.choices.push(text);
          }
          if (key === "timeline/entry" && entry) {
            if (entry.kind === "decision")
              game.decisions.push({ id: entry.id, choices: entry.choices });
            entry = undefined;
          }
          if (stack.join("/") === "player-report/games/game") game = undefined;
        }
        stack.pop();
        text = "";
      });
      const stream = createReadStream(path.join(base, file));
      stream.setEncoding("utf8");
      for await (const chunk of stream) {
        hash.update(chunk);
        parser.write(String(chunk));
      }
      parser.close();
      if (hash.digest("hex") !== sha)
        throw new Error("Benchmark actor evidence changed");
      if (
        games.length !== 4 ||
        games.some(
          (g) =>
            g.fields.status !== "completed" ||
            !g.fields.game_id ||
            !["win", "loss", "draw"].includes(
              g.fields["result/outcome"] ?? "",
            ) ||
            !g.decisions.length,
        )
      )
        throw new Error("Incomplete benchmark gameplay evidence");
      reports.push({ match, actor, games });
    }
  }
  return identity(reports);
}
