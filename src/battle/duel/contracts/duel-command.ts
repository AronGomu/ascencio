import type { ContentSetRef, ManifestRef } from "../../../content/index.ts";
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

export interface InitializeInstalledCommand {
  readonly type: "initialize";
  readonly content: ContentSetRef;
}

export type DuelCommand =
  | InitializeInstalledCommand
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
  /** Rebuild the failed duel from its own recorded responses, up to the last
      decision the player owned. */
  | { readonly type: "restore" }
  | { readonly type: "dispose" };

export function parseDuelCommand(value: unknown): DuelCommand {
  const command = requireRecord(value);
  const commandType = command.type;
  if (typeof commandType !== "string" || commandType.length > 32) {
    throw new DuelCommandValidationError("Unsupported duel command");
  }
  switch (commandType) {
    case "initialize":
      requireOnlyKeys(command, ["type", "content"]);
      if (command.content === undefined)
        throw new DuelCommandValidationError(
          "Duel initialize command requires installed content",
        );
      return {
        type: "initialize",
        content: parseContentSetRef(command.content),
      };
    case "surrender":
    case "requestDiagnostics":
    case "restore":
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

function parseContentSetRef(value: unknown): ContentSetRef {
  try {
    const ref = requireRecord(value);
    requireOnlyKeys(ref, ["catalogSha256", "snapshot", "runtime", "chapters"]);
    const snapshot = requireRecord(ref.snapshot);
    requireOnlyKeys(snapshot, [
      "activationId",
      "runtimeSnapshotId",
      "runtimeManifestSha256",
      "releaseCatalogSha256",
    ]);
    const catalogSha256 = contentHash(ref.catalogSha256);
    const releaseCatalogSha256 = contentHash(snapshot.releaseCatalogSha256);
    if (catalogSha256 !== releaseCatalogSha256) throw new Error();
    const runtime = manifestRef(ref.runtime);
    if (runtime.packId !== "runtime") throw new Error();
    if (!Array.isArray(ref.chapters) || ref.chapters.length > 99)
      throw new Error();
    const chapters = ref.chapters.map(manifestRef);
    if (
      chapters.length === 0 ||
      chapters.some(({ packId }) => packId === "runtime") ||
      chapters.some(
        ({ packId }, index) =>
          index > 0 && chapters[index - 1]!.packId >= packId,
      )
    )
      throw new Error();
    return Object.freeze({
      catalogSha256,
      snapshot: Object.freeze({
        activationId: contentHash(snapshot.activationId),
        runtimeSnapshotId: contentHash(snapshot.runtimeSnapshotId),
        runtimeManifestSha256: contentHash(snapshot.runtimeManifestSha256),
        releaseCatalogSha256,
      }),
      runtime,
      chapters: Object.freeze(chapters),
    });
  } catch {
    throw new DuelCommandValidationError(
      "Duel initialize command content ref is invalid",
    );
  }
}

function manifestRef(value: unknown): ManifestRef {
  const ref = requireRecord(value);
  requireOnlyKeys(ref, ["packId", "sha256", "bytes"]);
  if (
    typeof ref.packId !== "string" ||
    (ref.packId !== "runtime" &&
      !/^chapter-(0[1-9]|[1-9][0-9])$/.test(ref.packId)) ||
    typeof ref.bytes !== "number" ||
    !Number.isSafeInteger(ref.bytes) ||
    ref.bytes < 1 ||
    ref.bytes > 4_194_304
  )
    throw new Error();
  return Object.freeze({
    packId: ref.packId as ManifestRef["packId"],
    sha256: contentHash(ref.sha256),
    bytes: ref.bytes,
  });
}

function contentHash(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error();
  return value;
}
