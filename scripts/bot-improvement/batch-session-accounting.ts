/** One durable game allocation per evaluation; workers journal actual consumption locally. */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { withSessionLock } from "./session-lock.ts";
import { save, json } from "./session-checkpoint.ts";
import { digest } from "./session-fixtures.ts";
import { parseGameLog } from "./game-log.ts";
import type {
  SessionControl,
  ExecutionAttempt,
} from "./session-control-contract.ts";
import type { MatchBinding } from "./match-session.ts";
export interface BatchAllocation {
  id: string;
  output: string;
  iteration: number;
  role: "control" | "candidate";
  executableIdentity: string;
  gameCeiling: number;
  requestedMaxGames?: number;
  chargedGames: number;
  heldGames: number;
  status: "running" | "settled";
}
export function chargedGames(ledger: SessionControl) {
  return (
    ledger.attempts
      .filter((a) => !a.batchAllocation)
      .reduce((n, a) => n + a.games.length, 0) +
    (ledger.batchAllocations ?? []).reduce((n, a) => n + a.chargedGames, 0)
  );
}
export function heldGames(ledger: SessionControl) {
  return (
    ledger.attempts.filter((a) => !a.batchAllocation && a.status === "running")
      .length *
      4 +
    (ledger.batchAllocations ?? []).reduce((n, a) => n + a.heldGames, 0)
  );
}
export async function reserveBatchBudget(
  binding: Omit<MatchBinding, "executableIdentity">,
  output: string,
  executableIdentity: string,
  resume: boolean,
  maxGames?: number,
) {
  return withSessionLock(binding.session, async () => {
    const file = path.join(binding.session, "control.json"),
      ledger = (await json(file)) as SessionControl;
    const manifest = await json(
      path.join(
        binding.session,
        `iterations/iteration-${String(binding.iteration).padStart(4, "0")}/manifest.json`,
      ),
    );
    if (
      ledger.stoppingReason ||
      manifest.runnerIdentity !== binding.runnerIdentity ||
      manifest.fixture.identity !== ledger.fixtureIdentity ||
      (binding.role === "control" &&
        executableIdentity !== manifest.control.identity) ||
      !ledger.iterations.some(
        (i) => i.iteration === binding.iteration && i.status === "active",
      )
    )
      throw Error("Batch session admission rejected");
    const id = `${binding.iteration}/${binding.role}`,
      relative = path.relative(binding.session, path.resolve(output));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
      throw Error("Unsafe batch evaluation path");
    ledger.batchAllocations ??= [];
    if (
      ledger.batchAllocations.some((a) => a.id !== id && a.status === "running")
    )
      throw Error("Another batch evaluation holds session admission");
    let allocation = ledger.batchAllocations.find((a) => a.id === id);
    const available =
      (ledger.limits.maxGames ?? Number.MAX_SAFE_INTEGER) -
      chargedGames(ledger) -
      heldGames(ledger) +
      (allocation?.heldGames ?? 0);
    if (allocation) {
      if (
        !resume ||
        allocation.output !== relative ||
        allocation.executableIdentity !== executableIdentity ||
        (maxGames ?? null) !== (allocation.requestedMaxGames ?? null)
      )
        throw Error("Batch allocation identity changed");
      if (allocation.gameCeiling - allocation.chargedGames > available)
        throw Error("Insufficient remaining session game budget for resume");
      allocation.heldGames = allocation.gameCeiling - allocation.chargedGames;
      allocation.status = "running";
    } else {
      if (resume) throw Error("Missing batch allocation for resume");
      const ceiling =
        Math.floor(Math.min(maxGames ?? available, available) / 4) * 4;
      if (!Number.isSafeInteger(ceiling) || ceiling < 4)
        throw Error("Session game budget exhausted");
      allocation = {
        id,
        output: relative,
        iteration: binding.iteration,
        role: binding.role,
        executableIdentity,
        gameCeiling: ceiling,
        ...(maxGames === undefined ? {} : { requestedMaxGames: maxGames }),
        chargedGames: 0,
        heldGames: ceiling,
        status: "running",
      };
      ledger.batchAllocations.push(allocation);
    }
    await save(file, ledger);
    return {
      allocation,
      startedAt: ledger.startedAt!,
      maxWallMs: ledger.limits.maxWallMs,
    };
  });
}
export async function settleBatchBudget(
  binding: Omit<MatchBinding, "executableIdentity">,
  output: string,
) {
  // Derive consumption from durable journals, including unstarted interrupted batches.
  const workers = await readdir(path.join(output, "workers"));
  let charged = 0;
  for (const worker of workers) {
    const journal = await json(
      path.join(output, "workers", worker, "journal.json"),
    );
    if (
      !Number.isSafeInteger(journal.reservedGames) ||
      journal.reservedGames < 0
    )
      throw Error("Invalid worker accounting");
    charged += journal.reservedGames;
  }
  const index = await json(path.join(output, "matches.json"));
  const attempts: ExecutionAttempt[] = [];
  for (const [id, relative] of Object.entries(index)) {
    if (relative !== `matches/${id}` || !/^match-\d+$/.test(id))
      throw Error("Invalid session match index");
    const base = path.join(output, String(relative)),
      marker = await json(path.join(base, "done.json"));
    const games: ExecutionAttempt["games"] = [];
    for (let number = 1; number <= 4; number++) {
      const local = `native/games/game-${number}/game.log`,
        file = path.join(base, local),
        bytes = await readFile(file),
        sha256 = digest(bytes);
      if (marker.files?.[local] !== sha256)
        throw Error("Batch game evidence changed");
      if (parseGameLog(bytes.toString()).neutral.status === "completed")
        games.push({
          number,
          evidence: { path: path.relative(binding.session, file), sha256 },
        });
    }
    attempts.push({
      iteration: binding.iteration,
      role: binding.role,
      match: id,
      attempt: 1,
      batchAllocation: `${binding.iteration}/${binding.role}`,
      executableIdentity: "",
      status: games.length === 4 ? "complete" : "failed",
      reservedGames: 4,
      games,
    });
  }
  return withSessionLock(binding.session, async () => {
    const file = path.join(binding.session, "control.json"),
      ledger = (await json(file)) as SessionControl;
    const allocation = ledger.batchAllocations?.find(
      (a) => a.id === `${binding.iteration}/${binding.role}`,
    );
    if (
      !allocation ||
      charged < allocation.chargedGames ||
      charged > allocation.gameCeiling
    )
      throw Error("Batch consumption exceeds its reservation");
    allocation.chargedGames = charged;
    allocation.heldGames = 0;
    allocation.status = "settled";
    for (const attempt of attempts) {
      attempt.executableIdentity = allocation.executableIdentity;
      const old = ledger.attempts.find(
        (a) => a.batchAllocation === allocation.id && a.match === attempt.match,
      );
      if (old) Object.assign(old, attempt);
      else ledger.attempts.push(attempt);
    }
    await save(file, ledger);
    return allocation;
  });
}
