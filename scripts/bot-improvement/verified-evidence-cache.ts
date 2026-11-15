/** Bounded parse cache. Fresh content is hashed on every lookup; metadata is never authority. */
import { serialize, deserialize } from "node:v8";
import { digest } from "./session-fixtures.ts";
export class VerifiedEvidenceCache {
  private entries = new Map<string, Buffer>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  constructor(maxBytes = 32 * 1024 * 1024, maxEntries = 128) {
    this.maxBytes = maxBytes;
    this.maxEntries = maxEntries;
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      !Number.isSafeInteger(maxEntries) ||
      maxEntries < 1
    )
      throw Error("Invalid evidence cache bounds");
  }
  decode<T>(
    bytes: Buffer | string,
    parserIdentity: string,
    parse: () => T,
    expectedSha256?: string,
  ): T {
    const sha256 = digest(bytes);
    if (expectedSha256 !== undefined && sha256 !== expectedSha256)
      throw Error("Evidence cache hash mismatch");
    if (!parserIdentity) throw Error("Parser identity required");
    const key = JSON.stringify([parserIdentity, sha256]);
    const cached = this.entries.get(key);
    if (cached) {
      this.hits++;
      this.entries.delete(key);
      this.entries.set(key, cached);
      return deserialize(cached) as T;
    }
    this.misses++;
    const value = parse(),
      encoded = serialize(value);
    if (encoded.byteLength <= this.maxBytes) {
      while (
        this.entries.size >= this.maxEntries ||
        this.bytes + encoded.byteLength > this.maxBytes
      ) {
        const oldest = this.entries.keys().next().value!;
        this.bytes -= this.entries.get(oldest)!.byteLength;
        this.entries.delete(oldest);
      }
      this.entries.set(key, encoded);
      this.bytes += encoded.byteLength;
    }
    // Neither parser-owned values nor caller mutations can change the retained cache bytes.
    return deserialize(encoded) as T;
  }
  async decodeAsync<T>(
    bytes: Buffer | string,
    parserIdentity: string,
    parse: () => Promise<T>,
    expectedSha256?: string,
  ): Promise<T> {
    const sha256 = digest(bytes);
    if (expectedSha256 !== undefined && sha256 !== expectedSha256)
      throw Error("Evidence cache hash mismatch");
    const key = JSON.stringify([parserIdentity, sha256]);
    if (this.entries.has(key))
      return this.decode(
        bytes,
        parserIdentity,
        () => {
          throw Error("Cache entry vanished");
        },
        expectedSha256,
      );
    const value = await parse();
    return this.decode(bytes, parserIdentity, () => value, expectedSha256);
  }
  stats() {
    return {
      entries: this.entries.size,
      retainedBytes: this.bytes,
      maxBytes: this.maxBytes,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
    };
  }
  clear() {
    this.entries.clear();
    this.bytes = 0;
    this.hits = 0;
    this.misses = 0;
  }
}
export const evidenceParseCache = new VerifiedEvidenceCache();
