import type { ContentReadPort } from "./contracts/content-read-port.ts";
import type { ContentResult } from "./contracts/content-result.ts";
import type { ContentSetRef } from "./contracts/content-set-ref.ts";
import { failure, same } from "./content-verification.ts";
import { installedContentState } from "./installed-content-state.ts";

function inspectionKey(ref: ContentSetRef): string {
  return [
    ref.catalogSha256,
    ref.runtime.sha256,
    ...ref.chapters.map(({ sha256 }) => sha256),
  ].join(":");
}

export async function inspectInstalledContent(
  reader: ContentReadPort,
  ref: ContentSetRef,
): Promise<ContentResult<ContentSetRef>> {
  const state = installedContentState(reader);
  const revision = state.revision;
  const key = inspectionKey(ref);
  let pending = state.inspections.get(key);
  if (pending === undefined) {
    const inspected = reader
      .inspectContent(ref)
      .then((result) =>
        result.kind === "ok" && !same(result.value, ref)
          ? failure("CONTENT_INTEGRITY_FAILED")
          : result,
      );
    const created = inspected.then((result) => {
      if (result.kind === "failed" && state.inspections.get(key) === created)
        state.inspections.delete(key);
      return result;
    });
    pending = created;
    state.inspections.set(key, pending);
  }
  const result = await pending;
  if (state.revision !== revision) return failure("CONTENT_MISSING");
  return result.kind === "ok" && !same(result.value, ref)
    ? failure("CONTENT_INTEGRITY_FAILED")
    : result;
}
