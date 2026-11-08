import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  cp,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { validateCandidate } from "../../scripts/bot-improvement/validate-candidate.ts";
import {
  hashes,
  writeTree,
} from "../../scripts/bot-improvement/candidate-files.ts";
import {
  identity,
  schedule,
} from "../../scripts/bot-improvement/session-fixtures.ts";
import type {
  CandidateValidationRequest,
  FrozenBot,
  FrozenSetup,
} from "../../scripts/bot-improvement/session-contract.ts";

async function fixture(kind: "module" | "package" = "module") {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/candidate-validation-"));
  const archive = path.join(root, "fixture/versions/initial");
  const deck = { main: [], extra: [], side: [] };
  const files: Record<string, Buffer> = {
    "deck.json": Buffer.from(JSON.stringify(deck)),
    "configuration.json": Buffer.from("{}"),
  };
  let metadata;
  if (kind === "module") {
    const compiled = await build({
      entryPoints: ["src/battle/worker/bot/generalist-bot.ts"],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
    });
    files["bot.mjs"] = Buffer.from(compiled.outputFiles![0]!.contents);
    files["sources/0-generalist-bot.ts"] = await readFile(
      "src/battle/worker/bot/generalist-bot.ts",
    );
    metadata = { kind, module: "builtin:generalist", configuration: {}, deck };
  } else {
    for (const file of [
      "bot.json",
      "ai/Cargo.toml",
      "ai/Cargo.lock",
      ...["lib", "main", "wasm", "basic", "generalist", "selection"].map(
        (name) => `ai/src/${name}.rs`,
      ),
    ])
      files[file] = await readFile(path.join("assets/ai-bots/reference", file));
    files["dist/ai.wasm"] = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
    metadata = { kind, policy: "generalist", configuration: {}, deck };
  }
  const bot: FrozenBot = {
    ...metadata,
    files: hashes(files),
    identity: identity({ ...metadata, files: hashes(files) }),
  };
  await writeTree(archive, files);
  const contentFiles: Record<string, Buffer> = {};
  for (const id of ["card-library", "duel-core"]) {
    contentFiles[`content/${id}/critical.json`] = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        compilerVersion: 1,
        manifest: { packageId: id, version: "1.0.0" },
        cards:
          id === "card-library"
            ? [
                {
                  definition: {
                    code: 1,
                    type: 1,
                    alias: 0,
                    setcodes: [],
                    race: "1",
                    linkMarker: 0,
                    attack: 1234,
                  },
                  texts: [],
                },
              ]
            : [],
        scripts: [],
        config: id === "duel-core" ? { strings: {} } : {},
      }),
    );
  }
  await writeTree(path.join(root, "fixture"), contentFiles);
  const body = {
    schemaVersion: 1 as const,
    setupSeed: "validation-test",
    inputsIdentity: "test",
    profile: "mr5" as const,
    protocol: {
      gamesPerMatch: 4,
      sideboardAfterGame: 2,
      preserveSectionSizes: true,
      preserveTotalMultiset: true,
      shuffle: "sha256-counter-fisher-yates-v1",
      openingHand: "first-five-main-cards; normal-engine-first-turn-draw",
      randomness:
        "engine-u64x4; bot-u32-per-player-per-game; sideboard-u32-per-player",
    } as FrozenSetup["protocol"],
    target: bot,
    opponents: [],
    files: {
      ...Object.fromEntries(
        Object.entries(bot.files).map(([file, hash]) => [
          `versions/initial/${file}`,
          hash,
        ]),
      ),
      ...hashes(contentFiles),
    },
    matches: schedule("validation-test", deck, []),
  };
  const frozen = { ...body, identity: identity(body) };
  await writeFile(
    path.join(root, "fixture/manifest.json"),
    JSON.stringify(frozen),
  );
  const candidate = path.join(root, "workspace");
  await cp(archive, candidate, { recursive: true });
  const request: CandidateValidationRequest = {
    schemaVersion: 1,
    fixture: { path: path.join(root, "fixture"), identity: frozen.identity },
    accepted: { path: archive, bot },
    candidate,
    output: path.join(root, "attempt-1"),
  };
  return { root, request, files };
}

test("valid TS snapshot compiles frozen runtime, captures identities and supports next accepted version", async () => {
  const { root, request } = await fixture();
  try {
    const prepared = spawnSync(
      process.execPath,
      [
        "scripts/bot-improvement/prepare-strategy.ts",
        path.join(request.candidate, "strategy.mjs"),
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(prepared.status, 0, prepared.stderr);
    const result = await validateCandidate(request);
    assert.equal(result.status, "valid", JSON.stringify(result));
    assert.equal(result.acceptedIdentity, request.accepted.bot.identity);
    assert.ok(
      result.sourceIdentity &&
        result.executableIdentity &&
        result.snapshotIdentity,
    );
    assert.notEqual(
      result.candidate!.bot.identity,
      request.accepted.bot.identity,
    );
    const compiled = await readFile(
      path.join(result.candidate!.path, "bot.mjs"),
      "utf8",
    );
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
    );
    assert.equal(
      module.createGeneralistBotModule({ cards: new Map() }).contractVersion,
      1,
    );
    const submitted = await readFile(
      path.join(result.evidence, "submitted/strategy.mjs"),
      "utf8",
    );
    await writeFile(
      path.join(request.candidate, "strategy.mjs"),
      "changed after validation",
    );
    assert.equal(
      await readFile(
        path.join(result.evidence, "submitted/strategy.mjs"),
        "utf8",
      ),
      submitted,
    );
    const workspace2 = path.join(root, "workspace2");
    await cp(result.candidate!.path, workspace2, { recursive: true });
    await writeFile(
      path.join(workspace2, "strategy.mjs"),
      "export const createStrategy = d => {const score=d.cards.get(1).attack; return () => ({score});};",
    );
    const second = await validateCandidate({
      ...request,
      accepted: { path: result.candidate!.path, bot: result.candidate!.bot },
      candidate: workspace2,
      output: path.join(root, "attempt-2"),
    });
    assert.equal(second.status, "valid", JSON.stringify(second));
    await assert.rejects(validateCandidate(request), /EEXIST/);
    assert.equal(
      await readFile(
        path.join(request.accepted.path, "configuration.json"),
        "utf8",
      ),
      "{}",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scope violations, build failures, check failures and recovery retain distinct evidence", async () => {
  const { root, request } = await fixture();
  let n = 0;
  const run = async (category: string, message: RegExp) => {
    const result = await validateCandidate({
      ...request,
      output: path.join(root, `failed-${++n}`),
    });
    assert.equal(result.status, "invalid");
    assert.equal(result.reasons[0]!.category, category, JSON.stringify(result));
    assert.match(result.reasons[0]!.message, message);
    assert.deepEqual(
      JSON.parse(
        await readFile(path.join(result.evidence, "result.json"), "utf8"),
      ),
      result,
    );
    return result;
  };
  try {
    await writeFile(
      path.join(request.candidate, "strategy.mjs"),
      "export const createStrategy = () => () => ({score: 1});",
    );
    for (const forbidden of [
      "deck.json",
      "engine.wasm",
      "legal-selection.ts",
      "projection.ts",
      "configuration.json",
      "bot.mjs",
    ]) {
      const file = path.join(request.candidate, forbidden);
      const original = await readFile(file).catch(() => null);
      await writeFile(file, "forbidden");
      const result = await run("scope", /Only strategy.mjs may change/);
      assert.equal(
        await readFile(
          path.join(result.evidence, "submitted", forbidden),
          "utf8",
        ),
        "forbidden",
      );
      if (original) await writeFile(file, original);
      else await rm(file);
    }
    for (const source of [
      "import x from 'x';",
      "export const createStrategy=()=>Math.random;",
      "export const createStrategy=()=>Date.now;",
    ]) {
      await writeFile(path.join(request.candidate, "strategy.mjs"), source);
      await run("scope", /deterministic/);
    }
    await writeFile(
      path.join(request.candidate, "strategy.mjs"),
      "export const createStrategy = (",
    );
    await run("build", /Build failed/);
    await writeFile(
      path.join(request.candidate, "strategy.mjs"),
      "export const createStrategy = () => 42;",
    );
    const failed = await run("check", /strategy-check.json/);
    assert.match(
      await readFile(path.join(failed.evidence, "strategy-check.json"), "utf8"),
      /scoring function/,
    );
    await writeFile(
      path.join(request.candidate, "strategy.mjs"),
      "export const createStrategy = () => () => ({score: 2});",
    );
    assert.equal(
      (
        await validateCandidate({
          ...request,
          output: path.join(root, "recovered"),
        })
      ).status,
      "valid",
    );
    await symlink(
      path.join(request.accepted.path, "deck.json"),
      path.join(request.candidate, "link"),
    );
    await run("input", /regular files/);
    await rm(path.join(request.candidate, "link"));
    await writeFile(path.join(request.accepted.path, "deck.json"), "corrupt");
    await run("input", /Frozen input mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI resolves request-relative paths and emits structured invalid output", async () => {
  const { root, request } = await fixture();
  try {
    const relative = {
      ...request,
      fixture: { ...request.fixture, path: "fixture" },
      accepted: { ...request.accepted, path: "fixture/versions/initial" },
      candidate: "workspace",
      output: "cli-result",
    };
    await writeFile(path.join(root, "request.json"), JSON.stringify(relative));
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        "scripts/bot-improvement/validate-candidate.ts",
        path.join(root, "request.json"),
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.reasons[0].category, "scope");
    assert.match(
      output.reasons[0].message,
      /Required heuristic source missing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("retired Rust candidates cannot enter the strategy build path", async () => {
  const { root, request } = await fixture("package");
  try {
    const result = await validateCandidate(request);
    assert.equal(result.status, "invalid");
    assert.equal(result.reasons[0]?.category, "scope");
    assert.match(result.reasons[0]!.message, /Rust AI packages are retired/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pinned references and output isolation reject drift before compilation", async () => {
  const { root, request } = await fixture();
  try {
    await writeFile(
      path.join(request.candidate, "strategy.mjs"),
      "export const createStrategy=()=>()=>({score:1});",
    );
    const wrongFixture = await validateCandidate({
      ...request,
      fixture: { ...request.fixture, identity: "wrong" },
    });
    assert.equal(wrongFixture.reasons[0]?.category, "input");
    const wrongAccepted = await validateCandidate({
      ...request,
      accepted: {
        ...request.accepted,
        bot: { ...request.accepted.bot, identity: "wrong" },
      },
      output: path.join(root, "wrong-accepted"),
    });
    assert.match(wrongAccepted.reasons[0]!.message, /descriptor identity/);
    const { identity: _id, ...changed } = {
      ...request.accepted.bot,
      configuration: { forbidden: true },
    };
    void _id;
    const scope = await validateCandidate({
      ...request,
      accepted: {
        ...request.accepted,
        bot: { ...changed, identity: identity(changed) },
      },
      output: path.join(root, "configuration-drift"),
    });
    assert.equal(scope.reasons[0]?.category, "scope");
    await assert.rejects(
      validateCandidate({
        ...request,
        output: path.join(request.candidate, "nested"),
      }),
      /disjoint/,
    );
    await writeFile(
      path.join(request.candidate, "strategy.mjs"),
      "export const createStrategy=()=>{while(true){}};",
    );
    const timeout = await validateCandidate({
      ...request,
      output: path.join(root, "factory-timeout"),
    });
    assert.equal(timeout.reasons[0]?.category, "check");
    assert.match(
      await readFile(
        path.join(timeout.evidence, "strategy-check.json"),
        "utf8",
      ),
      /timed out/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
