import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("image download CLI", () => {
  it("rejects unknown options before validating known option values", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/download-images.ts",
        "--typo",
        "value",
        "--requests-per-second",
        "21",
      ],
      { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unknown argument: --typo");
  });
});
