import { bindPromptInstances } from "../../src/battle/worker/bot/prompt-instances.ts";
/** Narrow frozen-core/bot host. Rust alone owns scheduling, persistence and results. */
import { createInterface } from "node:readline";
import { writeSync } from "node:fs";
import { loadInputs, instantiate, type Artifact } from "./host-inputs.ts";
import { loadVendoredCoreNode } from "../../src/battle/worker/engine/load-vendored-core-node.ts";
import { DuelSession } from "../../src/battle/worker/engine/DuelSession.ts";
import { createProductionSeed } from "../../src/battle/worker/engine/duel-seed.ts";
import { PromptRegistry } from "../../src/battle/worker/protocol/PromptRegistry.ts";
import { ActorObservation } from "../../src/battle/worker/bot/actor-observation.ts";
import { toOpponentVisibleState } from "../../src/battle/worker/opponent/OpponentPolicy.ts";
import { validateBotDecision } from "../../src/battle/worker/bot/validate-bot-decision.ts";
import { sideboardBots } from "../../src/battle/worker/bot/bot-match.ts";
import { snapshotId } from "../../src/battle/duel/contracts/ids.ts";
import {
  deckRecord,
  promptRecord,
  changes,
  initialRecord,
  record,
} from "./host-evidence.ts";
import { EngineMessageType } from "../../src/battle/worker/engine/engine-constants.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import type { BotGameObservation } from "../../src/battle/worker/bot/bot-contract.ts";
import type { OcgCoreAdapter } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
interface Command {
  type: string;
  snapshot: string;
  codes: number[];
  bots: { module: string; config: Record<string, string> }[];
  decks: [ParsedDeck, ParsedDeck];
  profile: "mr3" | "mr5";
  game_id: string;
  limits: { max_turns_per_game: number; max_decisions_per_game: number };
  orders: [ParsedDeck, ParsedDeck] | null;
  bot_order: [number, number];
  histories: [
    readonly [BotGameObservation, BotGameObservation],
    readonly [BotGameObservation, BotGameObservation],
  ];
}
let dependencies: ActiveDuelDependencies,
  artifacts: Artifact[] = [],
  adapter: OcgCoreAdapter,
  snapshot: string;
let ipcTime = 0;
let measuring = false;
let handlesCreated = 0,
  handlesDestroyed = 0;
let outputBuffer = "";
function flushOutput() {
  if (!outputBuffer) return;
  const start = performance.now();
  const bytes = Buffer.from(outputBuffer, "utf8");
  outputBuffer = "";
  let offset = 0;
  while (offset < bytes.length) offset += writeSync(1, bytes, offset);
  if (measuring) ipcTime += performance.now() - start;
}
function send(value: unknown) {
  const start = performance.now();
  const event = (value as { type?: string }).type === "event";
  outputBuffer +=
    (event
      ? JSON.stringify(value)
      : JSON.stringify(value, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        )) + "\n";
  if (measuring) ipcTime += performance.now() - start;
  // Only observed events may be grouped. Every checkpoint, prompt, response,
  // result and cleanup flushes immediately. No buffered evidence crosses an
  // engine call that could hang; the supervisor retains the confirmed prefix.
  if (
    outputBuffer.length >= 16 * 1024 ||
    (value as { type?: string }).type !== "event"
  )
    flushOutput();
}

const names = new Map<number, string>(
  Object.entries(EngineMessageType).map(([name, n]) => [n, name.toLowerCase()]),
);
names.set(61, "summon_succeeded");
names.set(63, "special_summon_succeeded");
names.set(65, "flip_summon_succeeded");
async function game(command: Command) {
  const start = performance.now();
  measuring = true;
  ipcTime = 0;
  let projectionTime = 0;
  let engineTime = 0,
    botTime = 0,
    decisions = 0,
    turns = 0;
  let session: DuelSession | undefined;
  try {
    const bots = await Promise.all(
      command.bot_order.map((index) =>
        instantiate(artifacts[index]!, dependencies),
      ),
    );
    const engineStart = performance.now();
    session = DuelSession.create({
      adapter,
      dependencies,
      playerDeck: command.decks[0],
      opponentDeck: command.decks[1],
      captureStartingOrders: true,
      configuration: command.orders
        ? {
            mode: "programmed",
            rules: command.profile,
            seed: createProductionSeed(),
            playerDeckOrder: command.orders[0].main,
            opponentDeckOrder: command.orders[1].main,
            playerExtraOrder: command.orders[0].extra,
            opponentExtraOrder: command.orders[1].extra,
          }
        : { mode: "production", rules: command.profile },
      onEngineDiagnostic: (e) =>
        send({
          type: "diagnostic",
          entry: { message: e.message, type: e.type },
        }),
    });
    handlesCreated++;
    send({ type: "handle_created" });
    engineTime += performance.now() - engineStart;
    const observers = ([0, 1] as const).map(
      (actor) =>
        new ActorObservation(
          actor,
          session!,
          dependencies,
          snapshotId(snapshot),
          [command.decks[0].main.length, command.decks[1].main.length],
          [command.decks[0].extra.length, command.decks[1].extra.length],
          command.profile === "mr5",
        ),
    );
    const hostSetup = performance.now() - start;
    const registry = new PromptRegistry(dependencies, command.game_id);
    const previousStates = observers.map((observer) => observer.snapshot());
    let initialized = false;
    let sequence = 0;
    let lastDecision: string | null = null;
    while (true) {
      flushOutput();
      const processStart = performance.now();
      const boundary = session.processUntilBoundary();
      engineTime += performance.now() - processStart;
      let terminal: { winner: 0 | 1 | null; reason: number } | undefined;
      for (const message of boundary.messages) {
        if (message.type === EngineMessageType.RETRY)
          throw new Error(
            "invalid_response: core rejected the previous response",
          );
        for (const actor of [0, 1] as const) {
          const projectionStart = performance.now();
          const observer = observers[actor]!;
          const before = previousStates[actor]!;
          const update = observer.apply(message);
          const after = observer.snapshot();
          previousStates[actor] = after;
          turns = after.turn;
          if (update.result?.type === "completed")
            terminal = {
              winner: update.result.winner,
              reason: update.result.reason,
            };
          const delta = changes(before, after);
          projectionTime += performance.now() - projectionStart;
          const event = names.get(message.type) ?? `engine_${message.type}`;
          const isPrompt =
            (message.type >= 10 && message.type <= 26) ||
            (message.type >= 140 && message.type <= 143) ||
            message.type === 132;
          if (!isPrompt) {
            const details = update.observed?.details ?? [];
            send({
              type: "event",
              actor,
              entry: {
                sequence: ++sequence,
                kind: "event",
                actor:
                  "player" in message
                    ? message.player
                    : "controller" in message
                      ? message.controller
                      : null,
                event,
                turn: after.turn,
                phase: after.phase,
                before_initial: !initialized,
                caused_by_decision_id: lastDecision,
                changes: { change: delta },
                details: record(details),
              },
            });
          }
        }
        if (turns > command.limits.max_turns_per_game)
          throw new Error("turn_limit: maximum turns exceeded");
      }
      for (const actor of [0, 1] as const) {
        const projectionStart = performance.now();
        const observer = observers[actor]!;
        observer.reconcile();
        const after = observer.snapshot();
        const delta = changes(previousStates[actor]!, after);
        projectionTime += performance.now() - projectionStart;
        if (delta.length)
          send({
            type: "event",
            actor,
            entry: {
              sequence: ++sequence,
              kind: "event",
              actor: null,
              event: "state_reconciled",
              turn: after.turn,
              phase: after.phase,
              before_initial: !initialized,
              caused_by_decision_id: lastDecision,
              changes: { change: delta },
              details: {},
            },
          });
        previousStates[actor] = after;
      }
      if (!initialized) {
        for (const actor of [0, 1] as const) {
          const main = session.initialMainDeckOrder(actor);
          if (main.length !== command.decks[actor].main.length)
            throw new Error("starting_order_capture: missing startup capture");
          send({
            type: "initial",
            actor,
            initial: initialRecord(
              observers[actor]!.snapshot(),
              actor,
              command.decks[actor],
              main,
              command.orders?.[actor].extra ?? command.decks[actor].extra,
              command.profile,
            ),
          });
        }
        initialized = true;
      }
      if (terminal) {
        session.dispose();
        handlesDestroyed++;
        send({
          type: "done",
          host_setup_ms: hostSetup,
          projection_ms: projectionTime,
          ipc_ms: ipcTime,
          winner: terminal.winner,
          engine_reason: String(terminal.reason),
          turns,
          duration_ms: performance.now() - start,
          engine_time_ms: engineTime,
          bot_time_ms: botTime,
          handles_created: handlesCreated,
          handles_destroyed: handlesDestroyed,
          rss_bytes: process.memoryUsage().rss,
        });
        return;
      }
      let responded = false;
      for (const message of boundary.messages) {
        const published = registry.publish(message);
        if (!published) continue;
        const prompt = bindPromptInstances(
          published,
          observers[published.player]!.snapshot(),
        );
        if (responded)
          throw new Error(
            "unsupported_prompt: multiple prompts in one boundary",
          );
        const actor = prompt.player;
        const state = observers[actor]!.snapshot();
        send({ type: "decision_started", actor, prompt: promptRecord(prompt) });
        const botStart = performance.now();
        const input = {
          prompt,
          observation: toOpponentVisibleState(
            state,
            actor,
            observers[actor]!.takeEvents(),
          ),
        };
        // The repository-owned basic policy is read-only; its fresh instance
        // may share immutable observation data, as in the actual runtime.
        const trusted =
          artifacts[command.bot_order[actor]]!.module === "builtin:basic";
        const decision = bots[actor]!.decide(
          trusted ? input : structuredClone(input),
        );
        const duration = performance.now() - botStart;
        botTime += duration;
        send({
          type: "attempted_response",
          actor,
          response: {
            selected_choice_ids: { choice_id: decision?.choiceIds ?? [] },
            reason: decision?.reason ?? null,
          },
        });
        let response;
        try {
          validateBotDecision(prompt, decision);
          response = registry.respond(prompt.id, decision.choiceIds);
        } catch (error) {
          throw new Error(
            `invalid_decision: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        lastDecision = `${actor}-decision-${++decisions}`;
        send({
          type: "decision",
          actor,
          entry: {
            sequence: ++sequence,
            kind: "decision",
            decision_id: lastDecision,
            actor,
            turn: state.turn,
            phase: state.phase,
            // Rust attaches the already captured decision_started prompt.
            selected_choice_ids: { choice_id: [...decision.choiceIds] },
            reason: decision.reason,
            duration_ms: duration,
          },
        });
        if (decisions > command.limits.max_decisions_per_game)
          throw new Error("decision_limit: maximum decisions exceeded");
        const respondStart = performance.now();
        session.respond(response);
        engineTime += performance.now() - respondStart;
        responded = true;
      }
      if (!responded)
        throw new Error(
          "unsupported_prompt: waiting core without supported prompt",
        );
    }
  } catch (error) {
    send({
      type: "failure",
      failure: {
        category:
          error instanceof Error && /^[a-z_]+:/.test(error.message)
            ? error.message.split(":")[0]
            : "engine_or_bot_error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      },
      turns,
      duration_ms: performance.now() - start,
      engine_time_ms: engineTime,
      bot_time_ms: botTime,
    });
  } finally {
    if (session && !session.disposed) {
      session.dispose();
      handlesDestroyed++;
    }
    send({
      type: "cleanup",
      handles_created: handlesCreated,
      handles_destroyed: handlesDestroyed,
      rss_bytes: process.memoryUsage().rss,
    });
  }
}
for await (const line of createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})) {
  try {
    const command = JSON.parse(line) as Command;
    if (command.type === "initialize") {
      const loaded = await loadInputs(
        command.snapshot,
        command.codes,
        command.bots,
      );
      dependencies = loaded.dependencies;
      artifacts = loaded.artifacts;
      snapshot = loaded.manifest.snapshotId;
      // Executable setup only: no duel or decision is performed during startup.
      for (const artifact of artifacts)
        if (artifact.module === "builtin:basic")
          await instantiate(artifact, dependencies);
      adapter = await loadVendoredCoreNode({
        onDiagnostic: (d) => send({ type: "diagnostic", entry: d }),
      });
      send({
        type: "ready",
        manifest: loaded.manifest,
        artifacts,
        cards: [...dependencies.cards.values()].map((c) => ({
          code: String(c.code),
          alias: String(c.alias),
          type: c.type,
        })),
        node: process.version,
        node_flags: process.execArgv.join(" "),
        rss_bytes: process.memoryUsage().rss,
      });
    } else if (command.type === "game") await game(command);
    else if (command.type === "sideboard") {
      const bots = await Promise.all(
        artifacts.map((a) => instantiate(a, dependencies)),
      );
      const result = sideboardBots(
        command.decks,
        [bots[0]!, bots[1]!],
        command.histories,
        () => {},
        (actor, phase, decision) =>
          send({
            type: "sideboard_hook",
            actor,
            phase,
            response: decision
              ? {
                  reason: decision.reason,
                  exchanges: {
                    exchange: decision.exchanges.map((e) => ({
                      from_section: e.from,
                      to_section: e.to,
                      card_code: e.cardCode,
                      copies: e.copies,
                      reason: e.reason,
                    })),
                  },
                }
              : null,
          }),
      );
      send({
        type: "sideboard_done",
        decks: result.decks,
        decisions: result.decisions,
        durations: result.durations,
        configurations: result.decks.map(deckRecord),
      });
    } else throw new Error("Unknown host command");
  } catch (error) {
    send({
      type: "host_error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
