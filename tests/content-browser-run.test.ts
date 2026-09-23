import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

for (const run of ["", "../not-a-run"]) {
  test(`legacy browser preflight rejects ${run === "" ? "missing" : "unsafe"} CONTENT_RUN before browser execution`, () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-content-browser-run.ts"],
      {
        env: { ...process.env, CONTENT_RUN: run },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      run === ""
        ? /CONTENT_RUN must name a verified private T3 run/
        : /ASSET_PATH_UNSAFE/,
    );
  });
}
