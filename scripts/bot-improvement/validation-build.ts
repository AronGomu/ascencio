import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { parseBotManifest } from "../../src/battle/duel/contracts/bot-package.ts";
import { validateWasmLimits } from "../../src/battle/worker/bot-runtime/wasm-limits.ts";
import { wasmTransport } from "../bot-experiment/transport.ts";
import { loadCriticalInputs } from "../bot-evaluation/critical-inputs.ts";
import type { FrozenBot } from "./session-contract.ts";

export class ValidationFailure extends Error {
  category: "input" | "scope" | "build" | "check";
  constructor(
    category: "input" | "scope" | "build" | "check",
    message: string,
  ) {
    super(message);
    this.category = category;
  }
}
export async function command(
  argv: string[],
  cwd: string,
  log: string,
  env = process.env,
) {
  const result = spawnSync(argv[0]!, argv.slice(1), {
    cwd,
    env,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
  await writeFile(
    log,
    JSON.stringify(
      {
        argv,
        cwd,
        status: result.status,
        signal: result.signal,
        error: result.error?.message,
        stdout: result.stdout,
        stderr: result.stderr,
      },
      null,
      2,
    ),
  );
  if (result.error || result.status !== 0)
    throw new Error(`Command failed; see ${log}`);
}

/** Existing Cargo recipe and strategy checker, applied only to archived bytes. */
export async function compileCandidate(
  bot: FrozenBot,
  root: string,
  fixture: string,
  evidence: string,
  frozenRuntime?: Buffer,
) {
  if (bot.kind === "module") {
    const source = await readFile(path.join(root, "strategy.mjs"), "utf8");
    // Match the existing improvement loop's import-free boundary, plus ambient randomness.
    if (
      /import|require\s*\(|\b(?:Date|performance|globalThis|process|fetch|crypto|eval|Function)\b|Math\s*(?:\.\s*random|\[)/.test(
        source,
      )
    )
      throw new ValidationFailure(
        "scope",
        "strategy.mjs must be import-free and deterministic; use the frozen inputs, no ambient APIs",
      );
    try {
      const compiled = await build({
        stdin: { contents: source, loader: "js" },
        write: false,
        format: "esm",
        platform: "browser",
        target: "es2023",
        logLevel: "silent",
      });
      await writeFile(
        path.join(root, "strategy.mjs"),
        compiled.outputFiles![0]!.contents,
      );
    } catch (error) {
      throw new ValidationFailure("build", String(error));
    }
    try {
      await command(
        [
          process.execPath,
          "--experimental-vm-modules",
          path.resolve("scripts/bot-improvement/check-strategy.ts"),
        ],
        root,
        path.join(evidence, "strategy-check.json"),
        {
          ...process.env,
          BOT_STRATEGY: path.join(root, "strategy.mjs"),
          BOT_STRATEGY_CONTENT: path.join(fixture, "content"),
        },
      );
    } catch (error) {
      throw new ValidationFailure("check", String(error));
    }
    try {
      // Reuse the archived generalist implementation, never the live repository runtime.
      const built = await build({
        stdin: {
          contents: `import {createGeneralistBotModule as shared} from 'frozen-runtime';\nimport * as strategy from 'candidate-strategy';\nexport function createGeneralistBotModule(d) { const base=shared(d,strategy.createStrategy(d)); return {...base,create(c) { const bot=base.create(c); return strategy.sideboard ? {...bot,sideboard:strategy.sideboard} : bot; }}; }`,
          resolveDir: root,
        },
        plugins: [
          {
            name: "frozen-inputs",
            setup(b) {
              b.onResolve(
                { filter: /^(frozen-runtime|candidate-strategy)$/ },
                (args) => ({ path: args.path, namespace: "archive" }),
              );
              b.onLoad(
                { filter: /.*/, namespace: "archive" },
                async (args) => ({
                  contents:
                    args.path === "frozen-runtime"
                      ? frozenRuntime!.toString()
                      : await readFile(path.join(root, "strategy.mjs"), "utf8"),
                  loader: "js",
                }),
              );
            },
          },
        ],
        bundle: true,
        write: false,
        format: "esm",
        platform: "browser",
        target: "es2023",
        logLevel: "silent",
      });
      await writeFile(
        path.join(root, "bot.mjs"),
        built.outputFiles![0]!.contents,
      );
    } catch (error) {
      throw new ValidationFailure("build", String(error));
    }
    return;
  }
  const manifest = parseBotManifest(
    JSON.parse(await readFile(path.join(root, "bot.json"), "utf8")),
  );
  const cargo = path.join(root, "ai/Cargo.toml");
  const target = path.join(evidence, "cargo-target");
  try {
    await command(
      [
        "cargo",
        "build",
        "--locked",
        "--release",
        "--lib",
        "--target",
        "wasm32-unknown-unknown",
        "--manifest-path",
        cargo,
      ],
      root,
      path.join(evidence, "build.json"),
      {
        ...process.env,
        CARGO_TARGET_DIR: target,
        RUSTFLAGS: "-C link-arg=--max-memory=536870912",
      },
    );
    const bytes = await readFile(
      path.join(
        target,
        "wasm32-unknown-unknown/release/ascencio_reference_bot.wasm",
      ),
    );
    await mkdir(path.dirname(path.join(root, manifest.wasm)), {
      recursive: true,
    });
    await writeFile(path.join(root, manifest.wasm), bytes);
  } catch (error) {
    throw new ValidationFailure("build", String(error));
  }
  try {
    await command(
      ["cargo", "test", "--locked", "--lib", "--manifest-path", cargo],
      root,
      path.join(evidence, "cargo-check.json"),
      { ...process.env, CARGO_TARGET_DIR: target },
    );
    const bytes = await readFile(path.join(root, manifest.wasm));
    validateWasmLimits(bytes);
    const compiled = await WebAssembly.compile(Uint8Array.from(bytes));
    for (const name of [
      "memory",
      "allocate",
      "deallocate",
      "prepare",
      "execute",
      "serialize",
      "output_len",
    ])
      if (!WebAssembly.Module.exports(compiled).some((e) => e.name === name))
        throw new Error(`Missing bot WASM export: ${name}`);
    const { dependencies } = await loadCriticalInputs(
      path.join(fixture, "content"),
    );
    const transport = await wasmTransport({ bytes });
    try {
      const created = await transport.request({
        op: "create",
        contractVersion: 1,
        policy: bot.policy,
        configuration: bot.configuration,
        seed: 1,
        cards: [...dependencies.cards.values()].map((card) => ({
          ...card,
          race: String(card.race),
        })),
      });
      if (created.contractVersion !== 1)
        throw new Error("Unsupported bot create response");
    } finally {
      transport.close();
    }
    await writeFile(
      path.join(evidence, "wasm-check.json"),
      JSON.stringify({
        status: "passed",
        exports: WebAssembly.Module.exports(compiled),
      }),
    );
  } catch (error) {
    throw new ValidationFailure("check", String(error));
  }
}
