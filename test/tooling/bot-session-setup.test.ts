import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  cp,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
import {
  schedule,
  deckOrder,
  resolveMatchCount,
  digest,
} from "../../scripts/bot-improvement/session-fixtures.ts";
import { prepareMatches } from "../../scripts/bot-improvement/run-matches.ts";
import { executeMatches } from "../../scripts/bot-improvement/archive/run-matches.ts";
import { controlSession } from "../../scripts/bot-improvement/control-session.ts";
import { prepareIteration } from "../../scripts/bot-improvement/prepare-iteration.ts";

const deck = {
  main: Array.from({ length: 40 }, (_, i) => cardCode(i + 1)),
  extra: [cardCode(50), cardCode(51)],
  side: [cardCode(60)],
};
test("250 default deterministic four-game fixtures cover self-play, even slots, stable remainder and separate random streams", () => {
  const self = schedule("seed", deck, []);
  assert.equal(self.length, 250);
  assert.equal(self.flatMap((m) => m.games).length, 1000);
  assert.ok(self.every((m) => m.opponentSlot === "self"));
  const counts = (n: number) =>
    Object.values(
      schedule(
        "seed",
        deck,
        Array.from({ length: n }, () => deck),
      ).reduce<Record<string, number>>((a, m) => {
        a[m.opponentSlot] = (a[m.opponentSlot] ?? 0) + 1;
        return a;
      }, {}),
    );
  assert.deepEqual(counts(1), [125, 125]);
  assert.deepEqual(counts(2), [84, 83, 83]);
  assert.deepEqual(self, schedule("seed", deck, []));
  assert.notDeepEqual(self, schedule("different", deck, []));
  const games = self[0]!.games;
  assert.deepEqual(
    games.map((g) => g.starter),
    ["a", "b", "a", "b"],
  );
  assert.deepEqual(
    games.map((g) => g.stage),
    ["pre_side", "pre_side", "post_side", "post_side"],
  );
  assert.deepEqual(
    games[0]!.orders![0],
    deckOrder(deck, games[0]!.shuffleSeeds[0]!),
  );
  assert.deepEqual(
    [...games[0]!.orders![0]!.main].sort((a, b) => a - b),
    deck.main,
  );
  assert.equal(games[2]!.orders, null);
  assert.equal(
    new Set(self.flatMap((m) => m.games.flatMap((g) => g.engineSeed))).size,
    4000,
  );
  assert.notEqual(games[0]!.botSeeds[0], games[0]!.botSeeds[1]);
});

test("configurable schedules preserve seeds and orders, cover per-opponent allocations and reject invalid counts", () => {
  const initial = schedule("seed", deck, [deck], 2500);
  for (const count of [1, 250, 501, 750]) {
    const matches = schedule("seed", deck, [deck], count);
    assert.equal(matches.length, count);
    assert.deepEqual(matches, initial.slice(0, count));
  }
  assert.equal(resolveMatchCount(undefined, undefined, 2), 250);
  assert.equal(resolveMatchCount(undefined, 250, 2), 750);
  const allocations = schedule(
    "seed",
    deck,
    [deck, deck],
    resolveMatchCount(undefined, 250, 2),
  );
  for (const slot of ["opponent-1", "opponent-2", "self"])
    assert.equal(
      allocations.filter((m) => m.opponentSlot === slot).length,
      250,
    );
  for (const count of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(() => resolveMatchCount(count, undefined, 0));
    assert.throws(() => resolveMatchCount(undefined, count, 0));
  }
  assert.throws(() => resolveMatchCount(250, 250, 1), /not both/);
  assert.throws(() => resolveMatchCount(undefined, Number.MAX_SAFE_INTEGER, 1));
});

test("setup CLI atomically publishes durable inputs, validates reuse, archives sources and preserves failures", async (t) => {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/session-setup-test-"));
  const content = path.join(root, "content"),
    target = path.join(root, "target");
  const write = async (file: string, value: unknown) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value));
  };
  const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
  const run = (_request: unknown, ok = true) => {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        "scripts/bot-improvement/setup-session.ts",
        path.join(root, "request.json"),
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    if (ok) assert.equal(result.status, 0, result.stderr);
    else assert.notEqual(result.status, 0, result.stdout);
    return ok ? JSON.parse(result.stdout) : result.stderr;
  };
  try {
    for (const id of ["card-library", "duel-core"])
      await write(path.join(content, id, "critical.json"), {
        schemaVersion: 1,
        compilerVersion: 1,
        manifest: { packageId: id, version: "1.0.0" },
        cards:
          id === "card-library"
            ? Array.from({ length: 14 }, (_, i) => ({
                definition: {
                  code: i + 1,
                  type: 1,
                  alias: 0,
                  setcodes: [],
                  race: "1",
                  linkMarker: 0,
                },
                texts: [],
              }))
            : [],
        scripts: [],
        config: id === "duel-core" ? { strings: {} } : {},
      });
    await mkdir(target);
    await writeFile(
      path.join(target, "deck.ydk"),
      `#main\n${Array.from({ length: 40 }, (_, i) => (i % 14) + 1).join("\n")}\n#extra\n!side\n`,
    );
    await write(path.join(target, "rules.json"), []);
    const bot = {
      schemaVersion: 1,
      deck: "deck.ydk",
      content: "../content",
      banlist: "rules.json",
      profile: "mr5",
      configuration: {},
      module: "./bot.ts",
    };
    await writeFile(
      path.join(target, "bot.ts"),
      "export const contractVersion=1; export const create=()=>({decide(){},sideboard(){}});",
    );
    await write(path.join(target, "evaluation.json"), bot);
    const request = {
      target,
      opponents: [],
      setupSeed: "explicit-seed",
      session: path.join(root, "session-1"),
      stop: { maxIterations: 2 },
    };
    await write(path.join(root, "request.json"), request);
    const first = run(request);
    assert.equal(first.games, 1000);
    const originalSetupConfig = await readFile(
      path.join(target, "evaluation.json"),
    );
    await t.test(
      "configured counts flow through frozen verification, prepared jobs and baseline receipts",
      async () => {
        for (const matches of [250, 750]) {
          const custom = {
            ...request,
            setupSeed: `explicit-count-${matches}`,
            matches,
            session: path.join(root, `session-${matches}`),
          };
          await write(path.join(root, "request.json"), custom);
          const result = run(custom);
          assert.equal(result.matches, matches);
          assert.equal(result.games, matches * 4);
          const plan = await prepareIteration({
            session: result.session,
            iteration: 1,
            runnerIdentity: "test-runner-v1",
          });
          assert.equal(plan.plan.matchesPerEvaluation, matches);
          assert.equal(plan.plan.gamesPerEvaluation, matches * 4);
          const job = await prepareMatches({ session: result.session });
          assert.equal(job.job.matches.length, matches);
          assert.equal(job.totalMatches, matches);
          assert.equal(
            (await prepareMatches({ session: result.session, matchCount: 1 }))
              .job.matches.length,
            1,
          );
          await assert.rejects(
            prepareMatches({
              session: result.session,
              matchCount: matches + 1,
            }),
            /Match count/,
          );
          await write(path.join(root, "request.json"), {
            ...custom,
            session: custom.session + "-reuse",
            reuse: result.fixture,
            matches: matches + 1,
          });
          assert.match(
            run(custom, false),
            /Reuse identity mismatch|Frozen|reuse/i,
          );
        }
        await write(path.join(root, "request.json"), request);
      },
    );
    await t.test(
      "per-opponent CLI freezes a small full plan; only full completions publish reusable receipts",
      async () => {
        const small = path.join(root, "small");
        const cli = spawnSync(
          process.execPath,
          [
            "--experimental-vm-modules",
            "scripts/bot-improvement/setup-session.ts",
            "--target",
            target,
            "--seed",
            request.setupSeed,
            "--session",
            small,
            "--max-iterations",
            "2",
            "--matches-per-opponent",
            "3",
          ],
          { encoding: "utf8", timeout: 30000 },
        );
        assert.equal(cli.status, 0, cli.stderr);
        assert.equal(JSON.parse(cli.stdout).matches, 3);
        const fake = path.join(root, "fake-runner.mjs");
        await writeFile(
          fake,
          `#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const job=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--job')+1],'utf8'));const out=process.argv[process.argv.indexOf('--out')+1];fs.mkdirSync(out,{recursive:true});
for(const m of job.matches){const p=path.join(out,'matches',m.match.id);fs.mkdirSync(p,{recursive:true});fs.writeFileSync(path.join(p,'done.json'),JSON.stringify({match:m.match.id}));}
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({completedGames:job.matches.length*4,failedGames:0,skippedGames:0,failures:{}}));
`,
          { mode: 0o755 },
        );
        const full = await executeMatches({
          session: small,
          out: path.join(small, "evaluations/full"),
          workers: "1",
          binary: fake,
        });
        assert.ok(full.receipt);
        const receipt = await read(full.receipt!);
        assert.equal(receipt.completedMatches.length, 3);
        assert.equal(Object.keys(receipt.matches).length, 3);
        for (const evidence of Object.values(receipt.matches) as {
          path: string;
          sha256: string;
        }[])
          assert.equal(
            digest(
              await readFile(
                path.join(path.dirname(full.receipt!), evidence.path),
              ),
            ),
            evidence.sha256,
          );
        const reused = await prepareIteration({
          session: small,
          iteration: 1,
          runnerIdentity: "frozen-rust-match-pool/v1",
          baseline: full.receipt!,
        });
        assert.equal(reused.baseline.action, "reuse");
        const subset = await executeMatches({
          session: small,
          out: path.join(small, "evaluations/subset"),
          workers: "1",
          binary: fake,
          matchCount: 2,
        });
        assert.equal(subset.receipt, null);
      },
    );

    // Count-specific setup cases publish their own bot-side fixture reference.
    // Restore the initial reference before asserting the original setup below.
    await writeFile(path.join(target, "evaluation.json"), originalSetupConfig);
    await t.test(
      "published setup feeds preparation and session control without conversion",
      async () => {
        const prepared = await prepareIteration({
          session: first.session,
          iteration: 1,
          runnerIdentity: "test-runner-v1",
        });
        assert.equal(prepared.fixture.identity, first.identity);
        assert.equal(prepared.control.identity, prepared.self.identity);
        assert.equal(prepared.baseline.action, "refresh");
        const plan = await controlSession(first.session, {
          action: "start",
          iteration: 1,
        });
        assert.equal(plan.mayStart, true);
        assert.equal(plan.completedGames, 0);
        assert.equal(plan.accepted.identity, prepared.control.identity);
      },
    );
    assert.ok(
      first.fixture.startsWith(path.join(target, "evaluation", "fixtures")),
    );
    const manifest = await read(path.join(first.fixture, "manifest.json"));
    assert.equal(manifest.target.kind, "module");
    assert.equal(
      (await read(path.join(target, "evaluation.json"))).fixtures.identity,
      first.identity,
    );
    assert.equal(
      (await read(path.join(first.session, "state.json"))).status,
      "ready",
    );
    const archived = await readFile(
      path.join(first.fixture, "versions/initial/bot.mjs"),
      "utf8",
    );
    const reuse = {
      ...request,
      session: path.join(root, "session-2"),
      reuse: first.fixture,
    };
    await write(path.join(root, "request.json"), reuse);
    const flagRun = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        "scripts/bot-improvement/setup-session.ts",
        "--target",
        target,
        "--seed",
        request.setupSeed,
        "--session",
        reuse.session,
        "--reuse",
        first.fixture,
        "--max-iterations",
        "3",
        "--match-workers",
        "2",
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(flagRun.status, 0, flagRun.stderr);
    const second = JSON.parse(flagRun.stdout);
    assert.equal((await read(second.config)).limits.matchWorkers, 2);
    assert.equal(first.identity, second.identity);
    assert.deepEqual(
      (await read(path.join(second.fixture, "manifest.json"))).matches,
      manifest.matches,
    );
    const opponent = path.join(root, "opponent");
    await cp(target, opponent, {
      recursive: true,
      filter: (source) =>
        !source.includes(`${path.sep}evaluation${path.sep}`) &&
        path.basename(source) !== "evaluation",
    });
    const supplied = {
      ...request,
      opponents: [opponent],
      setupSeed: "opponent-seed",
      session: path.join(root, "supplied"),
    };
    await write(path.join(root, "request.json"), supplied);
    const suppliedResult = run(supplied);
    const suppliedManifest = await read(
      path.join(suppliedResult.fixture, "manifest.json"),
    );
    assert.equal(suppliedManifest.opponents.length, 1);
    const perOpponent = {
      ...supplied,
      matchesPerOpponent: 7,
      session: path.join(root, "per-opponent"),
    };
    await write(path.join(root, "request.json"), perOpponent);
    const perResult = run(perOpponent);
    assert.equal(perResult.matches, 14);
    assert.equal(perResult.games, 56);
    const perManifest = await read(
      path.join(perResult.fixture, "manifest.json"),
    );
    assert.equal(
      perManifest.matches.filter(
        (m: { opponentSlot: string }) => m.opponentSlot === "self",
      ).length,
      7,
    );
    assert.equal(
      perManifest.matches.filter(
        (m: { opponentSlot: string }) => m.opponentSlot === "opponent-1",
      ).length,
      7,
    );

    await writeFile(path.join(opponent, "bot.ts"), "later edits");
    assert.match(
      await readFile(
        path.join(suppliedResult.fixture, "opponents/opponent-1/bot.mjs"),
        "utf8",
      ),
      /contractVersion/,
    );
    await write(path.join(opponent, "evaluation.json"), {
      ...bot,
      profile: "mr3",
    });
    await write(path.join(root, "request.json"), {
      ...supplied,
      session: path.join(root, "mismatch"),
    });
    // Repair module so the rules comparison is the failure being tested.
    await cp(path.join(target, "bot.ts"), path.join(opponent, "bot.ts"));
    assert.match(run(supplied, false), /Engine\/content\/rules mismatch/);
    const currentConfig = await readFile(
      path.join(target, "evaluation.json"),
      "utf8",
    );
    // A fresh setup never silently reuses or replaces the existing deterministic location.
    await write(path.join(root, "request.json"), {
      ...request,
      session: path.join(root, "session-3"),
    });
    assert.match(run(request, false), /Already exists/);
    await writeFile(
      path.join(target, "bot.ts"),
      "export const contractVersion=1; export const create=()=>({decide(){return 2},sideboard(){}});",
    );
    await write(path.join(root, "request.json"), {
      ...reuse,
      session: path.join(root, "session-4"),
    });
    assert.match(run(reuse, false), /Reuse identity mismatch/);
    assert.equal(
      await readFile(
        path.join(first.fixture, "versions/initial/bot.mjs"),
        "utf8",
      ),
      archived,
    );
    assert.equal(
      await readFile(path.join(target, "evaluation.json"), "utf8"),
      currentConfig,
    );
    // Corrupted archives fail even when live inputs have not changed.
    await writeFile(
      path.join(first.fixture, "versions/initial/bot.mjs"),
      "corrupt",
    );
    assert.match(run(reuse, false), /Frozen input mismatch/);
    await write(path.join(root, "request.json"), {
      ...request,
      stop: { maxGames: 0 },
    });
    assert.match(run(request, false), /Invalid stopping condition/);
    await write(path.join(target, "evaluation.json"), {
      ...bot,
      deck: "missing.ydk",
    });
    await write(path.join(root, "request.json"), {
      ...request,
      session: path.join(root, "invalid"),
    });
    assert.match(run(request, false), /ENOENT/);
    await t.test("rejects retired Rust packages before compiling", async () => {
      const pkg = path.join(root, "package");
      await mkdir(pkg);
      await write(path.join(pkg, "evaluation.json"), {
        schemaVersion: 1,
        deck: "../target/deck.ydk",
        content: "../content",
        banlist: "../target/rules.json",
        profile: "mr5",
        policy: "generalist",
        configuration: {},
      });
      const packageRequest = {
        ...request,
        target: pkg,
        session: path.join(root, "package-session"),
      };
      await write(path.join(root, "request.json"), packageRequest);
      assert.match(run(packageRequest, false), /Rust AI packages are retired/);
    });
    await write(path.join(root, "request.json"), {
      ...request,
      session: path.join(root, "invalid"),
    });
    // Another setup's lock must survive our failed acquisition.
    await mkdir(path.join(target, ".evaluation-setup.lock"));
    assert.match(run(request, false), /EEXIST/);
    assert.ok(
      (await stat(path.join(target, ".evaluation-setup.lock"))).isDirectory(),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
