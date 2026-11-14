export { eventDetails } from "../../src/battle/worker/bot/observed-events.ts";

/** Engine sentinel values (for example both players) are not individual actors. */
export function messageActor(message: object): 0 | 1 | null {
  const value =
    "player" in message
      ? message.player
      : "controller" in message
        ? message.controller
        : null;
  return value === 0 || value === 1 ? value : null;
}
