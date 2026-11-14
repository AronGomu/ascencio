/** Publish the native completion receipt only after the match writer closes its files. */
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { publishTextCompletion } from "./analysis-text-evidence.ts";
const { values: v } = parseArgs({
  options: {
    session: { type: "string" },
    root: { type: "string" },
    execution: { type: "string" },
    match: { type: "string" },
    help: { type: "boolean" },
  },
});
if (v.help) {
  console.log(
    "Usage: node scripts/bot-improvement/publish-text-match.ts --session SESSION --root SESSION_RELATIVE_MATCH_DIR --execution JOB.json --match MATCH_ID\nValidate authoritative game logs (or legacy linked records) and publish a hash-pinned done.json for post-evaluation analysis; creates no game records.",
  );
} else {
  if (!v.session || !v.root || !v.execution || !v.match)
    throw new Error("Missing native completion arguments");
  const job = JSON.parse(await readFile(path.resolve(v.execution), "utf8"));
  const item = job.matches.find(
    (m: { match: { id: string } }) => m.match.id === v.match,
  );
  if (!item) throw new Error("Match is absent from the execution plan");
  await publishTextCompletion(path.resolve(v.session), v.root, {
    match: v.match,
    executionIdentity: job.identity,
    fixtureIdentity: job.fixtureIdentity,
    candidateIdentity: item.identities[0],
    opponentIdentity: item.identities[1],
    item,
  });
  console.log(path.join(path.resolve(v.session), v.root, "done.json"));
}
