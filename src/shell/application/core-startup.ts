import type { OwnedContentReader, ContentResult } from "../../content/index.ts";
import {
  loadLegacyGameplay,
  openLegacyContentReader,
  parseLegacyCoreBootstrap,
} from "../adapters/legacy-content-api.ts";
import type { CoreStartup, CoreFetch } from "../core/core-gate.ts";
import { createShellBootstrap } from "./shell-bootstrap.ts";
export async function loadCoreStartup(
  fetch: CoreFetch,
  appBaseUrl: string,
  indexedDB: IDBFactory | undefined,
  openReader: () => Promise<
    ContentResult<OwnedContentReader>
  > = openLegacyContentReader,
): Promise<CoreStartup> {
  let reader: OwnedContentReader | null = null;
  let transferred = false;
  try {
    const response = await fetch(
      new URL("core-bootstrap.json", appBaseUrl).href,
      {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("CONTENT_INVALID_MANIFEST");
    const bootstrap = await parseLegacyCoreBootstrap(
      await response.json(),
      appBaseUrl,
    );
    if (bootstrap.delivery === null)
      return {
        bootstrap: createShellBootstrap(bootstrap),
        gate: { kind: "locked", reason: "content-required" },
      };
    if (indexedDB === undefined)
      return {
        bootstrap: createShellBootstrap(bootstrap),
        gate: { kind: "locked", reason: "storage-unavailable" },
      };
    const opened = await openReader();
    if (opened.kind === "failed")
      return {
        bootstrap: createShellBootstrap(bootstrap),
        gate: {
          kind: "locked",
          reason:
            opened.code === "CONTENT_STORAGE_UNAVAILABLE"
              ? "storage-unavailable"
              : "content-invalid",
        },
      };
    reader = opened.value;
    const installed = await reader.current();
    if (installed.kind === "failed")
      return {
        bootstrap: createShellBootstrap(bootstrap),
        gate: {
          kind: "locked",
          reason:
            installed.code === "CONTENT_MISSING"
              ? "content-required"
              : installed.code === "CONTENT_STORAGE_UNAVAILABLE"
                ? "storage-unavailable"
                : "content-invalid",
        },
      };
    if (installed.value.current === null)
      return {
        bootstrap: createShellBootstrap(bootstrap),
        gate: { kind: "locked", reason: "content-required" },
      };
    const gameplay = await loadLegacyGameplay(
      opened.value,
      installed.value.current,
    );
    if (gameplay.kind === "failed")
      return {
        bootstrap: createShellBootstrap(bootstrap),
        gate: {
          kind: "locked",
          reason:
            gameplay.code === "CONTENT_MISSING"
              ? "content-required"
              : gameplay.code === "CONTENT_STORAGE_UNAVAILABLE"
                ? "storage-unavailable"
                : "content-invalid",
        },
      };
    try {
      const { validateLegacyGameplay } =
        await import("../adapters/legacy-gameplay-validation.ts");
      await validateLegacyGameplay(gameplay.value);
    } catch {
      return {
        bootstrap: createShellBootstrap(bootstrap),
        gate: { kind: "locked", reason: "content-invalid" },
      };
    }
    const { createShellGameplay } = await import("./legacy-content.ts");
    const prepared = createShellGameplay(gameplay.value, opened.value);
    transferred = true;
    return {
      bootstrap: createShellBootstrap(bootstrap),
      gate: {
        kind: "ready",
        gameplay: prepared,
        reader: Object.freeze({ close: () => opened.value.close() }),
        generation: installed.value.generation,
      },
    };
  } catch {
    return {
      bootstrap: null,
      gate: { kind: "locked", reason: "content-invalid" },
    };
  } finally {
    if (!transferred) reader?.close();
  }
}
