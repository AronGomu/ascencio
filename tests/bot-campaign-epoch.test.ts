import test from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
const snapshot = process.env.ARO2_ACCEPTANCE_SNAPSHOT;
const binary = resolve(
  "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
);
test(
  "a centrally validated shared fix creates an epoch, refreshes rankings, and reruns invalidated real-engine work",
  { skip: !snapshot || process.platform !== "linux", timeout: 240000 },
  async () => {
    const built = spawnSync(
      "cargo",
      [
        "build",
        "--release",
        "--manifest-path",
        "tools/bot-evaluation/Cargo.toml",
      ],
      { encoding: "utf8" },
    );
    assert.equal(built.status, 0, built.stderr);
    const root = mkdtempSync(resolve("generated/campaign-epoch-test-"));
    const fixture = join(root, "repository");
    mkdirSync(fixture);
    // This isolated fixture repository permits failure injection without changing
    // a running campaign's or the owner's source tree.
    for (const path of [
      "scripts",
      "src",
      "schemas",
      "vendor",
      "content/freeplay",
      "tests/fixtures/bot-evaluation",
      "package.json",
      "package-lock.json",
    ]) {
      const target = join(fixture, path);
      mkdirSync(resolve(target, ".."), { recursive: true });
      cpSync(resolve(path), target, { recursive: true });
    }
    symlinkSync(resolve("node_modules"), join(fixture, "node_modules"));
    assert.equal(spawnSync("git", ["init", "-q", fixture]).status, 0);
    const setup = spawnSync(
      process.execPath,
      [
        join(fixture, "scripts/bot-campaign/prepare-freeplay.ts"),
        join(root, "inputs"),
        snapshot!,
        "1",
        "1",
      ],
      { cwd: fixture, encoding: "utf8" },
    );
    assert.equal(setup.status, 0, setup.stderr);
    const host = join(
      fixture,
      "scripts/bot-evaluation/recoverable-strategy.mjs",
    );
    const original = readFileSync(host, "utf8");
    writeFileSync(
      host,
      "throw new Error('injected epoch regression');\n" + original,
    );
    const agent = join(root, "agent.mjs");
    writeFileSync(
      agent,
      `import {readFileSync,writeFileSync} from 'node:fs';
const r=JSON.parse(readFileSync('request.json','utf8'));const home=process.env.BOT_AGENT_STATE;
writeFileSync(home+'/session.json',JSON.stringify({session_id:r.logical_agent_id??r.bug_id,model:r.kind==='bug_fix'?'gpt-6.1-sol':'test-fixture',effort:'high'}));
if(r.kind==='bug_fix'){
 if(r.attempt===1){writeFileSync('response.json','{"resolution":');await new Promise(resolve=>globalThis.setTimeout(resolve,120000));process.exit(1);}
 writeFileSync('fix.patch',"diff --git a/scripts/bot-evaluation/recoverable-strategy.mjs b/scripts/bot-evaluation/recoverable-strategy.mjs\\n--- a/scripts/bot-evaluation/recoverable-strategy.mjs\\n+++ b/scripts/bot-evaluation/recoverable-strategy.mjs\\n@@ -1,2 +1,1 @@\\n-throw new Error('injected epoch regression');\\n"+" "+${JSON.stringify(original.split("\n")[0])}+"\\n");
 writeFileSync('response.json',JSON.stringify({resolution:'fix',root_cause:'test-fixture-startup-throw',diagnosis:'Remove injected startup failure',tests:'Dedicated regression command checks removal; real comparisons rerun'}));
}else writeFileSync('response.json',JSON.stringify({no_change:true,diagnosis:'Protocol fixture; no strategic claim'}));`,
    );
    const config = join(root, "inputs/campaign.json");
    const c = JSON.parse(readFileSync(config, "utf8"));
    c.agent = [process.execPath, agent];
    c.bug_agent = [process.execPath, agent];
    c.command_inputs = [agent];
    c.recovery_checks = [
      [
        process.execPath,
        "-e",
        `const fs=require('fs');if(fs.readFileSync('scripts/bot-evaluation/recoverable-strategy.mjs','utf8').includes('injected epoch regression'))process.exit(1);`,
      ],
    ];
    c.evaluation_timeout_ms = 30000;
    c.max_wall_ms = 180000;
    c.max_retries = 0;
    writeFileSync(config, JSON.stringify(c));
    const child = spawn(binary, ["campaign", "--config", config], {
      cwd: fixture,
      stdio: "ignore",
    });
    const ended = new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    const statePath = join(c.output, "state.json");
    let interrupted:
      { directory: string; status: string; attempts: number } | undefined;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline && child.exitCode === null) {
      if (existsSync(statePath)) {
        const checkpoint = JSON.parse(readFileSync(statePath, "utf8"));
        interrupted = Object.values(checkpoint.bugs)[0] as typeof interrupted;
        if (
          interrupted &&
          existsSync(join(interrupted.directory, "response.json"))
        )
          break;
      }
      await setTimeout(100);
    }
    writeFileSync(join(c.output, "CANCEL"), "test interruption");
    assert.equal(await ended, 2);
    assert.ok(interrupted);
    const stopped = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(stopped.reason, "cancelled");
    assert.equal(stopped.reserved_games, 4);
    assert.equal(Object.values(stopped.bugs).length, 1);
    assert.equal(
      (Object.values(stopped.bugs)[0] as { status: string }).status,
      "running",
    );
    unlinkSync(join(c.output, "CANCEL"));
    const exhausted = spawnSync(
      binary,
      ["campaign", "--config", config, "--resume"],
      { cwd: fixture, encoding: "utf8", timeout: 30000 },
    );
    assert.equal(exhausted.status, 2);
    const bounded = JSON.parse(readFileSync(statePath, "utf8"));
    assert.match(bounded.reason, /diagnosis_retry_budget/);
    assert.equal(
      bounded.reserved_games,
      4,
      "No new evaluation is reserved before interrupted diagnosis finishes",
    );
    c.max_retries = 1;
    writeFileSync(config, JSON.stringify(c));
    const result = spawnSync(
      binary,
      ["campaign", "--config", config, "--resume"],
      {
        cwd: fixture,
        encoding: "utf8",
        timeout: 200000,
      },
    );
    const s = JSON.parse(readFileSync(join(c.output, "state.json"), "utf8"));
    assert.equal(
      result.status,
      0,
      result.stderr +
        result.stdout +
        JSON.stringify({ reason: s.reason, bugs: s.bugs }),
    );
    assert.equal(s.epoch, 1);
    assert.equal(s.completed_rounds, 1);
    assert.equal(s.fixes.length, 1);
    assert.equal(s.rounds[0].epoch, 1);
    assert.equal(s.rankings.length, 2);
    assert.ok(s.rankings.every((r: { epoch: number }) => r.epoch === 1));
    assert.equal(readFileSync(host, "utf8"), original);
    assert.ok(
      s.abandoned.some(
        (a: { reason?: string }) => a.reason === "shared_behavior_fix",
      ),
    );
    assert.ok(
      s.abandoned.some(
        (a: { kind?: string }) => a.kind === "diagnosis_attempt",
      ),
    );
    assert.equal(
      (Object.values(s.bugs)[0] as { attempts: number }).attempts,
      2,
    );
    assert.equal(
      readFileSync(join(interrupted.directory, "response.json"), "utf8"),
      '{"resolution":',
    );
    assert.equal(
      Object.values(s.jobs).filter((j) => (j as { epoch: number }).epoch === 0)
        .length,
      1,
    );
    const jobs = Object.values(s.jobs) as { epoch: number; status: string }[];
    assert.ok(jobs.some((j) => j.epoch === 0 && j.status === "quarantined"));
    assert.ok(
      jobs.filter((j) => j.status === "completed").every((j) => j.epoch === 1),
    );
    assert.equal(s.fixes[0].execution.model, "gpt-6.1-sol");
    assert.equal(s.fixes[0].execution.effort, "high");
    assert.equal(
      readFileSync(
        resolve("scripts/bot-evaluation/recoverable-strategy.mjs"),
        "utf8",
      ),
      original,
    );
    const exported = JSON.parse(
      readFileSync(join(c.output, "final/packages.json"), "utf8"),
    );
    assert.equal(Object.keys(exported).length, 2);
  },
);
