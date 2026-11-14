/** Persistent engine ownership, externally enforced deadlines and timeout continuation. */
import { Worker } from "node:worker_threads";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
import { NativeMatchEvidence } from "./typescript-native-evidence.ts";
import type { Job, Frame } from "./typescript-match-worker.ts";
type Obj = Record<string, unknown>;
interface Response {
  verified?: boolean;
  nativeGame?: { text: string; game: Obj; records: Obj[] };
  initial: Obj[];
  events: Obj[][];
  terminal?: Frame;
  sideboard?: Frame;
  cleaned: boolean;
  failure?: {
    type: string;
    failure?: { category: string; message: string };
    message?: string;
  };
}
export class NativeCommandError extends Error {
  category: string;
  checkpoint: unknown;
  constructor(category: string, message: string, checkpoint?: unknown) {
    super(message);
    this.category = category;
    this.checkpoint = checkpoint ?? null;
  }
}
export class NativeEngineSlot {
  worker: Worker | undefined;
  constructor(readonlyData: {
    job: Job;
    runtime: string;
    register: (w: Worker) => void;
    aborted: () => boolean;
  }) {
    this.data = readonlyData;
  }
  readonly data: {
    job: Job;
    runtime: string;
    register: (w: Worker) => void;
    aborted: () => boolean;
  };
  async close() {
    const w = this.worker;
    this.worker = undefined;
    if (w) await w.terminate();
  }
  async request(command: Obj): Promise<Response> {
    if (this.data.aborted())
      throw new NativeCommandError("interrupted", "Execution stopped");
    if (!this.worker) {
      this.worker = new Worker(
        new URL("./typescript-native-worker.ts", import.meta.url),
        {
          workerData: { mode: "native" },
          execArgv: [
            "--experimental-vm-modules",
            "--disable-warning=ExperimentalWarning",
          ],
        },
      );
      this.data.register(this.worker);
    }
    const worker = this.worker,
      limits = this.data.job.limits;
    return new Promise((resolve, reject) => {
      let stage: ReturnType<typeof setTimeout> | undefined,
        wall: ReturnType<typeof setTimeout> | undefined,
        checkpoint: unknown;
      const cleanup = () => {
        clearTimeout(stage);
        clearTimeout(wall);
        worker.off("message", message);
        worker.off("error", error);
        worker.off("exit", exit);
      };
      const fail = (e: Error) => {
        cleanup();
        reject(e);
      };
      const timeout = () => {
        void this.close();
        fail(
          new NativeCommandError(
            "timeout",
            "Engine or bot exceeded external deadline",
            checkpoint,
          ),
        );
      };
      const deadline = (ms: number) => {
        clearTimeout(stage);
        stage = setTimeout(timeout, ms);
      };
      const message = (m: {
        progress?: string;
        phase?: string;
        checkpoint?: unknown;
        response?: Response;
        error?: string;
      }) => {
        if (m.progress) {
          checkpoint = m.checkpoint ?? checkpoint;
          if (m.progress === "decision_started")
            deadline(limits.decision_wall_time_ms);
          else if (m.progress === "decision")
            deadline(limits.game_wall_time_ms);
          else if (m.progress === "sideboard_hook" && m.phase === "start")
            deadline(limits.sideboarding_wall_time_ms);
          return;
        }
        cleanup();
        if (m.error) reject(new NativeCommandError("host_error", m.error));
        else if (m.response) resolve(m.response);
        else reject(Error("Missing native worker response"));
      };
      const error = (e: Error) =>
          fail(new NativeCommandError("host_crash", String(e))),
        exit = (code: number) =>
          fail(
            new NativeCommandError(
              this.data.aborted() ? "interrupted" : "host_crash",
              `Worker exited (${code})`,
              checkpoint,
            ),
          );
      worker.on("message", message);
      worker.once("error", error);
      worker.once("exit", exit);
      if (command.type === "game") {
        wall = setTimeout(timeout, limits.game_wall_time_ms);
        deadline(limits.game_wall_time_ms);
      } else
        deadline(
          command.type === "sideboard"
            ? limits.sideboarding_wall_time_ms
            : 120000,
        );
      worker.postMessage({ command });
    });
  }
  async verify(
    output: string,
    item: Job["matches"][number],
    marker: { files: Record<string, string> },
  ) {
    const result = await this.request({
      type: "verify",
      output,
      job: { identity: this.data.job.identity },
      item,
      marker,
    });
    if (!result.verified) throw Error("Native completion verification failed");
  }
  async initialize(item: Job["matches"][number]) {
    const response = await this.request({
      type: "initialize",
      snapshot: this.data.job.content,
      codes: [],
      bots: [],
      frozen: { bots: item.bots, engine: this.data.job.engine },
    });
    if (response.failure)
      throw new NativeCommandError(
        "host_error",
        response.failure.message ?? JSON.stringify(response.failure),
      );
  }
  async match(
    item: Job["matches"][number],
    writeGame: (number: number, text: string) => Promise<void>,
    writeBug: (id: string, value: unknown) => Promise<void>,
  ) {
    const { job } = this.data,
      builder = new NativeMatchEvidence(job, item, this.data.runtime);
    let decks = item.decks as [ParsedDeck, ParsedDeck],
      failed = false;
    const histories: unknown[][] = [[], []];
    try {
      await this.initialize(item);
    } catch (e) {
      await this.close();
      throw e;
    }
    for (let index = 0; index < 4; index++) {
      if (this.data.aborted())
        throw new NativeCommandError("interrupted", "Stopped between games");
      if (failed) {
        await writeGame(
          index + 1,
          builder.failure(
            index,
            decks,
            "earlier_execution_failed",
            "",
            undefined,
            true,
          ),
        );
        continue;
      }
      if (index === 2) {
        try {
          const r = await this.request({
            type: "sideboard",
            decks: item.decks,
            botSeeds: item.match.sideboardSeeds,
            histories,
          });
          if (r.failure || !r.sideboard)
            throw new NativeCommandError(
              "sideboarding_failure",
              JSON.stringify(r.failure ?? "Missing sideboard response"),
            );
          builder.sideboard(r.sideboard);
          decks = r.sideboard.decks;
        } catch (e) {
          if (this.data.aborted()) throw e;
          await this.close();
          const message = String(e);
          builder.sideboarding = [0, 1].map(() => ({
            status: "failed",
            bug_id: `${item.match.id}-sideboard`,
          }));
          await writeBug(`${item.match.id}-sideboard`, {
            category: "sideboarding_failure",
            message,
          });
          failed = true;
          await writeGame(
            index + 1,
            builder.failure(
              index,
              decks,
              "sideboarding_failure",
              message,
              undefined,
              true,
            ),
          );
          continue;
        }
      }
      const order = index % 2 ? [1, 0] : [0, 1];
      let response: Response | undefined;
      try {
        if (!this.worker) await this.initialize(item);
        response = await this.request({
          type: "game",
          game_id: `${item.match.id}-game-${index + 1}`,
          profile: job.profile,
          limits: job.limits,
          decks: order.map((i) => decks[i]),
          orders: null,
          bot_order: order,
          fixture: item.match.games[index],
          originalDecks: decks,
          native: {
            job: { ...job, matches: [] },
            item,
            index,
            sideboarding: builder.sideboarding,
          },
        });
        if (response.failure)
          throw new NativeCommandError(
            response.failure.failure?.category ?? "engine_or_bot_error",
            response.failure.failure?.message ??
              JSON.stringify(response.failure),
          );
        if (
          !response.terminal ||
          !response.cleaned ||
          (!response.nativeGame && response.initial.length !== 2)
        )
          throw new NativeCommandError(
            "host_protocol",
            "Incomplete authoritative game response",
          );
        if (!response.nativeGame)
          throw new NativeCommandError(
            "host_protocol",
            "Missing native game evidence",
          );
        builder.games.push(response.nativeGame.game);
        builder.records.push(response.nativeGame.records);
        await writeGame(index + 1, response.nativeGame.text);
      } catch (e) {
        if (this.data.aborted()) throw e;
        // Writer/encoder failures belong to the coordinator. Converting one
        // into a game failure would append a second record for the same game.
        if (!(e instanceof NativeCommandError)) throw e;
        const error = e;
        await this.close();
        failed = error.category !== "timeout";
        await writeBug(`${item.match.id}-game-${index + 1}-${error.category}`, {
          category: error.category,
          message: error.message,
          checkpoint: error.checkpoint,
          retry: false,
        });
        await writeGame(
          index + 1,
          builder.failure(
            index,
            decks,
            error.category,
            error.message,
            response,
          ),
        );
      }
      if (index < 2)
        for (const i of [0, 1]) {
          const r = builder.records[index]![i]!,
            initial = { ...((r.initial as Obj) ?? {}) };
          delete initial.own_starting_order;
          histories[i]!.push({
            gameId: `${item.match.id}-game-${index + 1}`,
            decisions: [],
            events: (r.timeline as { entry: unknown[] }).entry,
            initial: r.initial === null ? null : initial,
            outcome: (r.result as Obj).outcome,
          });
        }
    }
    return builder.match();
  }
}
