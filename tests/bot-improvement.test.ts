import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
const snapshot = process.env.ARO2_ACCEPTANCE_SNAPSHOT;
const binary = resolve(
  "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
);
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
test(
  "bounded improvement runs real matches, rejects inconclusive proposals, and resumes without resetting budgets",
  { skip: !snapshot || process.platform !== "linux", timeout: 180000 },
  async () => {
    const root = mkdtempSync(resolve("generated/loop-test-"));
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
    const strategy = join(root, "initial.mjs");
    await build({
      stdin: {
        contents:
          'export { baselineStrategy as createStrategy } from "./src/battle/worker/bot/generalist-strategy.ts";',
        resolveDir: process.cwd(),
      },
      bundle: true,
      platform: "browser",
      format: "esm",
      outfile: strategy,
    });
    const evaluation = join(root, "evaluation.xml");
    writeFileSync(
      evaluation,
      `<evaluation schema_version="1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><deck><path>${escape(resolve("content/freeplay/decks/player.ydk"))}</path></deck><bots><a><module>builtin:generalist</module><config/></a><b><module>builtin:generalist</module><config/></b></bots><batch><matches>1</matches><execution>sequential</execution></batch><rules><profile>mr5</profile><banlist>${escape(resolve("tests/fixtures/bot-evaluation/three-copy-rules.json"))}</banlist></rules><content><snapshot>${escape(snapshot!)}</snapshot></content><starting_orders><mode>normal</mode><fixture_path xsi:nil="true"/></starting_orders><limits><game_wall_time_ms>30000</game_wall_time_ms><decision_wall_time_ms>1000</decision_wall_time_ms><sideboarding_wall_time_ms>1000</sideboarding_wall_time_ms><max_turns_per_game>200</max_turns_per_game><max_decisions_per_game>100000</max_decisions_per_game></limits><output><directory>${root}/unused</directory></output></evaluation>`,
    );
    const agent = join(root, "agent.mjs");
    writeFileSync(
      agent,
      `import {readFileSync,writeFileSync,symlinkSync} from 'node:fs';
const request=JSON.parse(readFileSync('request.json','utf8'));
if(process.argv[2]==='failure' && request.iteration===1) {symlinkSync('.', 'abandoned-link'); throw new Error('intentional agent failure');}
const no_change=process.argv[2]==='failure';
if(!no_change) writeFileSync('strategy.mjs',readFileSync('strategy.mjs','utf8').replace('summon: 100','summon: 101'));
writeFileSync('response.json',JSON.stringify({no_change,diagnosis:'Protocol regression fixture; no strength claim', evidence:[{path:request.evidence.run+'/matches/match-000001/player-a.xml',game_id:'match-000001-game-1'}],play_changes:'small summon score change',sideboarding_changes:'none',tests:'trusted checks follow'}));`,
    );
    function configure(name: string, mode: string) {
      const output = join(root, name);
      const config = join(root, `${name}.json`);
      writeFileSync(
        config,
        JSON.stringify({
          evaluation,
          initial_strategy: strategy,
          output,
          agent: [process.execPath, agent, mode],
          checks: [
            [
              process.execPath,
              "--experimental-vm-modules",
              resolve("scripts/bot-improvement/check-strategy.ts"),
            ],
          ],
          max_iterations: 2,
          max_games: 40,
          max_no_improvement: 2,
          development_matches: 1,
          confirmation_matches: 1,
          max_wall_ms: 120000,
          agent_timeout_ms: 10000,
          check_timeout_ms: 10000,
          evaluation_timeout_ms: 30000,
          max_bytes: 100000000,
        }),
      );
      return { output, config };
    }
    function run(config: string, resume = false) {
      return spawnSync(
        binary,
        ["improve", "--config", config, ...(resume ? ["--resume"] : [])],
        { encoding: "utf8", timeout: 120000 },
      );
    }
    const normal = configure("normal", "candidate");
    const result = run(normal.config);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const state = JSON.parse(
      readFileSync(join(normal.output, "state.json"), "utf8"),
    );
    assert.equal(state.status, "completed");
    assert.equal(state.incumbent, state.baseline);
    assert.equal(state.history.length, 2);
    assert.equal(state.next_iteration, 3);
    assert.equal(readdirSync(join(normal.output, "versions")).length, 2);
    assert.ok(
      state.history.every((h: { outcome: string }) =>
        h.outcome.startsWith("rejected"),
      ),
    );
    const before = readFileSync(join(normal.output, "state.json"), "utf8");
    assert.equal(run(normal.config, true).status, 0);
    assert.equal(
      readFileSync(join(normal.output, "state.json"), "utf8"),
      before,
    );
    const failed = configure("failure", "failure");
    assert.equal(run(failed.config).status, 2);
    const old = JSON.parse(
      readFileSync(join(failed.output, "state.json"), "utf8"),
    );
    assert.equal(old.status, "incomplete");
    assert.equal(old.reserved_games, 4);
    assert.equal(run(failed.config, true).status, 0);
    const resumed = JSON.parse(
      readFileSync(join(failed.output, "state.json"), "utf8"),
    );
    assert.equal(resumed.history[0].outcome, "abandoned_interrupted");
    assert.equal(resumed.history[1].outcome, "no_change");
    assert.equal(resumed.reserved_games, 8);
    assert.equal(resumed.incumbent, resumed.baseline);
    const changed = JSON.parse(readFileSync(failed.config, "utf8"));
    changed.max_games++;
    writeFileSync(failed.config, JSON.stringify(changed));
    assert.equal(run(failed.config, true).status, 1);
  },
);

test("external strategy factories receive realm-local card metadata including bigint, without scripts", () => {
  const source = `
    import assert from 'node:assert/strict';
    import { instantiate } from './scripts/bot-evaluation/host-inputs.ts';
    const artifact = {module:'external',config:{},dependencies:[],source:
      'export function createBotModule(d) { if (Object.keys(d).join() !== "cards" || d.cards.get(42).race !== 1n || Object.getPrototypeOf(d) !== Object.prototype || !(d.cards instanceof Map)) throw Error("Invalid metadata boundary"); return {contractVersion:1,create() {return {decide() {return "ok"},sideboard() {return "ok"}}}} }'};
    const bot = await instantiate(artifact, {cards:new Map([[42,{race:1n}]]),scripts:new Map([['private','script']])});
    assert.equal(bot.decide({}), 'ok');
  `;
  const result = spawnSync(
    process.execPath,
    ["--experimental-vm-modules", "--input-type=module", "-e", source],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
});
