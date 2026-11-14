/** Bounded read-only verification before any resumed match can reserve games. */
import type { Worker } from "node:worker_threads";
import { NativeEngineSlot } from "./typescript-native-executor.ts";
import type { Job } from "./typescript-match-worker.ts";

export async function verifyNativeSchedule(options: {
  output: string;
  job: Job;
  workers: number;
  runtime: string;
  register: (worker: Worker) => void;
  aborted: () => boolean;
}): Promise<boolean[]> {
  if (!Number.isSafeInteger(options.workers) || options.workers < 1)
    throw Error("Invalid resume verification worker count");
  const verified = options.job.matches.map(() => false);
  const slots = Array.from(
    { length: Math.min(4, options.workers, verified.length) },
    () =>
      new NativeEngineSlot({
        job: options.job,
        runtime: options.runtime,
        register: options.register,
        aborted: options.aborted,
      }),
  );
  let cursor = 0,
    failure: unknown;
  await Promise.all(
    slots.map(async (slot) => {
      try {
        while (cursor < verified.length && failure === undefined) {
          if (options.aborted())
            throw Error("Native resume verification interrupted");
          const index = cursor++;
          const result = await slot.request({
            type: "verify",
            output: options.output,
            job: { identity: options.job.identity },
            item: options.job.matches[index],
          });
          if (typeof result.verified !== "boolean")
            throw Error("Invalid native resume verification response");
          verified[index] = result.verified;
        }
      } catch (error) {
        failure ??= error;
        // Stop admission and drain owned workers before exposing a failed resume.
        await Promise.all(slots.map((worker) => worker.close()));
      } finally {
        await slot.close();
      }
    }),
  );
  if (failure !== undefined) throw failure;
  if (options.aborted()) throw Error("Native resume verification interrupted");
  return verified;
}
