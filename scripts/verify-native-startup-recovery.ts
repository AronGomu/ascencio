import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  copyFile,
  writeFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { assertNoCriticalReads } from "../src/storage/diagnostics/io-trace.ts";
import { parseIoTraceSnapshot } from "../src/storage/diagnostics/parse-io-trace.ts";
import { captureReopenedStartup } from "./lib/native-startup-reopen.ts";

const [output, requestedScenario, ...extra] = process.argv.slice(2);
if (!output || extra.length || process.platform !== "linux") {
  console.error(
    "Usage (Linux desktop): node scripts/verify-native-startup-recovery.ts <new-report.json> [scenario]",
  );
  process.exitCode = 2;
} else {
  const scope = path.resolve(".tmp", `native-recovery-${randomUUID()}`);
  const releaseBytes = await readFile("content/critical-release.json");
  const release = JSON.parse(releaseBytes.toString()) as {
    packages: readonly { path: string; sha256: string }[];
    engine: readonly { path: string; sha256: string }[];
  };
  const identity = createHash("sha256").update(releaseBytes).digest("hex");
  const scenarios = [
    "invalid-user",
    "invalid-base",
    "invalid-mod-json",
    "invalid-mod-lua",
    "missing-mod-root",
    "maintenance",
  ] as const;
  const selected = requestedScenario
    ? scenarios.filter((scenario) => scenario === requestedScenario)
    : scenarios;
  if (selected.length === 0) throw new Error("RECOVERY_SCENARIO_INVALID");
  const results: unknown[] = [];
  let failed = false;
  try {
    for (const scenario of selected) {
      const fixture = path.join(scope, scenario);
      const data = path.join(fixture, "startup-native-data");
      const app = path.join(data, "com.ascencio.storyduel");
      const generation = path.join(app, "critical-generations", identity);
      for (const resource of [...release.packages, ...release.engine]) {
        const source = path.join(
          "src-tauri/resources/readable-content",
          resource.path,
        );
        const bytes = await readFile(source);
        if (
          createHash("sha256").update(bytes).digest("hex") !== resource.sha256
        )
          throw new Error("RECOVERY_FIXTURE_RELEASE_INVALID");
        const target = path.join(generation, resource.path);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(source, target);
      }
      await writeFile(path.join(generation, ".media-install-attempted"), "1\n");
      const preserved = {
        namespace: "deck-meta",
        key: "defaultDeck",
        revision: 1,
        payload: null,
      };
      const records: unknown[] = [preserved];
      if (scenario.includes("mod")) {
        records.push({
          namespace: "preferences",
          key: "content-mods",
          revision: 1,
          payload: {
            schemaVersion: 1,
            mode: "modded",
            root:
              scenario === "missing-mod-root"
                ? {
                    kind: "desktop",
                    path: path.join(fixture, "missing-folder"),
                  }
                : { kind: "managed", path: null },
            enabled: ["recovery"],
          },
        });
        const mod = path.join(app, "mods/recovery");
        await mkdir(mod, { recursive: true });
        const manifest = {
          schemaVersion: 1,
          id: "recovery",
          version: "1.0.0",
          contentApi: 1,
          base: [],
          dependencies: [],
          media: [],
          entities:
            scenario === "invalid-mod-lua"
              ? [
                  {
                    kind: "scripts",
                    packageId: "card-library",
                    operation: "add",
                    id: "card:recovery:broken",
                    path: "broken.lua",
                    resolves: [],
                  },
                ]
              : [],
        };
        await writeFile(
          path.join(mod, "mod.json"),
          scenario === "invalid-mod-json"
            ? "{\ninvalid"
            : JSON.stringify(manifest),
        );
        if (scenario === "invalid-mod-lua")
          await writeFile(path.join(mod, "broken.lua"), "-- header\nlocal =\n");
        const disabled = path.join(app, "mods/disabled");
        await mkdir(disabled, { recursive: true });
        await writeFile(
          path.join(disabled, "mod.json"),
          "malformed disabled fixture",
        );
      }
      const validUser = JSON.stringify({
        format: "ascencio-user-data-json",
        schemaVersion: 1,
        revision: 1,
        records,
      });
      const userPath = path.join(app, "user-data.json");
      await writeFile(
        userPath,
        scenario === "invalid-user" ? "{\ninvalid" : validUser,
      );
      if (scenario === "invalid-base") {
        const target = path.join(generation, "card-library/critical.json");
        const bytes = await readFile(target);
        bytes[0] = bytes[0]! ^ 1;
        await writeFile(target, bytes);
      }
      const child = spawn(
        path.resolve("src-tauri/target/release/ascencio"),
        [],
        {
          detached: true,
          env: {
            ...process.env,
            XDG_DATA_HOME: data,
            XDG_CONFIG_HOME: path.join(fixture, "config"),
            ASCENCIO_IO_TRACE: "1",
            ASCENCIO_NATIVE_ACCEPTANCE: "1",
            ASCENCIO_NATIVE_RECOVERY: scenario,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let nativeOutput = "";
      const capture = (chunk: Buffer) => {
        nativeOutput = (nativeOutput + chunk.toString()).slice(-32768);
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
      let repaired = false;
      const end = Date.now() + 100000;
      try {
        while (Date.now() < end) {
          const folder = path.join(app, "logs");
          const files = await readdir(folder).catch(() => []);
          const file = files.find((name) => name.endsWith("-acceptance.json"));
          if (file) {
            // Native checkpoint may be in the middle of its atomic-sized write.
            report = await readFile(path.join(folder, file), "utf8")
              .then((text) => JSON.parse(text) as Record<string, unknown>)
              .catch(() => report);
          }
          if (exited) break;
          await delay(50);
        }
        if (!exited && child.pid) process.kill(-child.pid, "SIGTERM");
        let exitCode = await exit;
        if (report?.status === "closed-error" && exitCode === 0) {
          // Simulate explicit correction while the app is closed, never a hidden runtime repair.
          const corrected = records.map((record) => {
            const row = record as {
              namespace: string;
              key: string;
              payload: object;
            };
            return row.namespace === "preferences" && row.key === "content-mods"
              ? { ...row, payload: { ...row.payload, mode: "normal" } }
              : row;
          });
          await writeFile(
            userPath,
            JSON.stringify({
              format: "ascencio-user-data-json",
              schemaVersion: 1,
              revision: 1,
              records: corrected,
            }),
          );
          repaired = true;
          const reopened = await captureReopenedStartup(
            data,
            path.join(fixture, "config"),
          );
          report = {
            ...report,
            status: reopened.report?.status ?? "failed",
            reopened: reopened.report,
            trace: reopened.report?.trace,
          };
          exitCode = reopened.exitCode;
          nativeOutput += reopened.output;
        }
        const record = {
          scenario,
          exitCode,
          preservedUserRecord: false,
          repairedByHost: repaired,
          report,
          nativeOutput,
        };
        results.push(record);
        const current = JSON.parse(await readFile(userPath, "utf8")) as {
          records: { namespace: string; key: string; payload: unknown }[];
        };
        const marker = current.records.find(
          (record) =>
            record.namespace === "deck-meta" && record.key === "defaultDeck",
        );
        const preservedUserRecord =
          JSON.stringify(marker) === JSON.stringify(preserved);
        if (
          report?.status !== "passed" ||
          exitCode !== 0 ||
          !preservedUserRecord
        )
          failed = true;
        record.preservedUserRecord = preservedUserRecord;
        if (scenario === "maintenance" && report?.status === "passed") {
          const preferences = current.records.find(
            (record) =>
              record.namespace === "preferences" &&
              record.key === "content-mods",
          )?.payload as { mode?: string } | undefined;
          if (
            preferences?.mode !== "modded" ||
            !current.records.some(
              (record) =>
                record.namespace === "deck-meta" && record.key === "lastOpened",
            )
          )
            throw new Error("RECOVERY_RESTORE_NOT_PERSISTED");
        }
        if (scenario === "invalid-mod-json" || scenario === "invalid-mod-lua") {
          const trace = report?.initialTrace as
            | { native: { events: { label: string; operation: string }[] } }
            | undefined;
          const reads = trace?.native.events.filter(
            (event) =>
              event.label === "enabled-mod-source" &&
              event.operation === "read",
          ).length;
          if (reads !== (scenario === "invalid-mod-json" ? 1 : 2))
            throw new Error("RECOVERY_DISABLED_MOD_READ");
        }
        if (report?.trace) {
          const trace = report.trace as { native: unknown; frontend: unknown };
          assertNoCriticalReads(parseIoTraceSnapshot(trace.native));
          assertNoCriticalReads(parseIoTraceSnapshot(trace.frontend));
        }
        if (report?.initialLog) {
          const log = report.initialLog as { path: string };
          const rows = (await readFile(log.path, "utf8"))
            .trim()
            .split("\n")
            .map((row) => JSON.parse(row) as { code: string });
          if (!rows.some((row) => row.code === report?.initialCode))
            throw new Error("RECOVERY_LOG_CONTENT_MISSING");
        }
        if (scenario === "invalid-base") {
          const bytes = await readFile(
            path.join(generation, "card-library/critical.json"),
          );
          if (
            createHash("sha256").update(bytes).digest("hex") !==
            release.packages.find(
              (p) => p.path === "card-library/critical.json",
            )?.sha256
          )
            throw new Error("RECOVERY_BASE_REPAIR_FAILED");
        }
        console.log(
          `${scenario}: ${report?.status ?? "missing report"}; exit ${exitCode}; user marker ${preservedUserRecord}`,
        );
      } finally {
        if (!exited && child.pid) {
          process.kill(-child.pid, "SIGTERM");
          await exit;
        }
      }
      if (failed) break;
    }
  } catch (error) {
    failed = true;
    results.push({
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    await writeFile(
      output,
      JSON.stringify(
        {
          kind: "actual-native-desktop-recovery",
          conditions:
            "Optimized native-acceptance build; digest-authenticated critical-only disposable fixtures, optional media intentionally absent. No physical/mobile or external-opener acceptance implied.",
          status: failed ? "failed" : "passed",
          results,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    await rm(scope, { recursive: true, force: true });
  }
  if (failed) process.exitCode = 1;
}
