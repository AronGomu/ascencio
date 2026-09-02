import path from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeSourcePath } from "../../scripts/lib/vite-runtime-assets.ts";

describe("runtimeSourcePath", () => {
  it("serves the card back from the generated image root", () => {
    expect(runtimeSourcePath("/project", "images/card-back.jpg")).toBe(
      path.join("/project", "generated/card-images/card-back.jpg"),
    );
  });

  it("rejects a traversal disguised as the card back", () => {
    expect(runtimeSourcePath("/project", "images/../card-back.jpg")).toBeNull();
  });

  it("still resolves an archived card image", () => {
    expect(runtimeSourcePath("/project", "images/97590747.jpg")).toBe(
      path.join("/project", "generated/card-images/archive/full/97590747.jpg"),
    );
  });
});
