/** Native resources are separate from the frontend bundle; no installed files touched. */
import { execFileSync } from "node:child_process";
import { cp, mkdir, copyFile, readdir, access, rm } from "node:fs/promises";
const root = "assets/ai-bots/reference";
execFileSync(
  "cargo",
  [
    "build",
    "--locked",
    "--release",
    "--manifest-path",
    `${root}/ai/Cargo.toml`,
  ],
  { stdio: "inherit" },
);
// This generated resource tree is exclusively owned by this staging command.
await rm("tauri/resources/ai-bots", { recursive: true, force: true });
await mkdir("tauri/resources/ai-bots/native", { recursive: true });
for (const entry of await readdir("assets/ai-bots", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const source = `assets/ai-bots/${entry.name}`;
  try {
    await access(`${source}/bot.json`);
  } catch {
    continue;
  }
  await cp(source, `tauri/resources/ai-bots/${entry.name}`, {
    recursive: true,
    filter: (path) => !path.split(/[\\/]/).includes("target"),
  });
}
await copyFile(
  `${root}/ai/target/release/ascencio-reference-bot${process.platform === "win32" ? ".exe" : ""}`,
  `tauri/resources/ai-bots/native/ascencio-reference-bot${process.platform === "win32" ? ".exe" : ""}`,
);
