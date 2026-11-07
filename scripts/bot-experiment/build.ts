import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
const manifest = "assets/ai-bots/reference/ai/Cargo.toml";
execFileSync(
  "cargo",
  ["build", "--locked", "--release", "--manifest-path", manifest],
  { stdio: "inherit" },
);
execFileSync(
  "cargo",
  [
    "build",
    "--locked",
    "--release",
    "--lib",
    "--target",
    "wasm32-unknown-unknown",
    "--manifest-path",
    manifest,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      RUSTFLAGS: [process.env.RUSTFLAGS, "-C link-arg=--max-memory=536870912"]
        .filter(Boolean)
        .join(" "),
    },
  },
);
await mkdir("assets/ai-bots/reference/dist", { recursive: true });
await copyFile(
  "assets/ai-bots/reference/ai/target/wasm32-unknown-unknown/release/ascencio_reference_bot.wasm",
  "assets/ai-bots/reference/dist/ai.wasm",
);

const files = [
  `assets/ai-bots/reference/ai/target/release/ascencio-reference-bot${process.platform === "win32" ? ".exe" : ""}`,
  "assets/ai-bots/reference/dist/ai.wasm",
];
await writeFile(
  "assets/ai-bots/reference/dist/build.json",
  JSON.stringify(
    {
      rust: execFileSync("rustc", ["--version"], { encoding: "utf8" }).trim(),
      cargo: execFileSync("cargo", ["--version"], { encoding: "utf8" }).trim(),
      profile: "release",
      wasmMaximumMemoryBytes: 536870912,
      files: await Promise.all(
        files.map(async (path) => ({
          path,
          sha256: createHash("sha256")
            .update(await readFile(path))
            .digest("hex"),
        })),
      ),
    },
    null,
    2,
  ) + "\n",
);
