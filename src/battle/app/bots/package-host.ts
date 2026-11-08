import type {
  BotPackageInfo,
  PinnedBotPackage,
} from "../../duel/contracts/bot-package.ts";
import type { BotSelection } from "../../duel/contracts/bot-selection.ts";
import type { BotHostCall } from "../../duel/contracts/bot-host.ts";
export type { BotHostCall } from "../../duel/contracts/bot-host.ts";

const retiredRuntime = () =>
  new Error("Rust AI packages are retired. Choose a built-in TypeScript AI.");

/** Compatibility surface for callers compiled against the former package API. */
export async function listBotPackages(): Promise<readonly BotPackageInfo[]> {
  return [];
}
export async function pinBotPackage(
  _selection: BotSelection,
): Promise<PinnedBotPackage> {
  void _selection;
  throw retiredRuntime();
}
export async function botHostCall(_call: BotHostCall): Promise<unknown> {
  void _call;
  throw retiredRuntime();
}
export async function assertBotAvailable(
  selection: BotSelection,
): Promise<void> {
  if (selection.runtime === "typescript") return;
  const failure = retiredRuntime();
  failure.name = "BotDependencyError";
  throw failure;
}
