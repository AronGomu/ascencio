import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
import {
  digest,
  identity,
  schedule,
} from "../../scripts/bot-improvement/session-fixtures.ts";
import {
  encodeLogRecord as line,
  parseGameLog,
  decodeLogRecord,
  decodeLog,
  targetLossView,
} from "../../scripts/bot-improvement/game-log.ts";
import { publishTextCompletion } from "../../scripts/bot-improvement/analysis-text-evidence.ts";
import { prepareAnalysisSlices } from "../../scripts/bot-improvement/analysis-slices.ts";
import type { AnalysisBinding } from "../../scripts/bot-improvement/analysis-contract.ts";

const put = async (file: string, value: unknown) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    typeof value === "string" ? value : JSON.stringify(value),
  );
};
test("typed log fields preserve exact replay choices, punctuation, nulls and empty containers", () => {
  const input = {
    "a=b/~": ["tabs\tnewlines\n=", null, {}, [], false, 1.25],
    __proto__: { nested: "safe" },
  };
  assert.deepEqual(
    decodeLogRecord(line("EVENT", input).trimEnd()).value,
    input,
  );
  assert.throws(
    () => decodeLogRecord("EVENT\t=o\t/x=n:1\t/x=n:2"),
    /Duplicate/,
  );
});
test("field dictionaries decode losslessly and reject unknown aliases", () => {
  const header = "ASCENCIO_GAME_LOG\t2";
  const text =
    header +
    "\n" +
    line("FIELDS", ["", "/kind", "/choice_id"]) +
    'EVENT\t#0=o\t#1=s:"decision"\t#2=s:"exact-id"\n';
  assert.deepEqual(decodeLog(text, header), [
    { tag: "EVENT", value: { kind: "decision", choice_id: "exact-id" } },
  ]);
  assert.throws(
    () => decodeLog(text.replace("#2=", "#99="), header),
    /Unknown log field alias/,
  );
});
test("251-match dispatch owns 250/1 slices, exposes only target losses, resumes and consolidates cross-slice reasons", async () => {
  await mkdir(".tmp", { recursive: true });
  const session = await mkdtemp(path.resolve(".tmp/slice-test-"));
  try {
    const b = {
      kind: "module",
      module: "builtin:basic",
      configuration: {},
      deck: { main: [cardCode(1)], extra: [], side: [] },
      files: { "bot.mjs": digest("bot") },
    };
    const bot = { ...b, identity: identity(b) };
    const matches = schedule("slice", bot.deck, [], 251);
    const f = {
      schemaVersion: 1,
      setupSeed: "slice",
      inputsIdentity: "inputs",
      profile: "mr5",
      protocol: {},
      target: bot,
      opponents: [],
      files: { "versions/initial/bot.mjs": digest("bot") },
      matches,
    };
    const frozen = { ...f, identity: identity(f) };
    const fixture = {
      path: path.join(session, "fixture"),
      identity: frozen.identity,
    };
    await put(path.join(fixture.path, "manifest.json"), frozen);
    await put(path.join(fixture.path, "versions/initial/bot.mjs"), "bot");
    await put(path.join(session, "config.json"), {
      schemaVersion: 1,
      fixture,
      limits: { analysisWorkers: 2 },
      analysisTiming: "after-evaluation",
    });
    await put(path.join(session, "iterations/iteration-0001/manifest.json"), {
      schemaVersion: 1,
      iteration: 1,
      fixture,
      self: { identity: bot.identity },
      control: { identity: bot.identity },
      opponents: [],
      runnerIdentity: "runner",
    });
    const body = {
      schemaVersion: 1,
      fixtureIdentity: frozen.identity,
      candidateIdentity: bot.identity,
      selfIdentity: bot.identity,
      matches: matches.map((match) => ({
        match,
        identities: [bot.identity, bot.identity],
      })),
    };
    const execution = { ...body, identity: identity(body) };
    await put(path.join(session, "run.job.json"), execution);
    await put(path.join(session, "proposal.txt"), "reason changes");
    const ref = async (p: string) => ({
      path: p,
      sha256: digest(await readFile(path.join(session, p))),
    });
    const binding: AnalysisBinding = {
      iteration: 1,
      role: "candidate",
      root: "run",
      execution: await ref("run.job.json"),
      proposal: await ref("proposal.txt"),
    };
    const lost = new Set([1, 2, 249, 250, 251]);
    async function match(number: number) {
      const item = execution.matches[number - 1]!,
        root = `run/matches/${item.match.id}`;
      let index =
        "ASCENCIO_MATCH_LOG\t2\n" +
        line("MATCH", {
          run_id: execution.identity,
          match_id: item.match.id,
          status: "completed",
          sideboarding: { status: "completed" },
        }) +
        line("MANIFEST", {}) +
        line("FIXTURE", item) +
        line("REPORT_A", {}) +
        line("REPORT_B", {});
      for (let n = 1; n <= 4; n++) {
        const winner = n === 1 && lost.has(number) ? "b" : n === 2 ? "a" : null;
        const g = {
          game_id: `${item.match.id}-game-${n}`,
          number: n,
          stage: n < 3 ? "pre_side" : "post_side",
          starter: n % 2 ? "a" : "b",
          status: "completed",
          winner,
          draw: winner === null,
          evidence_sha256: digest("evidence"),
        };
        let text = "ASCENCIO_GAME_LOG\t2\n" + line("GAME", g);
        for (const actor of ["a", "b"]) {
          text +=
            line("ACTOR", actor) +
            line("RECORD", {
              game_id: g.game_id,
              stage: g.stage,
              starting_player: g.starter,
              status: g.status,
            });
          text +=
            line("SIDEBOARD", {}) +
            line("INITIAL", {
              visible:
                actor === "b"
                  ? "OPPONENT_PRIVATE"
                  : winner === "b"
                    ? "LOSS_ONLY"
                    : "WIN_DRAW_ONLY",
            });
          text += line("EVENT", {
            kind: "decision",
            sequence: 1,
            decision_id: `${actor}-decision-${n}`,
            prompt: {
              choices: {
                choice: [{ id: "exact-instance-42", label: "visible action" }],
              },
            },
            selected_choice_ids: { choice_id: ["exact-instance-42"] },
          });
          text +=
            line("RESULT", {
              outcome:
                winner === null ? "draw" : winner === actor ? "win" : "loss",
              evidence_sha256: g.evidence_sha256,
            }) + line("END_ACTOR", actor);
        }
        text += line("END_GAME", g.game_id);
        await put(path.join(session, root, `games/game-${n}/game.log`), text);
        if (n === 1) {
          assert.equal(
            (
              parseGameLog(text).actors[0].timeline.entry[0]!.prompt as {
                choices: { choice: { id: string }[] };
              }
            ).choices.choice[0]!.id,
            "exact-instance-42",
          );
          if (winner !== "b")
            assert.throws(() => targetLossView(text), /Only completed/);
        }
        index += line("GAME_REF", {
          number: n,
          path: `games/game-${n}/game.log`,
        });
      }
      index += line("END_MATCH", item.match.id);
      await put(path.join(session, root, "match.log"), index);
      await publishTextCompletion(session, root, {
        match: item.match.id,
        executionIdentity: execution.identity,
        fixtureIdentity: frozen.identity,
        candidateIdentity: bot.identity,
        opponentIdentity: bot.identity,
        item,
      });
    }
    await match(1);
    await assert.rejects(
      prepareAnalysisSlices(session, { action: "sync", binding }),
      /All matches/,
    );
    for (let n = 2; n <= 251; n++) await match(n);
    const synced = await prepareAnalysisSlices(session, {
      action: "sync",
      binding,
    });
    assert.equal(synced.workers, 2);
    const a = { iteration: 1, role: "candidate" as const };
    const first = (
      await prepareAnalysisSlices(session, {
        action: "claim",
        ...a,
        owner: "one",
      })
    ).claim!;
    assert.deepEqual(
      (
        await prepareAnalysisSlices(session, {
          action: "claim",
          ...a,
          owner: "one",
        })
      ).claim,
      first,
    );
    const second = (
      await prepareAnalysisSlices(session, {
        action: "claim",
        ...a,
        owner: "two",
      })
    ).claim!;
    assert.notEqual(first.id, second.id);
    const submit = async (slice: typeof first) => {
      const packet = JSON.parse(
        await readFile(path.join(session, slice.packet.path), "utf8"),
      );
      assert.equal(packet.matches.length, slice.id === first.id ? 250 : 1);
      const reports = [];
      for (const job of packet.jobs) {
        for (const loss of job.losses) {
          const view = await readFile(
            path.join(session, loss.log.path),
            "utf8",
          );
          assert.match(view, /LOSS_ONLY/);
          assert.doesNotMatch(view, /WIN_DRAW_ONLY|OPPONENT_PRIVATE/);
        }
        const file = `findings/${job.match}.md`;
        await put(
          path.join(session, file),
          `# Match loss analysis\n\nJob: ${job.id}\nPacket: ${job.packetSha256}\n\n- G1 | a-decision-1 | avoidable | Wrong target | Revise target rule\n`,
        );
        reports.push(await ref(file));
      }
      return {
        action: "complete" as const,
        ...a,
        slice: slice.id,
        token: slice.claim!.token,
        reports,
      };
    };
    const report1 = await submit(first),
      report2 = await submit(second);
    await assert.rejects(
      prepareAnalysisSlices(session, { ...report1, reports: [] }),
      /Incomplete slice/,
    );
    await prepareAnalysisSlices(session, {
      action: "release",
      ...a,
      slice: second.id,
      token: second.claim!.token,
      terminated: true,
    });
    const replacement = (
      await prepareAnalysisSlices(session, {
        action: "claim",
        ...a,
        owner: "replacement",
      })
    ).claim!;
    await assert.rejects(prepareAnalysisSlices(session, report2), /Stale/);
    await prepareAnalysisSlices(session, report1);
    const done = await prepareAnalysisSlices(session, {
      ...report2,
      token: replacement.claim!.token,
    });
    assert.equal(done.complete, true);
    const summary = await readFile(
      path.join(session, done.summary!.path),
      "utf8",
    );
    assert.match(summary, /5 losses reviewed/);
    assert.match(summary, /Wrong target.*5 losses/);
  } finally {
    await rm(session, { recursive: true, force: true });
  }
});
