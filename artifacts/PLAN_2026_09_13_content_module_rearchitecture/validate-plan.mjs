import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(directory, "ticket-manifest.json"), "utf8"));
const index = fs.readFileSync(path.resolve(repository, manifest.plan), "utf8");
const catalog = fs.readFileSync(path.join(directory, "CONTRACTS.md"), "utf8");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const contracts = (text) => new Map([...text.matchAll(/### Contract `([^`]+)`\n\n```ts\n([\s\S]*?)\n```/g)].map((match) => [match[1], match[2]]));
const expected = contracts(catalog);
const tickets = new Map(manifest.tickets.map((ticket) => [ticket.id, ticket]));
const seen = new Set();
const ancestors = (id) => {
  const result = new Set();
  const visit = (current) => {
    for (const dependency of tickets.get(current)?.depends ?? []) {
      if (result.has(dependency)) continue;
      result.add(dependency);
      visit(dependency);
    }
  };
  visit(id);
  return result;
};
const requiredSections = ["Context (self-contained)", "Requirements", "Inputs", "Interface contract (level 5)", "TDD", "Test plan", "Impl steps", "Validation"];
let snippets = 0;
for (const ticket of manifest.tickets) {
  check(!seen.has(ticket.id), `Duplicate ticket ${ticket.id}`);
  for (const dependency of ticket.depends) check(seen.has(dependency), `${ticket.id} not topologically sorted after ${dependency}`);
  seen.add(ticket.id);
  const filename = path.join(directory, ticket.path);
  check(fs.existsSync(filename), `Missing ${filename}`);
  if (!fs.existsSync(filename)) continue;
  const text = fs.readFileSync(filename, "utf8");
  for (const section of requiredSections) check(text.includes(`## ${section}\n`), `${ticket.id} missing ${section}`);
  check(text.includes("**Commit outcome:**"), `${ticket.id} missing commit outcome`);
  check(text.includes("**Integration links:**"), `${ticket.id} missing integration trace`);
  check(text.includes("**Errors:**"), `${ticket.id} missing error contract`);
  check(text.includes("**Invariants:**"), `${ticket.id} missing invariants`);
  check(text.includes(`**Depends:** ${ticket.depends.join(", ") || "none"}`), `${ticket.id} Depends mismatch`);
  check(!text.includes("- [x]"), `${ticket.id} implementation checkbox incorrectly completed`);
  for (const match of text.matchAll(/^- \[ \] (.*)$/gm)) check(/^[A-Z]\d+\./.test(match[1]), `${ticket.id} action missing ID: ${match[1]}`);
  const actual = contracts(text);
  for (const name of [...ticket.produces, ...ticket.consumes]) {
    check(actual.has(name), `${ticket.id} lacks embedded ${name} contract`);
    check(actual.get(name) === expected.get(name), `${ticket.id} ${name} signature differs from catalog`);
  }
  const preceding = ancestors(ticket.id);
  for (const name of ticket.consumes) check([...preceding].some((id) => tickets.get(id).produces.includes(name)), `${ticket.id} consumes ${name} before producer`);
  for (const [name, code] of actual) {
    snippets += 1;
    const source = ts.createSourceFile(`${ticket.id}-${name}.ts`, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const diagnostic of source.parseDiagnostics) errors.push(`${ticket.id}/${name}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
  }
  check(index.includes(`[[${path.basename(directory)}/${ticket.path.replace(/\.md$/, "")}]]`), `${ticket.id} missing Obsidian index link`);
  check(new RegExp(`\\| ${ticket.id} \\|[^\\n]*\\| NOT STARTED \\|`).test(index), `${ticket.id} state not NOT STARTED`);
}
const actualEdges = [...index.matchAll(/^\s*(T\d+).*?-->\s*(T\d+)/gm)].map((match) => `${match[1]}->${match[2]}`).sort();
const requiredEdges = manifest.tickets.flatMap((ticket) => ticket.depends.map((dependency) => `${dependency}->${ticket.id}`)).sort();
check(JSON.stringify(actualEdges) === JSON.stringify(requiredEdges), "Mermaid edges differ from ticket dependencies");
for (const match of index.matchAll(/\[\[([^\]]+)\]\]/g)) check(fs.existsSync(path.join(repository, "artifacts", `${match[1]}.md`)), `Broken index link ${match[1]}`);
for (const filename of fs.readdirSync(path.join(repository, "docs/ADR")).filter((name) => /^(089|090|091|092|093|094)_/.test(name))) {
  const text = fs.readFileSync(path.join(repository, "docs/ADR", filename), "utf8");
  check(!/artifacts\/|\.tmp\/|\[[ x]\]/.test(text), `${filename} contains ephemeral link or checkbox`);
  for (const section of ["Context", "Decision", "Consequences", "Alternatives rejected"]) check(text.includes(`## ${section}`), `${filename} lacks ${section}`);
  check(text.includes("> Status: accepted; planned"), `${filename} falsely marked implemented`);
  check(/^D1\./m.test(text), `${filename} lacks numbered decision clauses`);
}
const htmlPath = path.join(repository, "artifacts", `${path.basename(directory)}.html`);
check(fs.existsSync(htmlPath), "Standalone plan HTML missing");
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, "utf8");
  check(!/<script[^>]+src=|<link[^>]+href=/i.test(html), "HTML has external dependency");
  for (const ticket of manifest.tickets) check(html.includes(`id="${ticket.id}"`), `HTML lacks ${ticket.id}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${tickets.size} tickets; ${requiredEdges.length} DAG edges; ${snippets} embedded contract copies; TypeScript syntax; index links; 6 ADRs; offline HTML structure.`);
  console.log("LIMIT: proposed contracts syntax-checked, not typechecked against unimplemented modules; no implementation behavior asserted.");
}
