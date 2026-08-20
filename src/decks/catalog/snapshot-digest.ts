/**
 * SHA-256 over runtime-snapshot bytes, for every reader of that snapshot.
 *
 * The Worker verified snapshot bodies long before the editor read any, so this
 * is that implementation rather than a second one: `src/decks` is the only
 * space ADR-022 lets both the duel and the editor import, so it moved here and
 * `src/battle/worker/assets/browser-runtime-assets.ts` now reads it from here.
 */

/** Throws naming `label` unless `bytes` digests to `expected`. */
export async function verifyDigest(
  label: string,
  bytes: Uint8Array,
  expected: string,
): Promise<void> {
  const actual = await sha256(bytes);
  if (actual !== expected) throw new Error(`${label}: SHA-256 mismatch`);
}

/** Lowercase hex SHA-256 of `bytes`. */
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(bytes),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

/* A `Uint8Array` may be a window onto a larger buffer, and `crypto.subtle`
   would hash the whole of it. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
