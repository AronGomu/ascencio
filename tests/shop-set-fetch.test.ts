import assert from "node:assert/strict";
import test from "node:test";
import { fetchSetCards } from "../scripts/lib/shop-set-fetch.ts";

const maxBytes = 8 * 1024 * 1024;
const apiName = "Fixture & Set";
const json = {
  data: [
    {
      id: 1,
      name: "Fixture card",
      card_sets: [
        { set_name: apiName, set_rarity: "Rare" },
        { set_name: apiName, set_rarity: "Ultimate Rare" },
      ],
    },
  ],
};

test("bounded shop fetch retains URL encoding and folded card output", async () => {
  const result = await fetchSetCards(apiName, async (url, init) => {
    assert.equal(
      url,
      "https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=Fixture%20%26%20Set",
    );
    assert.ok(init?.signal instanceof AbortSignal);
    return Response.json(json);
  });
  assert.deepEqual(result, [{ code: 1, name: "Fixture card", rarity: "rare" }]);
});

test("declared oversized shop response is cancelled before JSON decoding", async () => {
  let cancelled = false;
  await assert.rejects(
    fetchSetCards(
      apiName,
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(json)),
              );
              controller.close();
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "content-length": String(maxBytes + 1) } },
        ),
    ),
    /over the 8388608-byte download cap/,
  );
  assert.equal(cancelled, true);
});

test("chunked shop response cannot exceed body cap; stream is cancelled", async () => {
  let cancelled = false;
  await assert.rejects(
    fetchSetCards(
      apiName,
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(maxBytes).fill(32));
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(json)),
              );
              controller.enqueue(new Uint8Array([32]));
              controller.close();
            },
            cancel() {
              cancelled = true;
            },
          }),
        ),
    ),
    /exceeded the 8388608-byte download cap while streaming/,
  );
  assert.equal(cancelled, true);
});

test("shop response at exact byte cap is accepted", async () => {
  const body = JSON.stringify(json).padEnd(maxBytes, " ");
  assert.deepEqual(
    await fetchSetCards(
      apiName,
      async () =>
        new Response(body, {
          headers: { "content-length": String(maxBytes) },
        }),
    ),
    [{ code: 1, name: "Fixture card", rarity: "rare" }],
  );
});

test("15-second shop timeout aborts stalled headers", async (t) => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, 15_000);
    return controller.signal;
  });
  await assert.rejects(
    fetchSetCards(apiName, async (_url, init) => {
      assert.equal(init?.signal, controller.signal);
      return new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () =>
          reject(init!.signal!.reason),
        );
        controller.abort(new DOMException("Fixture timeout", "TimeoutError"));
      });
    }),
    { name: "TimeoutError", message: "Fixture timeout" },
  );
});

test("shop timeout remains attached while reading stalled body", async (t) => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, 15_000);
    return controller.signal;
  });
  await assert.rejects(
    fetchSetCards(apiName, async (_url, init) => {
      assert.equal(init?.signal, controller.signal);
      return new Response(
        new ReadableStream({
          start(stream) {
            init!.signal!.addEventListener("abort", () =>
              stream.error(init!.signal!.reason),
            );
          },
          pull() {
            controller.abort(
              new DOMException("Fixture body timeout", "TimeoutError"),
            );
          },
        }),
      );
    }),
    { name: "TimeoutError", message: "Fixture body timeout" },
  );
});

test("shop fetch retains HTTP errors and rejects malformed JSON", async () => {
  await assert.rejects(
    fetchSetCards(
      apiName,
      async () => new Response("unavailable", { status: 503 }),
    ),
    { message: 'HTTP 503 fetching "Fixture & Set"' },
  );
  await assert.rejects(
    fetchSetCards(apiName, async () => new Response("{")),
    SyntaxError,
  );
});
