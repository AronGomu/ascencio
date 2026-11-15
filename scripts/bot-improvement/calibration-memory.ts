/** Optional explicit policy: all three byte amounts are required together. */
export function calibrationMemory(
  values: Record<string, string | boolean | undefined>,
) {
  const keys = [
    "memory-budget-bytes",
    "memory-reserve-bytes",
    "memory-per-worker-bytes",
  ];
  if (keys.every((k) => values[k] === undefined)) return undefined;
  const [availableBytes, reserveBytes, bytesPerWorker] = keys.map((k) =>
    Number(values[k]),
  );
  if (
    ![availableBytes, reserveBytes, bytesPerWorker].every(
      (n) => Number.isSafeInteger(n) && n! >= 0,
    ) ||
    !availableBytes ||
    !bytesPerWorker
  )
    throw Error(
      "Memory preflight requires explicit positive budget/per-worker bytes and nonnegative reserve bytes",
    );
  return {
    availableBytes: availableBytes!,
    reserveBytes: reserveBytes!,
    bytesPerWorker: bytesPerWorker!,
    provenance: "explicit CLI budget and worker estimate",
  };
}
