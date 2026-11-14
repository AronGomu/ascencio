/** Maintain the bot-local Markdown decision history; no strategy or runner-state edits. */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
const { values: v } = parseArgs({
  options: {
    bot: { type: "string" },
    id: { type: "string" },
    change: { type: "string" },
    status: { type: "string" },
    base: { type: "string" },
    candidate: { type: "string" },
    evidence: { type: "string" },
    reason: { type: "string" },
    delta: { type: "string" },
    rules: { type: "string", multiple: true },
    "candidate-hash": { type: "string" },
    help: { type: "boolean" },
  },
});
if (v.help) {
  console.log(
    "Usage: node scripts/bot-improvement/update-improvement-history.ts --bot PACKAGE --id ID --change TEXT --status pending|accepted|rejected|error|superseded --base VERSION --candidate FILE --evidence FILE [--delta POINTS] [--reason TEXT] [--rules RULE_ID] [--candidate-hash SHA256]\nCreates or replaces one Markdown line by ID. Completed entries require a reason; accepted/rejected entries require a numeric win-rate difference. Uses an exclusive lock and atomic replacement.",
  );
  process.exit(0);
}
for (const k of [
  "bot",
  "id",
  "change",
  "status",
  "base",
  "candidate",
  "evidence",
] as const)
  if (!v[k]) throw Error(`Missing --${k}`);
if (!/^[a-zA-Z0-9_-]+$/.test(v.id!)) throw Error("Invalid history ID");
const labels: Record<string, string> = {
  pending: "PENDING",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
  error: "ERROR",
  superseded: "SUPERSEDED",
};
if (!labels[v.status!]) throw Error("Invalid status");
if (v.status !== "pending" && !v.reason)
  throw Error("Completed entries require --reason");
if (
  ["accepted", "rejected"].includes(v.status!) &&
  (v.delta === undefined || !Number.isFinite(Number(v.delta)))
)
  throw Error("Decision requires numeric --delta");
const clean = (s: string) =>
  s
    .replace(/[\r\n]+/g, " ")
    .replace(/[[\]`]/g, "")
    .trim();
const file = path.resolve(v.bot!, "improvement-history.md"),
  lock = file + ".lock",
  temporary = file + `.${process.pid}.tmp`;
await mkdir(lock);
try {
  let text = "# Improvement history\n\n";
  try {
    text = await readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const rules = [...new Set(v.rules ?? [])].sort();
  if (rules.some((r) => !/^[a-zA-Z0-9_.-]+$/.test(r)))
    throw Error("Invalid rule ID");
  const hash = v["candidate-hash"];
  if (hash && !/^[a-f0-9]{64}$/.test(hash))
    throw Error("Invalid candidate hash");
  const fingerprint = hash ? ` · candidate-hash: ${hash}` : "";
  const ruleSet = rules.length ? ` · rules: ${rules.join(",")}` : "";
  if (
    v.status === "pending" &&
    hash &&
    text
      .split("\n")
      .some(
        (line) =>
          !line.startsWith(`- ${v.id} · `) &&
          line.includes(` · base: ${clean(v.base!)} ·`) &&
          line.includes(fingerprint) &&
          / · (REJECTED|ERROR|ACCEPTED)/.test(line),
      )
  )
    throw Error(
      "Duplicate candidate against the same accepted version; change the rule/source before retrying",
    );
  const prefix = `- ${v.id} · `;
  const delta =
    v.delta === undefined
      ? ""
      : ` · ${Number(v.delta) > 0 ? "+" : ""}${Number(v.delta)} pp`;
  const reason = v.reason ? ` — ${clean(v.reason)}` : "";
  const line = `${prefix}${labels[v.status!]}${delta} · ${clean(v.change!)}${reason} · base: ${clean(v.base!)}${fingerprint}${ruleSet} · [candidate](<${path.resolve(v.candidate!)}>) · [evidence](<${path.resolve(v.evidence!)}>)`;
  const lines = text.trimEnd().split("\n");
  const existing = lines.findIndex((l) => l.startsWith(prefix));
  if (existing < 0) {
    if (!lines.some((l) => l.startsWith("- ")) && lines.at(-1) !== "")
      lines.push("");
    lines.push(line);
  } else lines[existing] = line;
  await writeFile(temporary, lines.join("\n") + "\n", { flag: "wx" });
  await rename(temporary, file);
  console.log(file);
} finally {
  await rm(temporary, { force: true });
  await rm(lock, { recursive: true });
}
