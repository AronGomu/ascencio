import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { prepareIteration } from "../../scripts/bot-improvement/prepare-iteration.ts";
import { validateCandidate } from "../../scripts/bot-improvement/validate-candidate.ts";
import {
  hashes,
  readTree,
} from "../../scripts/bot-improvement/candidate-files.ts";
import { identity } from "../../scripts/bot-improvement/session-fixtures.ts";
import type { FrozenBot } from "../../scripts/bot-improvement/session-contract.ts";

const save = async (file: string, value: unknown) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
};
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));

async function preparedSession() {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/candidate-session-"));
  try {
    for (const id of ["card-library", "duel-core"])
      await save(path.join(root, "content", id, "critical.json"), {
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
    const target = path.join(root, "target");
    await save(path.join(target, "evaluation.json"), {
      schemaVersion: 1,
      deck: "deck.ydk",
      content: "../content",
      banlist: "rules.json",
      profile: "mr5",
      configuration: {},
      module: "builtin:generalist",
    });
    await save(path.join(target, "rules.json"), []);
    await writeFile(
      path.join(target, "deck.ydk"),
      `#main\n${Array.from({ length: 40 }, (_, i) => (i % 14) + 1).join("\n")}\n#extra\n!side\n`,
    );
    const request = {
      target,
      opponents: [],
      setupSeed: "candidate-session",
      session: path.join(root, "session"),
      stop: { maxIterations: 2 },
    };
    const requestPath = path.join(root, "setup-request.json");
    await save(requestPath, request);
    const processResult = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        "scripts/bot-improvement/setup-session.ts",
        requestPath,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(processResult.status, 0, processResult.stderr);
    const setup = JSON.parse(processResult.stdout);
    const options = {
      session: setup.session,
      iteration: 1,
      runnerIdentity: "test-v1",
    };
    const prepared = await prepareIteration(options);
    return { root, setup, options, prepared };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

test("actual setup and iteration snapshots validate, promote and prepare the next iteration", async () => {
  const { root, setup, options, prepared } = await preparedSession();
  try {
    const statePath = path.join(setup.session, "state.json");
    const before = await readFile(statePath, "utf8");
    const originalDescriptor = await readFile(
      path.join(prepared.candidate.path, "frozen-bot.json"),
      "utf8",
    );
    await writeFile(
      path.join(prepared.candidate.path, "strategy.mjs"),
      "export const createStrategy = () => () => ({score: 7});",
    );
    const result = await validateCandidate({
      schemaVersion: 1,
      fixture: prepared.fixture,
      accepted: prepared.accepted,
      candidate: prepared.candidate.path,
      output: path.join(root, "validation-1"),
    });
    assert.equal(result.status, "valid", JSON.stringify(result));
    assert.equal(await readFile(statePath, "utf8"), before);
    assert.equal(
      await readFile(
        path.join(result.evidence, "submitted/frozen-bot.json"),
        "utf8",
      ),
      originalDescriptor,
    );
    assert.equal(
      await readFile(
        path.join(prepared.candidate.path, "frozen-bot.json"),
        "utf8",
      ),
      originalDescriptor,
    );
    const candidate = result.candidate!;
    assert.deepEqual(
      await json(path.join(candidate.path, "frozen-bot.json")),
      candidate.bot,
    );
    assert.equal(Object.hasOwn(candidate.bot.files, "frozen-bot.json"), false);
    const payload = await readTree(candidate.path);
    delete payload["frozen-bot.json"];
    assert.deepEqual(hashes(payload), candidate.bot.files);
    const submitted = await readTree(path.join(result.evidence, "submitted"));
    delete submitted["frozen-bot.json"];
    delete submitted["bot.mjs"];
    assert.equal(result.sourceIdentity, identity(hashes(submitted)));
    assert.notEqual(candidate.bot.identity, prepared.accepted.bot.identity);

    // Promotion publishes the validated archive before changing the accepted reference.
    const promoted = path.join(setup.session, "versions/promoted");
    await cp(candidate.path, promoted, { recursive: true });
    const state = JSON.parse(before);
    await save(statePath, {
      ...state,
      accepted: { path: promoted, identity: candidate.bot.identity },
    });
    const next = await prepareIteration({ ...options, iteration: 2 });
    assert.equal(next.accepted.identity, candidate.bot.identity);
    assert.equal(next.self.identity, candidate.bot.identity);
    assert.notEqual(next.comparisonIdentity, prepared.comparisonIdentity);
    const second = await validateCandidate({
      schemaVersion: 1,
      fixture: next.fixture,
      accepted: next.accepted,
      candidate: next.candidate.path,
      output: path.join(root, "validation-2"),
    });
    assert.equal(second.status, "valid", JSON.stringify(second));
    assert.deepEqual(
      (await prepareIteration({ ...options, iteration: 2 })).candidate,
      next.candidate,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepared accepted and candidate descriptors reject corruption and self-consistent forgeries", async () => {
  const { root, prepared } = await preparedSession();
  try {
    await writeFile(
      path.join(prepared.candidate.path, "strategy.mjs"),
      "export const createStrategy = () => () => ({score: 7});",
    );
    let attempt = 0;
    for (const archive of [prepared.accepted.path, prepared.candidate.path]) {
      const file = path.join(archive, "frozen-bot.json");
      const original = await readFile(file, "utf8");
      const { identity: _id, ...body } = prepared.accepted.bot;
      void _id;
      const changed = { ...body, configuration: { forged: true } };
      const selfConsistent = { ...changed, identity: identity(changed) };
      const changedFiles = {
        ...body,
        files: { ...body.files, "bot.mjs": "forged" },
      };
      for (const descriptor of [
        "{",
        JSON.stringify({ ...prepared.accepted.bot, identity: "forged" }),
        JSON.stringify(selfConsistent),
        JSON.stringify({ ...changedFiles, identity: identity(changedFiles) }),
      ]) {
        await writeFile(file, descriptor);
        const result = await validateCandidate({
          schemaVersion: 1,
          fixture: prepared.fixture,
          accepted: prepared.accepted,
          candidate: prepared.candidate.path,
          output: path.join(root, `forged-${++attempt}`),
        });
        assert.equal(result.status, "invalid", JSON.stringify(result));
        assert.equal(result.reasons[0]?.category, "input");
        assert.match(result.reasons[0]!.message, /archive descriptor/);
        assert.equal(result.candidate, undefined);
        if (archive === prepared.candidate.path)
          assert.equal(
            await readFile(
              path.join(result.evidence, "submitted/frozen-bot.json"),
              "utf8",
            ),
            descriptor,
          );
      }
      await writeFile(file, original);
    }
    // The reserved sidecar cannot be smuggled into the accepted payload hash set.
    const { identity: _id, ...body } = prepared.accepted.bot;
    void _id;
    const recursive = {
      ...body,
      files: { ...body.files, "frozen-bot.json": "forged" },
    };
    const forged: FrozenBot = { ...recursive, identity: identity(recursive) };
    const result = await validateCandidate({
      schemaVersion: 1,
      fixture: prepared.fixture,
      accepted: { ...prepared.accepted, bot: forged },
      candidate: prepared.candidate.path,
      output: path.join(root, "recursive-descriptor"),
    });
    assert.equal(result.status, "invalid");
    assert.match(result.reasons[0]!.message, /descriptor identity mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
