import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const snapshot = process.env.ARO2_ACCEPTANCE_SNAPSHOT;
const binary = resolve(
  "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
);
test(
  "campaign resumes budgets and replaces partial or fabricated responses within the same logical agent",
  { skip: !snapshot || process.platform !== "linux", timeout: 180000 },
  () => {
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
    const root = mkdtempSync(resolve("generated/campaign-recovery-test-"));
    const prepared = spawnSync(
      process.execPath,
      ["scripts/bot-campaign/prepare-freeplay.ts", root, snapshot!, "1", "1"],
      { encoding: "utf8" },
    );
    assert.equal(prepared.status, 0, prepared.stderr);
    const path = join(root, "campaign.json");
    const c = JSON.parse(readFileSync(path, "utf8"));
    const agent = join(root, "agent.mjs");
    writeFileSync(
      agent,
      `import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const r=JSON.parse(readFileSync('request.json','utf8'));const home=process.env.BOT_AGENT_STATE;
if(!existsSync(home+'/crashed')){writeFileSync(home+'/crashed','once');writeFileSync('response.json','{"no_change":');process.exit(1);}
writeFileSync(home+'/session.json',JSON.stringify({session_id:r.logical_agent_id,model:'test-fixture'}));
if(!existsSync(home+'/invalid')){writeFileSync(home+'/invalid','once');const ref=JSON.parse(readFileSync(r.evidence_index,'utf8'))[0];writeFileSync('response.json',JSON.stringify({no_change:false,diagnosis:'Invalid citation fixture',evidence:[{path:ref.path,game_id:'invented-game'}],play_changes:'none',sideboarding_changes:'none',tests:'none'}));process.exit(0);}
writeFileSync('response.json',JSON.stringify({no_change:true,diagnosis:'No supported improvement in this fixture'}));`,
    );
    c.agent = [process.execPath, agent];
    c.command_inputs.push(agent);
    c.max_games = 4;
    c.max_retries = 0;
    writeFileSync(path, JSON.stringify(c));
    const run = (resume = false) =>
      spawnSync(
        binary,
        ["campaign", "--config", path, ...(resume ? ["--resume"] : [])],
        { encoding: "utf8", timeout: 120000 },
      );
    const statePath = join(c.output, "state.json");
    assert.equal(run().status, 2);
    const stopped = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(stopped.status, "incomplete");
    assert.equal(stopped.reason, "game_budget");
    assert.equal(stopped.completed_rounds, 0);
    assert.equal(stopped.reserved_games, 4);
    const completedJobs = Object.entries(stopped.jobs);
    assert.equal(completedJobs.length, 1);
    const [completedJobKey, completedJob] = completedJobs[0]!;
    c.max_games = 100;
    writeFileSync(path, JSON.stringify(c));
    assert.equal(
      run(true).status,
      2,
      "Malformed response exhausts the declared attempt budget",
    );
    const partial = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(partial.reserved_games, 8);
    const failed = Object.values(partial.proposals)[0] as {
      directory: string;
      status: string;
    };
    assert.equal(failed.status, "failed");
    assert.equal(
      readFileSync(join(failed.directory, "response.json"), "utf8"),
      '{"no_change":',
    );
    c.max_retries = 2;
    writeFileSync(path, JSON.stringify(c));
    const resumed = run(true);
    assert.equal(
      resumed.status,
      0,
      resumed.stderr +
        resumed.stdout +
        readFileSync(statePath, "utf8").slice(-500),
    );
    const final = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(final.completed_rounds, 1);
    assert.equal(final.budget_extensions.length, 2);
    assert.equal(final.reserved_games, 16); // two diagnostics + two final ranking comparisons
    assert.deepEqual(final.jobs[completedJobKey], completedJob);
    assert.equal(
      final.abandoned.filter(
        (a: { kind: string }) => a.kind === "agent_attempt",
      ).length,
      4,
    );
    for (const id of Object.keys(final.decks)) {
      assert.equal(final.decks[id].agent_id, stopped.decks[id].agent_id);
      assert.equal(final.rounds[0].decisions[id].outcome, "no_change");
      assert.equal(final.proposals[`r1-${id}`].attempts, 3);
    }
    c.matches = 2;
    writeFileSync(path, JSON.stringify(c));
    assert.equal(
      run(true).status,
      1,
      "Changing sample size must not be a budget extension",
    );
    c.matches = 1;
    writeFileSync(path, JSON.stringify(c));
    const proposal = Object.values(final.proposals)[0] as { directory: string };
    writeFileSync(join(proposal.directory, "response.json"), "{}");
    assert.equal(
      run(true).status,
      1,
      "Finalized proposal tampering must be rejected",
    );
  },
);
