import { invoke } from "@tauri-apps/api/core";
import type {
  ContentQuery,
  LocalStorageClient,
  MediaWarning,
  PackageStack,
  QueryMap,
} from "../contracts/storage-client.ts";
import type { StorageResult } from "../contracts/package.ts";
import type {
  BackupPreview,
  UserMutation,
  UserRecord,
} from "../contracts/user-data.ts";
import { validateUserRecordPayload } from "../schema/user-record-validation.ts";
import {
  isUserNamespace,
  payloadRevisionMatches,
  validUserKey,
} from "../runtime/user-data-validation.ts";
import { validQuery } from "../runtime/content-query-runtime.ts";
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

function validRecord(record: UserRecord): boolean {
  return (
    isUserNamespace(record.namespace) &&
    validUserKey(record.key) &&
    Number.isSafeInteger(record.revision) &&
    record.revision >= 1 &&
    validateUserRecordPayload(record.namespace, record.key, record.payload)
      .kind === "ok" &&
    payloadRevisionMatches(record.namespace, record.payload, record.revision)
  );
}

export async function openNativeStorage(): Promise<
  StorageResult<LocalStorageClient>
> {
  const initial = await call<PackageStack>("native_package_stack", {
    verify: false,
  });
  if (initial.kind === "failed") return initial;
  const mediaListeners = new Set<(warning: MediaWarning) => void>();
  const sessions = new Set<string>();
  const stagedBackups = new Set<string>();
  let closed = false;
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
        acquireSession: async () => {
          if (closed) return unavailable();
          const acquired = await guard<{
            sessionId: string;
            generation: number;
          }>("native_package_acquire");
          if (acquired.kind === "failed") return acquired;
          sessions.add(acquired.value.sessionId);
          let released = false;
          return {
            kind: "ok",
            value: {
              generation: acquired.value.generation,
              release: async () => {
                if (released) return;
                released = true;
                sessions.delete(acquired.value.sessionId);
                await invoke("native_package_release", {
                  sessionId: acquired.value.sessionId,
                });
              },
            },
          };
        },
      },
      content: {
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
            (request.kind === "asset" || request.kind === "set-image")
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
                      path: `sets/${request.setId}`,
                      reason: "missing",
                    };
              for (const listener of mediaListeners) listener(warning);
            }
          }
          return result;
        },
      },
      userData: {
        readUser: async (namespace, key) => {
          if (!isUserNamespace(namespace) || !validUserKey(key))
            return failed("USER_DATA_INVALID");
          const result = await guard<UserRecord | null>("native_user_read", {
            namespace,
            key,
          });
          return result.kind === "ok" &&
            result.value !== null &&
            !validRecord(result.value)
            ? failed("USER_DATA_INVALID")
            : result;
        },
        listUser: async (namespace) => {
          if (!isUserNamespace(namespace)) return failed("USER_DATA_INVALID");
          const result = await guard<readonly UserRecord[]>(
            "native_user_list",
            { namespace },
          );
          return result.kind === "ok" && !result.value.every(validRecord)
            ? failed("USER_DATA_INVALID")
            : result;
        },
        writeUser: async (mutations: readonly UserMutation[]) => {
          if (!Array.isArray(mutations)) return failed("USER_DATA_INVALID");
          for (const mutation of mutations) {
            if (
              !isUserNamespace(mutation.namespace) ||
              !validUserKey(mutation.key)
            )
              return failed("USER_DATA_INVALID");
            if (mutation.kind === "put") {
              if (
                validateUserRecordPayload(
                  mutation.namespace,
                  mutation.key,
                  mutation.payload,
                ).kind === "failed"
              )
                return failed("USER_DATA_INVALID");
              const nextRevision = (mutation.expectedRevision ?? 0) + 1;
              if (
                !Number.isSafeInteger(nextRevision) ||
                !payloadRevisionMatches(
                  mutation.namespace,
                  mutation.payload,
                  nextRevision,
                )
              )
                return failed("USER_DATA_INVALID");
            }
          }
          const result = await guard<readonly UserRecord[]>(
            "native_user_write",
            { mutations },
          );
          return result.kind === "ok" && !result.value.every(validRecord)
            ? failed("USER_DATA_INVALID")
            : result;
        },
        exportUserData: async () => {
          if (closed) return unavailable();
          try {
            const bytes = await invoke<ArrayBuffer>("native_user_export");
            return {
              kind: "ok",
              value: new File([bytes], "user-data.sqlite", {
                type: "application/vnd.sqlite3",
              }),
            };
          } catch {
            return failed("USER_DATA_INVALID");
          }
        },
        inspectUserDataBackup: async (
          file,
        ): Promise<StorageResult<BackupPreview>> => {
          await Promise.all(
            [...stagedBackups].map(async (token) => {
              stagedBackups.delete(token);
              await invoke("native_user_discard", { token });
            }),
          );
          if (file.size > 256 * 1024 * 1024)
            return { kind: "failed", error: { code: "USER_DATA_TOO_LARGE" } };
          const result = await invoke<
            StorageResult<BackupPreview & { rows: UserRecord[] }>
          >(
            "native_user_inspect",
            new Uint8Array(await file.arrayBuffer()),
          ).catch(() =>
            failed<BackupPreview & { rows: UserRecord[] }>(
              "STORAGE_UNAVAILABLE",
            ),
          );
          if (result.kind === "failed") return result;
          const { rows, ...preview } = result.value;
          if (!Array.isArray(rows) || !rows.every(validRecord)) {
            await invoke("native_user_discard", { token: preview.token });
            return failed("USER_DATA_INVALID");
          }
          stagedBackups.add(preview.token);
          return { kind: "ok", value: preview };
        },
        restoreUserData: async (token, expectedRevision, confirmed) => {
          stagedBackups.delete(token);
          return await guard("native_user_restore", {
            token,
            expectedRevision,
            confirmed,
          });
        },
      },
      subscribeMediaWarnings: (listener) => {
        mediaListeners.add(listener);
        return () => mediaListeners.delete(listener);
      },
      close: async () => {
        closed = true;
        mediaListeners.clear();
        await Promise.all(
          [...sessions].map(async (sessionId) => {
            sessions.delete(sessionId);
            await invoke("native_package_release", { sessionId });
          }),
        );
        await Promise.all(
          [...stagedBackups].map(async (token) => {
            stagedBackups.delete(token);
            await invoke("native_user_discard", { token });
          }),
        );
      },
    },
  };
}
