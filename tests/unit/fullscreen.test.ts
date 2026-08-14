import { describe, expect, it, vi } from "vitest";
import {
  exitAppFullscreen,
  isFullscreen,
  isFullscreenSupported,
  requestAppFullscreen,
} from "../../src/shell/fullscreen.ts";

function documentOf(overrides: Partial<Record<string, unknown>>): Document {
  return overrides as unknown as Document;
}

describe("fullscreen helpers", () => {
  it("reports support from the document API", () => {
    expect(isFullscreenSupported(documentOf({ fullscreenEnabled: true }))).toBe(
      true,
    );
    expect(
      isFullscreenSupported(documentOf({ fullscreenEnabled: false })),
    ).toBe(false);
    expect(isFullscreenSupported(documentOf({}))).toBe(false);
  });

  it("reports the current fullscreen element", () => {
    expect(isFullscreen(documentOf({ fullscreenElement: {} }))).toBe(true);
    expect(isFullscreen(documentOf({ fullscreenElement: null }))).toBe(false);
    expect(isFullscreen(documentOf({}))).toBe(false);
  });

  it("resolves true when the request succeeds", async () => {
    const requestFullscreen = vi.fn(async () => {});
    await expect(
      requestAppFullscreen({ requestFullscreen } as unknown as Element),
    ).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it("resolves false when the request rejects", async () => {
    await expect(
      requestAppFullscreen({
        requestFullscreen: async () => {
          throw new Error("gesture required");
        },
      } as unknown as Element),
    ).resolves.toBe(false);
  });

  it("resolves false when the request throws synchronously", async () => {
    await expect(
      requestAppFullscreen({
        requestFullscreen: () => {
          throw new Error("nope");
        },
      } as unknown as Element),
    ).resolves.toBe(false);
  });

  it("resolves false when the element has no fullscreen API", async () => {
    await expect(requestAppFullscreen({} as unknown as Element)).resolves.toBe(
      false,
    );
  });

  it("exits fullscreen only when a fullscreen element exists", async () => {
    const exitFullscreen = vi.fn(async () => {});
    await expect(
      exitAppFullscreen(documentOf({ fullscreenElement: {}, exitFullscreen })),
    ).resolves.toBe(true);
    await expect(
      exitAppFullscreen(
        documentOf({ fullscreenElement: null, exitFullscreen }),
      ),
    ).resolves.toBe(false);
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it("resolves false when exiting rejects", async () => {
    await expect(
      exitAppFullscreen(
        documentOf({
          fullscreenElement: {},
          exitFullscreen: async () => {
            throw new Error("denied");
          },
        }),
      ),
    ).resolves.toBe(false);
  });
});
