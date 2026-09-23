import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCoreScratch,
  removeCoreScratch,
} from "./lib/core-source-scratch.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const id = process.env.CORE_SOURCE_ID ?? "default";
const token = process.env.CORE_SOURCE_TOKEN ?? randomUUID();
const scratch = await createCoreScratch(projectRoot, id, token);
const removeOwnedScratch = () => removeCoreScratch(projectRoot, id, token);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
async function run(args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(npm, args, {
      cwd: scratch,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${npm} ${args.join(" ")} failed with ${code ?? signal ?? "unknown"}`,
          ),
        );
    });
  });
}

try {
  for (const entry of ["src", "scripts", "vendor"] as const)
    await cp(path.join(projectRoot, entry), path.join(scratch, entry), {
      recursive: true,
    });
  await mkdir(path.join(scratch, "content"), { recursive: true });
  await cp(
    path.join(projectRoot, "content/core-bootstrap.json"),
    path.join(scratch, "content/core-bootstrap.json"),
  );
  for (const asset of [
    "assets/core/app-icon.svg",
    "assets/story/chapter-01/city-map-placeholder.svg",
  ] as const) {
    await mkdir(path.dirname(path.join(scratch, asset)), { recursive: true });
    await cp(path.join(projectRoot, asset), path.join(scratch, asset));
  }
  for (const file of [
    "index.html",
    "package-lock.json",
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
  ] as const)
    await cp(path.join(projectRoot, file), path.join(scratch, file));
  await run(["ci"]);
  await run(["run", "build"]);
  await cp(path.join(scratch, "dist"), path.join(scratch, "dist-a"), {
    recursive: true,
  });
  await appendFile(
    path.join(scratch, "index.html"),
    "\n<!-- cold-update-fixture-b -->\n",
  );
  await run(["run", "build:app", "--", "--outDir", "dist-b"]);
} catch (error) {
  await removeOwnedScratch();
  throw error;
}

const port = process.env.CORE_SOURCE_PORT ?? "4400";
const server = spawn(process.execPath, ["scripts/core-pwa-fixture-server.ts"], {
  cwd: scratch,
  env: { ...process.env, CORE_SOURCE_PORT: port },
  stdio: "inherit",
});

let stopping = false;
async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  server.kill(signal);
}
process.once("SIGTERM", () => void stop("SIGTERM"));
process.once("SIGINT", () => void stop("SIGINT"));
server.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
server.once("exit", async (code) => {
  try {
    await removeOwnedScratch();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    return;
  }
  if (!stopping && code !== 0) process.exitCode = code ?? 1;
});
