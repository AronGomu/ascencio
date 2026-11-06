import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const snapshot = process.env.ARO2_ACCEPTANCE_SNAPSHOT;
test(
  "cross-deck duplicate proposals remain unassessable without blocking rounds or inventing ranking scores",
  {
    skip: !snapshot || process.platform !== "linux",
    timeout: 180000,
  },
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
    const root = mkdtempSync(resolve("generated/campaign-support-test-"));
    const setup = spawnSync(
      process.execPath,
      ["scripts/bot-campaign/prepare-freeplay.ts", root, snapshot!, "2", "1"],
      { encoding: "utf8" },
    );
    assert.equal(setup.status, 0, setup.stderr);
    const config = join(root, "campaign.json");
    const c = JSON.parse(readFileSync(config, "utf8"));
    const agent = join(root, "agent.mjs");
    writeFileSync(
      agent,
      `import {readFileSync,writeFileSync} from 'node:fs';
const r=JSON.parse(readFileSync('request.json','utf8'));
writeFileSync(process.env.BOT_AGENT_STATE+'/session.json',JSON.stringify({session_id:r.logical_agent_id,model:'test-fixture'}));
const ref=JSON.parse(readFileSync(r.evidence_index,'utf8'))[0];
const duplicate=r.logical_agent_id.startsWith('deck-freeplay-player-');
if(duplicate)writeFileSync('config.json',JSON.stringify({avoidNormalSpellSet:true}));
writeFileSync('response.json',JSON.stringify({no_change:!duplicate,diagnosis:'Cross-deck duplicate fixture',evidence:[{path:ref.path,game_id:ref.games[0].game_id}],play_changes:'Use existing boolean option',sideboarding_changes:'none',tests:'Supervisor validates and assesses'}));`,
    );
    c.agent = [process.execPath, agent];
    c.command_inputs.push(agent);
    writeFileSync(config, JSON.stringify(c));
    const binary = resolve(
      "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
    );
    const run = (resume = false) =>
      spawnSync(
        binary,
        ["campaign", "--config", config, ...(resume ? ["--resume"] : [])],
        { encoding: "utf8", timeout: 150000 },
      );
    const result = run();
    const statePath = join(c.output, "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(
      result.status,
      0,
      result.stderr + JSON.stringify(state.reason),
    );
    assert.equal(state.completed_rounds, 2);
    assert.equal(state.reserved_games, 20);
    const player = state.decks["freeplay-player"];
    assert.equal(player.versions.length, 2);
    assert.equal(
      player.versions[1].id,
      state.decks["freeplay-opponent"].incumbent,
    );
    assert.equal(player.incumbent, player.versions[0].id);
    for (const round of state.rounds) {
      const decision = round.decisions["freeplay-player"];
      assert.equal(decision.outcome, "unassessable_no_common_opponents");
      assert.equal(decision.comparison.assessment, null);
      assert.deepEqual(decision.comparison.candidate, []);
      assert.equal(decision.comparison.excluded.length, 2);
    }
    const ranking = state.rankings[0].rankings["freeplay-player"];
    assert.equal(ranking.status, "unassessable_retained_previous_pool");
    assert.equal(ranking.considered.length, 2);
    assert.deepEqual(ranking.ranking, []);
    assert.equal(ranking.retained_from.label, "initial_roster");
    assert.deepEqual(state.pool["freeplay-player"], [player.incumbent]);
    for (const job of Object.values(state.jobs) as {
      version: string;
      opponent: string;
    }[])
      assert.notEqual(job.version, job.opponent);
    const before = readFileSync(statePath, "utf8");
    assert.equal(run(true).status, 0);
    assert.equal(readFileSync(statePath, "utf8"), before);
    const relocated = join(root, "relocated");
    cpSync(join(c.output, "final"), relocated, { recursive: true });
    const packages = JSON.parse(
      readFileSync(join(relocated, "packages.json"), "utf8"),
    );
    for (const pkg of Object.values(packages) as { module: string }[]) {
      assert.equal(isAbsolute(pkg.module), false);
      const loaded = await import(
        pathToFileURL(join(relocated, pkg.module)).href
      );
      assert.equal(typeof loaded.createBotModule, "function");
    }
  },
);
