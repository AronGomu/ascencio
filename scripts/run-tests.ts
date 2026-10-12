import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { branchBase } from "./lib/branch-test-context.ts";
import {
  changedFiles,
  relativeFile,
  repositoryFiles,
  selectTests,
  testRunner,
} from "./lib/test-selection.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const help = `Usage: npm test -- [--list] [--report] [--files <sources> | --tests <exact-test-files> | --base <ref>]
       npm test -- --full [--list] [--report]

Default: related tests for committed branch changes plus staged, unstaged and untracked changes.
--list previews commands. --tests replaces automatic selection with exact files.
There is no runner time budget or test-file limit. --report is off by default.
--full requires an explicit owner request for the complete application pipeline.`;

type Command = { label: string; executable: string; args: string[] };

function fullCommands(): Command[] {
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !existsSync(npmCli))
    throw new Error("Use npm test -- --full so the npm CLI is available.");
  const manifest: unknown = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  );
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("scripts" in manifest) ||
    !manifest.scripts ||
    typeof manifest.scripts !== "object"
  )
    throw new Error("Invalid package scripts.");
  const scripts = manifest.scripts;
  function expand(name: string, parents: string[]): Command[] {
    if (parents.includes(name))
      throw new Error(`Recursive pipeline script: ${name}`);
    if (!(name in scripts)) throw new Error(`Missing pipeline script: ${name}`);
    const value: unknown = Reflect.get(scripts, name);
    if (typeof value !== "string")
      throw new Error(`Invalid pipeline script: ${name}`);
    return value.split("&&").flatMap((part): Command[] => {
      const text = part.trim();
      const child = /^npm run ([\w:-]+)$/.exec(text)?.[1];
      if (child !== undefined) return expand(child, [...parents, name]);
      return [
        {
          label: `${name}: ${text}`,
          executable:
            process.platform === "win32"
              ? (process.env.ComSpec ?? "cmd.exe")
              : "/bin/sh",
          args:
            process.platform === "win32"
              ? ["/d", "/s", "/c", `"${text}"`]
              : ["-c", text],
        },
      ];
    });
  }
  return expand("check", []);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(help);
    return 0;
  }
  let list = false;
  let full = false;
  let report = false;
  let base: string | null = null;
  let scope:
    { kind: "changed" } | { kind: "files" | "tests"; files: string[] } = {
    kind: "changed",
  };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const option = args[i];
    if (option === undefined) break;
    if (seen.has(option)) throw new Error(`Repeated option: ${option}`);
    seen.add(option);
    if (option === "--list") list = true;
    else if (option === "--full") full = true;
    else if (option === "--report") report = true;
    else if (option === "--base") {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw new Error("Missing value for --base");
      base = value;
    } else if (option === "--files" || option === "--tests") {
      if (scope.kind !== "changed")
        throw new Error("Choose --files or --tests, not both.");
      const files: string[] = [];
      while (args[i + 1] !== undefined && !args[i + 1]?.startsWith("--")) {
        const file = args[++i];
        if (file !== undefined) files.push(relativeFile(root, file));
      }
      if (files.length === 0) throw new Error(`Missing files for ${option}`);
      scope = {
        kind: option === "--files" ? "files" : "tests",
        files: [...new Set(files)],
      };
    } else throw new Error(`Unknown option: ${option}\n${help}`);
  }
  if (
    (full && (scope.kind !== "changed" || base !== null)) ||
    (base !== null && scope.kind !== "changed")
  )
    throw new Error(
      "--full, --base, --files, and --tests are mutually exclusive.",
    );
  const commands: Command[] = [];
  if (full) commands.push(...fullCommands());
  else {
    const files = repositoryFiles(root);
    const changed =
      scope.kind === "changed"
        ? changedFiles(root, base ?? branchBase(root))
        : scope.files;
    for (const file of changed) {
      if (
        !files.includes(file) &&
        !existsSync(path.join(root, file)) &&
        scope.kind !== "changed"
      )
        throw new Error(`Unknown file: ${file}`);
    }
    const plan =
      scope.kind === "tests"
        ? {
            selected: new Map(
              changed.map((file) => [file, ["explicit selection"]]),
            ),
            uncovered: [],
          }
        : selectTests(root, changed, files);
    console.log(`Selected ${plan.selected.size} test files.`);
    for (const [file, reasons] of [...plan.selected].sort()) {
      if (testRunner(file) === null || !existsSync(path.join(root, file)))
        throw new Error(`Unsupported or missing test file: ${file}`);
      console.log(`  ${file}\n    Related to: ${reasons.join(", ")}`);
    }
    if (plan.uncovered.length > 0) {
      console.error(
        `Coverage needs an explicit selection for:\n${plan.uncovered.map((file) => `  ${file}`).join("\n")}\nReview these changes and use --tests with exact related files.`,
      );
      return 2;
    }
    for (const file of [...plan.selected.keys()].sort()) {
      const runner = testRunner(file);
      const flags =
        runner === "node"
          ? ["--test", "--test-reporter=spec", file]
          : runner === "vitest" || runner === "release"
            ? [
                "node_modules/vitest/vitest.mjs",
                "run",
                ...(runner === "release"
                  ? ["--config", "vitest.release.config.ts"]
                  : []),
                "--reporter=verbose",
                file,
              ]
            : [
                "node_modules/@playwright/test/cli.js",
                "test",
                "--config",
                `playwright.${runner}.config.ts`,
                "--reporter=line",
                file,
              ];
      commands.push({ label: file, executable: process.execPath, args: flags });
    }
  }
  for (const command of commands)
    console.log(`Command: ${command.executable} ${command.args.join(" ")}`);
  if (list || commands.length === 0) return 0;
  const started = Date.now();
  const runDirectory = path.join(
    root,
    "generated/tests/local-runs",
    `${Date.now()}-${process.pid}`,
  );
  await mkdir(runDirectory, { recursive: true });
  const results: {
    command: string;
    exitCode: number;
    elapsedMs: number;
    log: string;
  }[] = [];
  let exitCode = 0;
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    if (command === undefined) continue;
    console.log(
      `Starting command ${i + 1}/${commands.length}: ${command.label}`,
    );
    const log = path.join(runDirectory, `${i + 1}.log`);
    const commandStarted = Date.now();
    const result = await run(command, log);
    results.push({
      command: command.label,
      exitCode: result,
      elapsedMs: Date.now() - commandStarted,
      log,
    });
    console.log(
      `[test-event] ${JSON.stringify({ kind: result === 0 ? "passed" : "failed", command: command.label, exitCode: result, log })}`,
    );
    if (result === 130 || result === 143) {
      exitCode = result;
      break;
    }
    if (result !== 0) exitCode = 1;
  }
  if (report) {
    const output = path.join(runDirectory, "report.json");
    await writeFile(
      output,
      JSON.stringify(
        { full, exitCode, elapsedMs: Date.now() - started, results },
        null,
        2,
      ) + "\n",
    );
    console.log(`Requested report: ${output}`);
  }
  console.log(
    exitCode === 0
      ? "Selected commands passed."
      : "Run completed with failures or interruption.",
  );
  return exitCode;
}

function run(command: Command, logFile: string): Promise<number> {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const log = createWriteStream(logFile);
    const child = spawn(command.executable, command.args, {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsVerbatimArguments:
        process.platform === "win32" &&
        command.executable === (process.env.ComSpec ?? "cmd.exe"),
      windowsHide: true,
    });
    for (const [stream, output] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ] as const) {
      stream?.on("data", (data: Buffer) => {
        output.write(data);
        log.write(data);
      });
    }
    const started = Date.now();
    let interrupted: number | null = null;
    function stop(code: number): void {
      if (interrupted !== null) return;
      interrupted = code;
      if (child.pid !== undefined) {
        if (process.platform === "win32")
          spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true,
          });
        else {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch (error) {
            if (!(
              error instanceof Error &&
              "code" in error &&
              error.code === "ESRCH"
            ))
              throw error;
          }
        }
      }
    }
    const onInterrupt = () => stop(130);
    const onTerminate = () => stop(143);
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onTerminate);
    const heartbeat = setInterval(
      () =>
        console.log(
          `Tests still running: ${Math.round((Date.now() - started) / 1000)}s in ${command.label}.`,
        ),
      15_000,
    );
    child.on("error", (error) => {
      console.error(error.message);
      log.write(error.message + "\n");
    });
    child.on("close", (code) => {
      clearInterval(heartbeat);
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
      log.end(() => resolve(interrupted ?? code ?? 1));
    });
  });
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
