import { workflowGates } from "../../../../scripts/bot-improvement/workflow-gates.ts";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const transitions = Object.freeze({
  prepare: Object.freeze({ ready: "evaluate" }),
  evaluate: Object.freeze({ complete: "decide", "slice-ready": "evaluate" }),
  decide: Object.freeze({ complete: "analyze" }),
  analyze: Object.freeze({ continue: "replay", complete: "deliver" }),
  replay: Object.freeze({ validated: "assemble", none: "deliver" }),
  assemble: Object.freeze({ ready: "evaluate" }),
  deliver: Object.freeze({ complete: "closed" }),
});

function stageExists(stage) {
  return Object.hasOwn(transitions, stage);
}

export function nextStage(stage, event) {
  if (!stageExists(stage)) throw new Error(`Not an active stage: ${stage}`);
  if (event === "suspend") return "suspended";
  const next = transitions[stage][event];
  if (!Object.hasOwn(transitions[stage], event))
    throw new Error(`Invalid transition: ${stage} / ${event}`);
  return next;
}

export function taskText(markdown, stage) {
  if (stage !== "suspended" && !stageExists(stage))
    throw new Error(`Unknown task stage: ${stage}`);
  const split = markdown.indexOf("\n## Workflow\n");
  if (split < 0) throw new Error("Missing workflow section");
  const heading = stage[0].toUpperCase() + stage.slice(1);
  const marker = `\n### ${heading}\n`;
  const start = markdown.indexOf(marker, split);
  if (start < 0) throw new Error(`Missing stage instructions: ${stage}`);
  const end = markdown.indexOf("\n### ", start + marker.length);
  const links = markdown.indexOf("\n[runner]:", start);
  const boundary = Math.min(
    ...[end, links, markdown.length].filter((n) => n >= 0),
  );
  if (links < 0) throw new Error("Missing reference definitions");
  return `${markdown.slice(0, split).trim()}\n\n## Current task: ${heading}\n${markdown.slice(start + marker.length, boundary).trim()}\n\n${markdown.slice(links).trim()}\n`;
}

export function commandStage(args) {
  const [command, stage, event] = args;
  if (command === "task" && args.length === 2) return stage;
  if (command === "advance" && args.length === 3)
    return nextStage(stage, event);
  // Authorization and verified run evidence are caller obligations, not CLI flags.
  if (command === "resume" && args.length === 2 && stageExists(stage))
    return stage;
  throw new Error(
    "Usage: workflow-controller.mjs task STAGE | advance STAGE EVENT | resume PRIOR-STAGE",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv[2] === "gate") {
      const result = workflowGates(JSON.parse(await readFile(process.argv[3],"utf8")));
      process.stdout.write(JSON.stringify(result)+"\n");
      process.exit(0);
    }
    const stage = commandStage(process.argv.slice(2));
    if (stage === "closed") process.stdout.write("Closed\n");
    else {
      const markdown = await readFile(
        new URL("../SKILL.md", import.meta.url),
        "utf8",
      );
      process.stdout.write(taskText(markdown, stage));
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
