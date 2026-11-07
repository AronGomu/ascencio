/** Persistent admission/accounting bridge. Rust retains subprocess and attempt ownership. */
import { createInterface } from "node:readline";
import { sessionControl as controlSession } from "./match-session.ts";
import type { MatchBinding } from "./match-session.ts";
import type { ControlAction } from "./session-control-contract.ts";
let binding: MatchBinding | undefined;
for await (const line of createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})) {
  try {
    const command = JSON.parse(line);
    if (command.type === "initialize") binding = command.binding;
    if (!binding) throw new Error("Initialize session binding first");
    const base = { iteration: binding.iteration, role: binding.role };
    let action: ControlAction;
    if (command.type === "reserve") {
      action = {
        action: "reserve",
        ...base,
        match: command.match,
        runnerIdentity: binding.runnerIdentity,
        executableIdentity: binding.executableIdentity,
      };
    } else if (command.type === "settle") {
      action = {
        action: "settle",
        ...base,
        match: command.match,
        attempt: command.attempt,
        status: command.status,
        games: command.games,
      };
    } else if (command.type === "stop")
      action = { action: "stop", reason: "interrupted" };
    else action = { action: "plan" };
    if (command.type === "reserve" && command.recover) {
      const current = await controlSession(binding.session, { action: "plan" });
      const attempt = current.running.find(
        (a) =>
          a.iteration === binding!.iteration &&
          a.role === binding!.role &&
          a.match === command.match,
      );
      if (attempt)
        await controlSession(binding.session, {
          action: "settle",
          ...base,
          match: command.match,
          attempt: attempt.attempt,
          status: "interrupted",
          games: command.games,
        });
    }
    let plan;
    try {
      plan = await controlSession(binding.session, action);
    } catch (e) {
      if (
        command.type !== "reserve" ||
        !(e instanceof Error) ||
        e.message !== "Match worker limit reached"
      )
        throw e;
      plan = await controlSession(binding.session, { action: "plan" });
    }
    process.stdout.write(JSON.stringify({ type: "control", plan }) + "\n");
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      }) + "\n",
    );
  }
}
