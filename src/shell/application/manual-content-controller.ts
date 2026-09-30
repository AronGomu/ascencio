import type {
  BackupPreview,
  ImportProgress,
  LocalStorageClient,
  MediaWarning,
  ModeReadiness,
  PackageId,
  PackageStack,
  RestoreOutcomeUnknown,
  StorageFailure,
  StorageResult,
} from "../../storage/index.ts";
import { packageReadiness } from "../adapters/package-readiness.ts";

export type ManualContentState =
  | { readonly kind: "loading" }
  | { readonly kind: "already-open" }
  | {
      readonly kind: "ready";
      readonly stack: PackageStack;
      readonly readiness: ModeReadiness;
      readonly cleanupPending: boolean;
      readonly mediaWarnings: readonly MediaWarning[];
    }
  | { readonly kind: "importing"; readonly progress: ImportProgress | null }
  | { readonly kind: "restore-confirmation"; readonly preview: BackupPreview }
  | RestoreOutcomeUnknown
  | { readonly kind: "restoring" }
  | { readonly kind: "failed"; readonly error: StorageFailure };

export interface RestoredUserState {
  readonly revision: number;
  readonly hydrated: unknown;
}

export type RestoreLifecycleResult =
  | RestoreOutcomeUnknown
  | StorageResult<RestoredUserState>
  | { readonly kind: "refresh-failed"; readonly error: StorageFailure };

export interface ManualBackupLifecycle {
  exportUserData(): Promise<StorageResult<Blob>>;
  inspectUserDataBackup(file: File): Promise<StorageResult<BackupPreview>>;
  restoreUserData(
    token: string,
    expectedRevision: number,
    refreshRoot: (hydrated: unknown) => Promise<void>,
  ): Promise<RestoreLifecycleResult>;
  refreshAfterRestore(): Promise<StorageResult<RestoredUserState>>;
}

export interface RemovalConfirmation {
  readonly packageId: PackageId;
  readonly version: string;
  readonly generation: number;
  readonly sha256: string;
}

export interface ManualContentView {
  readonly state: ManualContentState;
  readonly message: string;
  readonly busy: boolean;
  readonly refreshPending: boolean;
  readonly navigationBlocked: boolean;
  readonly removal: RemovalConfirmation | null;
}

export interface ManualContentController {
  readonly view: ManualContentView;
  subscribe(listener: (view: ManualContentView) => void): () => void;
  refresh(): Promise<void>;
  retry(): Promise<void>;
  importPackages(files: readonly File[]): Promise<void>;
  cancelImport(): void;
  verifyInstalled(): Promise<void>;
  requestRemoval(packageId: PackageId): void;
  cancelRemoval(): void;
  removePackage(confirmed: true): Promise<void>;
  cleanupUnused(): Promise<void>;
  exportUserData(): Promise<Blob | null>;
  reportDownload(message: string): void;
  inspectUserDataBackup(file: File): Promise<void>;
  cancelRestore(): void;
  confirmRestore(): Promise<void>;
  updateMediaWarnings(warnings: readonly MediaWarning[]): void;
  dispose(): Promise<void>;
}

const INITIAL_MESSAGE = "Select local SQLite packages to install or update.";

export function createManualContentController(options: {
  readonly storage: LocalStorageClient;
  readonly backups: ManualBackupLifecycle;
  readonly isSessionActive: () => boolean;
  readonly onRestored: (hydrated: unknown) => Promise<void> | void;
  readonly initialMediaWarnings?: readonly MediaWarning[];
}): ManualContentController {
  const listeners = new Set<(view: ManualContentView) => void>();
  let warnings = [...(options.initialMediaWarnings ?? [])];
  let current: ManualContentView = Object.freeze({
    state: { kind: "loading" as const },
    message: INITIAL_MESSAGE,
    busy: false,
    refreshPending: false,
    navigationBlocked: false,
    removal: null,
  });
  let stable: Extract<ManualContentState, { readonly kind: "ready" }> | null =
    null;
  let importAbort: AbortController | null = null;
  let sequence = 0;
  let disposed = false;
  let refreshPending = false;
  let restoreTask: Promise<void> | null = null;
  let disposing = false;
  let disposal: Promise<void> | null = null;
  let restoredStack: PackageStack | null = null;
  const restoreLocked = (): boolean =>
    current.state.kind === "restoring" ||
    current.state.kind === "restore-outcome-unknown" ||
    refreshPending;
  const unavailable = (): boolean => disposed || disposing || restoreLocked();

  const publish = (patch: Partial<ManualContentView>): void => {
    if (disposed) return;
    const next = { ...current, ...patch };
    current = Object.freeze({
      ...next,
      navigationBlocked:
        next.state.kind === "restoring" ||
        next.state.kind === "restore-outcome-unknown" ||
        next.refreshPending,
    });
    for (const listener of listeners) listener(current);
  };
  const readyState = (
    stack: PackageStack,
    cleanupPending = false,
  ): Extract<ManualContentState, { readonly kind: "ready" }> =>
    Object.freeze({
      kind: "ready",
      stack,
      readiness: packageReadiness(stack),
      cleanupPending,
      mediaWarnings: Object.freeze([...warnings]),
    });
  const publishReady = (
    stack: PackageStack,
    message: string,
    cleanupPending = false,
  ): void => {
    const consent = current.removal;
    const active = stack.packages.find(
      (item) => item.packageId === consent?.packageId,
    );
    const stale =
      consent !== null &&
      (consent.generation !== stack.generation ||
        consent.version !== active?.version ||
        consent.sha256 !== active.sha256);
    stable = readyState(stack, cleanupPending);
    publish({
      state: stable,
      message: stale
        ? "Installed packages changed. Review removal again."
        : message,
      busy: false,
      refreshPending: false,
      removal: stale ? null : consent,
    });
  };
  const publishFailure = (
    error: StorageFailure,
    message = failureCopy(error),
  ): void => {
    publish({
      state:
        error.code === "APP_ALREADY_OPEN"
          ? { kind: "already-open" }
          : { kind: "failed", error },
      message,
      busy: false,
      refreshPending,
    });
  };
  const sessionAllowed = (): boolean => {
    if (!options.isSessionActive()) return true;
    publishFailure({ code: "APP_SESSION_ACTIVE" });
    return false;
  };
  const mutationAllowed = (): boolean =>
    !unavailable() &&
    !current.busy &&
    current.removal === null &&
    sessionAllowed();
  const start = (): number => {
    const expected = ++sequence;
    publish({ busy: true });
    return expected;
  };
  const currentSequence = (expected: number): boolean =>
    !disposed && expected === sequence;

  const storageCall = async <T>(
    operation: () => Promise<StorageResult<T>>,
  ): Promise<StorageResult<T>> => {
    try {
      return await operation();
    } catch {
      return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
    }
  };

  async function refresh(): Promise<void> {
    if (unavailable() || current.busy) return;
    const expected = start();
    publish({
      state: { kind: "loading" },
      message: "Reading installed packages…",
    });
    const result = await storageCall(() => options.storage.packages.current());
    if (!currentSequence(expected)) return;
    if (result.kind === "failed") publishFailure(result.error);
    else publishReady(result.value, "Installed package status refreshed.");
  }

  const committedFailure = (): void => {
    refreshPending = true;
    publishFailure(
      { code: "STORAGE_UNAVAILABLE" },
      "Restore committed. User data was replaced, but app refresh failed. Retry refresh before continuing. Do not restore again.",
    );
  };

  async function refreshRoot(hydrated: unknown): Promise<void> {
    await options.onRestored(hydrated);
    const result = await options.storage.packages.current();
    if (result.kind === "failed") throw new Error(result.error.code);
    restoredStack = result.value;
  }

  function finishRestore(result: RestoreLifecycleResult): void {
    if (result.kind !== "ok") {
      committedFailure();
      return;
    }
    refreshPending = false;
    publishReady(restoredStack!, "User data restored.");
    restoredStack = null;
  }

  function refreshAfterRestore(): Promise<void> {
    if (disposed || disposing || current.busy) return Promise.resolve();
    const completion = Promise.withResolvers<void>();
    restoreTask = completion.promise;
    publish({
      state: { kind: "restoring" },
      busy: true,
      message: "Refreshing restored user data…",
    });
    void (async () => {
      const result = await storageCall(() =>
        options.backups.refreshAfterRestore(),
      );
      finishRestore(result);
    })().then(completion.resolve, completion.reject);
    return completion.promise;
  }

  const controller: ManualContentController = {
    get view() {
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    refresh,
    retry: async () => {
      if (refreshPending) await refreshAfterRestore();
      else await refresh();
    },
    async importPackages(files) {
      if (files.length === 0 || !mutationAllowed()) return;
      if (current.busy || stable === null) {
        publishFailure({ code: "STORAGE_CONFLICT" });
        return;
      }
      const expected = start();
      const generation = stable.stack.generation;
      const abort = new AbortController();
      importAbort = abort;
      publish({
        state: { kind: "importing", progress: null },
        message: "Importing selected packages…",
      });
      const result = await storageCall(() =>
        options.storage.packages.importPackages(
          files,
          generation,
          abort.signal,
          (progress) => {
            if (currentSequence(expected))
              publish({ state: { kind: "importing", progress } });
          },
        ),
      );
      if (importAbort === abort) importAbort = null;
      if (!currentSequence(expected)) return;
      if (result.kind === "ok")
        publishReady(result.value, "Packages imported and activated.");
      else if (result.error.code === "OPERATION_CANCELLED" && stable !== null)
        publish({
          state: stable,
          message: "Import cancelled. Installed content is unchanged.",
          busy: false,
        });
      else publishFailure(result.error);
    },
    cancelImport() {
      importAbort?.abort();
    },
    async verifyInstalled() {
      if (!mutationAllowed() || stable === null) return;
      const expected = start();
      const abort = new AbortController();
      const result = await storageCall(() =>
        options.storage.packages.verifyInstalled(abort.signal),
      );
      if (!currentSequence(expected)) return;
      if (result.kind === "failed") publishFailure(result.error);
      else publishReady(result.value, "Installed packages verified.");
    },
    requestRemoval(packageId) {
      if (!mutationAllowed() || current.state.kind !== "ready") return;
      const active = current.state.stack.packages.find(
        (item) => item.packageId === packageId,
      );
      if (active === undefined) return;
      publish({
        removal: Object.freeze({
          packageId,
          version: active.version,
          generation: current.state.stack.generation,
          sha256: active.sha256,
        }),
      });
    },
    cancelRemoval() {
      if (unavailable() || current.busy) return;
      publish({ removal: null });
    },
    async removePackage(confirmed) {
      const consent = current.removal;
      if (
        confirmed !== true ||
        unavailable() ||
        current.busy ||
        consent === null ||
        !sessionAllowed()
      )
        return;
      const expected = start();
      const { packageId, generation } = consent;
      publish({ removal: null });
      const result = await storageCall(() =>
        options.storage.packages.removePackage(packageId, generation),
      );
      if (!currentSequence(expected)) return;
      if (result.kind === "failed") publishFailure(result.error);
      else
        publishReady(
          result.value.stack,
          result.value.cleanupPending
            ? "Package removed. Some unused files remain. Run cleanup."
            : "Package removed.",
          result.value.cleanupPending,
        );
    },
    async cleanupUnused() {
      if (!mutationAllowed() || current.busy || stable === null) return;
      const expected = start();
      const result = await storageCall(() =>
        options.storage.packages.cleanupUnused(),
      );
      if (!currentSequence(expected)) return;
      if (result.kind === "failed") publishFailure(result.error);
      else {
        stable = readyState(stable.stack, result.value.remainingFiles > 0);
        publish({
          state: stable,
          message: `Cleanup removed ${result.value.removedFiles.toLocaleString()} files. ${result.value.remainingFiles.toLocaleString()} unused files remain.`,
          busy: false,
        });
      }
    },
    async exportUserData() {
      if (!mutationAllowed() || current.busy) return null;
      const expected = start();
      const result = await storageCall(() => options.backups.exportUserData());
      if (!currentSequence(expected)) return null;
      if (result.kind === "failed") {
        publishFailure(result.error);
        return null;
      }
      publish({
        message: "Backup prepared. Starting browser download…",
        busy: false,
      });
      return result.value;
    },
    reportDownload(message) {
      if (unavailable()) return;
      publish({ message });
    },
    async inspectUserDataBackup(file) {
      if (unavailable() || current.removal !== null) return;
      if (current.busy && current.state.kind !== "loading") return;
      const expected = start();
      publish({ state: { kind: "loading" }, message: "Inspecting backup…" });
      const result = await storageCall(() =>
        options.backups.inspectUserDataBackup(file),
      );
      if (!currentSequence(expected)) return;
      if (result.kind === "failed") publishFailure(result.error);
      else
        publish({
          state: { kind: "restore-confirmation", preview: result.value },
          message: "Backup inspected. Review counts before restoring.",
          busy: false,
        });
    },
    cancelRestore() {
      if (unavailable()) return;
      sequence += 1;
      if (stable !== null)
        publish({
          state: stable,
          message: "Restore cancelled. Current user data is unchanged.",
          busy: false,
        });
    },
    confirmRestore() {
      if (current.state.kind !== "restore-confirmation" || !mutationAllowed())
        return Promise.resolve();
      const preview = current.state.preview;
      const completion = Promise.withResolvers<void>();
      restoreTask = completion.promise;
      // Irreversible phase starts synchronously; no later UI event can supersede it.
      publish({
        state: { kind: "restoring" },
        busy: true,
        message:
          "Restoring user data. This operation cannot be cancelled. Keep this app open.",
      });
      void (async () => {
        let result: RestoreLifecycleResult;
        try {
          result = await options.backups.restoreUserData(
            preview.token,
            preview.currentRevision,
            refreshRoot,
          );
        } catch {
          result = { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
        }
        if (result.kind === "restore-outcome-unknown") {
          publish({
            state: result,
            busy: false,
            refreshPending: false,
            message:
              "Restore outcome unknown. User data may have been replaced. Close and reopen this app to inspect your data before making changes. Do not restore again. If the browser warns about leaving, choose to leave.",
          });
          return;
        }
        if (result.kind === "failed") {
          publishFailure(
            result.error,
            result.error.code === "STORAGE_CONFLICT"
              ? "Backup is stale because user data changed. Inspect it again before restoring."
              : failureCopy(result.error),
          );
          return;
        }
        finishRestore(result);
      })().then(completion.resolve, completion.reject);
      return completion.promise;
    },
    updateMediaWarnings(nextWarnings) {
      warnings = nextWarnings.map((warning) => Object.freeze({ ...warning }));
      if (stable !== null) {
        stable = readyState(stable.stack, stable.cleanupPending);
        if (current.state.kind === "ready") publish({ state: stable });
      }
    },
    dispose() {
      if (disposal !== null) return disposal;
      disposing = true;
      importAbort?.abort();
      // Route unmount only unsubscribes. Root teardown waits for committed results.
      disposal = (async () => {
        await restoreTask;
        disposed = true;
        sequence += 1;
        listeners.clear();
      })();
      return disposal;
    },
  };
  return Object.freeze(controller);
}

export function failureCopy(error: StorageFailure): string {
  switch (error.code) {
    case "APP_ALREADY_OPEN":
      return "App already open in another tab. Close that tab, then retry here.";
    case "APP_SESSION_ACTIVE":
      return "Return to Main Menu before changing installed content or user data.";
    case "SQLITE_UNAVAILABLE":
      return "This browser does not support required local SQLite storage.";
    case "STORAGE_UNAVAILABLE":
      return "Browser storage is unavailable. Existing data remains untouched. Retry.";
    case "STORAGE_QUOTA_EXCEEDED":
      return "Storage is full. Free browser storage, then retry.";
    case "STORAGE_CONFLICT":
      return "Stored data changed in another operation. Refresh, then retry.";
    case "PACKAGE_DEPENDENCY_MISSING":
      return error.packageId !== undefined && error.requiredBy !== undefined
        ? `Install ${error.packageId} before ${error.requiredBy}, then retry.`
        : "Install missing package dependencies in the listed order, then retry.";
    case "PACKAGE_DEPENDENCY_INCOMPATIBLE":
      return error.packageId !== undefined && error.requiredBy !== undefined
        ? `Install a compatible ${error.packageId} version before ${error.requiredBy}.`
        : "Installed package versions are incompatible. Replace dependencies in order.";
    case "PACKAGE_REFERENCED":
      return error.dependants !== undefined && error.dependants.length > 0
        ? `Remove installed dependants first: ${[...error.dependants].sort().join(", ")}.`
        : "Package is still required by installed content.";
    case "PACKAGE_INTEGRITY_FAILED":
      return "Package verification failed. Replace the local file from a trusted source.";
    case "PACKAGE_INVALID":
    case "PACKAGE_SCHEMA_UNSUPPORTED":
    case "PACKAGE_SOURCE_INCOMPLETE":
      return "Selection must be one valid package ZIP or up to four complete SQLite packages.";
    case "USER_DATA_INVALID":
      return "Selected backup is invalid. Current user data is unchanged.";
    case "USER_DATA_TOO_LARGE":
      return "Selected backup is larger than the supported 256 MiB limit.";
    case "OPERATION_CANCELLED":
      return "Operation cancelled. Installed data is unchanged.";
    default:
      return `${error.code}. Retry from Content & updates.`;
  }
}
