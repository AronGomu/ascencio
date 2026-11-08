import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createServer } from "vite";
import { contentSourceDenyPlugin } from "../../scripts/lib/vite-content-deny.ts";

test("browser dev serves bot TypeScript while fencing private assets and symlink escapes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ascencio-bot-source-"));
  const ai = path.join(root, "assets/ai-bots/basic/ai");
  await mkdir(path.join(ai, "tactics"), { recursive: true });
  await mkdir(path.join(root, "assets/ai-bots/linked"), { recursive: true });
  await mkdir(path.join(root, "assets/card-library"));
  await writeFile(
    path.join(ai, "index.ts"),
    "export { value } from './tactics/score.ts';",
  );
  await writeFile(
    path.join(ai, "tactics/score.ts"),
    "export const value: number = 1;",
  );
  await writeFile(path.join(ai, "data.json"), '{"private":true}');
  await writeFile(path.join(root, "outside.ts"), "export const outside=1;");
  await writeFile(
    path.join(root, "assets/card-library/secret.ts"),
    "export const secret=1;",
  );
  await writeFile(
    path.join(root, "assets/ai-bots/basic/deck.ydk"),
    "private deck",
  );
  await symlink(
    path.join(root, "assets/card-library/secret.ts"),
    path.join(ai, "escape.ts"),
  );
  await symlink(
    path.join(root, "assets/card-library"),
    path.join(root, "assets/ai-bots/linked/ai"),
    "dir",
  );
  await symlink(path.join(root, "outside.ts"), path.join(ai, "outside.ts"));
  const server = await createServer({
    configFile: false,
    root,
    plugins: [contentSourceDenyPlugin(root)],
    server: { host: "127.0.0.1", port: 0, watch: null },
  });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    for (const resource of [
      "assets/ai-bots/basic/ai/index.ts",
      "assets/ai-bots/basic/ai/tactics/score.ts?import",
      `@fs${path.join(ai, "index.ts")}`,
    ]) {
      const source = await fetch(`${base}/${resource}`);
      assert.equal(source.status, 200, `${resource}: ${await source.text()}`);
    }
    for (const resource of [
      "assets/card-library/secret.ts",
      "assets/ai-bots/basic/deck.ydk",
      "assets/ai-bots/basic/ai/escape.ts",
      "assets/ai-bots/basic/ai/outside.ts",
      "assets/ai-bots/basic/ai/data.json",
      "assets/ai-bots/linked/ai/secret.ts",
      "assets/ai-bots/basic/ai/index.ts.map",
      "assets%2Fai-bots%2Fbasic%2Fai%2Fescape.ts?raw",
      `@fs${path.join(ai, "escape.ts")}`,
      `@id/@fs${path.join(ai, "escape.ts")}`,
    ])
      assert.equal((await fetch(`${base}/${resource}`)).status, 403, resource);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
