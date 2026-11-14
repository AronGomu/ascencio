/** Experimental worker: engine and frozen content remain local across matches. */
import { parentPort, workerData } from "node:worker_threads";
import { executeHostCommand } from "../bot-evaluation/host.ts";
import type { prepareMatches } from "./prepare-match-job.ts";
import { identity } from "./session-fixtures.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
export type Job = Awaited<ReturnType<typeof prepareMatches>>["job"];
export type Frame = {
  type: string;
  actor: number;
  entry: Record<string, unknown>;
  initial: Record<string, unknown>;
  prompt: unknown;
  winner: number | null;
  turns: number;
  engine_reason: string;
  decks: [ParsedDeck, ParsedDeck];
  [key: string]: unknown;
  handles_created: number;
  handles_destroyed: number;
};
export function gameplayHash(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return identity(sort(value));
}
export function mapPlayers(value: unknown, swapped: boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => mapPlayers(v, swapped));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => {
      if (k === "life_points" && swapped && v && typeof v === "object") {
        const points = v as { a: unknown; b: unknown };
        return [k, { a: points.b, b: points.a }];
      }
      if (["actor", "player", "controller", "owner", "turn_player"].includes(k))
        return [
          k,
          v === 0 ? (swapped ? "b" : "a") : v === 1 ? (swapped ? "a" : "b") : v,
        ];
      return [k, mapPlayers(v, swapped)];
    }),
  );
}
export async function integratedMatch(
  job: Job,
  item: Job["matches"][number],
  evidence: boolean,
  hooks?: {
    progress?: (frame: Frame) => void;
    sideboard?: (frame: Frame) => void;
    game?: (game: {
      index: number;
      initial: Record<string, unknown>[];
      events: Record<string, unknown>[][];
      terminal: Frame;
      decks: [ParsedDeck, ParsedDeck];
    }) => Promise<void>;
  },
) {
  const histories: unknown[][] = [[], []],
    games = [],
    frames: unknown[] = [];
  let decks = item.decks as [ParsedDeck, ParsedDeck];
  const command = async (value: unknown, consume: (frame: Frame) => void) => {
    await executeHostCommand(value, (raw) => {
      const f = raw as Frame;
      hooks?.progress?.(f);
      if (["host_error", "failure", "fallback"].includes(f.type))
        throw Error(JSON.stringify(f));
      if (evidence) frames.push(structuredClone(f));
      consume(f);
    });
  };
  await command(
    {
      type: "initialize",
      snapshot: job.content,
      codes: [],
      bots: [],
      frozen: { bots: item.bots, engine: job.engine },
    },
    () => {},
  );
  for (let index = 0; index < 4; index++) {
    hooks?.progress?.({
      type: index === 2 ? "sideboard_start" : "game_start",
    } as Frame);
    if (index === 2) {
      let side: Frame | undefined;
      await command(
        {
          type: "sideboard",
          decks: item.decks,
          botSeeds: item.match.sideboardSeeds,
          histories,
        },
        (f) => {
          if (f.type === "sideboard_done") side = f;
        },
      );
      if (!side) throw Error("Missing sideboard result");
      decks = side.decks;
      hooks?.sideboard?.(side);
    }
    if (index === 2) hooks?.progress?.({ type: "game_start" } as Frame);
    const swapped = index % 2 === 1,
      order = swapped ? [1, 0] : [0, 1];
    const initial: Record<string, unknown>[] = [],
      events: Record<string, unknown>[][] = [[], []];
    let terminal: Frame | undefined,
      cleaned = false,
      prompt: unknown;
    await command(
      {
        type: "game",
        game_id: `${item.match.id}-game-${index + 1}`,
        profile: job.profile,
        limits: job.limits,
        decks: order.map((i) => decks[i]),
        orders: null,
        bot_order: order,
        fixture: item.match.games[index],
      },
      (f) => {
        const actor = order[f.actor] ?? 0;
        if (f.type === "initial")
          initial[actor] = mapPlayers(
            structuredClone(f.initial),
            swapped,
          ) as Record<string, unknown>;
        if (f.type === "decision_started") prompt = structuredClone(f.prompt);
        if (f.type === "event" || f.type === "decision") {
          const entry = structuredClone(f.entry);
          if (f.type === "decision") entry.prompt = prompt;
          events[actor]!.push(
            mapPlayers(entry, swapped) as Record<string, unknown>,
          );
        }
        if (f.type === "done") terminal = f;
        if (f.type === "cleanup") {
          if (f.handles_created !== f.handles_destroyed)
            throw Error("Unbalanced engine handles");
          cleaned = true;
        }
      },
    );
    if (!terminal || !cleaned || initial.length !== 2)
      throw Error("Incomplete integrated game");
    await hooks?.game?.({ index, initial, events, terminal, decks });
    const winner = terminal.winner === null ? null : order[terminal.winner];
    const outcomes = [0, 1].map((i) =>
      winner === null ? "draw" : winner === i ? "win" : "loss",
    );
    games.push({
      id: `${item.match.id}-game-${index + 1}`,
      winner: winner === null ? null : winner === 0 ? "a" : "b",
      turns: terminal.turns,
      reason: terminal.engine_reason,
      actors: [0, 1].map((i) => ({
        opening: initial[i]!.own_starting_order,
        decisions: events[i]!.filter((e) => e.kind === "decision").map((e) => ({
          id: e.decision_id,
          choices: e.selected_choice_ids,
        })),
      })),
    });
    if (index < 2)
      for (const i of [0, 1]) {
        const visible = { ...initial[i] };
        delete visible.own_starting_order;
        histories[i]!.push({
          gameId: `${item.match.id}-game-${index + 1}`,
          decisions: [],
          events: events[i],
          initial: visible,
          outcome: outcomes[i],
        });
      }
  }
  return {
    id: item.match.id,
    games,
    fingerprint: gameplayHash(games),
    ...(evidence ? { frames } : {}),
  };
}
if (parentPort && workerData?.mode !== "native")
  parentPort.on(
    "message",
    async ({
      job,
      item,
      evidence,
    }: {
      job: Job;
      item: Job["matches"][number];
      evidence: boolean;
    }) => {
      try {
        parentPort!.postMessage({
          result: await integratedMatch(job, item, evidence),
        });
      } catch (e) {
        parentPort!.postMessage({ error: String(e) });
      }
    },
  );
