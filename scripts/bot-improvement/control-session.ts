import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { json, optionalJson, save, evidence } from "./session-checkpoint.ts";
import { writeSessionReport } from "./report-session.ts";
import { verifyFrozen } from "./frozen-setup.ts";
import { digest, identity } from "./session-fixtures.ts";
import { botBytes } from "./prepare-iteration.ts";
import { withSessionLock } from "./session-lock.ts";
import type { IterationManifest } from "./iteration-contract.ts";
import type {
  ControlAction,
  SessionControl,
  StopReason,
  ExecutionAttempt,
} from "./session-control-contract.ts";

export async function controlSession(
  sessionPath: string,
  input: ControlAction,
) {
  const session = path.resolve(sessionPath);
  return withSessionLock(session, async () => {
    if (
      input.action === "stop" &&
      !["owner-stop", "interrupted"].includes(input.reason)
    )
      throw new Error("Invalid stop reason");
    const config = await json(path.join(session, "config.json"));
    const state = await json(path.join(session, "state.json"));
    const frozen = await verifyFrozen(config.fixture.path);
    if (
      config.schemaVersion !== 1 ||
      state.schemaVersion !== 1 ||
      config.fixture.identity !== frozen.identity ||
      state.fixtureIdentity !== frozen.identity
    )
      throw new Error("Session fixture identity mismatch");
    const acceptedBot =
      path.resolve(state.accepted.path) ===
      path.resolve(config.fixture.path, "versions/initial")
        ? frozen.target
        : await json(path.join(state.accepted.path, "frozen-bot.json"));
    if (acceptedBot.identity !== state.accepted.identity)
      throw new Error("Accepted reference identity mismatch");
    await botBytes(state.accepted.path, acceptedBot);
    const limits = config.limits.stop;
    if (
      !limits ||
      !Object.keys(limits).length ||
      Object.keys(limits).some(
        (k) =>
          !["maxIterations", "maxGames", "maxWallMs", "ownerStop"].includes(k),
      ) ||
      ["maxIterations", "maxGames", "maxWallMs"].some(
        (k) =>
          limits[k] !== undefined &&
          (!Number.isSafeInteger(limits[k]) || limits[k] < 1),
      ) ||
      (limits.ownerStop !== undefined && limits.ownerStop !== true)
    )
      throw new Error("Invalid stopping limits");
    const file = path.join(session, "control.json");
    const old = (await optionalJson(file)) as SessionControl | null;
    // Never silently bootstrap over execution recorded by another writer.
    if (
      !old &&
      (state.iteration !== 0 ||
        state.completedGames?.length ||
        state.completedMatches?.length ||
        state.stoppingReason ||
        state.accepted.identity !== config.accepted.identity)
    )
      throw new Error(
        "Existing progress requires explicit accounting migration",
      );
    const ledger: SessionControl = old ?? {
      schemaVersion: 1,
      fixtureIdentity: frozen.identity,
      limits,
      elapsedMs: 0,
      activeSince: null,
      stoppingReason: null,
      ownerStopToken: null,
      acknowledgedMarker: null,
      iterations: [],
      attempts: [],
      records: [],
    };
    if (
      ledger.schemaVersion !== 1 ||
      ledger.fixtureIdentity !== frozen.identity ||
      identity(ledger.limits) !== identity(limits)
    )
      throw new Error(
        "Control identity or limits changed; budgets cannot be extended",
      );
    const now = Date.now();
    if (ledger.activeSince !== null) {
      ledger.elapsedMs += Math.max(0, now - ledger.activeSince);
      ledger.activeSince = now;
    }
    let marker: string | null = null;
    try {
      marker = digest(await readFile(path.join(session, "OWNER_STOP")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (marker && marker !== ledger.acknowledgedMarker)
      ledger.ownerStopToken = marker;
    if (input.action === "stop" && input.reason === "owner-stop")
      ledger.ownerStopToken ??= randomUUID();
    const running = () => ledger.attempts.filter((a) => a.status === "running");
    if (input.action === "continue") {
      if (running().length)
        throw new Error(
          "Settle or cancel running attempts before continuation",
        );
      if (
        ledger.ownerStopToken &&
        input.ownerStopToken !== ledger.ownerStopToken
      )
        throw new Error("Explicit owner-stop token required");
      ledger.ownerStopToken = null;
      ledger.acknowledgedMarker = marker;
      ledger.stoppingReason = null;
    }
    const completedGames = () =>
      ledger.attempts.reduce((n, a) => n + a.games.length, 0);
    const reservedGames = () => running().length * 4;
    const active = () =>
      ledger.iterations.find(
        (i) => i.status === "active" || i.status === "interrupted",
      );
    const limitReason = (): StopReason | null =>
      ledger.ownerStopToken
        ? "owner-stop"
        : limits.maxWallMs !== undefined && ledger.elapsedMs >= limits.maxWallMs
          ? "max-wall-ms"
          : limits.maxGames !== undefined &&
              completedGames() + 4 > limits.maxGames
            ? "max-games"
            : null;
    ledger.stoppingReason = limitReason() ?? ledger.stoppingReason;
    if (input.action === "stop")
      ledger.stoppingReason = ledger.ownerStopToken
        ? "owner-stop"
        : input.reason;
    let reservation: { attempt: ExecutionAttempt; launch: boolean } | null =
      null;
    if (input.action === "start") {
      if (!Number.isSafeInteger(input.iteration) || input.iteration < 1)
        throw new Error("Positive iteration required");
      const existing = ledger.iterations.find(
        (i) => i.iteration === input.iteration,
      );
      if (
        existing &&
        existing.status !== "active" &&
        existing.status !== "interrupted"
      )
        throw new Error("Iteration already settled");
      if (!existing && active())
        throw new Error("Finish current iteration before starting another");
      if (!existing && input.iteration !== ledger.iterations.length + 1)
        throw new Error("Iterations must be consecutive");
      if (
        !existing &&
        limits.maxIterations !== undefined &&
        ledger.iterations.length >= limits.maxIterations
      )
        ledger.stoppingReason = ledger.ownerStopToken
          ? "owner-stop"
          : "max-iterations";
      if (
        !existing &&
        !ledger.stoppingReason &&
        limits.maxGames !== undefined &&
        completedGames() + 4 > limits.maxGames
      )
        ledger.stoppingReason = "max-games";
      if (!ledger.stoppingReason) {
        if (existing) existing.status = "active";
        else
          ledger.iterations.push({
            iteration: input.iteration,
            status: "active",
            accepted: state.accepted,
          });
        ledger.activeSince ??= now;
      }
    } else if (input.action === "reserve") {
      if (!ledger.stoppingReason) {
        if (
          active()?.iteration !== input.iteration ||
          active()?.status !== "active"
        )
          throw new Error("Start iteration before reserving");
        ledger.activeSince ??= now;
        const manifest = (await json(
          path.join(
            session,
            "iterations",
            `iteration-${String(input.iteration).padStart(4, "0")}`,
            "manifest.json",
          ),
        )) as IterationManifest;
        if (
          manifest.fixture.identity !== frozen.identity ||
          manifest.control.identity !== active()?.accepted.identity ||
          manifest.runnerIdentity !== input.runnerIdentity ||
          manifest.iteration !== input.iteration ||
          !frozen.matches.some((m) => m.id === input.match) ||
          !["control", "candidate"].includes(input.role) ||
          !input.executableIdentity?.trim() ||
          (input.role === "control" &&
            input.executableIdentity !== manifest.control.identity)
        )
          throw new Error("Execution binding mismatch");
        if (
          ledger.attempts.some(
            (a) =>
              a.iteration === input.iteration &&
              a.role === input.role &&
              a.executableIdentity !== input.executableIdentity,
          )
        )
          throw new Error("Executable identity changed within evaluation");
        const previous = ledger.attempts.filter(
          (a) =>
            a.iteration === input.iteration &&
            a.role === input.role &&
            a.match === input.match,
        );
        const last = previous.at(-1);
        if (
          (!last ||
            (last.status !== "complete" && last.status !== "running")) &&
          running().length >= config.limits.matchWorkers
        )
          throw new Error("Match worker limit reached");
        if (last && (last.status === "complete" || last.status === "running")) {
          reservation = { attempt: last, launch: false };
        } else if (
          limits.maxGames !== undefined &&
          completedGames() + 4 > limits.maxGames
        ) {
          ledger.stoppingReason = "max-games";
        } else if (
          limits.maxGames === undefined ||
          completedGames() + reservedGames() + 4 <= limits.maxGames
        ) {
          const attempt: ExecutionAttempt = {
            iteration: input.iteration,
            role: input.role,
            match: input.match,
            executableIdentity: input.executableIdentity,
            attempt: previous.length + 1,
            status: "running",
            reservedGames: 4,
            games: [],
          };
          ledger.attempts.push(attempt);
          reservation = { attempt, launch: true };
        }
      }
    } else if (input.action === "settle") {
      const attempt = ledger.attempts.find(
        (a) =>
          a.iteration === input.iteration &&
          a.role === input.role &&
          a.match === input.match &&
          a.attempt === input.attempt,
      );
      if (
        !attempt ||
        !["complete", "failed", "interrupted"].includes(input.status) ||
        !Array.isArray(input.games) ||
        input.games.length > 4 ||
        new Set(input.games.map((g) => g.number)).size !== input.games.length ||
        input.games.some(
          (g) => !Number.isInteger(g.number) || g.number < 1 || g.number > 4,
        ) ||
        (input.status === "complete" && input.games.length !== 4)
      )
        throw new Error("Invalid attempt settlement");
      for (const game of input.games) await evidence(session, game.evidence);
      if (
        attempt.status !== "running" &&
        identity({ status: attempt.status, games: attempt.games }) !==
          identity({ status: input.status, games: input.games })
      )
        throw new Error("Attempt already settled differently");
      attempt.status = input.status;
      attempt.games = input.games;
    } else if (input.action === "finish" || input.action === "record") {
      const iteration = ledger.iterations.find(
        (i) => i.iteration === input.iteration,
      );
      if (!iteration) throw new Error("Unknown iteration");
      await evidence(session, input.evidence);
      if (input.action === "record") {
        if (!["proposal", "decision", "comparison"].includes(input.kind))
          throw new Error("Unknown record kind");
        const existing = ledger.records.find(
          (r) => r.iteration === input.iteration && r.kind === input.kind,
        );
        if (
          existing &&
          identity(existing.evidence) !== identity(input.evidence)
        )
          throw new Error("Record already published differently");
        if (!existing)
          ledger.records.push({
            iteration: input.iteration,
            kind: input.kind,
            evidence: input.evidence,
          });
      } else {
        if (running().some((a) => a.iteration === input.iteration))
          throw new Error("Settle running attempts before finishing iteration");
        if (!["complete", "failed", "interrupted"].includes(input.status))
          throw new Error("Invalid iteration status");
        if (
          ["complete", "failed"].includes(iteration.status) &&
          identity({
            status: iteration.status,
            evidence: iteration.evidence,
          }) !== identity({ status: input.status, evidence: input.evidence })
        )
          throw new Error("Iteration already settled differently");
        iteration.status = input.status;
        iteration.evidence = input.evidence;
        if (input.status === "interrupted")
          ledger.stoppingReason ??= "interrupted";
      }
    } else if (!["plan", "report", "stop", "continue"].includes(input.action))
      throw new Error("Unknown control action");
    ledger.stoppingReason = limitReason() ?? ledger.stoppingReason;
    if (
      !active() &&
      limits.maxIterations !== undefined &&
      ledger.iterations.length >= limits.maxIterations
    )
      ledger.stoppingReason ??= "max-iterations";
    // Keep charging until every running job has settled, including cancellation latency.
    if (!running().length && (ledger.stoppingReason || !active()))
      ledger.activeSince = null;
    const pending = active();
    if (pending && pending.accepted.identity !== state.accepted.identity)
      throw new Error("Accepted identity changed during unfinished iteration");
    await save(file, ledger);
    const plan = {
      schemaVersion: 1,
      reservation,
      session,
      accepted: state.accepted,
      stoppingReason: ledger.stoppingReason,
      ownerStopToken: ledger.ownerStopToken,
      mayStart: ledger.stoppingReason === null,
      iteration: pending?.iteration ?? ledger.iterations.length + 1,
      completedGames: completedGames(),
      reservedGames: reservedGames(),
      elapsedMs: ledger.elapsedMs,
      cancel: ledger.stoppingReason ? running() : [],
      running: running(),
      completedMatches: ledger.attempts
        .filter((a) => a.status === "complete")
        .map((a) => ({ iteration: a.iteration, role: a.role, match: a.match })),
      remainingMatches: pending
        ? ["control", "candidate"].map((role) => ({
            role,
            matches: frozen.matches
              .filter(
                (m) =>
                  !ledger.attempts.some(
                    (a) =>
                      a.iteration === pending.iteration &&
                      a.role === role &&
                      a.match === m.id &&
                      (a.status === "complete" || a.status === "running"),
                  ),
              )
              .map((m) => m.id),
          }))
        : [],
      iterations: ledger.iterations,
      records: ledger.records,
    };
    if (input.action === "report") {
      return writeSessionReport(session, plan, config.fixture, ledger);
    }
    return plan;
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [session, request] = process.argv.slice(2);
    if (!session || !request || process.argv.length !== 4)
      throw new Error(
        "Usage: bot:session -- SESSION REQUEST.json (request paths are session-relative)",
      );
    console.log(
      JSON.stringify(
        await controlSession(session, await json(path.resolve(request))),
      ),
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
