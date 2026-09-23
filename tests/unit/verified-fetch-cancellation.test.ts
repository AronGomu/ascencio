import { afterEach, expect, it, vi } from "vitest";
import { fetchVerified } from "../../src/content/install/verified-fetch.ts";

afterEach(() => vi.unstubAllGlobals());

it("cancels a rejected response body before reporting the network failure", async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
    },
    cancel,
  });
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status: 503 })),
  );

  await expect(
    fetchVerified(
      "http://localhost/",
      "parts",
      { sha256: "a".repeat(64), bytes: 1 },
      new AbortController().signal,
      () => undefined,
    ),
  ).rejects.toMatchObject({
    kind: "failed",
    code: "CONTENT_NETWORK_FAILED",
  });
  expect(cancel).toHaveBeenCalledOnce();
});
