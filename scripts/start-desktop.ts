import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.some((arg) => !["--headless", "--debug"].includes(arg))) {
  throw new Error("Usage: npm start -- [--headless] [--debug]");
}
const debug = args.includes("--debug");
const cli = path.join(root, "node_modules/@tauri-apps/cli/tauri.js");
const build = spawn(
  process.execPath,
  [cli, "build", "--no-bundle", ...(debug ? ["--debug"] : [])],
  {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  },
);
build.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
build.on("exit", (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }
  if (args.includes("--headless")) {
    console.log(
      "Standalone build verified; no desktop window opened. Use test:browser:native-bridge for headless UI checks.",
    );
    return;
  }
  const binary = path.join(
    root,
    "src-tauri/target",
    debug ? "debug" : "release",
    process.platform === "win32" ? "ascencio.exe" : "ascencio",
  );
  const app = spawn(binary, [], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  app.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  app.on("exit", (status) => {
    process.exitCode = status ?? 1;
  });
});
