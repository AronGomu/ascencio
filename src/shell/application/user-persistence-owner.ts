import {
  createApplicationAdmission,
  type ApplicationAdmission,
} from "./application-admission.ts";
import {
  defaultPersistedUiState,
  type PersistedUiState,
} from "../../battle/ports/index.ts";
import {
  openLocalStorage,
  userWriteLifecycle,
  type BackupPreview,
  type LocalStorageClient,
  type RestoreOutcomeUnknown,
  type StorageFailure,
  type StorageResult,
  type UserDataStore,
  type UserNamespace,
} from "../../storage/index.ts";
import {
  DEFAULT_STORY_PLAYBACK_SETTINGS,
  type StoryPlaybackSettings,
} from "../../story/playback/index.ts";
import {
  createSqliteStoryRepository,
  type GenerationSaveRepository,
} from "../../story/saves/index.ts";
import {
  createSqliteUserServices,
  invalidateSqliteUserPreferences,
  reloadSqliteUserPreferences,
  readSqliteBattlePreferences,
} from "../adapters/sqlite-user-services.ts";
import type { ShellUserServices } from "../core/user-services.ts";
import {
  DEFAULT_SHELL_SETTINGS,
  type ShellSettings,
} from "../settings/index.ts";

export interface HydratedUserPreferences {
  readonly shell: ShellSettings;
  readonly battle: PersistedUiState;
  readonly battlePresent: boolean;
  readonly storyPlayback: StoryPlaybackSettings;
  readonly storyReadLog: ReadonlySet<string>;
}

export interface RestoredUserPersistence {
  readonly revision: number;
  readonly hydrated: HydratedUserPreferences;
}

export type UserRestoreLifecycleResult =
  | RestoreOutcomeUnknown
  | StorageResult<RestoredUserPersistence>
  | { readonly kind: "refresh-failed"; readonly error: StorageFailure };

export interface UserPersistenceOwner {
  /** Root-only composition seam. Never pass this generic client to a screen. */
  readonly storage: LocalStorageClient | null;
  readonly services: ShellUserServices;
  readonly saves: GenerationSaveRepository;
  readonly hydrated: HydratedUserPreferences;
  readonly failure: StorageFailure | null;
  flush(): Promise<StorageResult<void>>;
  reset(namespaces: readonly UserNamespace[]): Promise<StorageResult<void>>;
  exportUserData(): Promise<StorageResult<Blob>>;
  inspectUserDataBackup(file: File): Promise<StorageResult<BackupPreview>>;
  restoreUserData(
    token: string,
    expectedRevision: number,
    refreshRoot: (hydrated: HydratedUserPreferences) => Promise<void>,
  ): Promise<UserRestoreLifecycleResult>;
  refreshAfterRestore(): Promise<StorageResult<RestoredUserPersistence>>;
  close(): Promise<void>;
}

export async function openUserPersistence(
  admission = createApplicationAdmission(),
): Promise<UserPersistenceOwner> {
  let client: LocalStorageClient | null = null;
  try {
    const opened = await openLocalStorage();
    if (opened.kind === "failed") return degradedOwner(opened.error, admission);
    client = opened.value;
    return await createUserPersistenceOwner(client, admission);
  } catch (error) {
    try {
      await client?.close();
    } catch (closeError) {
      console.warn("USER_PERSISTENCE_STARTUP_CLEANUP_FAILED", closeError);
    }
    return degradedOwner(storageFailure(error), admission);
  }
}

export async function createUserPersistenceOwner(
  client: LocalStorageClient,
  admission = createApplicationAdmission(),
): Promise<UserPersistenceOwner> {
  const services = createSqliteUserServices(client.userData);
  const reads = await Promise.allSettled([
    services.preferences.shell.read(),
    readSqliteBattlePreferences(client.userData),
    services.preferences.storyPlayback.read(),
    services.preferences.storyReadLog.read(),
  ] as const);
  const failure = reads.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  const battle = fulfilled(reads[1], {
    value: defaultPersistedUiState(),
    present: false,
  });
  return owner(
    client,
    client.userData,
    services,
    createSqliteStoryRepository(client.userData),
    {
      shell: fulfilled(reads[0], DEFAULT_SHELL_SETTINGS),
      battle: battle.value,
      battlePresent: battle.present,
      storyPlayback: fulfilled(reads[2], DEFAULT_STORY_PLAYBACK_SETTINGS),
      storyReadLog: fulfilled(reads[3], new Set<string>()),
    },
    failure === undefined ? null : storageFailure(failure.reason),
    admission,
  );
}

function owner(
  client: LocalStorageClient | null,
  store: UserDataStore,
  services: ShellUserServices,
  saves: GenerationSaveRepository,
  hydrated: HydratedUserPreferences,
  failure: StorageFailure | null,
  admission: ApplicationAdmission,
): UserPersistenceOwner {
  const lifecycle = userWriteLifecycle(store);
  let currentHydrated = hydrated;
  let releaseAdmission: (() => void) | null = null;
  let restoreBarrier: { release(): void } | null = null;
  let restoredRevision: number | null = null;
  let refreshRoot:
    ((hydrated: HydratedUserPreferences) => Promise<void>) | null = null;
  let inFlight: Promise<UserRestoreLifecycleResult> | null = null;
  let closing: Promise<void> | null = null;

  const releaseRestore = (): void => {
    releaseAdmission?.();
    releaseAdmission = null;
    restoreBarrier?.release();
    restoreBarrier = null;
    restoredRevision = null;
    refreshRoot = null;
  };
  const track = (
    operation: Promise<UserRestoreLifecycleResult>,
  ): Promise<UserRestoreLifecycleResult> => {
    inFlight = operation;
    void operation.then(
      () => {
        inFlight = null;
      },
      () => {
        inFlight = null;
      },
    );
    return operation;
  };

  async function refreshRestoredState(): Promise<
    StorageResult<RestoredUserPersistence>
  > {
    if (
      restoreBarrier === null ||
      restoredRevision === null ||
      refreshRoot === null
    )
      return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
    invalidateSqliteUserPreferences(store, ["preferences", "story-read-log"]);
    let reloaded: Awaited<ReturnType<typeof reloadSqliteUserPreferences>>;
    try {
      reloaded = await reloadSqliteUserPreferences(store);
    } catch {
      return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
    }
    if (reloaded.kind === "failed") return reloaded;
    currentHydrated = reloaded.value;
    const result = {
      kind: "ok" as const,
      value: { revision: restoredRevision, hydrated: currentHydrated },
    };
    try {
      // Root invalidation must not re-enter adapter admission under this barrier.
      await refreshRoot(currentHydrated);
    } catch {
      return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
    }
    releaseRestore();
    return result;
  }

  return Object.freeze({
    storage: client,
    services: Object.freeze({
      ...services,
      preferences: Object.freeze({
        ...services.preferences,
        battle: Object.freeze({
          ...services.preferences.battle,
          update(patch: Partial<PersistedUiState>) {
            // Keep publication inside the admitted lifetime: reset/restore must
            // drain it before replacing the root snapshot, not just the DB write.
            return lifecycle
              .run(async () => {
                const result = await services.preferences.battle.update(patch);
                if (result.kind === "ok" && closing === null)
                  currentHydrated = {
                    ...currentHydrated,
                    battle: structuredClone(result.value),
                    battlePresent: true,
                  };
                return result;
              })
              .catch((error: unknown) => ({
                kind: "failed" as const,
                error: storageFailure(error),
              }));
          },
        }),
      }),
    }),
    saves,
    get hydrated() {
      return currentHydrated;
    },
    failure,
    flush: () => lifecycle.flush(),
    reset(namespaces: readonly UserNamespace[]) {
      const selected = [...namespaces];
      return lifecycle.quiesce(async () => {
        const result = await resetNamespaces(store, selected);
        if (result.kind === "ok") {
          invalidateSqliteUserPreferences(store, selected);
          if (selected.includes("preferences"))
            currentHydrated = {
              ...currentHydrated,
              battle: defaultPersistedUiState(),
              battlePresent: false,
            };
        }
        return result;
      });
    },
    exportUserData: () => lifecycle.quiesce(() => store.exportUserData()),
    inspectUserDataBackup: (file: File) => store.inspectUserDataBackup(file),
    restoreUserData(
      token: string,
      expectedRevision: number,
      onRefreshed: (hydrated: HydratedUserPreferences) => Promise<void>,
    ): Promise<UserRestoreLifecycleResult> {
      if (closing !== null || inFlight !== null || restoreBarrier !== null)
        return Promise.resolve({
          kind: "failed",
          error: { code: "STORAGE_CONFLICT" },
        });
      releaseAdmission = admission.enter("restore");
      if (releaseAdmission === null)
        return Promise.resolve({
          kind: "failed",
          error: { code: "APP_SESSION_ACTIVE" },
        });
      // acquireBarrier closes admission before its first await.
      const acquired = lifecycle.acquireBarrier();
      refreshRoot = onRefreshed;
      return track(
        (async () => {
          const barrier = await acquired;
          if (barrier.kind === "failed") {
            releaseRestore();
            return barrier;
          }
          restoreBarrier = barrier.value;
          let restored: Awaited<ReturnType<UserDataStore["restoreUserData"]>>;
          try {
            restored = await store.restoreUserData(
              token,
              expectedRevision,
              true,
            );
          } catch {
            releaseRestore();
            return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
          }
          if (restored.kind === "restore-outcome-unknown") {
            // No known revision or root refresh. Retain admission until close;
            // normal startup hydrates whichever complete DB survived.
            refreshRoot = null;
            return restored;
          }
          if (restored.kind === "failed") {
            releaseRestore();
            return restored;
          }
          restoredRevision = restored.value.revision;
          const refreshed = await refreshRestoredState();
          return refreshed.kind === "ok"
            ? refreshed
            : { kind: "refresh-failed", error: refreshed.error };
        })(),
      );
    },
    refreshAfterRestore() {
      if (closing !== null || inFlight !== null)
        return Promise.resolve({
          kind: "failed" as const,
          error: { code: "STORAGE_CONFLICT" as const },
        });
      // Retry retains the original barrier and root callback, never the token.
      const refreshing = refreshRestoredState();
      track(refreshing);
      return refreshing;
    },
    close() {
      if (closing !== null) return closing;
      // Mark lifecycle closed synchronously. Release only after restore/refresh
      // settles, including failure; close must not wait forever on recovery.
      const active = inFlight;
      const terminated = lifecycle.close(async () => {
        await client?.close();
      });
      closing = (async () => {
        try {
          await active;
        } finally {
          releaseRestore();
          await terminated;
        }
      })();
      return closing;
    },
  });
}

function degradedOwner(
  failure: StorageFailure,
  admission: ApplicationAdmission,
): UserPersistenceOwner {
  const store = unavailableStore(failure.code);
  const services = createSqliteUserServices(store);
  return owner(
    null,
    store,
    services,
    createSqliteStoryRepository(store),
    {
      shell: DEFAULT_SHELL_SETTINGS,
      battle: defaultPersistedUiState(),
      battlePresent: false,
      storyPlayback: DEFAULT_STORY_PLAYBACK_SETTINGS,
      storyReadLog: new Set(),
    },
    failure,
    admission,
  );
}

async function resetNamespaces(
  store: UserDataStore,
  namespaces: readonly UserNamespace[],
): Promise<StorageResult<void>> {
  const unique = [...new Set(namespaces)];
  const listed = await Promise.all(
    unique.map((namespace) => store.listUser(namespace)),
  );
  const failure = listed.find(
    (result): result is Extract<typeof result, { readonly kind: "failed" }> =>
      result.kind === "failed",
  );
  if (failure !== undefined) return failure;
  const mutations = listed.flatMap((result) =>
    result.kind === "ok"
      ? result.value.map((record) => ({
          kind: "delete" as const,
          namespace: record.namespace,
          key: record.key,
          expectedRevision: record.revision,
        }))
      : [],
  );
  if (mutations.length === 0) return { kind: "ok", value: undefined };
  const result = await store.writeUser(mutations);
  return result.kind === "ok" ? { kind: "ok", value: undefined } : result;
}

function unavailableStore(code: StorageFailure["code"]): UserDataStore {
  const failed = <T>(): Promise<StorageResult<T>> =>
    Promise.resolve({ kind: "failed", error: { code } });
  return Object.freeze({
    readUser: failed,
    listUser: failed,
    writeUser: failed,
    exportUserData: failed,
    inspectUserDataBackup: failed,
    restoreUserData: failed,
  });
}

function fulfilled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function storageFailure(error: unknown): StorageFailure {
  const code =
    error instanceof Error && isStorageCode(error.message)
      ? error.message
      : "STORAGE_UNAVAILABLE";
  return { code };
}

function isStorageCode(value: string): value is StorageFailure["code"] {
  return [
    "SQLITE_UNAVAILABLE",
    "APP_ALREADY_OPEN",
    "STORAGE_UNAVAILABLE",
    "STORAGE_CONFLICT",
    "STORAGE_QUOTA_EXCEEDED",
    "USER_DATA_INVALID",
    "USER_DATA_TOO_LARGE",
  ].includes(value);
}
