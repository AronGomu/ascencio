/** Machine-local recommendations for the TypeScript backend; never reuse Rust timings. */
import {
  hostname,
  release,
  cpus,
  availableParallelism,
  totalmem,
} from "node:os";
import path from "node:path";
import { identity } from "./session-fixtures.ts";
import { nativeRuntimeIdentity } from "./run-typescript-native.ts";
export const typescriptRecommendation = path.resolve(
  ".cache/typescript-native-workers.json",
);
export async function typescriptCalibrationIdentity(
  fixture: string,
  batchSize: number,
) {
  return identity({
    runner: "typescript-native/v1",
    runtime: await nativeRuntimeIdentity(),
    machine: hostname(),
    kernel: release(),
    node: process.version,
    cpu: cpus()[0]?.model,
    logical: availableParallelism(),
    memory: totalmem(),
    fixture,
    batchSize,
  });
}
