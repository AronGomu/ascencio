import { listen } from "@tauri-apps/api/event";
import type { CriticalSnapshot } from "../contracts/critical-snapshot.ts";
import type {
  LocalStorageClient,
  MediaWarning,
  PackageStack,
  RemovePackageResult,
} from "../contracts/storage-client.ts";
import type { StorageResult } from "../contracts/package.ts";
import { orderPackages } from "../schema/package-manifest.ts";
import { JsonUserDataStore } from "../json/user-data-store.ts";
import { createSnapshotCatalog } from "../snapshot/snapshot-catalog.ts";
import { invokeNative, nativeIoTrace } from "./invoke.ts";
import { nativeUserJsonBackend } from "./user-json-backend.ts";
import { composeMods, ModCompositionFailure } from "../mods/compose-mods.ts";
import {
  DEFAULT_MOD_PREFERENCES,
  isModPreferences,
} from "../mods/mod-preferences.ts";
import type {
  ContentComposition,
  ModLoadResult,
} from "../mods/mod-contracts.ts";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export interface StartupProgress {
  readonly sessionId: string;
  readonly phase: string;
  readonly completed: number;
  readonly total: number;
}
interface Descriptor {
  readonly sessionId: string;
  readonly generation: number;
  readonly metadataBytes: number;
  readonly engineBytes: number;
  readonly vendorManifest: string;
  readonly packages: readonly {
    readonly packageId: string;
    readonly version: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
}
let prepared: Promise<LocalStorageClient> | null = null;

export function prepareNativeStorage(
  signal: AbortSignal,
  progress: (event: StartupProgress) => void = () => {},
): Promise<LocalStorageClient> {
  prepared ??= prepare(signal, progress);
  return prepared;
}
export async function closePreparedNativeStorage(): Promise<void> {
  const current = prepared;
  prepared = null;
  if (current) {
    const client = await current.catch(() => null);
    await client?.close();
  }
}
export async function flushPreparedNativeStorage(): Promise<void> {
  if (!prepared) return;
  const client = await prepared.catch(() => null);
  if (client?.userData.persistence?.uncertain)
    throw new Error(
      "USER_SAVE_OUTCOME_UNKNOWN: restart required before saving again",
    );
  const result = await client?.userData.flush?.();
  if (result?.kind === "failed") throw new Error(result.error.code);
}
/** Explicit recovery only, after the failed attempt's content/writer handles are closed. */
export async function disableStartupMods(): Promise<void> {
  if (prepared !== null) throw new Error("APP_SESSION_ACTIVE");
  const users = new JsonUserDataStore(nativeUserJsonBackend());
  try {
    const current = await users.readUser("preferences", "content-mods");
    if (current.kind === "failed") throw new Error(current.error.code);
    const preferences = current.value?.payload ?? DEFAULT_MOD_PREFERENCES;
    if (!isModPreferences(preferences))
      throw new Error("MOD_PREFERENCES_INVALID");
    const result = await users.writeUser([
      {
        kind: "put",
        namespace: "preferences",
        key: "content-mods",
        expectedRevision: current.value?.revision ?? null,
        payload: { ...preferences, mode: "normal" },
      },
    ]);
    if (result.kind === "failed") throw new Error(result.error.code);
  } finally {
    await users.close();
  }
}
export async function openPreparedNativeStorage(): Promise<
  StorageResult<LocalStorageClient>
> {
  return {
    kind: "ok",
    value: await prepareNativeStorage(new AbortController().signal),
  };
}
async function prepare(
  signal: AbortSignal,
  progress: (event: StartupProgress) => void,
): Promise<LocalStorageClient> {
  nativeIoTrace.markStartup();
  const sessionId = crypto.randomUUID();
  let userData: JsonUserDataStore | null = null;
  let finished = false;
  let nativeLoading = true;
  const cancel = () => {
    void invokeNative("native_startup_cancel", { sessionId }).catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const unlisten = await listen<StartupProgress>(
    "startup-progress",
    (event) => {
      if (
        nativeLoading &&
        event.payload.sessionId === sessionId &&
        !signal.aborted
      )
        progress(event.payload);
    },
  );
  try {
    signal.throwIfAborted();
    const descriptor = await invokeNative<Descriptor>("native_startup_load", {
      sessionId,
    });
    nativeLoading = false;
    signal.throwIfAborted();
    if (
      descriptor.sessionId !== sessionId ||
      descriptor.metadataBytes > 256 * 1024 * 1024 ||
      descriptor.engineBytes > 16 * 1024 * 1024
    )
      throw new Error("STARTUP_TRANSFER_INVALID");
    const [raw, wasm] = await Promise.all([
      invokeNative<ArrayBuffer>("native_startup_metadata", { sessionId }),
      invokeNative<ArrayBuffer>("native_startup_engine", { sessionId }),
    ]);
    signal.throwIfAborted();
    if (
      !(raw instanceof ArrayBuffer) ||
      raw.byteLength !== descriptor.metadataBytes ||
      !(wasm instanceof ArrayBuffer) ||
      wasm.byteLength !== descriptor.engineBytes
    )
      throw new Error("STARTUP_TRANSFER_INVALID");
    let snapshots = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(raw),
    ) as CriticalSnapshot[];
    if (
      !Array.isArray(snapshots) ||
      snapshots.length !== descriptor.packages.length ||
      snapshots.length > 64
    )
      throw new Error("BASE_ENVELOPE_INVALID");
    const graph = orderPackages(
      snapshots.map((s) => s.manifest),
      [],
    );
    if (graph.kind === "failed") throw new Error(graph.error.code);
    let stack: PackageStack = Object.freeze({
      generation: descriptor.generation,
      packages: Object.freeze(
        snapshots.map((snapshot) => {
          const receipt = descriptor.packages.find(
            (p) => p.packageId === snapshot.manifest.packageId,
          );
          if (!receipt || receipt.version !== snapshot.manifest.version)
            throw new Error("BASE_ENVELOPE_INVALID");
          return Object.freeze({
            ...snapshot.manifest,
            fileKey: `snapshot:${receipt.packageId}`,
            bytes: receipt.bytes,
            sha256: receipt.sha256,
          });
        }),
      ),
    });
    progress({ sessionId, phase: "user-state", completed: 0, total: 1 });
    userData = new JsonUserDataStore(nativeUserJsonBackend());
    const initialized = await userData.initialize();
    if (initialized.kind === "failed")
      throw (
        userData.initializationError ??
        new Error(`${initialized.error.code}: user-data.json`)
      );
    signal.throwIfAborted();
    const preferences = await userData.readUser("preferences", "content-mods");
    if (preferences.kind === "failed") throw new Error(preferences.error.code);
    const mods = preferences.value?.payload ?? DEFAULT_MOD_PREFERENCES;
    if (!isModPreferences(mods)) throw new Error("MOD_PREFERENCES_INVALID");
    const baseIdentities = descriptor.packages.map(
      (p) => `${p.packageId}:${p.version}:${p.sha256}`,
    );
    progress({ sessionId, phase: "user-state", completed: 1, total: 1 });
    let composition: ContentComposition = {
      identity: bytesToHex(
        sha256(new TextEncoder().encode(JSON.stringify(baseIdentities.sort()))),
      ),
      requiredMods: [],
    };
    if (mods.mode === "modded") {
      progress({
        sessionId,
        phase: "mod-composition",
        completed: 0,
        total: 3,
      });
      const loaded = await invokeNative<ModLoadResult>("native_mods_load", {
        sessionId,
        preferences: mods,
      });
      signal.throwIfAborted();
      if (loaded.diagnostics.length)
        throw new ModCompositionFailure(
          loaded.droppedDiagnostics
            ? [
                ...loaded.diagnostics,
                {
                  code: "DIAGNOSTICS_TRUNCATED",
                  severity: "warning",
                  phase: "mod-composition",
                  message: `${loaded.droppedDiagnostics} further mod diagnostics suppressed.`,
                  notes: [],
                  causes: [],
                  remediation: "Correct reported errors and retry.",
                },
              ]
            : loaded.diagnostics,
        );
      progress({ sessionId, phase: "mod-composition", completed: 1, total: 3 });
      const composed = composeMods(snapshots, loaded.mods, baseIdentities);
      progress({ sessionId, phase: "mod-composition", completed: 2, total: 3 });
      snapshots = composed.packs;
      composition = composed.composition;
      await invokeNative("native_mods_activate", {
        sessionId,
        owners: composed.mediaOwners,
      });
      signal.throwIfAborted();
      progress({ sessionId, phase: "mod-composition", completed: 3, total: 3 });
      if (composition.requiredMods.length)
        stack = Object.freeze({
          generation: Number.parseInt(composition.identity.slice(0, 12), 16),
          packages: Object.freeze(
            stack.packages.map((p) =>
              Object.freeze({
                ...p,
                sha256: bytesToHex(
                  sha256(
                    new TextEncoder().encode(
                      `${p.sha256}:${composition.identity}`,
                    ),
                  ),
                ),
              }),
            ),
          ),
        });
    }
    const listeners = new Set<(warning: MediaWarning) => void>();
    const warnings = new Set<string>();
    const executable = new Map([
      [
        "duel-core:engine/ocgcore.sync.wasm",
        { mime: "application/wasm", bytes: new Uint8Array(wasm) },
      ],
      [
        "duel-core:engine/vendor-manifest.json",
        {
          mime: "application/json",
          bytes: new TextEncoder().encode(descriptor.vendorManifest),
        },
      ],
    ]);
    progress({
      sessionId,
      phase: "domain-projections",
      completed: 0,
      total: 1,
    });
    const content = createSnapshotCatalog(
      snapshots,
      async (packageId, mapping, accessSignal) => {
        accessSignal.throwIfAborted();
        try {
          const bytes = await invokeNative<ArrayBuffer>(
            "native_live_media_read",
            { sessionId, packageId, logicalId: mapping.id },
          );
          accessSignal.throwIfAborted();
          if (
            !(bytes instanceof ArrayBuffer) ||
            bytes.byteLength > 64 * 1024 * 1024
          )
            return null;
          return { mime: mapping.mime, bytes: new Uint8Array(bytes) };
        } catch (error) {
          if (accessSignal.aborted) throw error;
          const key = `${packageId}:${mapping.id}`;
          if (warnings.size < 256 && !warnings.has(key)) {
            warnings.add(key);
            for (const listener of listeners)
              listener({ packageId, path: mapping.id, reason: "unreadable" });
          }
          return null;
        }
      },
      executable,
      async (packageId, mapping, accessSignal) => {
        accessSignal.throwIfAborted();
        const revision = await invokeNative<string | null>(
          "native_live_media_revision",
          { sessionId, packageId, logicalId: mapping.id },
        );
        accessSignal.throwIfAborted();
        return revision;
      },
    );
    progress({
      sessionId,
      phase: "domain-projections",
      completed: 1,
      total: 1,
    });
    let closed = false,
      leases = 0;
    let closing: Promise<void> | null = null;
    const unavailable = <T>(): StorageResult<T> => ({
      kind: "failed",
      error: { code: closed ? "STORAGE_UNAVAILABLE" : "APP_SESSION_ACTIVE" },
    });
    const users = userData;
    let maintenanceGeneration = descriptor.generation;
    const maintenance = async <T>(
      operation: string,
      extras: Record<string, unknown> = {},
    ): Promise<StorageResult<T>> => {
      if (closed) return unavailable();
      if (leases)
        return { kind: "failed", error: { code: "APP_SESSION_ACTIVE" } };
      try {
        return {
          kind: "ok",
          value: await invokeNative<T>("native_critical_maintenance", {
            sessionId,
            operation,
            expectedGeneration: maintenanceGeneration,
            ...extras,
          }),
        };
      } catch (error) {
        const code = String(error).split(":")[0];
        const known = [
          "STORAGE_CONFLICT",
          "PACKAGE_INVALID",
          "PACKAGE_INTEGRITY_FAILED",
          "PACKAGE_REFERENCED",
          "PACKAGE_NOT_FOUND",
          "PACKAGE_SOURCE_INCOMPLETE",
        ] as const;
        return {
          kind: "failed",
          error: {
            code:
              known.find((value) => value === code) ?? "STORAGE_UNAVAILABLE",
          },
        };
      }
    };
    const acceptStack = (next: PackageStack) => {
      stack = next;
      maintenanceGeneration = next.generation;
    };
    const client: LocalStorageClient = {
      preparedRequirements: [
        "critical-content",
        "user-state",
        "mod-composition",
      ],
      composition,
      content: {
        mediaRevision: (request, accessSignal) =>
          closed
            ? Promise.resolve(null)
            : content.mediaRevision!(request, accessSignal),
        query: (request, querySignal) =>
          closed
            ? Promise.resolve(unavailable())
            : content.query(request, querySignal),
      },
      userData: users,
      packages: {
        current: async () =>
          closed ? unavailable() : { kind: "ok", value: stack },
        acquireSession: async () => {
          if (closed) return unavailable();
          leases++;
          let released = false;
          return {
            kind: "ok",
            value: {
              generation: stack.generation,
              release: async () => {
                if (!released) {
                  released = true;
                  leases--;
                }
              },
            },
          };
        },
        importPackages: async (
          files,
          expectedGeneration,
          importSignal,
          report,
        ) => {
          if (importSignal.aborted)
            return { kind: "failed", error: { code: "OPERATION_CANCELLED" } };
          if (expectedGeneration !== stack.generation)
            return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
          if (
            files.length > 64 ||
            files.reduce((size, file) => size + file.size, 0) >
              256 * 1024 * 1024
          )
            return { kind: "failed", error: { code: "PACKAGE_INVALID" } };
          const sources: string[] = [];
          for (const file of files) {
            importSignal.throwIfAborted();
            sources.push(await file.text());
            report({
              operationId: sessionId,
              phase: "validating",
              fileName: file.name,
              copiedBytes: file.size,
              totalBytes: file.size,
            });
          }
          importSignal.throwIfAborted();
          const result = await maintenance<PackageStack>("import", { sources });
          if (result.kind === "ok") acceptStack(result.value);
          return result;
        },
        removePackage: async (packageId, expectedGeneration) => {
          if (expectedGeneration !== stack.generation)
            return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
          const result = await maintenance<RemovePackageResult>("remove", {
            packageId,
          });
          if (result.kind === "ok") acceptStack(result.value.stack);
          return result;
        },
        cleanupUnused: async () => maintenance("cleanup"),
        verifyInstalled: async (verifySignal) =>
          verifySignal.aborted
            ? { kind: "failed", error: { code: "OPERATION_CANCELLED" } }
            : maintenance<PackageStack>("verify"),
      },
      subscribeMediaWarnings: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close() {
        closing ??= (async () => {
          closed = true;
          listeners.clear();
          try {
            await users.close();
          } finally {
            await invokeNative("native_startup_close", { sessionId });
          }
        })();
        return closing;
      },
    };
    // Track leases to retain the admission invariant; lifecycle mutation remains startup-only.
    void leases;
    finished = true;
    return client;
  } catch (error) {
    try {
      await userData?.close();
    } finally {
      await invokeNative("native_startup_close", { sessionId }).catch(() => {});
    }
    throw error;
  } finally {
    unlisten();
    signal.removeEventListener("abort", cancel);
    if (!finished && signal.aborted) cancel();
  }
}
