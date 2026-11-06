import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  cpSync,
  unlinkSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const snapshot = process.env.ARO2_ACCEPTANCE_SNAPSHOT;
const executable = resolve(
  "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
);
const root = resolve(`generated/bot-evaluation-validation/${Date.now()}`);
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
function config(
  name: string,
  matches = 1,
  module = "builtin:basic",
  fixture?: string,
) {
  mkdirSync(root, { recursive: true });
  const file = join(root, `${name}.xml`);
  writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?><evaluation schema_version="1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><deck><path>${escape(resolve("content/freeplay/decks/player.ydk"))}</path></deck><bots><a><module>${escape(module)}</module><config/></a><b><module>builtin:basic</module><config/></b></bots><batch><matches>${matches}</matches><execution>sequential</execution></batch><rules><profile>mr5</profile><banlist>${escape(resolve("tests/fixtures/bot-evaluation/three-copy-rules.json"))}</banlist></rules><content><snapshot>${escape(snapshot!)}</snapshot></content><starting_orders><mode>${fixture ? "fixture" : "normal"}</mode><fixture_path${fixture ? ">" + escape(fixture) + "</fixture_path>" : ' xsi:nil="true"/>'}</starting_orders><limits><game_wall_time_ms>10000</game_wall_time_ms><decision_wall_time_ms>1000</decision_wall_time_ms><sideboarding_wall_time_ms>1000</sideboarding_wall_time_ms><max_turns_per_game>200</max_turns_per_game><max_decisions_per_game>100000</max_decisions_per_game></limits><output><directory>${escape(join(root, name))}</directory></output><performance_target><warm_game_p95_ms>1000</warm_game_p95_ms></performance_target></evaluation>`,
  );
  return file;
}
function cli(args: string[], status = 0) {
  const r = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, ARO2_NODE: process.execPath },
  });
  assert.equal(r.status, status, r.stdout + r.stderr);
  return r.stdout.trim();
}
const read = (dir: string, file: string) =>
  readFileSync(join(dir, file), "utf8");
const field = (s: string, k: string) =>
  s.match(new RegExp(`<${k}>([^<]*)</${k}>`))?.[1];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
test(
  "real-core Rust evaluation, schemas, failure recovery, fixture and resume",
  { skip: !snapshot, timeout: 180000 },
  async () => {
    const build = spawnSync(
      "cargo",
      [
        "build",
        "--release",
        "--manifest-path",
        "tools/bot-evaluation/Cargo.toml",
      ],
      { encoding: "utf8" },
    );
    assert.equal(build.status, 0, build.stderr);
    const cfg = config("normal");
    cli(["benchmark", "--config", cfg], 1); // Wrong latency goal is rejected.
    writeFileSync(
      cfg,
      readFileSync(cfg, "utf8").replace(
        "<warm_game_p95_ms>1000",
        "<warm_game_p95_ms>100",
      ),
    );
    cli(["benchmark", "--config", cfg, "--resume", "ignored"], 1);
    const tooMany = config("not-a-sample", 2);
    writeFileSync(
      tooMany,
      readFileSync(tooMany, "utf8").replace(
        "<warm_game_p95_ms>1000",
        "<warm_game_p95_ms>100",
      ),
    );
    cli(["benchmark", "--config", tooMany], 1);
    const run = cli(["benchmark", "--config", cfg]);
    const summary = read(run, "summary.xml");
    const samples = summary.match(/<game_samples>(.*?)<\/game_samples>/)![1]!;
    const timings = [
      ...samples.matchAll(/<duration_ms>(.*?)<\/duration_ms>/g),
    ].map((m) => Number(m[1]));
    assert.equal(timings.length, 4);
    assert.ok(timings.every((t) => t > 0));
    assert.ok(
      Number(field(summary, "end_to_end_ms")) >=
        timings.reduce((a, b) => a + b, 0),
    );
    assert.ok(Number(field(summary, "startup_ms")) > 0);
    assert.match(
      summary,
      /<criterion>all_four_games_strictly_below_limit<\/criterion>/,
    );
    const target = summary.match(
      /<acceptance_target>(.*?)<\/acceptance_target>/,
    )![1]!;
    assert.equal(
      field(target, "passed"),
      String(timings.every((t) => t < 100)),
    );
    for (const [i, sample] of [
      ...samples.matchAll(/<game>(.*?)<\/game>/g),
    ].entries()) {
      assert.equal(field(sample[1]!, "passed"), String(timings[i]! < 100));
      assert.match(sample[1]!, /<filesystem_ms>/);
      assert.match(sample[1]!, /<schema_validation_ms>/);
    }
    assert.match(summary, /<measurement_boundary>.*fsync.*host shutdown/);
    assert.equal(field(summary, "handles_created"), "4");
    assert.equal(field(summary, "handles_destroyed"), "4");
    assert.equal(field(summary, "games_completed"), "4");
    assert.equal(field(summary, "games_failed"), "0");
    assert.equal(existsSync(join(run, "bugs")), false);
    const manifest = hash(read(run, "manifest.xml"));
    const report = read(run, "matches/match-000001/player-a.xml");
    assert.match(report, /<reason>/);
    assert.match(report, /<own_starting_order>/);
    assert.match(report, /<caused_by_decision_id/);
    for (const [i, malformed] of [
      report.replace(
        /<initial>.*?<\/initial>/,
        '<initial xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>',
      ),
      report.replace(/<reason>.*?<\/reason>/, ""),
      report.replace(/<timeline>.*?<\/timeline>/, ""),
    ].entries()) {
      const file = join(root, `invalid-perspective-${i}.xml`);
      writeFileSync(file, malformed);
      cli(["validate", "--file", file, "--root", "player-report"], 1);
    }
    cli(["evaluate", "--config", cfg, "--resume", run]);
    assert.equal(hash(read(run, "manifest.xml")), manifest);
    assert.equal(read(run, "summary.xml"), summary);
    // Saved orders are accepted only as an explicit fixture, never implicit production seeding.
    const reports = [report, read(run, "matches/match-000001/player-b.xml")];
    const orders = reports.map((r) =>
      [...r.matchAll(/<own_starting_order>(.*?)<\/own_starting_order>/g)].map(
        (m) => m[1],
      ),
    );
    const fixture = join(root, "orders.xml");
    writeFileSync(
      fixture,
      `<starting-orders schema_version="1"><matches><match><number>1</number><games>${[0, 1, 2, 3].map((i) => `<game><number>${i + 1}</number><a>${orders[0]![i]}</a><b>${orders[1]![i]}</b></game>`).join("")}</games></match></matches></starting-orders>`,
    );
    // The input and manifest fixture trees share strict four-game/order schemas.
    cli(["validate", "--file", fixture, "--root", "starting-orders"]);
    const fixtureXml = readFileSync(fixture, "utf8");
    const malformedFixtures = [
      fixtureXml.replace(/<game>.*?<\/game>/, ""),
      fixtureXml.replace("<number>4</number>", "<number>5</number>"),
      fixtureXml.replace(/<card>\d+<\/card>/, "<card>not-a-card-code</card>"),
      fixtureXml.replace(/<a>.*?<\/a>/, ""),
    ];
    for (const [i, source] of malformedFixtures.entries()) {
      const invalidFixture = join(root, `invalid-orders-${i}.xml`);
      writeFileSync(invalidFixture, source);
      cli(
        ["validate", "--file", invalidFixture, "--root", "starting-orders"],
        1,
      );
    }
    const fixtureRun = cli([
      "evaluate",
      "--config",
      config("fixture", 1, "builtin:basic", fixture),
    ]);
    for (const [i, actor] of ["a", "b"].entries()) {
      const saved = [
        ...read(
          fixtureRun,
          `matches/match-000001/player-${actor}.xml`,
        ).matchAll(/<own_starting_order>(.*?)<\/own_starting_order>/g),
      ].map((m) => m[1]);
      assert.deepEqual(saved, orders[i]);
    }
    for (const kind of ["invalid", "hang"]) {
      const f = config(
        kind,
        2,
        resolve(`tests/fixtures/bot-evaluation/${kind}-bot.ts`),
      );
      const failed = cli(["evaluate", "--config", f], 2);
      const s = read(failed, "summary.xml");
      assert.equal(field(s, "games_failed"), "2");
      assert.equal(field(s, "games_skipped"), "6");
      assert.equal(field(s, "matches_incomplete"), "2");
      const tickets = readdirSync(join(failed, "bugs")).filter(
        (f) => !f.endsWith(".diagnostics.xml"),
      );
      assert.equal(tickets.length, 1);
      assert.equal(
        field(read(failed, `bugs/${tickets[0]}`), "occurrence_count"),
        "2",
      );
      cli(["evaluate", "--config", f, "--resume", failed], 2);
      const failureComparison = join(root, `comparison-${kind}`);
      cli([
        "compare",
        "--baseline",
        run,
        "--candidate",
        failed,
        "--out",
        failureComparison,
      ]);
      const reliability = read(failureComparison, "comparison.xml");
      assert.match(reliability, /<reliability_changes>/);
      assert.match(reliability, /<delta_count>2<\/delta_count>/);
      assert.match(
        read(failureComparison, "report.xml"),
        /<reference path="[^"]*bugs\/bug-[^"]+\.xml"/,
      );
    }
    for (const hang of [false, true]) {
      const sideFailureCfg = config(
        `side-failure-${hang}`,
        2,
        resolve("tests/fixtures/bot-evaluation/sideboard-failure-bot.ts"),
      );
      if (hang)
        writeFileSync(
          sideFailureCfg,
          readFileSync(sideFailureCfg, "utf8").replace(
            "<config/>",
            "<config><hang>true</hang></config>",
          ),
        );
      const sideFailureRun = cli(["evaluate", "--config", sideFailureCfg], 2);
      const sf = read(sideFailureRun, "summary.xml");
      assert.equal(field(sf, "games_completed"), "4");
      assert.equal(field(sf, "games_failed"), "0");
      assert.equal(field(sf, "games_skipped"), "4");
      assert.equal(field(sf, "matches_incomplete"), "2");
      const tickets = readdirSync(join(sideFailureRun, "bugs")).filter(
        (f) => !f.endsWith(".diagnostics.xml"),
      );
      assert.equal(tickets.length, 1);
      assert.equal(
        field(read(sideFailureRun, `bugs/${tickets[0]}`), "occurrence_count"),
        "2",
      );
    }
    const limitedCfg = config("turn-limit");
    writeFileSync(
      limitedCfg,
      readFileSync(limitedCfg, "utf8").replace(
        "<max_turns_per_game>200</max_turns_per_game>",
        "<max_turns_per_game>1</max_turns_per_game>",
      ),
    );
    const limitedRun = cli(["evaluate", "--config", limitedCfg], 2);
    assert.equal(field(read(limitedRun, "summary.xml"), "games_failed"), "1");
    if (process.platform === "linux") {
      const crashCfg = config("host-crash", 2);
      const worker = spawn(executable, ["evaluate", "--config", crashCfg], {
        env: { ...process.env, ARO2_NODE: process.execPath },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "",
        errors = "";
      worker.stdout.on("data", (b) => (output += b));
      worker.stderr.on("data", (b) => (errors += b));
      const closed = new Promise<number | null>((resolve) =>
        worker.on("close", resolve),
      );
      let killed = false;
      for (let i = 0; i < 500; i++) {
        const dir = join(root, "host-crash");
        if (existsSync(dir)) {
          const name = readdirSync(dir)[0];
          if (name && existsSync(join(dir, name, "progress.xml"))) {
            const children = readFileSync(
              `/proc/${worker.pid}/task/${worker.pid}/children`,
              "utf8",
            )
              .trim()
              .split(/\s+/)
              .filter(Boolean);
            if (children[0]) {
              process.kill(Number(children[0]), "SIGKILL");
              killed = true;
              break;
            }
          }
        }
        await new Promise((r) => setTimeout(r, 5));
      }
      assert.ok(killed);
      assert.equal(await closed, 2, output + errors);
      const crashed = output.trim();
      const summary = read(crashed, "summary.xml");
      assert.equal(field(summary, "games_failed"), "1");
      assert.equal(field(summary, "matches_incomplete"), "1");
      assert.equal(
        Number(field(summary, "games_completed")) +
          Number(field(summary, "games_failed")) +
          Number(field(summary, "games_skipped")),
        8,
      );
    }
    const interruptedCfg = config("interrupted", 3);
    const child = spawn(executable, ["evaluate", "--config", interruptedCfg], {
      env: { ...process.env, ARO2_NODE: process.execPath },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "",
      errors = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (errors += b));
    const closed = new Promise<number | null>((resolve) =>
      child.on("close", resolve),
    );
    let interruptedRun = "";
    for (let i = 0; i < 500; i++) {
      const outputRoot = join(root, "interrupted");
      if (existsSync(outputRoot)) {
        const first = readdirSync(outputRoot)[0];
        if (first) {
          interruptedRun = join(outputRoot, first);
          const p = join(interruptedRun, "progress.xml");
          if (existsSync(p) && readFileSync(p, "utf8").includes("<game_id>")) {
            child.kill("SIGINT");
            break;
          }
        }
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(await closed, 2, output + errors);
    const beforeResume = read(interruptedRun, "matches/match-000001/match.xml");
    assert.equal(
      field(read(interruptedRun, "progress.xml"), "status"),
      "interrupted",
    );
    const previousElapsed = Number(
      field(read(interruptedRun, "summary.xml"), "elapsed_ms"),
    );
    // A process killed before summary persistence has valid game evidence but no
    // complete batch timing checkpoint. Recovery must not invent throughput.
    const noTimingRun = join(root, "recovery-without-timing");
    cpSync(interruptedRun, noTimingRun, { recursive: true });
    unlinkSync(join(noTimingRun, "summary.xml"));
    unlinkSync(join(noTimingRun, "report.xml"));
    cli(["evaluate", "--config", interruptedCfg, "--resume", noTimingRun], 2);
    const noTimingSummary = read(noTimingRun, "summary.xml");
    assert.equal(field(noTimingSummary, "timing_complete"), "false");
    assert.match(
      noTimingSummary,
      /<completed_games_per_second xsi:nil="true"\s*\/>/,
    );
    assert.match(
      noTimingSummary,
      /<peak_resident_memory_bytes xsi:nil="true"\s*\/>/,
    );
    cli(
      ["evaluate", "--config", interruptedCfg, "--resume", interruptedRun],
      2,
    );
    assert.equal(
      read(interruptedRun, "matches/match-000001/match.xml"),
      beforeResume,
    );
    const recovered = read(interruptedRun, "summary.xml");
    assert.equal(field(recovered, "timing_complete"), "true");
    assert.ok(Number(field(recovered, "elapsed_ms")) >= previousElapsed);
    assert.equal(
      Number(field(recovered, "games_completed")) +
        Number(field(recovered, "games_failed")) +
        Number(field(recovered, "games_skipped")),
      12,
    );
    const sideCfg = config(
      "sideboard",
      1,
      resolve("tests/fixtures/bot-evaluation/exchange-bot.ts"),
    );
    writeFileSync(
      sideCfg,
      readFileSync(sideCfg, "utf8").replace(
        escape(resolve("content/freeplay/decks/player.ydk")),
        escape(resolve("tests/fixtures/bot-evaluation/sideboard.ydk")),
      ),
    );
    const sideRun = cli(["evaluate", "--config", sideCfg]);
    const sideReport = read(sideRun, "matches/match-000001/player-a.xml");
    assert.equal(field(read(sideRun, "summary.xml"), "games_completed"), "4");
    assert.equal([...sideReport.matchAll(/<exchange>/g)].length, 2);
    const configurations = [
      ...sideReport.matchAll(
        /<configuration_sha256>(.*?)<\/configuration_sha256>/g,
      ),
    ].map((m) => m[1]);
    assert.equal(configurations.length, 4);
    assert.equal(configurations[0], configurations[1]);
    assert.equal(configurations[2], configurations[3]);
    assert.notEqual(configurations[0], configurations[2]);
    const referenceCfg = config("sideboard-reference");
    writeFileSync(
      referenceCfg,
      readFileSync(referenceCfg, "utf8").replace(
        escape(resolve("content/freeplay/decks/player.ydk")),
        escape(resolve("tests/fixtures/bot-evaluation/sideboard.ydk")),
      ),
    );
    const referenceRun = cli(["evaluate", "--config", referenceCfg]);
    const isolatedComparison = join(root, "isolated-comparison");
    cli([
      "compare",
      "--baseline",
      referenceRun,
      "--candidate",
      sideRun,
      "--out",
      isolatedComparison,
    ]);
    assert.match(
      read(isolatedComparison, "comparison.xml"),
      /<confounded>false<\/confounded>/,
    );
    assert.match(
      read(isolatedComparison, "comparison.xml"),
      /<changed_bot>a<\/changed_bot>/,
    );
    assert.match(
      read(isolatedComparison, "report.xml"),
      /<section>sideboarding<\/section>/,
    );
    const comparison = join(root, "comparison");
    cli([
      "compare",
      "--baseline",
      run,
      "--candidate",
      fixtureRun,
      "--out",
      comparison,
    ]);
    assert.match(
      read(comparison, "comparison.xml"),
      /<confounded>true<\/confounded>/,
    );
    // Every persisted result is XML and validates against its named bundled schema.
    function validate(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) validate(path);
        else {
          assert.ok(entry.name.endsWith(".xml"));
          const content = readFileSync(path, "utf8");
          const tag = content.match(/<(?!\?)([\w-]+)(?:\s|>)/)![1]!;
          cli(["validate", "--file", path, "--root", tag]);
        }
      }
    }
    for (const dir of [run, fixtureRun, comparison, interruptedRun, sideRun])
      validate(dir);
    const progressBeforeTampering = read(run, "progress.xml");
    const broken = report.replace(
      /<card_code>(\d+)<\/card_code>/,
      "<card_code>999999999</card_code>",
    );
    writeFileSync(join(run, "matches/match-000001/player-a.xml"), broken);
    cli(["evaluate", "--config", cfg, "--resume", run], 1);
    writeFileSync(join(run, "matches/match-000001/player-a.xml"), report);
    writeFileSync(join(run, "progress.xml"), progressBeforeTampering);
    writeFileSync(
      join(root, "validation.xml"),
      `<evaluation-report schema_version="1"><run_id>targeted-real-core</run_id><manifest_path>${escape(run)}/manifest.xml</manifest_path><summary_path>${escape(run)}/summary.xml</summary_path><configuration_description>Real-core targeted acceptance cases</configuration_description><results><metric_references/><observations><observation>Normal and fixture execution, XML schemas, invalid decisions, stuck bot recovery, grouped bugs, comparison and immutable completed resume passed.</observation></observations></results><decision_investigations/><sideboarding/><performance_and_reliability/><comparison_references/><limitations><limitation>This targeted run is not the 10000-match soak.</limitation></limitations></evaluation-report>`,
    );
  },
);
