import {
  OCG_ATTRIBUTE,
  OCG_RACE,
  OCG_TYPE,
} from "../../cards/classification/index.ts";
import type { SnapshotCard } from "../contracts/critical-snapshot.ts";
export class ReadableCardFailure extends Error {
  readonly pointer: string;
  constructor(pointer: string) {
    super(`CARD_CLASSIFICATION: ${pointer}`);
    this.pointer = pointer;
  }
}
function mask(
  table: Readonly<Record<string, number | bigint>>,
  names: unknown,
  raw: unknown,
  pointer: string,
): bigint {
  if (
    !Array.isArray(names) ||
    names.length > 32 ||
    new Set(names).size !== names.length
  )
    throw new ReadableCardFailure(pointer);
  let named = 0n,
    known = 0n;
  for (const value of Object.values(table)) known |= BigInt(value);
  for (const name of names) {
    if (typeof name !== "string" || !Object.hasOwn(table, name.toUpperCase()))
      throw new ReadableCardFailure(pointer);
    named |= BigInt(table[name.toUpperCase()]!);
  }
  const engine = raw === undefined ? named : BigInt(raw as string | number);
  if ((engine & known) !== named) throw new ReadableCardFailure(pointer);
  return engine;
}
/** Named fields compile to engine masks; explicit masks retain unknown official bits losslessly. */
export function readableCard(value: unknown): { id: string } & SnapshotCard {
  const row = value as Record<string, unknown>;
  if (
    !row ||
    typeof row !== "object" ||
    row.schemaVersion !== 1 ||
    typeof row.id !== "string" ||
    Object.keys(row).sort().join() !==
      "classification,engine,id,schemaVersion,texts" ||
    !row.engine ||
    typeof row.engine !== "object" ||
    Array.isArray(row.engine)
  )
    throw new ReadableCardFailure("");
  const classification = row.classification as Record<string, unknown>;
  if (
    !classification ||
    typeof classification !== "object" ||
    Object.keys(classification).sort().join() !== "attributes,races,types"
  )
    throw new ReadableCardFailure("/classification");
  const engine = { ...(row.engine as Record<string, unknown>) };
  try {
    engine.type = Number(
      mask(
        OCG_TYPE,
        classification.types,
        engine.type,
        "/classification/types",
      ),
    );
    engine.attribute = Number(
      mask(
        OCG_ATTRIBUTE,
        classification.attributes,
        engine.attribute,
        "/classification/attributes",
      ),
    );
    engine.race = mask(
      OCG_RACE,
      classification.races,
      engine.race,
      "/classification/races",
    ).toString();
  } catch (error) {
    if (error instanceof ReadableCardFailure) throw error;
    throw new ReadableCardFailure("/engine");
  }
  engine.code ??= 0;
  return {
    id: row.id,
    definition: engine as unknown as SnapshotCard["definition"],
    texts: row.texts as SnapshotCard["texts"],
  };
}
