import { createApplicationAdmission } from "./application-admission.ts";
import type { CoreFetch, CoreStartup } from "../core/core-gate.ts";
import { prepareServiceWorkerUpdate } from "../pwa/register-service-worker.ts";
import { createAppUpdateController } from "./app-update-controller.ts";
import { createSqliteApplicationService } from "./sqlite-application-service.ts";
import { openUserPersistence } from "./user-persistence-owner.ts";
import { isNativeApp } from "../native/content.ts";

// Executable compatibility epoch, not a remotely chosen setting.
export const CORE_CONTENT_API_VERSION = 1;

export async function bootstrapApplication(
  fetch: CoreFetch,
  appBaseUrl: string,
  factory: IDBFactory | undefined,
): Promise<CoreStartup> {
  const admission = createApplicationAdmission();
  const userPersistence = await openUserPersistence(admission);
  let service: ReturnType<typeof createSqliteApplicationService> | null = null;
  const appUpdates =
    factory === undefined || isNativeApp()
      ? undefined
      : createAppUpdateController({
          admission,
          factory,
          appBaseUrl,
          currentBuildId: __APP_BUILD_ID__,
          fetch,
          prepareServiceWorkerUpdate,
          isSessionActive: () => service?.sessionActive() ?? false,
        });
  const appUpdateStartup = appUpdates === undefined ? {} : { appUpdates };
  const storage = userPersistence.storage;
  if (storage === null)
    return {
      gate: { kind: "locked", reason: "storage-unavailable" },
      ...appUpdateStartup,
      userPersistence,
      dispose: async () => {
        admission.close();
        await appUpdates?.dispose();
        await userPersistence.close();
      },
    };

  service = createSqliteApplicationService({
    admission,
    storage,
    users: userPersistence.services,
    flushUserWrites: () => userPersistence.flush(),
  });
  let disposed: Promise<void> | null = null;
  const disposeRuntime = (): Promise<void> => {
    if (disposed !== null) return disposed;
    disposed = (async () => {
      let failure: unknown = null;
      try {
        await service!.dispose();
      } catch (error) {
        failure = error;
      }
      try {
        await userPersistence.close();
      } catch (error) {
        failure ??= error;
      }
      if (failure !== null) throw failure;
    })();
    return disposed;
  };
  const dispose = async (): Promise<void> => {
    admission.close();
    await appUpdates?.dispose();
    await disposeRuntime();
  };

  try {
    const readiness = await service.readiness();
    const firstThreeMissing = readiness.missing.filter((packageId) =>
      ["duel-core", "card-library", "freeplay"].includes(packageId),
    );
    return {
      gate: readiness.freeplay
        ? {
            kind: "ready",
            generation: readiness.generation,
            missing: readiness.missing,
          }
        : {
            kind: "locked",
            reason: "content-required",
            missing: firstThreeMissing,
          },
      application: service.application,
      ...appUpdateStartup,
      applicationStatus: service.status,
      subscribeApplicationStatus: (listener) =>
        service!.subscribeStatus(listener),
      userPersistence,
      dispose,
    };
  } catch (error) {
    await disposeRuntime();
    const unavailable =
      error instanceof Error &&
      ["SQLITE_UNAVAILABLE", "STORAGE_UNAVAILABLE"].includes(error.message);
    return {
      gate: {
        kind: "locked",
        reason: unavailable ? "storage-unavailable" : "content-invalid",
      },
      ...appUpdateStartup,
      dispose: async () => {
        admission.close();
        await appUpdates?.dispose();
      },
    };
  }
}
