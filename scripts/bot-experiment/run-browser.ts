/** Isolated Chromium process accounting and unattended saved-workload instrumentation. */
import { spawn, execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const [executable, mode = "smoke", ...selected] = process.argv.slice(2);
if (!executable)
  throw new Error(
    "Usage: run-browser.ts <chromium-executable> smoke|benchmark|throughput|memory [typescript|wasm ...]",
  );
if (
  !["smoke", "benchmark", "throughput", "memory"].includes(mode) ||
  selected.some((runtime) => !["typescript", "wasm"].includes(runtime))
)
  throw new Error("Unsupported browser workload or runtime");
await mkdir(".tmp/browser-results", { recursive: true });
for (const runtime of selected.length ? selected : ["typescript", "wasm"]) {
  await writeFile(
    ".tmp/bot-harness-config.json",
    JSON.stringify({ mode, runtime }),
  );
  const result = `.tmp/${runtime}${mode === "smoke" ? "" : "-" + mode}-runtime-smoke.json`;
  await rm(result, { force: true });
  const profile = await mkdtemp(join(tmpdir(), "ascencio-bot-browser-"));
  const browser = spawn(
    executable,
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--disable-background-networking",
      `--user-data-dir=${profile}`,
      `http://127.0.0.1:4214/?runtime=${runtime}&holdMemory=1`,
    ],
    { stdio: "ignore" },
  );
  const start = Date.now();
  try {
    for (;;) {
      if (Date.now() - start > 600000)
        throw new Error("Browser workload exceeded ten minutes");
      if (browser.exitCode !== null)
        throw new Error(`Chromium exited ${browser.exitCode}`);
      try {
        const report = JSON.parse(await readFile(result, "utf8"));
        if (report.type !== "complete") throw new Error(JSON.stringify(report));
        if (mode === "memory") {
          const samples = [];
          for (let i = 0; i < 3; i++) {
            await delay(1000);
            const path = `.tmp/browser-results/${runtime}-rss-${i}.json`;
            execFileSync(process.execPath, [
              "scripts/bot-experiment/process-memory.ts",
              String(browser.pid),
              path,
            ]);
            samples.push(JSON.parse(await readFile(path, "utf8")));
          }
          report.processMemory = {
            method:
              "Three Linux process-tree VmRSS snapshots, 1 second apart, fresh isolated Chromium profile/process per runtime, after identical 100 saved decisions; live bot and workload retained; shared pages counted per process; no forced GC or disk cache reset",
            samples,
          };
        }
        await writeFile(
          `.tmp/browser-results/${runtime}-${mode}.json`,
          JSON.stringify(report, null, 2) + "\n",
        );
        console.log(`${runtime} ${mode}: complete`);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await delay(500);
    }
  } finally {
    browser.kill("SIGTERM");
    if (browser.exitCode === null)
      await new Promise<void>((resolve) =>
        browser.once("exit", () => resolve()),
      );
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  }
}
