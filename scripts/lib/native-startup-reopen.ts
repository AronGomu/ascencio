import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** Reopen only the caller-owned disposable recovery fixture, after its writer exits. */
export async function captureReopenedStartup(data: string, config: string) {
  const logs = path.join(data, "com.ascencio.storyduel", "logs");
  const previous = new Set(await readdir(logs));
  const child = spawn(path.resolve("src-tauri/target/release/ascencio"), [], {
    detached: true,
    env: {
      ...process.env,
      XDG_DATA_HOME: data,
      XDG_CONFIG_HOME: config,
      ASCENCIO_IO_TRACE: "1",
      ASCENCIO_NATIVE_ACCEPTANCE: "1",
      ASCENCIO_NATIVE_RECOVERY: "reopened",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const capture = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-32768);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  let exited = false;
  const exit = new Promise<number | null>((resolve, reject) => {
    child.once("error", (error) => {
      exited = true;
      reject(error);
    });
    child.once("exit", (code) => {
      exited = true;
      resolve(code);
    });
  });
  let report: Record<string, unknown> | null = null;
  try {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const files = await readdir(logs);
      const file = files.find(
        (name) => name.endsWith("-acceptance.json") && !previous.has(name),
      );
      if (file)
        report = await readFile(path.join(logs, file), "utf8")
          .then((text) => JSON.parse(text) as Record<string, unknown>)
          .catch(() => report);
      if (exited) break;
      await delay(50);
    }
    if (!exited && child.pid) process.kill(-child.pid, "SIGTERM");
    return { report, exitCode: await exit, output };
  } finally {
    if (!exited && child.pid) {
      process.kill(-child.pid, "SIGTERM");
      await exit;
    }
  }
}
