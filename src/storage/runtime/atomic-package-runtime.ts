import {
  validateCommerceStack,
  type CommerceContent,
} from "../../modules/index.ts";
import { validateModuleCatalogs } from "../modules/catalog-validation.ts";
import {
  isQuota,
  packageDatabaseFailure,
} from "../schema/package-database-failure.ts";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type {
  ActivePackage,
  ContentQuery,
  ImportProgress,
  MediaWarning,
  PackageStack,
  QueryMap,
  RemovePackageResult,
} from "../contracts/storage-client.ts";
import type {
  PackageId,
  PackageManifest,
  StorageFailure,
  StorageResult,
} from "../contracts/package.ts";
import {
  orderPackages,
  parsePackageManifest,
} from "../schema/package-manifest.ts";
import { validatePackageDatabaseHeader } from "../schema/package-database.ts";
import type { RuntimeDatabase, RuntimeFileStore } from "./runtime-ports.ts";
import { queryContent, validQuery } from "./content-query-runtime.ts";
import {
  FILE_CHUNK_BYTES,
  validateRuntimePackage,
  type ValidatedRuntimePackage,
} from "./package-validation.ts";
import {
  inspectPackageImportSourceHeader,
  isPackageArchiveError,
  resolvePackageImportSources,
} from "./package-import-selection.ts";

export interface AtomicPackageRuntimeOptions {
  readonly registry: RuntimeDatabase;
  readonly files: RuntimeFileStore;
  readonly now: () => string;
  readonly randomId: () => string;
  readonly fault?: ((point: string) => void) | undefined;
  readonly estimate?: ((bytes: number) => Promise<boolean>) | undefined;
  readonly mediaWarning?: ((warning: MediaWarning) => void) | undefined;
}

interface StagedPackage extends ActivePackage {
  readonly config: ValidatedRuntimePackage["config"];
}

export class AtomicPackageRuntime {
  readonly #registry: RuntimeDatabase;
  readonly #files: RuntimeFileStore;
  readonly #now: () => string;
  readonly #randomId: () => string;
  readonly #fault: (point: string) => void;
  readonly #estimate: (bytes: number) => Promise<boolean>;
  readonly #mediaWarning: (warning: MediaWarning) => void;
  #leases = 0;
  #closed = false;
  #operationSequence = 0;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(options: AtomicPackageRuntimeOptions) {
    this.#registry = options.registry;
    this.#files = options.files;
    this.#now = options.now;
    this.#randomId = options.randomId;
    this.#fault = options.fault ?? (() => {});
    this.#estimate = options.estimate ?? (async () => true);
    this.#mediaWarning = options.mediaWarning ?? (() => {});
  }

  async current(): Promise<StorageResult<PackageStack>> {
    if (this.#closed) return failed("STORAGE_UNAVAILABLE");
    try {
      return this.#readStack();
    } catch {
      return failed("STORAGE_UNAVAILABLE");
    }
  }

  async importPackages(
    files: readonly File[],
    expectedGeneration: number,
    signal: AbortSignal,
    progress: (event: ImportProgress) => void,
  ): Promise<StorageResult<PackageStack>> {
    return await this.#serialize(async () => {
      if (this.#closed) return failed("STORAGE_UNAVAILABLE");
      if (this.#leases > 0) return failed("APP_SESSION_ACTIVE");
      if (
        !Number.isSafeInteger(expectedGeneration) ||
        expectedGeneration < 0 ||
        files.length === 0
      )
        return failed("RPC_INVALID");
      if (signal.aborted) return failed("OPERATION_CANCELLED");
      let operationId = "";
      const stagedKeys: string[] = [];
      let committed = false;
      try {
        operationId = this.#nextOperationId();
        const stackResult = this.#readStack();
        if (stackResult.kind === "failed") return stackResult;
        if (stackResult.value.generation !== expectedGeneration)
          return failed("STORAGE_CONFLICT");
        const resolved = await resolvePackageImportSources(files);
        if (resolved.kind === "failed") return resolved;
        const sources = resolved.value;
        let selectedBytes = 0;
        for (const source of sources) {
          const header = await inspectPackageImportSourceHeader(source);
          if (header.kind === "failed") return header;
          selectedBytes += source.size;
          if (!Number.isSafeInteger(selectedBytes))
            return failed("STORAGE_QUOTA_EXCEEDED");
        }
        if (!(await this.#estimate(selectedBytes + 8 * 1024 * 1024)))
          return failed("STORAGE_QUOTA_EXCEEDED");
        await this.#files.reserveMinimumCapacity(
          (stackResult.value.packages.length + sources.length + 1) * 3 + 1,
        );
        this.#fault("before-copy");
        const staged: StagedPackage[] = [];
        for (let index = 0; index < sources.length; index += 1) {
          const source = sources[index]!;
          const key = `/imports/${operationId}/${index}.partial`;
          stagedKeys.push(key);
          const hasher = sha256.create();
          let offset = 0;
          progressEvent(
            progress,
            operationId,
            "copying",
            source.name,
            0,
            source.size,
          );
          const reader = (await source.open()).getReader();
          let remainder: Uint8Array | null = null;
          let bytes: number;
          try {
            bytes = await this.#files.importDatabase(key, async () => {
              if (signal.aborted) throw cancelledError();
              let chunk: Uint8Array;
              if (remainder !== null) {
                chunk = remainder.subarray(0, FILE_CHUNK_BYTES);
                remainder =
                  chunk.byteLength === remainder.byteLength
                    ? null
                    : remainder.subarray(chunk.byteLength);
              } else {
                const result = await reader.read();
                if (result.done) return undefined;
                chunk = result.value.subarray(0, FILE_CHUNK_BYTES);
                if (chunk.byteLength < result.value.byteLength)
                  remainder = result.value.subarray(chunk.byteLength);
              }
              hasher.update(chunk);
              offset += chunk.byteLength;
              progressEvent(
                progress,
                operationId,
                "copying",
                source.name,
                offset,
                source.size,
              );
              return chunk;
            });
          } catch (error) {
            await reader.cancel().catch(() => undefined);
            throw error;
          } finally {
            reader.releaseLock();
          }
          if (bytes !== source.size || offset !== source.size) {
            console.error("Package copy byte count mismatch", {
              name: source.name,
              sourceSize: source.size,
              importedBytes: bytes,
              streamedBytes: offset,
            });
            return failed("PACKAGE_INTEGRITY_FAILED");
          }
          progressEvent(
            progress,
            operationId,
            "validating",
            source.name,
            bytes,
            source.size,
          );
          let database: RuntimeDatabase | null = null;
          let validated: StorageResult<ValidatedRuntimePackage>;
          try {
            database = this.#files.openDatabase(key);
            validated = validateRuntimePackage(database);
          } catch (error) {
            console.error("Package database open or validation failed", error);
            return packageDatabaseFailure(error);
          } finally {
            database?.close();
          }
          if (validated.kind === "failed") {
            console.error("Package database validation rejected the import", {
              name: source.name,
              error: validated.error,
            });
            return validated;
          }
          staged.push({
            ...validated.value.manifest,
            config: validated.value.config,
            fileKey: key,
            bytes,
            sha256: bytesToHex(hasher.digest()),
          });
        }
        const ids = staged.map(({ packageId }) => packageId);
        if (new Set(ids).size !== ids.length)
          return failed("PACKAGE_DUPLICATE");
        const installed = stackResult.value.packages;
        for (const item of staged) {
          const existing = installed.find(
            ({ packageId }) => packageId === item.packageId,
          );
          if (
            existing?.version === item.version &&
            existing.sha256 !== item.sha256
          )
            return failed("PACKAGE_IDENTITY_CONFLICT", {
              packageId: item.packageId,
            });
        }
        const selectedForActivation = staged.filter((item) => {
          const existing = installed.find(
            ({ packageId }) => packageId === item.packageId,
          );
          return !(
            existing?.version === item.version &&
            existing.sha256 === item.sha256
          );
        });
        const ordered = orderPackages(
          staged.map(manifestOnly),
          installed.map(manifestOnly),
        );
        if (ordered.kind === "failed") return ordered;
        const candidate = new Map<PackageId, StagedPackage | ActivePackage>(
          installed.map((item) => [item.packageId, item]),
        );
        for (const item of staged) candidate.set(item.packageId, item);
        const crossResult = this.#validateCandidate(candidate, signal);
        if (crossResult.kind === "failed") return crossResult;
        this.#fault("after-validation");
        if (selectedForActivation.length === 0) return stackResult;
        this.#fault("before-commit");
        if (signal.aborted) return failed("OPERATION_CANCELLED");
        progressEvent(
          progress,
          operationId,
          "committing",
          sources[0]?.name ?? "",
          selectedBytes,
          selectedBytes,
        );
        const commit = this.#commitImport(
          operationId,
          expectedGeneration,
          selectedForActivation,
        );
        if (commit.kind === "failed") return commit;
        committed = true;
        const activeKeys = new Set(
          commit.value.packages.map(({ fileKey }) => fileKey),
        );
        for (const key of stagedKeys)
          if (!activeKeys.has(key)) {
            try {
              this.#files.unlink(key);
            } catch {
              // Explicit cleanupUnused reports any postcommit orphan.
            }
          }
        try {
          this.#fault("after-commit");
        } catch {
          // Commit is authoritative. Postcommit cleanup/diagnostics cannot turn
          // successful activation into a reported rollback.
        }
        progressEvent(
          progress,
          operationId,
          "complete",
          sources[0]?.name ?? "",
          selectedBytes,
          selectedBytes,
        );
        return commit;
      } catch (error) {
        if (committed) return this.#readStack();
        if (isPackageArchiveError(error)) return failed("PACKAGE_INVALID");
        if (isCancellation(error) || signal.aborted)
          return failed("OPERATION_CANCELLED");
        if (isQuota(error)) return failed("STORAGE_QUOTA_EXCEEDED");
        return failed("STORAGE_UNAVAILABLE");
      } finally {
        if (!committed) {
          const active = this.#activeKeys();
          for (const key of stagedKeys)
            if (active.kind === "ok" && !active.value.has(key)) {
              try {
                this.#files.unlink(key);
              } catch {
                // Explicit cleanupUnused reports leftovers; original operation
                // result remains primary and active mappings stay protected.
              }
            }
        }
      }
    });
  }

  async verifyInstalled(
    signal: AbortSignal,
  ): Promise<StorageResult<PackageStack>> {
    if (signal.aborted) return failed("OPERATION_CANCELLED");
    const stack = await this.current();
    if (stack.kind === "failed") return stack;
    const candidate = new Map<PackageId, StagedPackage>();
    for (const item of stack.value.packages) {
      if (signal.aborted) return failed("OPERATION_CANCELLED");
      let database: RuntimeDatabase | null = null;
      try {
        database = this.#files.openDatabase(item.fileKey);
        const result = validateRuntimePackage(database);
        if (result.kind === "failed")
          return {
            kind: "failed",
            error: {
              ...result.error,
              code: result.error.code.startsWith("PACKAGE_")
                ? "PACKAGE_INTEGRITY_FAILED"
                : result.error.code,
              packageId: item.packageId,
            },
          };
        if (result.value.manifest.packageId !== item.packageId)
          return failed("PACKAGE_INTEGRITY_FAILED", {
            packageId: item.packageId,
          });
        candidate.set(item.packageId, { ...item, config: result.value.config });
      } catch (error) {
        return packageDatabaseFailure(error, item.packageId);
      } finally {
        database?.close();
      }
    }
    const crossResult = this.#validateCandidate(candidate, signal);
    if (crossResult.kind === "failed")
      return {
        kind: "failed",
        error: {
          ...crossResult.error,
          code:
            crossResult.error.code === "PACKAGE_SOURCE_INCOMPLETE"
              ? "PACKAGE_INTEGRITY_FAILED"
              : crossResult.error.code,
        },
      };
    return stack;
  }

  async removePackage(
    packageId: PackageId,
    expectedGeneration: number,
  ): Promise<StorageResult<RemovePackageResult>> {
    return await this.#serialize(async () => {
      if (this.#leases > 0) return failed("APP_SESSION_ACTIVE");
      const current = this.#readStack();
      if (current.kind === "failed") return current;
      if (current.value.generation !== expectedGeneration)
        return failed("STORAGE_CONFLICT");
      const target = current.value.packages.find(
        (item) => item.packageId === packageId,
      );
      if (!target) return failed("PACKAGE_NOT_FOUND", { packageId });
      const dependants = transitiveDependants(
        packageId,
        current.value.packages,
      );
      if (dependants.length > 0)
        return failed("PACKAGE_REFERENCED", {
          packageId,
          dependants,
        });
      const nextStack: PackageStack = {
        generation: expectedGeneration + 1,
        packages: current.value.packages
          .filter((item) => item.packageId !== packageId)
          .sort(comparePackage),
      };
      try {
        this.#registry.exec("BEGIN IMMEDIATE");
        const generation = scalarGeneration(this.#registry);
        if (generation !== expectedGeneration) throw conflictError();
        this.#registry.run(
          "DELETE FROM installed_packages WHERE package_id=?",
          [packageId],
        );
        const changed = this.#registry.run(
          "UPDATE registry_state SET generation=generation+1 WHERE singleton=1 AND generation=?",
          [expectedGeneration],
        );
        if (changed.changes !== 1) throw conflictError();
        this.#registry.exec("COMMIT");
      } catch (error) {
        tryRollback(this.#registry);
        return isConflict(error)
          ? failed("STORAGE_CONFLICT")
          : failed("STORAGE_UNAVAILABLE");
      }
      let cleanupPending: boolean;
      try {
        cleanupPending = !this.#files.unlink(target.fileKey);
      } catch {
        cleanupPending = true;
      }
      return { kind: "ok", value: { stack: nextStack, cleanupPending } };
    });
  }

  async reconcileInterruptedImports(): Promise<
    StorageResult<{ readonly removedFiles: number }>
  > {
    const active = this.#activeKeys();
    if (active.kind === "failed") return active;
    let removedFiles = 0;
    try {
      for (const key of this.#files.list())
        if (
          /^\/imports\/[^/]+\/[0-9]+\.partial$/.test(key) &&
          !active.value.has(key) &&
          this.#files.unlink(key)
        )
          removedFiles += 1;
      return { kind: "ok", value: { removedFiles } };
    } catch {
      return failed("STORAGE_UNAVAILABLE");
    }
  }

  async cleanupUnused(): Promise<
    StorageResult<{
      readonly removedFiles: number;
      readonly remainingFiles: number;
    }>
  > {
    return await this.#serialize(async () => {
      if (this.#leases > 0) return failed("APP_SESSION_ACTIVE");
      const active = this.#activeKeys();
      if (active.kind === "failed") return active;
      let removedFiles = 0;
      for (const key of this.#files.list()) {
        if (
          active.value.has(key) ||
          !/^\/imports\/[^/]+\/[0-9]+\.partial$/.test(key)
        )
          continue;
        try {
          if (this.#files.unlink(key)) removedFiles += 1;
        } catch {
          // Remaining count below makes partial cleanup explicit.
        }
      }
      return {
        kind: "ok",
        value: {
          removedFiles,
          remainingFiles: this.#files
            .list()
            .filter(
              (key) =>
                !active.value.has(key) &&
                /^\/imports\/[^/]+\/[0-9]+\.partial$/.test(key),
            ).length,
        },
      };
    });
  }

  async acquireSession(): Promise<
    StorageResult<{ readonly generation: number; release(): Promise<void> }>
  > {
    const stack = this.#readStack();
    if (stack.kind === "failed") return stack;
    this.#leases += 1;
    let released = false;
    return {
      kind: "ok",
      value: {
        generation: stack.value.generation,
        release: async () => {
          if (released) return;
          released = true;
          this.#leases -= 1;
        },
      },
    };
  }

  async query<Q extends ContentQuery>(
    request: Q,
    signal: AbortSignal,
  ): Promise<StorageResult<QueryMap[Q["kind"]]>> {
    if (signal.aborted) return failed("OPERATION_CANCELLED");
    if (!validQuery(request)) return failed("RPC_INVALID");
    const stack = this.#readStack();
    if (stack.kind === "failed") return stack;
    return queryContent(
      request,
      stack.value,
      signal,
      this.#files,
      this.#mediaWarning,
    );
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#registry.close();
    this.#files.close();
  }

  #readStack(): StorageResult<PackageStack> {
    const generation = scalarGeneration(this.#registry);
    const rows = this.#registry.all(
      "SELECT package_id, manifest_json, file_key, byte_length, sha256 FROM installed_packages ORDER BY package_id",
    );
    const packages: ActivePackage[] = [];
    for (const row of rows) {
      if (
        typeof row.manifest_json !== "string" ||
        typeof row.file_key !== "string" ||
        typeof row.byte_length !== "number" ||
        typeof row.sha256 !== "string" ||
        !this.#files.has(row.file_key)
      )
        return failed("PACKAGE_INTEGRITY_FAILED");
      let raw: unknown;
      try {
        raw = JSON.parse(row.manifest_json) as unknown;
      } catch {
        return failed("PACKAGE_INTEGRITY_FAILED");
      }
      const manifest = parsePackageManifest(raw);
      if (
        manifest.kind === "failed" ||
        manifest.value.packageId !== row.package_id ||
        !Number.isSafeInteger(row.byte_length) ||
        row.byte_length < 0 ||
        !/^[a-f0-9]{64}$/.test(row.sha256)
      )
        return failed("PACKAGE_INTEGRITY_FAILED");
      let database: RuntimeDatabase | null = null;
      try {
        database = this.#files.openDatabase(row.file_key);
        const header = validatePackageDatabaseHeader(database);
        if (header.kind === "failed")
          return failed(
            header.error.code.startsWith("PACKAGE_")
              ? "PACKAGE_INTEGRITY_FAILED"
              : header.error.code,
            { packageId: manifest.value.packageId },
          );
        if (!sameManifest(manifest.value, header.value.manifest))
          return failed("PACKAGE_INTEGRITY_FAILED", {
            packageId: manifest.value.packageId,
          });
      } catch (error) {
        return packageDatabaseFailure(error, manifest.value.packageId);
      } finally {
        database?.close();
      }
      packages.push({
        ...manifest.value,
        fileKey: row.file_key,
        bytes: row.byte_length,
        sha256: row.sha256,
      });
    }
    const closure = orderPackages([], packages.map(manifestOnly));
    if (closure.kind === "failed") return closure;
    packages.sort(comparePackage);
    return { kind: "ok", value: { generation, packages } };
  }

  #commitImport(
    operationId: string,
    expectedGeneration: number,
    selected: readonly StagedPackage[],
  ): StorageResult<PackageStack> {
    const current = this.#readStack();
    if (current.kind === "failed") return current;
    const next = new Map(
      current.value.packages.map((item) => [item.packageId, item]),
    );
    for (const item of selected) next.set(item.packageId, activeOnly(item));
    const committedStack: PackageStack = {
      generation: expectedGeneration + 1,
      packages: [...next.values()].sort(comparePackage),
    };
    try {
      this.#registry.exec("BEGIN IMMEDIATE");
      if (scalarGeneration(this.#registry) !== expectedGeneration)
        throw conflictError();
      for (const item of selected)
        this.#registry.run(
          `INSERT INTO installed_packages
            (package_id, manifest_json, file_key, byte_length, sha256, verified_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(package_id) DO UPDATE SET
             manifest_json=excluded.manifest_json,
             file_key=excluded.file_key,
             byte_length=excluded.byte_length,
             sha256=excluded.sha256,
             verified_at=excluded.verified_at`,
          [
            item.packageId,
            JSON.stringify(manifestOnly(item)),
            item.fileKey,
            item.bytes,
            item.sha256,
            this.#now(),
          ],
        );
      const changed = this.#registry.run(
        "UPDATE registry_state SET generation=generation+1 WHERE singleton=1 AND generation=?",
        [expectedGeneration],
      );
      if (changed.changes !== 1) throw conflictError();
      this.#registry.run("INSERT INTO import_receipts VALUES (?, ?, ?, ?)", [
        operationId,
        expectedGeneration + 1,
        JSON.stringify(selected.map(({ packageId }) => packageId).sort()),
        this.#now(),
      ]);
      this.#registry.exec("COMMIT");
      return { kind: "ok", value: committedStack };
    } catch (error) {
      tryRollback(this.#registry);
      return isConflict(error)
        ? failed("STORAGE_CONFLICT")
        : failed("STORAGE_UNAVAILABLE");
    }
  }

  #validateCandidate(
    candidate: ReadonlyMap<PackageId, StagedPackage | ActivePackage>,
    signal: AbortSignal,
  ): StorageResult<void> {
    if (signal.aborted) return failed("OPERATION_CANCELLED");
    const validated = new Map<PackageId, ValidatedRuntimePackage>();
    for (const item of candidate.values()) {
      if (signal.aborted) return failed("OPERATION_CANCELLED");
      if ("config" in item) {
        validated.set(item.packageId, {
          manifest: manifestOnly(item),
          config: item.config,
        });
        continue;
      }
      let database: RuntimeDatabase | null = null;
      try {
        database = this.#files.openDatabase(item.fileKey);
        const result = validateRuntimePackage(database);
        if (result.kind === "failed")
          return {
            kind: "failed",
            error: { ...result.error, packageId: item.packageId },
          };
        validated.set(item.packageId, result.value);
      } catch (error) {
        return packageDatabaseFailure(error, item.packageId);
      } finally {
        database?.close();
      }
    }
    const libraryItem = candidate.get("card-library");
    if (!libraryItem) return { kind: "ok", value: undefined };
    try {
      const inventories = validateModuleCatalogs(
        [...candidate.values()],
        this.#files,
      );
      if (inventories.kind === "failed") return inventories;
      validateCommerceStack(
        [...candidate.values()].map((item) => {
          const config = validated.get(item.packageId)!.config as {
            commerce?: CommerceContent;
            shopId?: string;
            setIds?: string[];
          };
          return {
            id: item.packageId,
            dependencies: item.dependencies.map((d) => d.packageId),
            sets: [...(inventories.value.get(item.packageId)?.sets ?? [])],
            commerce: config.commerce,
            shopId: config.shopId,
            selectedSetIds: config.setIds,
          };
        }),
      );
      for (const item of candidate.values()) {
        if (signal.aborted) return failed("OPERATION_CANCELLED");
        if (item.packageType !== "freeplay" && item.packageType !== "chapter")
          continue;
        const allowed = new Set<PackageId>();
        const visit = (id: PackageId): void => {
          if (allowed.has(id)) return;
          allowed.add(id);
          for (const dependency of candidate.get(id)?.dependencies ?? [])
            visit(dependency.packageId);
        };
        visit(item.packageId);
        const catalogs = [...inventories.value].filter(([id]) =>
          allowed.has(id),
        );
        const cardCodes = new Set(
          catalogs.flatMap(([, catalog]) => [...catalog.cards]),
        );
        const setIds = new Set(
          catalogs.flatMap(([, catalog]) => [...catalog.sets]),
        );
        let database: RuntimeDatabase | null = null;
        try {
          database = this.#files.openDatabase(item.fileKey);
          for (const row of database.all(
            "SELECT cards_json FROM decks ORDER BY id",
          )) {
            if (typeof row.cards_json !== "string")
              return sourceIncomplete(item.packageId);
            const deck = JSON.parse(row.cards_json) as {
              main: number[];
              extra: number[];
              side: number[];
            };
            if (
              [...deck.main, ...deck.extra, ...deck.side].some(
                (code) => !cardCodes.has(code),
              )
            )
              return sourceIncomplete(item.packageId);
          }
          const limitTable =
            item.packageType === "chapter"
              ? "chapter_card_limits"
              : "freeplay_card_limits";
          if (
            database
              .all(`SELECT card_code FROM ${limitTable} ORDER BY card_code`)
              .some(
                (row) =>
                  typeof row.card_code !== "number" ||
                  !cardCodes.has(row.card_code),
              )
          )
            return sourceIncomplete(item.packageId);
          if (item.packageType === "chapter") {
            const config = validated.get(item.packageId)!.config as {
              readonly setIds: readonly string[];
            };
            if (config.setIds.some((setId) => !setIds.has(setId)))
              return sourceIncomplete(item.packageId);
          }
        } catch (error) {
          return packageDatabaseFailure(error, item.packageId);
        } finally {
          database?.close();
        }
      }
      return { kind: "ok", value: undefined };
    } catch (error) {
      return packageDatabaseFailure(error, libraryItem.packageId);
    }
  }

  #nextOperationId(): string {
    const base = this.#randomId();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(base))
      throw new Error("invalid operation id");
    let candidate = base;
    const names = new Set(this.#files.list());
    while ([...names].some((name) => name.startsWith(`/imports/${candidate}/`)))
      candidate = `${base}-${++this.#operationSequence}`;
    return candidate;
  }

  #activeKeys(): StorageResult<ReadonlySet<string>> {
    try {
      // Registry pointers protect bytes even when the referenced DB is corrupt.
      const rows = this.#registry.all(
        "SELECT file_key FROM installed_packages",
      );
      const keys = new Set<string>();
      for (const row of rows) {
        if (typeof row.file_key !== "string" || row.file_key.length === 0)
          return failed("STORAGE_UNAVAILABLE");
        keys.add(row.file_key);
      }
      return { kind: "ok", value: keys };
    } catch {
      // Unknown protection set is never permission to delete.
      return failed("STORAGE_UNAVAILABLE");
    }
  }

  async #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#mutationTail;
    let release!: () => void;
    this.#mutationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

function scalarGeneration(database: RuntimeDatabase): number {
  const rows = database.all(
    "SELECT generation FROM registry_state WHERE singleton=1",
  );
  const generation = rows.length === 1 ? rows[0]?.generation : undefined;
  if (
    typeof generation !== "number" ||
    !Number.isSafeInteger(generation) ||
    generation < 0
  )
    throw new Error("invalid registry generation");
  return generation;
}

function sameManifest(left: PackageManifest, right: PackageManifest): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function activeOnly(value: ActivePackage): ActivePackage {
  return {
    ...manifestOnly(value),
    fileKey: value.fileKey,
    bytes: value.bytes,
    sha256: value.sha256,
  };
}

function manifestOnly(value: PackageManifest): PackageManifest {
  return {
    packageId: value.packageId,
    packageType: value.packageType,
    version: value.version,
    schemaVersion: value.schemaVersion,
    dependencies: value.dependencies,
    createdAt: value.createdAt,
  };
}

function comparePackage(left: PackageManifest, right: PackageManifest): number {
  return (
    rank(left.packageId) - rank(right.packageId) ||
    left.packageId.localeCompare(right.packageId)
  );
}
function rank(packageId: PackageId): number {
  if (packageId === "duel-core") return 0;
  if (packageId === "card-library") return 1;
  if (packageId.startsWith("card-pack-")) return 1.5;
  if (packageId === "freeplay") return 2;
  return Number(packageId.slice(8)) + 2;
}

function transitiveDependants(
  target: PackageId,
  installed: readonly ActivePackage[],
): PackageId[] {
  const dependants = new Set<PackageId>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of installed) {
      if (dependants.has(item.packageId) || item.packageId === target) continue;
      if (
        item.dependencies.some(
          ({ packageId }) => packageId === target || dependants.has(packageId),
        )
      ) {
        dependants.add(item.packageId);
        changed = true;
      }
    }
  }
  return [...dependants].sort();
}

function progressEvent(
  emit: (event: ImportProgress) => void,
  operationId: string,
  phase: ImportProgress["phase"],
  fileName: string,
  copiedBytes: number,
  totalBytes: number,
): void {
  emit({ operationId, phase, fileName, copiedBytes, totalBytes });
}
function sourceIncomplete(packageId: PackageId): StorageResult<never> {
  return failed("PACKAGE_SOURCE_INCOMPLETE", { packageId });
}
function failed<T>(
  code: StorageFailure["code"],
  details: Omit<StorageFailure, "code"> = {},
): StorageResult<T> {
  return { kind: "failed", error: { code, ...details } };
}
function cancelledError(): Error {
  return Object.assign(new Error("cancelled"), { name: "AbortError" });
}
function conflictError(): Error {
  return Object.assign(new Error("conflict"), { name: "StorageConflict" });
}
function isCancellation(value: unknown): boolean {
  return value instanceof Error && value.name === "AbortError";
}
function isConflict(value: unknown): boolean {
  return value instanceof Error && value.name === "StorageConflict";
}
function tryRollback(database: RuntimeDatabase): void {
  try {
    database.exec("ROLLBACK");
  } catch {
    // No active transaction after successful COMMIT or failed BEGIN.
  }
}
