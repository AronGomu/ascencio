/** Prepare immutable bot inputs and JSON setup files; never launch games or agents. */
import {
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { build } from "esbuild";

const { values } = parseArgs({
  options: {
    bot: { type: "string" },
    opponent: { type: "string", multiple: true },
    template: { type: "string" },
    implementation: { type: "string" },
    out: { type: "string" },
    iterations: { type: "string" },
    matches: { type: "string" },
    "baseline-run": { type: "string" },
    help: { type: "boolean" },
  },
});
if (values.help) {
  console.log(
    "Usage: node scripts/bot-improvement/generate-improvement-run-setup.ts --bot PACKAGE --template TRUSTED_CAMPAIGN_JSON --implementation CHECKOUT --out NEW_DIRECTORY [--opponent PACKAGE] [--iterations N] [--matches N] [--baseline-run DIRECTORY]\nUses trusted template commands and limits; explicit counts override them. Missing limits use shared policy defaults. Packages must provide ai/evaluation/scoring.ts exporting baselineStrategy.",
  );
  process.exit(0);
}
for (const key of ["bot", "template", "implementation", "out"] as const)
  if (!values[key]) throw new Error(`Missing --${key}`);
const implementation = await realpath(values.implementation!);
const templateFile = await realpath(values.template!);
const template = JSON.parse(await readFile(templateFile, "utf8"));
const policy = JSON.parse(
  await readFile(
    path.join(implementation, "config/bot-campaign-policy.json"),
    "utf8",
  ),
);
const positive = (value: unknown, name: string) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`Invalid ${name}`);
  return n;
};
const iterations = positive(
  values.iterations ?? template.rounds ?? policy.defaults.rounds,
  "iterations",
);
const matches = positive(
  values.matches ?? template.matches ?? policy.defaults.matches,
  "matches",
);
if (matches > 10000) throw new Error("matches exceeds evaluator limit 10000");
const sources = [
  await realpath(values.bot!),
  ...(await Promise.all((values.opponent ?? []).map((p) => realpath(p)))),
];
// The target is always included in the frozen opponent roster.
const unique = [...new Set(sources)];
const manifests = await Promise.all(
  unique.map(async (source) => {
    const manifest = JSON.parse(
      await readFile(path.join(source, "bot.json"), "utf8"),
    );
    if (!manifest.recommendedDecks?.[0])
      throw new Error(`Missing recommended deck: ${source}`);
    await stat(path.join(source, "ai/evaluation/scoring.ts"));
    await stat(path.join(source, manifest.recommendedDecks[0]));
    return manifest;
  }),
);
const templateBase = path.dirname(templateFile);
const evaluationFile = path.resolve(templateBase, template.evaluation);
let evaluation = await readFile(evaluationFile, "utf8");
const xmlBase = path.dirname(evaluationFile);
const decode = (s: string) =>
  s.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const rulesMatch = evaluation.match(/<banlist>([^<]+)<\/banlist>/);
const snapshotMatch = evaluation.match(/<snapshot>([^<]+)<\/snapshot>/);
if (!rulesMatch || !snapshotMatch)
  throw new Error("Template evaluation requires banlist and snapshot paths");
const rules = JSON.parse(
  await readFile(path.resolve(xmlBase, decode(rulesMatch[1]!)), "utf8"),
);
const snapshot = await realpath(
  path.resolve(xmlBase, decode(snapshotMatch[1]!)),
);
const out = path.resolve(values.out!);
await mkdir(out, { recursive: false }); // Refuse overwrite or accidental checkpoint reuse.
const json = async (name: string, value: unknown) =>
  writeFile(path.join(out, name), JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  });
const decks = [];
for (const [i, source] of unique.entries()) {
  const folder = path.join(out, `bot-${i}`);
  await cp(source, folder, {
    recursive: true,
    filter: (file) =>
      !["improvement-history.md", "improvement-history.md.lock"].includes(
        path.basename(file),
      ),
  });
  const strategy = path.join(folder, "strategy.mjs");
  await build({
    stdin: {
      contents: `export { baselineStrategy as createStrategy } from ${JSON.stringify(path.join(source, "ai/evaluation/scoring.ts"))};`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile: strategy,
  });
  decks.push({
    id: `bot-${i}`,
    deck: path.join(folder, manifests[i].recommendedDecks[0]),
    strategy,
    config: {},
  });
}
// The runner treats entries after the target as opponents; repeat the frozen target
// under a distinct logical id when additional opponents are supplied.
if (decks.length > 1) decks.push({ ...decks[0], id: "self-play" });
await json("rules.json", rules);
evaluation = evaluation
  .replace(
    /<deck>[\s\S]*?<\/deck>/,
    `<deck><path>${escape(decks[0]!.deck!)}</path></deck>`,
  )
  .replace(
    /<banlist>[^<]+<\/banlist>/,
    `<banlist>${escape(path.join(out, "rules.json"))}</banlist>`,
  )
  .replace(
    /<snapshot>[^<]+<\/snapshot>/,
    `<snapshot>${escape(snapshot)}</snapshot>`,
  )
  .replace(/<matches>[^<]+<\/matches>/, `<matches>${matches}</matches>`)
  .replace(
    /<output>[\s\S]*?<\/output>/,
    `<output><directory>${escape(path.join(out, "unused"))}</directory></output>`,
  );
await writeFile(path.join(out, "evaluation.xml"), evaluation, { flag: "wx" });
const opponents = decks.length === 1 ? 1 : decks.length - 1;
const maxGames =
  (2 + 2 * iterations) * opponents * matches * policy.protocol.gamesPerMatch;
if (!Number.isSafeInteger(maxGames)) throw new Error("Game ceiling overflow");
const config = {
  ...policy.defaults,
  ...template,
  evaluation: path.join(out, "evaluation.xml"),
  output: path.join(out, "run"),
  decks,
  rounds: iterations,
  matches,
  max_games: maxGames,
};
if (values["baseline-run"])
  config.baseline_campaign = await realpath(values["baseline-run"]);
else delete config.baseline_campaign;
for (const key of ["agent", "bug_agent"]) {
  if (!Array.isArray(config[key]) || !path.isAbsolute(config[key][0]))
    throw new Error(`Trusted template requires absolute ${key} executable`);
}
for (const file of config.command_inputs ?? [])
  if (!path.isAbsolute(file))
    throw new Error("Trusted command_inputs must be absolute");
await json("campaign.json", config);
await json("experiment-plan.json", {
  iterations,
  matchesPerOpponent: matches,
  opponents,
  gamesPerMatch: policy.protocol.gamesPerMatch,
  maxGames,
  reviewMode: "step-by-step",
});
const files: Record<string, string> = {};
async function hash(folder: string) {
  for (const name of await readdir(folder)) {
    const file = path.join(folder, name);
    if ((await stat(file)).isDirectory()) await hash(file);
    else
      files[path.relative(out, file)] = createHash("sha256")
        .update(await readFile(file))
        .digest("hex");
  }
}
await hash(out);
await json("preparation.json", {
  status: "prepared",
  implementation,
  template: templateFile,
  sources: unique,
  files,
  gamesStarted: false,
});
console.log(path.join(out, "campaign.json"));
