import {
  DuelCommandValidationError,
  requireId,
  requireOnlyKeys,
  requireRecord,
} from "./duel-command-parsing.ts";
import {
  parseDuelDeckSelection,
  type DuelDeckSelection,
} from "./duel-deck-selection.ts";
import {
  choiceId,
  duelId,
  promptId,
  type ChoiceId,
  type DuelId,
  type PromptId,
} from "./ids.ts";

const MAX_RESPONSE_CHOICES = 256;

export { DuelCommandValidationError };

export type DuelCommand =
  | { readonly type: "initialize" }
  | {
      readonly type: "startDuel";
      readonly duelId: DuelId;
      readonly player: DuelDeckSelection;
      readonly opponent: DuelDeckSelection;
    }
  | {
      readonly type: "respond";
      readonly promptId: PromptId;
      readonly choiceIds: readonly ChoiceId[];
    }
  | { readonly type: "surrender" }
  | { readonly type: "requestDiagnostics" }
  | { readonly type: "dispose" };

export function parseDuelCommand(value: unknown): DuelCommand {
  const command = requireRecord(value);
  const commandType = command.type;
  if (typeof commandType !== "string" || commandType.length > 32) {
    throw new DuelCommandValidationError("Unsupported duel command");
  }
  switch (commandType) {
    case "initialize":
    case "surrender":
    case "requestDiagnostics":
    case "dispose":
      requireOnlyKeys(command, ["type"]);
      return { type: commandType };
    case "startDuel":
      requireOnlyKeys(command, ["type", "duelId", "player", "opponent"]);
      return {
        type: "startDuel",
        duelId: duelId(requireId(command.duelId, "duelId")),
        player: parseDuelDeckSelection(command.player),
        opponent: parseDuelDeckSelection(command.opponent),
      };
    case "respond": {
      requireOnlyKeys(command, ["type", "promptId", "choiceIds"]);
      if (!Array.isArray(command.choiceIds)) {
        throw new DuelCommandValidationError(
          "Duel respond command choiceIds must be an array",
        );
      }
      if (command.choiceIds.length > MAX_RESPONSE_CHOICES) {
        throw new DuelCommandValidationError(
          `Duel respond command accepts at most ${MAX_RESPONSE_CHOICES} choice IDs`,
        );
      }
      for (let index = 0; index < command.choiceIds.length; index += 1) {
        if (!(index in command.choiceIds)) {
          throw new DuelCommandValidationError(
            "Duel respond command choiceIds must be a dense array",
          );
        }
      }
      return {
        type: "respond",
        promptId: promptId(requireId(command.promptId, "promptId")),
        choiceIds: command.choiceIds.map((id) =>
          choiceId(requireId(id, "choiceId")),
        ),
      };
    }
    default:
      throw new DuelCommandValidationError("Unsupported duel command");
  }
}
