import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { browserBotResource } from "../../scripts/lib/browser-bot-packages.ts";
test("browser delivers only indexed fixed bot manifests and bounded executables", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ascencio-browser-bots-"));
  try {
    const folder = path.join(root, "assets/ai-bots/reference");
    await mkdir(path.join(folder, "dist"), { recursive: true });
    await writeFile(path.join(folder, "bot.json"), "{}");
    await writeFile(
      path.join(folder, "dist/ai.wasm"),
      new Uint8Array([0, 1, 2]),
    );
    const index = await browserBotResource(root, "/bot-packages/index.json");
    assert.deepEqual(JSON.parse(new TextDecoder().decode(index!.bytes)), [
      "reference",
    ]);
    assert.equal(
      (await browserBotResource(root, "/bot-packages/reference/dist/ai.wasm"))!
        .type,
      "application/wasm",
    );
    assert.equal(
      await browserBotResource(root, "/bot-packages/reference/ai/Cargo.toml"),
      null,
    );
    assert.equal(
      await browserBotResource(root, "/bot-packages/../../secret"),
      null,
    );
    await writeFile(path.join(root, "secret.wasm"), "private");
    await symlink(
      path.join(root, "secret.wasm"),
      path.join(folder, "dist/escape.wasm"),
    );
    await assert.rejects(
      browserBotResource(root, "/bot-packages/reference/dist/escape.wasm"),
      /Unsafe/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
