import { DuelOperationError } from "./duel-error.ts";

/* The primitives every Worker command payload is parsed with. They live apart
   from `duel-command.ts` so a per-field contract — a deck selection, say — can
   reuse them and still be imported *by* the command parser without the two
   modules importing each other. */

const MAX_ID_LENGTH = 512;

export class DuelCommandValidationError extends DuelOperationError {
  constructor(message: string) {
    super({ code: "invalid_command", message, recoverable: true });
    this.name = "DuelCommandValidationError";
  }
}

export function requireRecord(
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DuelCommandValidationError("Duel command must be an object");
  }
  return value as Readonly<Record<string, unknown>>;
}

export function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DuelCommandValidationError(
      `Duel command ${label} must be a non-empty string`,
    );
  }
  if (value.length > MAX_ID_LENGTH) {
    throw new DuelCommandValidationError(
      `Duel command ${label} exceeds ${MAX_ID_LENGTH} characters`,
    );
  }
  return value;
}

/* Exact-key parsing rather than "has at least": an unexpected key means the
   sender speaks a contract this build does not, and silently dropping it would
   start a duel with settings nobody applied. Counting own keys also refuses a
   forged `__proto__` or `constructor` entry, which arrives as an ordinary own
   property once a payload has been through `JSON.parse` or a structured
   clone. */
export function requireOnlyKeys(
  command: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
): void {
  let ownKeyCount = 0;
  for (const key in command) {
    if (!Object.hasOwn(command, key)) continue;
    ownKeyCount += 1;
    if (ownKeyCount > allowedKeys.length || !allowedKeys.includes(key)) {
      throw new DuelCommandValidationError(
        "Duel command contains an unexpected field",
      );
    }
  }
}
