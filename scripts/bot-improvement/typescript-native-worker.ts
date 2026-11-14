import { verifyNativeCompletion } from "./typescript-native-completion.ts";
import { NativeMatchEvidence } from "./typescript-native-evidence.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
/** Engine and bots stay in this thread; only checkpoints and finalized game records leave it. */
import { parentPort } from "node:worker_threads";
import { executeHostCommand } from "../bot-evaluation/host.ts";
import { mapPlayers, type Frame, type Job } from "./typescript-match-worker.ts";
parentPort!.on(
  "message",
  async ({ command }: { command: Record<string, unknown> }) => {
    if (command.type === "verify") {
      try {
        const verified = await verifyNativeCompletion(
          String(command.output),
          command.job as Job,
          command.item as Job["matches"][number],
          command.marker as { files: Record<string, string> },
        );
        parentPort!.postMessage({ response: { verified } });
      } catch (e) {
        parentPort!.postMessage({ error: String(e) });
      }
      return;
    }

    const initial: Record<string, unknown>[] = [],
      events: Record<string, unknown>[][] = [[], []];
    let evidenceBytes = 0,
      entries = 0;
    const valueSize = (v: unknown): number =>
      Array.isArray(v)
        ? v.reduce((n, x) => n + 16 + valueSize(x), 0)
        : v && typeof v === "object"
          ? Object.entries(v).reduce(
              (n, [k, x]) => n + k.length + 32 + valueSize(x),
              0,
            )
          : typeof v === "string"
            ? v.length
            : 16;
    let terminal: Frame | undefined,
      failure: unknown,
      sideboard: Frame | undefined,
      prompt: unknown,
      cleaned = false;
    const order = (command.bot_order ?? [0, 1]) as number[],
      swapped = order[0] === 1;
    try {
      await executeHostCommand(command, (raw) => {
        const f = raw as Frame,
          actor = order[f.actor] ?? 0;
        if (f.type === "initial")
          initial[actor] = mapPlayers(
            structuredClone(f.initial),
            swapped,
          ) as Record<string, unknown>;
        if (f.type === "event" || f.type === "decision") {
          entries++;
          evidenceBytes += valueSize(f);
          if (entries > 1_000_000 || evidenceBytes > 64 * 1024 * 1024)
            throw Error("evidence_limit: game exceeded bounded evidence limit");
          const entry = structuredClone(f.entry);
          if (f.type === "decision") entry.prompt = prompt;
          events[actor]!.push(
            mapPlayers(entry, swapped) as Record<string, unknown>,
          );
        }
        if (f.type === "decision_started") prompt = structuredClone(f.prompt);
        if (["decision_started", "decision", "sideboard_hook"].includes(f.type))
          parentPort!.postMessage({
            progress: f.type,
            phase: f.phase,
            checkpoint:
              f.type === "decision_started"
                ? { pending_prompt: prompt }
                : undefined,
          });
        if (f.type === "done") terminal = f;
        if (f.type === "sideboard_done") sideboard = f;
        if (["failure", "host_error", "fallback"].includes(f.type)) failure = f;
        if (f.type === "cleanup") {
          cleaned = true;
          if (f.handles_created !== f.handles_destroyed)
            failure = {
              type: "failure",
              failure: {
                category: "handle_cleanup",
                message: "Unbalanced engine handles",
              },
            };
        }
      });
      const native = command.native as
        | {
            job: Job;
            item: Job["matches"][number];
            index: number;
            sideboarding: Record<string, unknown>[];
          }
        | undefined;
      let nativeGame: unknown;
      if (native && terminal && cleaned && !failure) {
        const builder = new NativeMatchEvidence(native.job, native.item);
        builder.games.length = native.index;
        builder.records.length = native.index;
        builder.sideboarding = native.sideboarding;
        const text = builder.game({
          index: native.index,
          initial,
          events,
          terminal,
          decks: command.originalDecks as [ParsedDeck, ParsedDeck],
        });
        nativeGame = {
          text,
          game: builder.games[native.index],
          records: native.index < 2 ? builder.records[native.index] : [],
        };
      }
      parentPort!.postMessage({
        response: {
          initial: nativeGame ? [] : initial,
          events: nativeGame ? [[], []] : events,
          terminal,
          sideboard,
          cleaned,
          failure,
          nativeGame,
        },
      });
    } catch (e) {
      parentPort!.postMessage({ error: String(e) });
    }
  },
);
