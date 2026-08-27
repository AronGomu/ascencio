import { describe, expect, it } from "vitest";
import { readCappedResponseBody } from "../../scripts/lib/capped-response-body.ts";

const CAP = 8_192;

/* A body that never ends is the shape the audit measured against the real call
   site. The pull budget turns an uncapped read into a fast assertion failure
   instead of the memory exhaustion the cap exists to prevent. */
function endlessBody(chunkBytes: number, pullBudget: number) {
  const state = { pulls: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.pulls += 1;
      if (state.pulls > pullBudget) {
        controller.error(new Error("body read past the pull budget"));
        return;
      }
      controller.enqueue(new Uint8Array(chunkBytes).fill(0xab));
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { state, stream };
}

describe("capped response body", () => {
  it("refuses a response whose content-length exceeds the cap without reading the body", async () => {
    const { state, stream } = endlessBody(4_096, 100);
    const response = new Response(stream, {
      headers: { "content-length": String(CAP + 1) },
    });

    const result = await readCappedResponseBody(response, CAP, "101305088.jpg");

    expect(result.status).toBe("too-large");
    expect(result.status === "too-large" && result.error).toContain(
      "101305088.jpg",
    );
    expect(result.status === "too-large" && result.error).toContain(
      String(CAP),
    );
    expect(state.pulls).toBe(0);
    expect(state.cancelled).toBe(true);
  });

  it("refuses a streamed body that exceeds the cap", async () => {
    const { state, stream } = endlessBody(4_096, 100);
    const response = new Response(stream);
    expect(response.headers.get("content-length")).toBeNull();

    const result = await readCappedResponseBody(
      response,
      CAP,
      "dark-crisis.jpg",
    );

    expect(result.status).toBe("too-large");
    expect(result.status === "too-large" && result.error).toContain(
      "dark-crisis.jpg",
    );
    expect(result.status === "too-large" && result.error).toContain(
      String(CAP),
    );
    expect(state.pulls).toBe(3);
    expect(state.cancelled).toBe(true);
  });

  it("accepts a body at or below the cap", async () => {
    const first = new Uint8Array(CAP - 1).fill(0x01);
    const last = new Uint8Array([0x02]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(first);
        controller.enqueue(last);
        controller.close();
      },
    });

    const result = await readCappedResponseBody(
      new Response(stream),
      CAP,
      "101305088.jpg",
    );

    expect(result.status).toBe("ok");
    expect(result.status === "ok" && result.bytes).toEqual(
      new Uint8Array([...first, ...last]),
    );
  });

  it("reads a body-less response as empty, as arrayBuffer did", async () => {
    const result = await readCappedResponseBody(
      new Response(null),
      CAP,
      "101305088.jpg",
    );

    expect(result).toEqual({ status: "ok", bytes: new Uint8Array() });
  });
});
