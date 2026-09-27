import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const files = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock("node:fs/promises", () => files);

afterEach(() => vi.unstubAllGlobals());

it("writes acquired shop sets only to package-owned authoring", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })),
  );
  await import("../../scripts/generate-shop-sets.ts");
  const output = path.resolve(
    "assets/content/card-library/authoring/shop-sets.v1.json",
  );
  expect(files.mkdir).toHaveBeenCalledExactlyOnceWith(path.dirname(output), {
    recursive: true,
  });
  expect(files.writeFile).toHaveBeenCalledExactlyOnceWith(
    output,
    expect.any(String),
  );
  const serialized = JSON.parse(files.writeFile.mock.calls[0]![1]);
  expect(serialized.version).toBe(1);
  expect(serialized.sets.length).toBeGreaterThan(0);
});
