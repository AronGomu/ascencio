import { setTimeout } from "node:timers/promises";

/** Retry transient Windows directory handles without deleting or replacing data. */
export async function withWindowsRenameRetry(
  operation: () => Promise<void>,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (
        platform !== "win32" ||
        attempt >= 14 ||
        !["EPERM", "EACCES", "EBUSY"].includes(code ?? "")
      )
        throw error;
      await setTimeout(Math.min(100 * (attempt + 1), 1000));
    }
  }
}
