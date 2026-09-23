// @vitest-environment node
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { responseBytes } from "../../src/content/storage/progressive-storage-validation.ts";

const signal = () => new AbortController().signal;

describe("decoded progressive response integrity", () => {
  it("accepts gzip transport length distinct from exact decoded file bytes", async () => {
    const bytes = new TextEncoder().encode("verified-content-".repeat(40));
    const compressed = gzipSync(bytes);
    const server = createServer((_request, response) => {
      response.writeHead(200, {
        "Content-Encoding": "gzip",
        "Content-Length": compressed.length,
      });
      response.end(compressed);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("No test port");
      const response = await fetch(`http://127.0.0.1:${address.port}`, {
        signal: AbortSignal.timeout(5000),
      });
      expect(Number(response.headers.get("Content-Length"))).not.toBe(
        bytes.length,
      );
      await expect(
        responseBytes(response, bytes.length, bytes.length, signal()),
      ).resolves.toEqual(bytes);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("ignores unexposed encoding and transport length larger than decoded cap", async () => {
    await expect(
      responseBytes(
        new Response(new Uint8Array(4), {
          headers: { "Content-Length": "100" },
        }),
        4,
        4,
        signal(),
      ),
    ).resolves.toEqual(new Uint8Array(4));
  });

  it.each([undefined, "1", "100"])(
    "cancels decoded overflow exactly once despite declared %s",
    async (declared) => {
      const cancel = vi.fn();
      const pull = vi.fn(
        (controller: ReadableStreamDefaultController<Uint8Array>) => {
          controller.enqueue(new Uint8Array(8));
        },
      );
      const body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
      await expect(
        responseBytes(
          new Response(body, {
            headers:
              declared === undefined ? {} : { "Content-Length": declared },
          }),
          4,
          4,
          signal(),
        ),
      ).rejects.toThrow("CONTENT_INTEGRITY_FAILED");
      expect(cancel).toHaveBeenCalledOnce();
      expect(pull).toHaveBeenCalledOnce();
      expect(body.locked).toBe(false);
    },
  );

  it("preserves integrity failure if stream cancellation fails", async () => {
    const cancel = vi.fn(() => {
      throw new Error("cancel failed");
    });
    const body = new ReadableStream(
      {
        pull(controller) {
          controller.enqueue(new Uint8Array(8));
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    await expect(
      responseBytes(new Response(body), 4, 4, signal()),
    ).rejects.toThrow("CONTENT_INTEGRITY_FAILED");
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it("rejects decoded truncation despite matching declared length", async () => {
    await expect(
      responseBytes(
        new Response(new Uint8Array(3), {
          headers: { "Content-Length": "4" },
        }),
        4,
        4,
        signal(),
      ),
    ).rejects.toThrow("CONTENT_INTEGRITY_FAILED");
  });
});
