/* `await response.arrayBuffer()` has no ceiling, and the bytes it allocates sit
   outside the V8 heap, so no engine limit ever fires: an endless upstream body
   drove the image downloaders to 15.7 GB RSS in one 15 s fetch window. Reading
   through the stream lets a caller stop at its own declared cap instead. */

export type CappedResponseBody =
  { status: "ok"; bytes: Uint8Array } | { status: "too-large"; error: string };

/**
 * Buffer `response` in memory, refusing anything over `maxBytes`. A declared
 * `content-length` is rejected before the body is touched; a body without one
 * is measured chunk by chunk and cancelled the moment it passes the cap, so a
 * chunked response cannot get past it either. `label` names the file the caller
 * was fetching, and appears in the returned error.
 */
export async function readCappedResponseBody(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<CappedResponseBody> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    return {
      status: "too-large",
      error: `${label} declares ${declared} bytes, over the ${maxBytes}-byte download cap`,
    };
  }
  if (!response.body) {
    return { status: "ok", bytes: new Uint8Array() };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return {
        status: "too-large",
        error: `${label} exceeded the ${maxBytes}-byte download cap while streaming`,
      };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { status: "ok", bytes };
}
