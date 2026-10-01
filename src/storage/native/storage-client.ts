import { createModuleCatalogQueries } from "../modules/catalog-queries.ts";
import { invoke } from "@tauri-apps/api/core";
import type {
  ContentQuery,
  LocalStorageClient,
  MediaWarning,
  PackageStack,
  QueryMap,
} from "../contracts/storage-client.ts";
import type { StorageResult } from "../contracts/package.ts";
import { JsonUserDataStore } from "../json/user-data-store.ts";
import { nativeUserJsonBackend } from "./user-json-backend.ts";
import { validQuery } from "../contracts/validate-content-query.ts";
import {
  orderPackages,
  parsePackageManifest,
} from "../schema/package-manifest.ts";
import type { PackageManifest } from "../contracts/package.ts";

function failed<T>(
  code: "STORAGE_UNAVAILABLE" | "OPERATION_CANCELLED" | "USER_DATA_INVALID",
): StorageResult<T> {
  return { kind: "failed", error: { code } };
}

async function call<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<StorageResult<T>> {
  try {
    return await invoke<StorageResult<T>>(command, args);
  } catch {
    return failed("STORAGE_UNAVAILABLE");
  }
}

export async function openNativeStorage(): Promise<
  StorageResult<LocalStorageClient>
> {
  const initial = await call<PackageStack>("native_package_stack", {
    verify: false,
  });
  if (initial.kind === "failed") return initial;
  const mediaListeners = new Set<(warning: MediaWarning) => void>();
  const sessions = new Map<string, () => Promise<void>>();
  const acquisitions = new Set<Promise<unknown>>();
  let closed = false;
  let closing: Promise<void> | null = null;
  const userData = new JsonUserDataStore(nativeUserJsonBackend());
  const unavailable = <T>(): StorageResult<T> => failed("STORAGE_UNAVAILABLE");
  const guard = async <T>(
    command: string,
    args: Record<string, unknown> = {},
  ): Promise<StorageResult<T>> =>
    closed ? unavailable() : await call<T>(command, args);
  return {
    kind: "ok",
    value: {
      packages: {
        current: async () =>
          await guard("native_package_stack", { verify: false }),
        importPackages: async (files, expectedGeneration, signal, progress) => {
          if (closed) return unavailable();
          if (signal.aborted) return failed("OPERATION_CANCELLED");
          if (files.length === 0)
            return {
              kind: "failed",
              error: { code: "PACKAGE_SOURCE_INCOMPLETE" },
            };
          const begun = await guard<{ token: string }>("native_import_begin", {
            sizes: files.map((file) => file.size),
            expectedGeneration,
          });
          if (begun.kind === "failed") return begun;
          const token = begun.value.token;
          try {
            for (const [index, file] of files.entries()) {
              let copiedBytes = 0;
              while (copiedBytes < file.size) {
                if (signal.aborted) return failed("OPERATION_CANCELLED");
                const chunk = new Uint8Array(
                  await file
                    .slice(copiedBytes, copiedBytes + 1024 * 1024)
                    .arrayBuffer(),
                );
                const result = await invoke<
                  StorageResult<{ copiedBytes: number }>
                >("native_import_chunk", chunk, {
                  headers: {
                    "x-content-token": token,
                    "x-content-index": String(index),
                  },
                }).catch(() =>
                  failed<{ copiedBytes: number }>("STORAGE_UNAVAILABLE"),
                );
                if (result.kind === "failed") return result;
                copiedBytes = result.value.copiedBytes;
                progress({
                  operationId: token,
                  phase: "copying",
                  fileName: file.name,
                  copiedBytes,
                  totalBytes: file.size,
                });
              }
            }
            progress({
              operationId: token,
              phase: "validating",
              fileName: files[0]!.name,
              copiedBytes: files.reduce((sum, file) => sum + file.size, 0),
              totalBytes: files.reduce((sum, file) => sum + file.size, 0),
            });
            const preview = await guard<readonly { manifest: unknown }[]>(
              "native_import_preview",
              { token },
            );
            if (preview.kind === "failed") return preview;
            const selected: PackageManifest[] = [];
            for (const entry of preview.value) {
              const parsed = parsePackageManifest(entry.manifest);
              if (parsed.kind === "failed") return parsed;
              selected.push(parsed.value);
            }
            const current = await guard<PackageStack>("native_package_stack", {
              verify: false,
            });
            if (current.kind === "failed") return current;
            const ordered = orderPackages(selected, current.value.packages);
            if (ordered.kind === "failed") return ordered;
            if (signal.aborted) return failed("OPERATION_CANCELLED");
            progress({
              operationId: token,
              phase: "committing",
              fileName: files[0]!.name,
              copiedBytes: 0,
              totalBytes: 0,
            });
            const committed = await guard<{ committed: true }>(
              "native_import_commit",
              { token },
            );
            if (committed.kind === "failed") return committed;
            return await guard<PackageStack>("native_package_stack", {
              verify: false,
            });
          } finally {
            await invoke("native_import_cancel", { token }).catch(() => {});
          }
        },
        verifyInstalled: async (signal) =>
          signal.aborted
            ? failed("OPERATION_CANCELLED")
            : await guard("native_package_stack", { verify: true }),
        removePackage: async (packageId, expectedGeneration) => {
          const removed = await guard<{ cleanupPending: boolean }>(
            "native_package_remove",
            { packageId, expectedGeneration },
          );
          if (removed.kind === "failed") return removed;
          const stack = await guard<PackageStack>("native_package_stack", {
            verify: false,
          });
          return stack.kind === "failed"
            ? stack
            : {
                kind: "ok",
                value: {
                  stack: stack.value,
                  cleanupPending: removed.value.cleanupPending,
                },
              };
        },
        cleanupUnused: async () => await guard("native_package_cleanup"),
        acquireSession: () => {
          if (closed) return Promise.resolve(unavailable());
          const acquisition = (async (): ReturnType<
            LocalStorageClient["packages"]["acquireSession"]
          > => {
            const acquired = await guard<{
              sessionId: string;
              generation: number;
            }>("native_package_acquire");
            if (acquired.kind === "failed") return acquired;
            const { sessionId, generation } = acquired.value;
            let releasing: Promise<void> | null = null;
            const release = (): Promise<void> =>
              (releasing ??= (async () => {
                await invoke("native_package_release", { sessionId });
                sessions.delete(sessionId);
              })());
            sessions.set(sessionId, release);
            // Close drains this acquisition and owns cleanup of its late lease.
            return closed
              ? unavailable()
              : { kind: "ok", value: { generation, release } };
          })();
          acquisitions.add(acquisition);
          void acquisition.then(
            () => acquisitions.delete(acquisition),
            () => acquisitions.delete(acquisition),
          );
          return acquisition;
        },
      },
      content: createModuleCatalogQueries(
        {
          query: async <Q extends ContentQuery>(
            request: Q,
            signal: AbortSignal,
          ): Promise<StorageResult<QueryMap[Q["kind"]]>> => {
            if (closed) return unavailable();
            if (signal.aborted) return failed("OPERATION_CANCELLED");
            if (!validQuery(request))
              return { kind: "failed", error: { code: "RPC_INVALID" } };
            const result = await guard<QueryMap[Q["kind"]]>(
              "native_content_query",
              { request },
            );
            if (
              result.kind === "ok" &&
              (request.kind === "asset" ||
                request.kind === "set-image" ||
                (request.kind === "module-query" &&
                  request.query.kind === "set-image"))
            ) {
              const media = result.value as QueryMap["asset"];
              if (media !== null) {
                const raw = media.bytes as unknown;
                if (!Array.isArray(raw))
                  return { kind: "failed", error: { code: "PACKAGE_INVALID" } };
                (media as { bytes: Uint8Array }).bytes = Uint8Array.from(raw);
              } else {
                const warning: MediaWarning =
                  request.kind === "asset"
                    ? {
                        packageId: request.packageId,
                        path: request.path,
                        reason: "missing",
                      }
                    : {
                        packageId: "card-library",
                        path: `sets/${request.kind === "module-query" ? (request.query as Extract<ContentQuery, { kind: "set-image" }>).setId : request.setId}`,
                        reason: "missing",
                      };
                for (const listener of mediaListeners) listener(warning);
              }
            }
            return result;
          },
        },
        async () => guard("native_package_stack", { verify: false }),
      ),
      userData,
      subscribeMediaWarnings: (listener) => {
        mediaListeners.add(listener);
        return () => mediaListeners.delete(listener);
      },
      close: () => {
        if (closing !== null) return closing;
        closed = true;
        mediaListeners.clear();
        closing = (async () => {
          const drained = await Promise.allSettled([
            userData.close(),
            ...acquisitions,
          ]);
          const released = await Promise.allSettled(
            [...sessions.values()].map((release) => release()),
          );
          for (const result of [...drained, ...released])
            if (result.status === "rejected") throw result.reason;
        })();
        return closing;
      },
    },
  };
}
