import { JsonUserDataStore } from "../json/user-data-store.ts";
import { createSnapshotCatalog } from "../snapshot/snapshot-catalog.ts";
import { GameContentReader } from "../transport/game-content-reader.ts";
import { parseContentDescriptor } from "../transport/content-descriptor.ts";
import { loadGameContent } from "../transport/load-game-content.ts";
import type { StartupProgress } from "../native/prepared-storage.ts";
import type {
  LocalStorageClient,
  MediaWarning,
} from "../contracts/storage-client.ts";
import type { StorageResult } from "../contracts/package.ts";
import { browserUserJsonBackend } from "./user-json-backend.ts";

let prepared: Promise<LocalStorageClient> | null = null;

export function prepareBrowserStorage(
  signal: AbortSignal,
  progress: (event: StartupProgress) => void = () => {},
): Promise<LocalStorageClient> {
  prepared ??= prepare(signal, progress);
  return prepared;
}

export async function closePreparedBrowserStorage(): Promise<void> {
  const current = prepared;
  prepared = null;
  if (current) await (await current.catch(() => null))?.close();
}

export async function flushPreparedBrowserStorage(): Promise<void> {
  if (!prepared) return;
  const client = await prepared.catch(() => null);
  const result = await client?.userData.flush?.();
  if (result?.kind === "failed") throw new Error(result.error.code);
}

async function prepare(
  signal: AbortSignal,
  progress: (event: StartupProgress) => void,
): Promise<LocalStorageClient> {
  const root = new GameContentReader(
    `${import.meta.env.BASE_URL}game-content/`,
  );
  const descriptor = parseContentDescriptor(
    await root.json("startup.json", signal, 1024 * 1024),
  );
  const reader = new GameContentReader(
    `${import.meta.env.BASE_URL}game-content/${descriptor.sessionId}/`,
  );
  progress({
    sessionId: descriptor.sessionId,
    phase: "verification",
    completed: 0,
    total: 1,
  });
  const loaded = await loadGameContent(reader, descriptor, signal);
  progress({
    sessionId: descriptor.sessionId,
    phase: "verification",
    completed: 1,
    total: 1,
  });
  const userData = new JsonUserDataStore(browserUserJsonBackend());
  const listeners = new Set<(warning: MediaWarning) => void>();
  const warned = new Set<string>();
  let closed = false;
  const unavailable = <T>(): StorageResult<T> => ({
    kind: "failed",
    error: { code: "STORAGE_UNAVAILABLE" },
  });
  try {
    const initialized = await userData.initialize();
    if (initialized.kind === "failed")
      throw userData.initializationError ?? new Error(initialized.error.code);
    signal.throwIfAborted();
    const catalog = createSnapshotCatalog(
      loaded.snapshots,
      async (packageId, mapping, accessSignal) => {
        const asset = await reader.media(packageId, mapping, accessSignal);
        const key = `${packageId}:${mapping.id}`;
        if (!asset && !warned.has(key) && warned.size < 256) {
          warned.add(key);
          for (const listener of listeners)
            listener({ packageId, path: mapping.id, reason: "unreadable" });
        }
        return asset;
      },
      loaded.executable,
    );
    progress({
      sessionId: descriptor.sessionId,
      phase: "user-state",
      completed: 1,
      total: 1,
    });
    return {
      preparedRequirements: [
        "critical-content",
        "user-state",
        "mod-composition",
      ],
      composition: loaded.composition,
      content: {
        query: (request, querySignal) =>
          closed
            ? Promise.resolve(unavailable())
            : catalog.query(request, querySignal),
      },
      userData,
      packages: {
        current: async () =>
          closed ? unavailable() : { kind: "ok", value: loaded.stack },
        acquireSession: async () =>
          closed
            ? unavailable()
            : {
                kind: "ok",
                value: {
                  generation: loaded.stack.generation,
                  release: async () => {},
                },
              },
        importPackages: async () => unavailable(),
        removePackage: async () => unavailable(),
        cleanupUnused: async () => unavailable(),
        verifyInstalled: async () => unavailable(),
      },
      subscribeMediaWarnings(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      async close() {
        if (closed) return;
        closed = true;
        listeners.clear();
        await userData.close();
      },
    };
  } catch (error) {
    await userData.close();
    throw error;
  }
}
