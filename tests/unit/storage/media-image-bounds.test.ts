import { expect, it } from "vitest";
import { boundedMediaImage } from "../../../src/shell/adapters/media-image-bounds.ts";
it("refuses excessive decoded dimensions and malformed raster headers before allocation", () => {
  const png = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 4, 0, 0,
    0, 4, 0,
  ]);
  expect(boundedMediaImage(png, "image/png")).toBe(true);
  new DataView(png.buffer).setUint32(16, 16384);
  new DataView(png.buffer).setUint32(20, 16384);
  expect(boundedMediaImage(png, "image/png")).toBe(false);
  expect(boundedMediaImage(png.subarray(0, 16), "image/png")).toBe(false);
  expect(
    boundedMediaImage(new TextEncoder().encode("unsupported"), "image/jpeg"),
  ).toBe(false);
  expect(
    boundedMediaImage(new Uint8Array(1024 * 1024 + 1), "image/svg+xml"),
  ).toBe(false);
});
