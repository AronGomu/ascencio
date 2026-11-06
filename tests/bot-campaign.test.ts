import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
const snapshot = process.env.ARO2_ACCEPTANCE_SNAPSHOT;
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const binary = resolve(
  "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
);
test(
  "real multi-deck campaign freezes pools, resolves final proposals, retains sessions and resumes idempotently",
  { skip: !snapshot || process.platform !== "linux", timeout: 240000 },
  async () => {
    const root = mkdtempSync(resolve("generated/campaign-test-"));
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
          'import { baselineStrategy } from "./src/battle/worker/bot/generalist-strategy.ts"; export function createStrategy(dependencies, config) { if (typeof config.aggression !== "number" || config.aggression !== 0.5) throw Error("Configuration lost its scalar type"); return baselineStrategy(dependencies); }',
        resolveDir: process.cwd(),
      },
      bundle: true,
      platform: "browser",
      format: "esm",
      outfile: strategy,
    });
    const second = join(root, "second.mjs");
    writeFileSync(
      second,
      readFileSync(strategy, "utf8").replace("summon: 100", "summon: 99"),
    );
    const evaluation = join(root, "evaluation.xml");
    writeFileSync(
      evaluation,
      `<evaluation schema_version="1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><deck><path>${escape(resolve("content/freeplay/decks/player.ydk"))}</path></deck><bots><a><module>builtin:generalist</module><config/></a><b><module>builtin:generalist</module><config/></b></bots><batch><matches>1</matches><execution>sequential</execution></batch><rules><profile>mr5</profile><banlist>${escape(resolve("tests/fixtures/bot-evaluation/three-copy-rules.json"))}</banlist></rules><content><snapshot>${escape(snapshot!)}</snapshot></content><starting_orders><mode>normal</mode><fixture_path xsi:nil="true"/></starting_orders><limits><game_wall_time_ms>30000</game_wall_time_ms><decision_wall_time_ms>1000</decision_wall_time_ms><sideboarding_wall_time_ms>1000</sideboarding_wall_time_ms><max_turns_per_game>200</max_turns_per_game><max_decisions_per_game>100000</max_decisions_per_game></limits><output><directory>${root}/unused</directory></output></evaluation>`,
    );
    const agent = join(root, "agent.mjs");
    writeFileSync(
      agent,
      `import {readFileSync,writeFileSync} from 'node:fs';
 const r=JSON.parse(readFileSync('request.json','utf8'));
 const home=process.env.BOT_AGENT_STATE;
 let count=0;try { count=JSON.parse(readFileSync(home+'/session.json','utf8')).count; }catch{}
 writeFileSync(home+'/session.json',JSON.stringify({session_id:r.logical_agent_id,model:'test-fixture',count:count+1}));
 const index=JSON.parse(readFileSync(r.evidence_index,'utf8'));
 const ref=index.at(-1);
 writeFileSync('strategy.mjs',readFileSync('strategy.mjs','utf8')+'\\n// proposal round '+r.round);
 writeFileSync('response.json',JSON.stringify({no_change:false,diagnosis:'Test fixture - no strength claim',evidence:[{path:ref.path,game_id:ref.games[0].game_id}],play_changes:'Source-only proposal exercises inconclusive rejection',sideboarding_changes:'none',tests:'Trusted checks follow'}));`,
    );
    const output = join(root, "campaign");
    const config = join(root, "campaign.json");
    const value = {
      evaluation,
      output,
      decks: [
        {
          id: "player",
          deck: resolve("content/freeplay/decks/player.ydk"),
          strategy,
          config: { aggression: 0.5 },
        },
        {
          id: "opponent",
          deck: resolve("content/freeplay/decks/opponent.ydk"),
          strategy: second,
          config: { aggression: 0.5 },
        },
      ],
      agent: [process.execPath, agent],
      bug_agent: ["false"],
      checks: [
        [
          process.execPath,
          "--experimental-vm-modules",
          resolve("scripts/bot-improvement/check-strategy.ts"),
        ],
      ],
      recovery_checks: [["true"]],
      command_inputs: [agent],
      rounds: 2,
      matches: 1,
      max_games: 200,
      max_wall_ms: 240000,
      max_bytes: 500000000,
      agent_timeout_ms: 10000,
      evaluation_timeout_ms: 60000,
      check_timeout_ms: 10000,
      recovery_timeout_ms: 10000,
      max_retries: 1,
      max_fixes: 1,
    };
    writeFileSync(config, JSON.stringify(value));
    const run = (resume = false) =>
      spawnSync(
        binary,
        ["campaign", "--config", config, ...(resume ? ["--resume"] : [])],
        { encoding: "utf8", timeout: 200000 },
      );
    const result = run();
    assert.equal(
      result.status,
      0,
      result.stderr +
        result.stdout +
        readFileSync(join(output, "state.json"), "utf8").slice(-2000),
    );
    const state = JSON.parse(readFileSync(join(output, "state.json"), "utf8"));
    assert.equal(state.completed_rounds, 2);
    assert.equal(state.status, "completed");
    for (const id of ["player", "opponent"]) {
      assert.equal(state.decks[id].incumbent, state.decks[id].versions[0].id);
      assert.equal(state.decks[id].versions.length, 3);
      assert.equal(
        JSON.parse(
          readFileSync(join(output, "agents", id, "session.json"), "utf8"),
        ).count,
        2,
      );
      for (const round of state.rounds)
        assert.equal(
          round.decisions[id].outcome,
          "rejected_regression_or_inconclusive",
        );
    }
    assert.equal(state.rankings.length, 1);
    assert.equal(state.rankings[0].rankings.player.ranking.length, 3);
    const jobs = Object.values(state.jobs) as {
      deck: "player" | "opponent";
      opponent_deck: "player" | "opponent";
      result: { run: string };
    }[];
    assert.ok(jobs.length > 0);
    const firstJob = jobs[0]!;
    const manifest = readFileSync(
      join(firstJob.result.run, "manifest.xml"),
      "utf8",
    );
    assert.match(manifest, /<opponent_deck>/);
    const deckSection = (xml: string, name: string) => {
      const matches = [
        ...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "g")),
      ];
      const body = matches.find(
        (match) =>
          !["deck", "opponent_deck"].includes(name) ||
          match[1]!.includes("<main>"),
      )?.[1];
      assert.ok(body, `Missing ${name}`);
      return body;
    };
    const deckHash = (xml: string, name: string) => {
      const hash = deckSection(xml, name).match(
        /<sha256>([a-f0-9]{64})<\/sha256>/,
      )?.[1];
      assert.ok(hash, `Missing ${name} hash`);
      return hash;
    };
    assert.notEqual(
      deckHash(manifest, "deck"),
      deckHash(manifest, "opponent_deck"),
    );
    function expectedMain(deck: "player" | "opponent") {
      const cards = readFileSync(
        resolve(`content/freeplay/decks/${deck}.ydk`),
        "utf8",
      )
        .split("#main")[1]!
        .split("#extra")[0]!
        .trim()
        .split(/\s+/);
      return cards.reduce<Record<string, number>>((counts, card) => {
        counts[card] = (counts[card] ?? 0) + 1;
        return counts;
      }, {});
    }
    function reportedMain(xml: string) {
      const main = deckSection(xml, "main");
      return Object.fromEntries(
        [...main.matchAll(/<card>([\s\S]*?)<\/card>/g)].map((entry) => {
          const card = entry[1]!.match(/<card_code>(\d+)<\/card_code>/)?.[1];
          const copies = entry[1]!.match(/<copies>(\d+)<\/copies>/)?.[1];
          assert.ok(card && copies);
          return [card, Number(copies)];
        }),
      );
    }
    for (const job of jobs) {
      const savedManifest = readFileSync(
        join(job.result.run, "manifest.xml"),
        "utf8",
      );
      assert.deepEqual(
        reportedMain(deckSection(savedManifest, "deck")),
        expectedMain(job.deck),
      );
      assert.deepEqual(
        reportedMain(deckSection(savedManifest, "opponent_deck")),
        expectedMain(job.opponent_deck),
      );
      for (const [actor, deck] of [
        ["a", job.deck],
        ["b", job.opponent_deck],
      ] as const) {
        const report = readFileSync(
          join(job.result.run, `matches/match-000001/player-${actor}.xml`),
          "utf8",
        );
        assert.match(report, new RegExp(`<perspective>${actor}</perspective>`));
        const ownConfigurations = [
          ...report.matchAll(
            /<own_configuration>([\s\S]*?)<\/own_configuration>/g,
          ),
        ];
        assert.equal(ownConfigurations.length, 4);
        for (const own of ownConfigurations)
          assert.deepEqual(reportedMain(own[1]!), expectedMain(deck));
      }
      const match = readFileSync(
        join(job.result.run, "matches/match-000001/match.xml"),
        "utf8",
      );
      assert.equal((match.match(/<number>[1-4]<\/number>/g) ?? []).length, 4);
    }
    const before = readFileSync(join(output, "state.json"), "utf8");
    assert.equal(run(true).status, 0);
    assert.equal(readFileSync(join(output, "state.json"), "utf8"), before);
    assert.match(
      readFileSync(join(output, "report.md"), "utf8"),
      /2 \/ 2 rounds/,
    );
    assert.equal(readdirSync(join(output, "versions")).length, 6);
  },
);
