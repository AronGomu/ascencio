import { nativeIoTrace, assertStartupReady } from "../../storage/index.ts";
import { prepareApplicationInputs } from "./prepare-application-inputs.ts";
import { createApplicationAdmission } from "./application-admission.ts";
import type { CoreStartup } from "../core/core-gate.ts";
import { createSqliteApplicationService } from "./sqlite-application-service.ts";
import { openUserPersistence } from "./user-persistence-owner.ts";

// Executable compatibility epoch, not a remotely chosen setting.
export const CORE_CONTENT_API_VERSION = 1;

export async function bootstrapApplication(
  signal = new AbortController().signal,
  progress: (completed: number, total: number) => void = () => {},
): Promise<CoreStartup> {
  const admission = createApplicationAdmission();
  const userPersistence = await openUserPersistence(admission);
  let service: ReturnType<typeof createSqliteApplicationService> | null = null;
  let prepared: Awaited<ReturnType<typeof prepareApplicationInputs>> | null =
    null;
  let preparationTotal = 1;
  const storage = userPersistence.storage;
  if (storage === null)
    return {
      gate: { kind: "locked", reason: "storage-unavailable" },
      userPersistence,
      dispose: async () => {
        admission.close();
        await userPersistence.close();
      },
    };

  try {
    prepared = await prepareApplicationInputs(
      storage,
      userPersistence.services,
      signal,
      (completed, total) => {
        preparationTotal = total;
        progress(completed, total + 1);
      },
    );
  } catch (error) {
    admission.close();
    await userPersistence.close();
    throw error;
  }
  service = createSqliteApplicationService({
    admission,
    storage,
    users: userPersistence.services,
    flushUserWrites: () => userPersistence.flush(),
    loadFreeplayInputs: async () => prepared!.freeplay,
    loadStoryInputs: async (_storage, _users, chapterId) => {
      const input = prepared!.stories.get(chapterId);
      if (!input) throw new Error("APP_REQUIRED_INPUT_FAILED");
      return input;
    },
    closeFreeplayInputs: () => {},
    closeStoryInputs: () => {},
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
      prepared?.close();
      if (failure !== null) throw failure;
    })();
    return disposed;
  };
  const dispose = async (): Promise<void> => {
    admission.close();
    await disposeRuntime();
  };

  try {
    const readiness = await service.readiness();
    const firstThreeMissing = readiness.missing.filter((packageId) =>
      ["duel-core", "card-library", "freeplay"].includes(packageId),
    );
    if (readiness.freeplay) {
      signal.throwIfAborted();
      assertStartupReady([
        ...(storage.preparedRequirements ?? []),
        ...prepared!.requirements,
      ]);
      await nativeIoTrace.markReady();
      progress(preparationTotal + 1, preparationTotal + 1);
    }
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
      applicationStatus: service.status,
      subscribeApplicationStatus: (listener) =>
        service!.subscribeStatus(listener),
      userPersistence,
      dispose,
    };
  } catch (error) {
    await disposeRuntime();
    admission.close();
    throw error;
  }
}
