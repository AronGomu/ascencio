import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

/** Shared by preparation, control and future promotion; never hold during execution. */
export async function withSessionLock<T>(
  session: string,
  run: () => Promise<T>,
): Promise<T> {
  const lock = path.join(session, ".session-state.lock");
  await mkdir(lock);
  try {
    return await run();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
