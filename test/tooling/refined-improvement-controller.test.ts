import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  commandStage,
  nextStage,
  taskText,
  transitions,
} from "../../.agents/skills/ai-bot-self-improvement/scripts/workflow-controller.mjs";

const skill = await readFile(
  new URL(
    "../../.agents/skills/ai-bot-self-improvement/SKILL.md",
    import.meta.url,
  ),
  "utf8",
);

test("stage progression preserves decision-before-analysis and repair evaluation", () => {
  let stage = "prepare";
  for (const [event, expected] of [
    ["ready", "evaluate"],
    ["complete", "decide"],
    ["complete", "analyze"],
    ["continue", "replay"],
    ["validated", "assemble"],
    ["ready", "evaluate"],
  ]) {
    stage = nextStage(stage, event!);
    assert.equal(stage, expected);
  }
  assert.equal(nextStage("evaluate", "slice-ready"), "evaluate");
  assert.equal(nextStage("analyze", "complete"), "deliver");
  assert.equal(nextStage("replay", "none"), "deliver");
  assert.equal(nextStage("deliver", "complete"), "closed");
  assert.throws(() => nextStage("evaluate", "validated"));
  assert.throws(() => nextStage("decide", "ready"));
});

test("suspension cannot silently advance or close", () => {
  for (const stage of Object.keys(transitions))
    assert.equal(nextStage(stage, "suspend"), "suspended");
  assert.throws(() => nextStage("suspended", "complete"));
  assert.throws(() => nextStage("closed", "ready"));
  assert.equal(commandStage(["resume", "analyze"]), "analyze");
  assert.throws(() => commandStage(["resume", "closed"]));
  assert.throws(() => commandStage(["advance", "prepare", "ready", "extra"]));
  assert.throws(() => nextStage("__proto__", "ready"));
  assert.throws(() => nextStage("prepare", "constructor"));
});

test("every task includes inherited gates and links, with only its own stage actions", () => {
  for (const stage of [...Object.keys(transitions), "suspended"]) {
    const task = taskText(skill, stage);
    assert.match(task, /All stages inherit/);
    assert.match(task, /## Incident policy/);
    assert.match(task, /## Output and artifact lifecycle/);
    assert.match(task, /\[runner\]:/);
    assert.equal((task.match(/## Current task:/g) ?? []).length, 1);
    assert.equal((task.match(/^### /gm) ?? []).length, 0);
    for (const other of Object.keys(transitions)) {
      if (other !== stage) {
        const label = other.charAt(0).toUpperCase() + other.slice(1);
        assert.ok(!task.includes(`## Current task: ${label}\n`));
      }
    }
  }
  assert.match(
    taskText(skill, "replay"),
    /Read history and the pending-rule ledger/,
  );
  assert.match(
    taskText(skill, "replay"),
    /carry pending entries and their full accumulated replay stacks/,
  );
  assert.match(
    taskText(skill, "replay"),
    /validated, pending, blocked and proven-discarded outcomes/,
  );
  assert.doesNotMatch(taskText(skill, "replay"), /### Assemble/);
  assert.throws(() =>
    taskText(skill.replace("## Workflow", "## Missing"), "prepare"),
  );
  assert.throws(() => taskText(skill, "closed"));
});
