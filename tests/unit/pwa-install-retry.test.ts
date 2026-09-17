import { describe, expect, it, vi } from "vitest";
import { installShellPrecache } from "../../src/shell/pwa/shell-cache-policy.ts";

describe("PWA shell install recovery", () => {
  it("removes an incomplete first-install cache before retry", async () => {
    const failure = new Error("precache failed");
    const removeIncompleteCache = vi.fn(async () => true);

    await expect(
      installShellPrecache(
        true,
        async () => {
          throw failure;
        },
        removeIncompleteCache,
      ),
    ).rejects.toBe(failure);
    expect(removeIncompleteCache).toHaveBeenCalledOnce();
  });

  it("preserves existing caches when an approved update fails", async () => {
    const failure = new Error("precache failed");
    const removeIncompleteCache = vi.fn(async () => true);

    await expect(
      installShellPrecache(
        false,
        async () => {
          throw failure;
        },
        removeIncompleteCache,
      ),
    ).rejects.toBe(failure);
    expect(removeIncompleteCache).not.toHaveBeenCalled();
  });
});
