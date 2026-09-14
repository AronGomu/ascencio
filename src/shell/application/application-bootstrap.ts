import { openProgressiveContentStore } from "../../content/index.ts";
import type { CoreFetch, CoreStartup } from "../core/core-gate.ts";
import { applicationLocks } from "./application-locks.ts";
import { createApplicationService } from "./application-service.ts";
import { requestServiceWorkerUpdate } from "../pwa/register-service-worker.ts";

// Executable compatibility epoch, not a remotely chosen setting.
export const CORE_CONTENT_API_VERSION = 1;

export async function bootstrapApplication(
  _fetch: CoreFetch,
  _appBaseUrl: string,
  factory: IDBFactory | undefined,
): Promise<CoreStartup> {
  if (!factory)
    return {
      bootstrap: null,
      gate: { kind: "locked", reason: "storage-unavailable" },
    };
  let service: ReturnType<typeof createApplicationService> | null = null;
  try {
    const locks = applicationLocks();
    const store = await openProgressiveContentStore(_appBaseUrl);
    service = createApplicationService({
      factory,
      locks,
      store,
      coreContentApiVersion: CORE_CONTENT_API_VERSION,
      currentBuildId: __APP_BUILD_ID__,
      coreBaseUrl: _appBaseUrl,
      requestServiceWorkerUpdate,
      isHome: () =>
        ["", "#/", "#/install-content"].includes(globalThis.location.hash),
    });
    try {
      // Local selector and semantic pair first. No legacy active pointer or latest prerequisite.
      const session = await service.application.acquire(
        new AbortController().signal,
      );
      const gate = {
        kind: "ready" as const,
        gameplay: session.gameplay,
        reader: null,
        generation: session.generation,
      };
      await session.close();
      return {
        bootstrap: null,
        gate,
        application: service.application,
        contentActions: service.contentActions,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "APP_STORAGE_UNAVAILABLE",
          "CONTENT_STORAGE_UNAVAILABLE",
          "STORY_STORAGE_UNAVAILABLE",
        ].includes(error.message)
      )
        throw error;
      // Keep explicit repair/cleanup available without replacing selector or saves.
      return {
        bootstrap: null,
        gate: {
          kind: "locked",
          reason:
            error instanceof Error && error.message === "APP_CONTENT_REQUIRED"
              ? "content-required"
              : "content-invalid",
        },
        application: service.application,
        contentActions: service.contentActions,
      };
    }
  } catch (error) {
    service?.application.close();
    const unavailable =
      error instanceof Error &&
      [
        "APP_STORAGE_UNAVAILABLE",
        "CONTENT_STORAGE_UNAVAILABLE",
        "STORY_STORAGE_UNAVAILABLE",
      ].includes(error.message);
    return {
      bootstrap: null,
      gate: {
        kind: "locked",
        reason: unavailable ? "storage-unavailable" : "content-invalid",
      },
    };
  }
}
