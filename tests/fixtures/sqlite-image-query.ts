import { vi } from "vitest";
import type {
  ContentQueries,
  ContentQuery,
  QueryMap,
  StorageResult,
} from "../../src/storage/index.ts";

/** Narrow query injection for lease/cancellation tests; no persistence assertion. */
export function imageQueryFixture() {
  const query = vi.fn<
    (
      request: ContentQuery,
      signal: AbortSignal,
    ) => Promise<StorageResult<QueryMap["asset"]>>
  >(async () => ({ kind: "ok", value: null }));
  return { query, content: { query } as ContentQueries };
}
