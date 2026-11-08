import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
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

/** Compile and check the frozen TypeScript-derived strategy boundary. */
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
  throw new ValidationFailure(
    "scope",
    "Rust AI packages are retired. Use a TypeScript strategy module.",
  );
}
