import {
  createApplicationAdmission,
  type ApplicationAdmission,
} from "./application-admission.ts";
import {
  parseCoreCandidate,
  writeCoreApproval,
  type CoreCandidate,
} from "./core-update-approval.ts";

export interface AppUpdateView {
  readonly phase:
    | "idle"
    | "checking"
    | "available"
    | "up-to-date"
    | "approving"
    | "committing"
    | "approved"
    | "failed";
  readonly message: string;
  readonly canCheck: boolean;
  readonly canApprove: boolean;
  readonly candidate: CoreCandidate | null;
}

export interface AppUpdateController {
  readonly view: AppUpdateView;
  subscribe(listener: (view: AppUpdateView) => void): () => void;
  check(): Promise<void>;
  approve(candidate: CoreCandidate): Promise<void>;
  cancel(): void;
  dispose(): Promise<void>;
}

interface ApprovalOperation {
  readonly abort: AbortController;
  readonly release: () => void;
  committing: boolean;
}

const APPLICATION_LIFECYCLE_LOCK = "ygo-application-lifecycle-v1";

const initialView: AppUpdateView = Object.freeze({
  phase: "idle",
  message: "Check for an app update. Installation requires explicit approval.",
  canCheck: true,
  canApprove: false,
  candidate: null,
});

function releaseUrl(baseUrl: string): string {
  return new URL("core-release.json", baseUrl).href;
}

async function fetchCandidate(
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
  baseUrl: string,
  signal: AbortSignal,
): Promise<CoreCandidate> {
  let response: Response;
  try {
    response = await fetcher(releaseUrl(baseUrl), {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal,
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error("CORE_UPDATE_DISCOVERY_FAILED", { cause });
  }
  const length = Number(response.headers.get("Content-Length") ?? "0");
  if (
    !response.ok ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > 4096 ||
    response.body === null
  ) {
    await response.body?.cancel();
    throw new Error("CORE_UPDATE_DISCOVERY_FAILED");
  }
  const reader = response.body.getReader();
  const bytes = new Uint8Array(4096);
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > bytes.byteLength - size)
        throw new Error("CORE_UPDATE_DISCOVERY_FAILED");
      bytes.set(value, size);
      size += value.byteLength;
    }
    return parseCoreCandidate(
      JSON.parse(new TextDecoder().decode(bytes.subarray(0, size))),
    );
  } catch (cause) {
    await reader.cancel();
    if (signal.aborted) throw cause;
    throw new Error("CORE_UPDATE_DISCOVERY_FAILED", { cause });
  } finally {
    reader.releaseLock();
  }
}

function failureMessage(error: unknown, approvalWritten: boolean): string {
  if (approvalWritten)
    return "App update request failed. Approved build remains pending; retry from this screen.";
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "APP_LIFECYCLE_BUSY":
      return "Finish the active session, restore, or app approval before approving an update.";
    case "APP_SESSION_ACTIVE":
      return "Return to Main Menu before approving an app update.";
    case "CORE_UPDATE_UNAVAILABLE":
      return "App updates are unavailable in this browser.";
    case "CORE_UPDATE_PENDING":
      return "Another approved app build is pending. Close all app tabs, then reopen.";
    case "CORE_UPDATE_INVALID":
      return "App update metadata is invalid. No update was approved.";
    case "APP_STORAGE_UNAVAILABLE":
      return "App update approval could not be saved. No update was requested.";
    default:
      return "App update check failed. Installed offline app remains available.";
  }
}

export function createAppUpdateController(options: {
  readonly admission?: ApplicationAdmission;
  readonly factory: IDBFactory;
  readonly appBaseUrl: string;
  readonly currentBuildId: string;
  readonly fetch: (input: string, init?: RequestInit) => Promise<Response>;
  readonly prepareServiceWorkerUpdate: () => Promise<() => Promise<void>>;
  readonly isSessionActive: () => boolean;
  readonly locks?: LockManager;
  readonly now?: () => number;
}): AppUpdateController {
  const listeners = new Set<(view: AppUpdateView) => void>();
  let current = initialView;
  let operation: AbortController | null = null;
  let epoch = 0;
  let disposed = false;
  let disposal: Promise<void> | null = null;
  const admission = options.admission ?? createApplicationAdmission();
  const tasks = new Set<Promise<unknown>>();
  let approval: ApprovalOperation | null = null;
  let consentPending = false;

  const track = <T = void>(): PromiseWithResolvers<T> => {
    const completion = Promise.withResolvers<T>();
    tasks.add(completion.promise);
    void completion.promise.then(
      () => tasks.delete(completion.promise),
      () => tasks.delete(completion.promise),
    );
    return completion;
  };

  const publish = (patch: Partial<AppUpdateView>): void => {
    if (disposed) return;
    current = Object.freeze({ ...current, ...patch });
    for (const listener of listeners) listener(current);
  };
  const invalidate = (): number => {
    if (approval !== null && !approval.committing) {
      approval.abort.abort();
      approval.release();
      approval = null;
    }
    operation?.abort();
    operation = null;
    return ++epoch;
  };
  const isCurrent = (expected: number): boolean =>
    !disposed && epoch === expected;

  const controller: AppUpdateController = {
    get view() {
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    check() {
      if (disposed || disposal !== null || approval?.committing)
        return Promise.resolve();
      const completion = track();
      const expected = invalidate();
      const active = new AbortController();
      operation = active;
      publish({
        phase: "checking",
        message: "Checking for an app update…",
        canCheck: false,
        canApprove: false,
        candidate: null,
      });
      void (async () => {
        try {
          if (!isCurrent(expected)) return;
          const candidate = await untilAborted(
            fetchCandidate(options.fetch, options.appBaseUrl, active.signal),
            active.signal,
          );
          if (!isCurrent(expected)) return;
          if (candidate.buildId === options.currentBuildId)
            publish({
              phase: "up-to-date",
              message: "Installed app is up to date.",
              canCheck: true,
              canApprove: false,
              candidate,
            });
          else
            publish({
              phase: "available",
              message:
                "App update available. Approval is required before installation.",
              canCheck: true,
              canApprove: true,
              candidate,
            });
        } catch (error) {
          if (!isCurrent(expected)) return;
          if (active.signal.aborted)
            publish({ ...initialView, message: "App update check cancelled." });
          else
            publish({
              phase: "failed",
              message: failureMessage(error, false),
              canCheck: true,
              canApprove: false,
              candidate: null,
            });
        } finally {
          if (operation === active) operation = null;
        }
      })().then(completion.resolve, completion.reject);
      return completion.promise;
    },
    approve(input) {
      if (disposed || disposal !== null || approval !== null)
        return Promise.resolve();
      const expected = invalidate();
      const completion = track();
      let approvalWritten = false;
      let active: ApprovalOperation | null = null;
      void (async () => {
        try {
          const candidate = parseCoreCandidate(input);
          if (
            current.candidate === null ||
            current.candidate.buildId !== candidate.buildId ||
            current.candidate.coreContentApiVersion !==
              candidate.coreContentApiVersion ||
            candidate.buildId === options.currentBuildId
          )
            throw new Error("CORE_UPDATE_INVALID");
          if (options.isSessionActive()) throw new Error("APP_SESSION_ACTIVE");
          const release = admission.enter("approval");
          if (release === null) throw new Error("APP_LIFECYCLE_BUSY");
          active = { abort: new AbortController(), release, committing: false };
          approval = active;
          const assertCurrent = (): void => {
            active!.abort.signal.throwIfAborted();
            if (
              !isCurrent(expected) ||
              approval !== active ||
              current.candidate?.buildId !== candidate.buildId ||
              current.candidate.coreContentApiVersion !==
                candidate.coreContentApiVersion
            )
              throw new Error("CORE_UPDATE_INVALID");
            if (options.isSessionActive())
              throw new Error("APP_SESSION_ACTIVE");
          };
          publish({
            phase: "approving",
            message: "Preparing app update approval. You can still cancel.",
            canCheck: false,
            canApprove: false,
          });
          assertCurrent();
          const locks = options.locks ?? globalThis.navigator?.locks;
          if (locks === undefined) throw new Error("CORE_UPDATE_UNAVAILABLE");
          await locks.request(
            APPLICATION_LIFECYCLE_LOCK,
            { mode: "exclusive", ifAvailable: true },
            async (lock) => {
              assertCurrent();
              if (!lock) throw new Error("APP_SESSION_ACTIVE");
              // Cancellation releases admission/lock promptly, but root
              // disposal still drains the underlying preparation capability.
              const prepared = track<() => Promise<void>>();
              try {
                void options
                  .prepareServiceWorkerUpdate()
                  .then(prepared.resolve, prepared.reject);
              } catch (error) {
                prepared.reject(error);
              }
              const update = await untilAborted(
                prepared.promise,
                active!.abort.signal,
              );
              assertCurrent();
              // Consent may become durable as soon as the writer starts. No
              // cancel/check/dispose may revoke or misrepresent it from here.
              active!.committing = true;
              publish({
                phase: "committing",
                message:
                  "Saving approval and requesting installation. This step cannot be cancelled. Keep this app open.",
              });
              assertCurrent();
              await writeCoreApproval(
                options.factory,
                candidate,
                options.currentBuildId,
                (options.now ?? Date.now)(),
              );
              approvalWritten = true;
              consentPending = true;
              assertCurrent();
              // Keep both local admission and the cross-tab lock until the
              // actual registration.update request settles, including failure.
              await update();
              assertCurrent();
            },
          );
          assertCurrent();
          publish({
            phase: "approved",
            message:
              "App update approved. Close all app tabs, then reopen after installation completes.",
            canCheck: true,
            canApprove: false,
          });
        } catch (error) {
          if (!isCurrent(expected)) return;
          publish({
            phase: "failed",
            message: failureMessage(error, approvalWritten),
            canCheck: true,
            canApprove: current.candidate !== null,
          });
        } finally {
          active?.release();
          if (approval === active) approval = null;
        }
      })().then(completion.resolve, completion.reject);
      return completion.promise;
    },
    cancel() {
      if (disposed || disposal !== null || approval?.committing) return;
      invalidate();
      publish({
        ...initialView,
        phase: consentPending ? "approved" : "idle",
        message: consentPending
          ? "This attempt stopped. Previously approved build remains pending; cancellation does not revoke it."
          : "This attempt was cancelled before saving approval. Any previously approved build remains pending.",
      });
    },
    dispose() {
      if (disposal !== null) return disposal;
      // Install disposal before cancellation can notify reentrant subscribers.
      const completion = Promise.withResolvers<void>();
      disposal = completion.promise;
      if (!approval?.committing) invalidate();
      void Promise.allSettled([...tasks]).then(() => {
        disposed = true;
        listeners.clear();
        completion.resolve();
      });
      return disposal;
    },
  };
  return Object.freeze(controller);
}

/** Abort only the cancellable wait; always observe the underlying settlement. */
function untilAborted<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    void operation.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
