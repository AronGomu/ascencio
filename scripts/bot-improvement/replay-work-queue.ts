/** Small dynamic batches keep variable-length replays distributed without duplicate admission. */
export async function replayWorkers<T>(
  jobs: readonly T[],
  workers: number,
  batchSize: number,
  signal: AbortSignal,
  execute: (job: T, worker: number) => Promise<void>,
) {
  if (
    !Number.isInteger(workers) ||
    workers < 1 ||
    !Number.isInteger(batchSize) ||
    batchSize < 1
  )
    throw Error("Positive worker and batch counts required");
  let next = 0;
  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(workers, jobs.length) }, async (_, index) => {
      while (!signal.aborted && next < jobs.length) {
        const batch = jobs.slice(next, next + batchSize);
        next += batch.length;
        for (const job of batch) {
          if (signal.aborted) break;
          await execute(job, index + 1);
        }
      }
    }),
  );
  const failure = settled.find(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  if (failure) throw failure.reason;
}
