import type { FileDigest } from "./file-digest.ts";
import { assertManagedPath, assertNoPathCollisions } from "./path-guards.ts";
import { fail } from "./failure.ts";

export const MAX_SOURCE_BYTES = 16 * 1024 * 1024 * 1024;
export function assertSourceInventory(files: readonly FileDigest[]): void {
  let total = 0;
  if (files.length > 100_000) fail("ASSET_LIMIT_EXCEEDED");
  for (const file of files) {
    assertManagedPath(file.path);
    total += file.bytes;
    if (!Number.isSafeInteger(total) || total > MAX_SOURCE_BYTES)
      fail("ASSET_LIMIT_EXCEEDED");
  }
  assertNoPathCollisions(files.map((file) => file.path));
}
