/** Native resources are separate from the frontend bundle; no installed files touched. */
import { execFileSync } from "node:child_process";
import { cp, mkdir, copyFile, rm } from "node:fs/promises";
const root = "docs/archive/rust-bot-experiment/reference";
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
await cp(root, "tauri/resources/ai-bots/reference", {
  recursive: true,
  filter: (path) => !path.split(/[\\/]/).includes("target"),
});
await copyFile(
  `${root}/ai/target/release/ascencio-reference-bot${process.platform === "win32" ? ".exe" : ""}`,
  `tauri/resources/ai-bots/native/ascencio-reference-bot${process.platform === "win32" ? ".exe" : ""}`,
);
