import { sha } from "./content-install-fixture.ts";

/** Test-only conditional transport. No AWS SDK, remote endpoint or R2 compatibility claim. */
export function createFakeR2() {
  const baseUrl = "http://127.0.0.1/r2/";
  const objects = new Map<
    string,
    { bytes: Uint8Array; etag: string; mediaType: string }
  >();
  const requests: string[] = [];
  return {
    baseUrl,
    requests,
    get objects(): ReadonlyMap<
      string,
      { readonly bytes: Uint8Array; readonly etag: string }
    > {
      return new Map(
        [...objects].map(([key, value]) => [
          key,
          { bytes: value.bytes.slice(), etag: value.etag },
        ]),
      );
    },
    async fetch(
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      requests.push(`${method} ${url}`);
      const key = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : "";
      if (
        !/^content\/[A-Za-z0-9._/-]+$/.test(key) ||
        key.endsWith("/") ||
        key.includes("//") ||
        /(?:^|\/)\.{1,2}(?:\/|$)/.test(key)
      )
        return new Response(null, { status: 404 });
      if (method === "PUT") {
        const request = new Request(input, init);
        const bytes = new Uint8Array(await request.arrayBuffer());
        const ifMatch = request.headers.get("If-Match");
        const ifNoneMatch = request.headers.get("If-None-Match");
        if ((!ifMatch && ifNoneMatch !== "*") || (ifMatch && ifNoneMatch))
          return new Response(null, { status: 428 });
        // Check and mutation stay synchronous AFTER body read: one winner per prior ETag.
        const previous = objects.get(key);
        if (
          (ifNoneMatch === "*" && previous) ||
          (ifMatch && previous?.etag !== ifMatch)
        )
          return new Response(null, { status: 412 });
        const etag = `"${sha(bytes)}"`;
        objects.set(key, {
          bytes,
          etag,
          mediaType:
            request.headers.get("Content-Type") ?? "application/octet-stream",
        });
        return new Response(null, { headers: { ETag: etag } });
      }
      if (method !== "GET" && method !== "HEAD")
        return new Response(null, { status: 405 });
      const object = objects.get(key);
      if (!object) return new Response(null, { status: 404 });
      return new Response(method === "HEAD" ? null : object.bytes.slice(), {
        headers: {
          ETag: object.etag,
          "Content-Length": String(object.bytes.length),
          "Content-Type": object.mediaType,
        },
      });
    },
  };
}
