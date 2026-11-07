/** Fresh accounting state prevents ledger growth from biasing later concurrency stages. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { retrySession } from "./match-session.ts";
import { withSessionLock } from "./session-lock.ts";
import { digest } from "./session-fixtures.ts";
export async function benchmarkInputs(source: string) {
  const session = path.resolve(source);
  return retrySession(session, () =>
    withSessionLock(session, async () => {
      const config = JSON.parse(
        await readFile(path.join(session, "config.json"), "utf8"),
      );
      const state = JSON.parse(
        await readFile(path.join(session, "state.json"), "utf8"),
      );
      let marker: string | null = null,
        acknowledged: string | null = null;
      try {
        marker = digest(await readFile(path.join(session, "OWNER_STOP")));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      try {
        acknowledged = JSON.parse(
          await readFile(path.join(session, "control.json"), "utf8"),
        ).acknowledgedMarker;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      if (marker && marker !== acknowledged)
        throw new Error("Source session has an unacknowledged OWNER_STOP");
      return {
        config: { ...config, accepted: state.accepted },
        accepted: state.accepted,
        stopSource: {
          path: path.join(session, "OWNER_STOP"),
          acknowledged: marker,
        },
      };
    }),
  );
}
export async function createBenchmarkSession(
  inputs: Awaited<ReturnType<typeof benchmarkInputs>>,
  destination: string,
) {
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(destination);
  for (const dir of ["iterations", "versions", "matches", "analyses"])
    await mkdir(path.join(destination, dir));
  await writeFile(
    path.join(destination, "config.json"),
    JSON.stringify(inputs.config, null, 2),
    { flag: "wx" },
  );
  await writeFile(
    path.join(destination, "state.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        status: "ready",
        iteration: 0,
        accepted: inputs.accepted,
        fixtureIdentity: inputs.config.fixture.identity,
        completedMatches: [],
        completedGames: [],
        stoppingReason: null,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  return destination;
}
