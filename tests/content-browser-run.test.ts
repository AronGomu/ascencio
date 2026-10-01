import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { openLocalStorage } from "../src/storage/create-storage-client.ts";

test("production commands and workflows do not invoke retired browser content preflight", () => {
  assert.equal(existsSync("scripts/verify-content-browser-run.ts"), false);
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  for (const [name, command] of Object.entries(pkg.scripts))
    assert.doesNotMatch(
      command,
      /verify-content-browser-run|CONTENT_RUN/,
      name,
    );
  for (const workflow of readdirSync(".github/workflows").filter((name) =>
    /\.ya?ml$/.test(name),
  ))
    assert.doesNotMatch(
      readFileSync(`.github/workflows/${workflow}`, "utf8"),
      /verify-content-browser-run|CONTENT_RUN/,
      workflow,
    );
});

test("production storage fails closed without the native Tauri runtime", async () => {
  assert.deepEqual(await openLocalStorage(), {
    kind: "failed",
    error: { code: "STORAGE_UNAVAILABLE" },
  });
});
