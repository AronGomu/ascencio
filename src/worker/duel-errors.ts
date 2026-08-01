import {
  DuelOperationError,
  type DuelError,
} from "../duel/contracts/duel-error.ts";

const MAXIMUM_LOG_ERROR_DEPTH = 8;
const MAXIMUM_AGGREGATE_ERRORS = 16;
const MAXIMUM_LOG_MESSAGE_LENGTH = 512;
const MAXIMUM_LOG_STACK_LENGTH = 4_096;

export function routineLogError(error: unknown): unknown {
  if (!containsDuelOperationError(error, new Set(), 0)) return error;
  return sanitizeRoutineLogError(error, new Set(), 0);
}

function containsDuelOperationError(
  error: unknown,
  visited: Set<object>,
  depth: number,
): boolean {
  if (error instanceof DuelOperationError) return true;
  if (!(error instanceof Error)) return false;
  if (depth >= MAXIMUM_LOG_ERROR_DEPTH) return true;
  if (visited.has(error)) return false;
  visited.add(error);
  try {
    if (error instanceof AggregateError) {
      if (error.errors.length > MAXIMUM_AGGREGATE_ERRORS) return true;
      for (const nested of error.errors) {
        if (containsDuelOperationError(nested, visited, depth + 1)) return true;
      }
    }
    return (
      "cause" in error &&
      containsDuelOperationError(error.cause, visited, depth + 1)
    );
  } finally {
    visited.delete(error);
  }
}

function sanitizeRoutineLogError(
  error: unknown,
  ancestors: Set<object>,
  depth: number,
): unknown {
  if (error instanceof DuelOperationError)
    return duelOperationLogEnvelope(error);
  if (!(error instanceof Error)) return error;
  if (depth >= MAXIMUM_LOG_ERROR_DEPTH)
    return Object.freeze({ name: "Error", message: "Nested error omitted" });
  if (ancestors.has(error))
    return Object.freeze({ name: "Error", message: "Cyclic error omitted" });

  if (!containsDuelOperationError(error, new Set(), depth)) return error;

  ancestors.add(error);
  try {
    const cause =
      "cause" in error
        ? sanitizeRoutineLogError(error.cause, ancestors, depth + 1)
        : undefined;
    if (error instanceof AggregateError) {
      const errors = error.errors
        .slice(0, MAXIMUM_AGGREGATE_ERRORS)
        .map((nested) => sanitizeRoutineLogError(nested, ancestors, depth + 1));
      if (error.errors.length > MAXIMUM_AGGREGATE_ERRORS)
        errors.push(
          Object.freeze({ name: "Error", message: "Nested errors omitted" }),
        );
      return Object.freeze({
        name: error.name,
        message: "Operation failed with nested errors",
        errors: Object.freeze(errors),
        ...(cause === undefined ? {} : { cause }),
      });
    }
    return Object.freeze({
      name: error.name,
      message: "Operation failed with sanitized cause",
      ...(cause === undefined ? {} : { cause }),
    });
  } finally {
    ancestors.delete(error);
  }
}

function duelOperationLogEnvelope(error: DuelOperationError): unknown {
  return Object.freeze({
    name: error.name,
    message: boundedText(error.duelError.message, MAXIMUM_LOG_MESSAGE_LENGTH),
    code: error.duelError.code,
    ...(error.stack === undefined
      ? {}
      : { stack: boundedText(error.stack, MAXIMUM_LOG_STACK_LENGTH) }),
  });
}

function boundedText(value: string, maximumLength: number): string {
  return value.length <= maximumLength ? value : value.slice(0, maximumLength);
}

export function toDuelError(
  error: unknown,
  options: { readonly terminal?: boolean } = {},
): DuelError {
  const duelError =
    error instanceof DuelOperationError
      ? error.duelError
      : fallbackEngineError(error);
  if (options.terminal !== true || !duelError.recoverable) return duelError;
  return {
    ...duelError,
    code: "engine_error",
    recoverable: false,
  };
}

function fallbackEngineError(error: unknown): DuelError {
  const message = error instanceof Error ? error.message : String(error);
  const code = "engine_error" as const;
  return {
    code,
    message,
    detail: { cause: message },
    recoverable: false,
  };
}
