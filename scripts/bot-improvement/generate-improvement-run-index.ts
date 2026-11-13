/** Build navigation with one index per owner; never duplicate parent configuration. */
import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
const { values: v } = parseArgs({
  options: { run: { type: "string" }, help: { type: "boolean" } },
});
if (v.help) {
  console.log(
    "Usage: node scripts/bot-improvement/generate-improvement-run-index.ts --run DIRECTORY\nGenerates linked Markdown indexes for run, iterations, evaluations and matches, ending at individual A/B game logs. Starts no games.",
  );
  process.exit(0);
}
if (!v.run) throw Error("Missing --run");
const root = path.resolve(v.run);
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const state = await json(path.join(root, "run.json"));
const exists = async (file: string) => {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
};
const link = (label: string, file: string) => `[${label}](<${file}>)`;
const indexes = new Map<string, string[]>();
const owner = (folder: string, title: string) => {
  let lines = indexes.get(folder);
  if (!lines) {
    lines = [`# ${title}`, ""];
    indexes.set(folder, lines);
  }
  return lines;
};
const run = owner(root, "Improvement run");
run.push(
  `- ${link("Run state", path.join(root, "run.json"))}`,
  `- ${link("Configuration", path.join(root, "configuration.json"))}`,
);
for (const [key, reference] of Object.entries(state.jobs) as [
  string,
  { $ref: string },
][]) {
  const manifest = path.join(root, reference.$ref),
    folder = path.dirname(manifest);
  const job = await json(manifest);
  const lines = owner(folder, `Evaluation ${key}`);
  lines.push(`- ${link("Evaluation record", manifest)}`);
  const isBaseline = reference.$ref.startsWith("baseline/");
  const parent = isBaseline
    ? path.join(root, "baseline")
    : path.dirname(path.dirname(folder));
  const parentLines = owner(parent, isBaseline ? "Baseline" : "Iteration");
  parentLines.push(`- ${link(key, path.join(folder, "index.md"))}`);
  if (job.retention?.actions_pruned && job.retention.receipt) {
    const retention = await json(job.retention.receipt);
    lines.push(
      `- Actions pruned · ${link("Loss analysis", retention.analysis)} · ${link("Retention receipt", job.retention.receipt)}`,
    );
  }
  if (job.status !== "completed") continue;
  const matches = path.join(job.result.run, "matches");
  for (const name of (await readdir(matches)).sort()) {
    const match = path.join(matches, name),
      navigation = path.join(folder, "matches", name),
      matchLines = owner(navigation, name);
    lines.push(`- ${link(name, path.join(navigation, "index.md"))}`);
    matchLines.push(
      `- ${link("Match record", path.join(match, "match.json"))}`,
    );
    for (let n = 1; n <= 4; n++) {
      const game = path.join(match, "games", `game-${n}`);
      const views = [];
      for (const actor of ["a", "b"])
        if (await exists(path.join(game, `${actor}.log`)))
          views.push(
            link(actor.toUpperCase(), path.join(game, `${actor}.log`)),
          );
      matchLines.push(
        `- Game ${n}: ${link("Record", path.join(game, "game.json"))} · ${views.length ? views.join(" · ") : job.retention?.actions_pruned ? "Actions pruned after analysis" : "Actions unavailable"}`,
      );
    }
  }
}
run.push(`- ${link("Baseline", path.join(root, "baseline/index.md"))}`);
const iterations = new Set<string>();
if (state.active?.$ref)
  iterations.add(path.dirname(path.join(root, state.active.$ref)));
for (const reference of state.rounds ?? [])
  if (reference.$ref)
    iterations.add(path.dirname(path.join(root, reference.$ref)));
for (const folder of iterations) {
  const lines = owner(folder, path.basename(folder));
  lines.push(
    `- ${link("Iteration record", path.join(folder, "iteration.json"))}`,
  );
  if (await exists(path.join(folder, "proposal.json"))) {
    lines.push(
      `- ${link("Proposal receipt", path.join(folder, "proposal.json"))}`,
    );
  }
  for (const name of ["loss-analysis.md", "retention.json"])
    if (await exists(path.join(folder, name)))
      lines.push(`- ${link(name, path.join(folder, name))}`);
  run.push(`- ${link(path.basename(folder), path.join(folder, "index.md"))}`);
}
for (const [folder, lines] of indexes) {
  await mkdir(folder, { recursive: true });
  await writeFile(
    path.join(folder, "index.md"),
    [...new Set(lines)].join("\n") + "\n",
  );
}
console.log(path.join(root, "index.md"));
