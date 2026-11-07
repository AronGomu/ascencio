/** Evaluator-only asynchronous transport; application transport is separate. */
import type { Artifact } from "../bot-evaluation/host-inputs.ts";
import { instantiate } from "../bot-evaluation/host-inputs.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import type {
  BotDecisionInput,
  BotSideboardInput,
  BotDecision,
  BotSideboardDecision,
} from "../../src/battle/worker/bot/bot-contract.ts";
import { nativeTransport, wasmTransport } from "./transport.ts";
export interface HostBot {
  decide(input: BotDecisionInput): BotDecision | Promise<BotDecision>;
  sideboard(
    input: BotSideboardInput,
  ): BotSideboardDecision | Promise<BotSideboardDecision>;
  close?(): void;
}
export async function instantiateHostBot(
  artifact: Artifact,
  dependencies: ActiveDuelDependencies,
): Promise<HostBot> {
  if (!artifact.module.startsWith("experiment:"))
    return instantiate(artifact, dependencies);
  const [, target, policy] = artifact.module.split(":");
  if (
    !["native", "wasm"].includes(target!) ||
    !["basic", "generalist", "random"].includes(policy!)
  )
    throw new Error("Unsupported experiment bot");
  const transport =
    target === "native" ? await nativeTransport() : await wasmTransport();
  try {
    await transport.request({
      op: "create",
      contractVersion: 1,
      policy,
      configuration: artifact.config,
      seed: 1,
      cards: [...dependencies.cards.values()].map((c) => ({
        ...c,
        race: String(c.race),
      })),
    });
  } catch (error) {
    transport.close();
    throw error;
  }
  return {
    decide: (input) => transport.request({ op: "decide", input }),
    sideboard: (input) => transport.request({ op: "sideboard", input }),
    close: () => transport.close(),
  };
}
