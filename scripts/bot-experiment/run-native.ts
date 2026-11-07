/** Sequential real Tauri-webview measurements; never runs benchmarks concurrently. */
import { spawn, execFileSync } from "node:child_process";
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const [mode = "smoke", ...selected] = process.argv.slice(2);
const runtimes = selected.length ? selected : ["typescript", "wasm", "native"];
await mkdir(".tmp/native-results", { recursive: true });
for (const runtime of runtimes) {
  await writeFile(
    ".tmp/bot-harness-config.json",
    JSON.stringify({ mode, runtime }),
  );
  const result = `.tmp/${runtime}${mode === "smoke" ? "" : "-" + mode}-runtime-smoke.json`;
  await rm(result, { force: true });
  const app = spawn("tauri/target/release/ascencio", [], {
    env: {
      ...process.env,
      XDG_DATA_HOME: `${process.cwd()}/.tmp/bot-native-data`,
    },
    stdio: "ignore",
  });
  const start = Date.now();
  let sampled = false;
  try {
    for (;;) {
      if (Date.now() - start > 600000)
        throw new Error(`${runtime} ${mode} exceeded ten minutes`);
      if (app.exitCode !== null)
        throw new Error(`Tauri exited ${app.exitCode}`);
      if (!sampled && Date.now() - start > 10000) {
        execFileSync(process.execPath, [
          "scripts/bot-experiment/process-memory.ts",
          String(app.pid),
          `.tmp/native-results/${runtime}-${mode}-memory.json`,
        ]);
        sampled = true;
      }
      try {
        const text = await readFile(result, "utf8");
        const data = JSON.parse(text);
        await writeFile(`.tmp/native-results/${runtime}-${mode}.json`, text);
        if (data.type !== "complete") throw new Error(text);
        console.log(`${runtime} ${mode}: complete`);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await delay(500);
    }
  } finally {
    app.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (app.exitCode !== null) resolve();
      else app.once("exit", () => resolve());
    });
  }
}
