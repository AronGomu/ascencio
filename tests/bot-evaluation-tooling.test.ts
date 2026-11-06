import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
test("Rust evaluator canonicalization, XML safety, failure accounting and clustering", () => {
  const result = spawnSync(
    "cargo",
    ["test", "--manifest-path", "tools/bot-evaluation/Cargo.toml"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
