import {
  allUserMutations,
  logicalUserSnapshot,
} from "./user-data-test-records.ts";
import type {
  RpcArgs,
  RpcResponse,
} from "../../../src/storage/contracts/rpc.ts";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import { UserDataRuntime } from "../../fixtures/legacy-user-data-runtime.ts";
import {
  createImportablePackageFixture,
  createUserDataFixture,
} from "./sqlite-fixtures.ts";
import {
  createRuntimeFixture,
  createNodeFileStore,
  databaseAdapter,
  completeStackFiles,
  crossPackageDefects,
  breakCrossPackageReference,
  activeFileKey,
  queryFailureCases,
  injectQueryFailure,
  fixtureFile,
  packageOpenFailures,
  validationFailureSql,
  injectValidationFailure,
} from "./runtime-fixtures.ts";
import { describe, expect, it, vi } from "vitest";
import { StorageRpcClient } from "../../../src/storage/runtime/rpc-client.ts";
import {
  StorageRpcDispatcher,
  validateRpcRequest,
} from "../../../src/storage/runtime/rpc-dispatch.ts";
import { requestLifetimeOwnerLock } from "../../../src/storage/runtime/worker-lock.ts";

class FakeWorker extends EventTarget {
  readonly sent: unknown[] = [];
  terminated = 0;
  postMessage(value: unknown): void {
    this.sent.push(value);
  }
  terminate(): void {
    this.terminated += 1;
  }
  message(value: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data: value }));
  }
  fail(type: "error" | "messageerror"): void {
    this.dispatchEvent(new Event(type));
  }
}

async function rpcResult<M extends Exclude<keyof RpcArgs, "restoreUserData">>(
  runtime: AtomicPackageRuntime,
  method: M,
  args: RpcArgs[M],
) {
  const worker = new FakeWorker();
  const client = new StorageRpcClient(worker);
  const settled = vi.fn();
  const pending = client.request(method, args).then((result) => {
    settled(result);
    return result;
  });
  const responses: RpcResponse[] = [];
  await new StorageRpcDispatcher(runtime, (response) => {
    responses.push(response);
    worker.message(response);
    worker.message(response);
  }).dispatch(worker.sent[0]);
  const result = await pending;
  expect(
    responses.filter((response) => response.kind === "result"),
  ).toHaveLength(1);
  worker.fail("messageerror");
  await Promise.resolve();
  expect(settled).toHaveBeenCalledOnce();
  client.closeTransport();
  return result;
}

async function installedRpcFixture() {
  const fixture = createRuntimeFixture();
  const warnings: unknown[] = [];
  const runtime = new AtomicPackageRuntime({
    ...fixture,
    now: () => "2026-09-24T12:00:00.000Z",
    randomId: () => "rpc-matrix",
    mediaWarning: (warning) => warnings.push(warning),
  });
  expect(
    (
      await runtime.importPackages(
        completeStackFiles(),
        0,
        new AbortController().signal,
        () => {},
      )
    ).kind,
  ).toBe("ok");
  return { ...fixture, runtime, warnings };
}

describe("storage RPC", () => {
  it.each(["error", "messageerror", "close", "invalid-reply"] as const)(
    "dispatched restore alone has unknown outcome on %s",
    async (failure) => {
      const worker = new FakeWorker();
      const client = new StorageRpcClient(worker);
      const restore = client.request("restoreUserData", ["token", 0, true]);
      const read = client.request("current", []);
      if (failure === "close") client.closeTransport();
      else if (failure === "invalid-reply") worker.message({ invalid: true });
      else worker.fail(failure);
      await expect(restore).resolves.toEqual({
        kind: "restore-outcome-unknown",
      });
      await expect(read).resolves.toEqual({
        kind: "failed",
        error: { code: "STORAGE_UNAVAILABLE" },
      });
      await expect(
        client.request("restoreUserData", ["unused", 0, true]),
      ).resolves.toEqual({
        kind: "failed",
        error: { code: "STORAGE_UNAVAILABLE" },
      });
      client.closeTransport();
      expect(worker.terminated).toBe(1);
    },
  );

  it("postMessage throw leaves unsent restore known failed, earlier dispatched restore unknown", async () => {
    const worker = new FakeWorker();
    const client = new StorageRpcClient(worker);
    const dispatched = client.request("restoreUserData", ["first", 0, true]);
    vi.spyOn(worker, "postMessage").mockImplementationOnce(() => {
      throw new DOMException("Cannot clone", "DataCloneError");
    });
    const unsent = client.request("restoreUserData", ["second", 0, true]);
    await expect(unsent).resolves.toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    await expect(dispatched).resolves.toEqual({
      kind: "restore-outcome-unknown",
    });
    expect(worker.sent).toHaveLength(1);
  });

  it("authoritative Worker failure remains known failed after later transport death", async () => {
    const worker = new FakeWorker();
    const client = new StorageRpcClient(worker);
    const restore = client.request("restoreUserData", ["token", 0, true]);
    const { id } = worker.sent[0] as { id: string };
    const result = { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
    worker.message({ id, kind: "result", result });
    worker.fail("error");
    await expect(restore).resolves.toEqual(result);
  });

  it("Worker cannot forge local unknown result through protocol allowlist", async () => {
    const worker = new FakeWorker();
    const client = new StorageRpcClient(worker);
    const read = client.request("current", []);
    const { id } = worker.sent[0] as { id: string };
    worker.message({
      id,
      kind: "result",
      result: { kind: "restore-outcome-unknown" },
    });
    await expect(read).resolves.toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    expect(worker.terminated).toBe(1);
  });

  it.each(packageOpenFailures)(
    "RPC cross-reference verification preserves $label once",
    async ({ error, code }) => {
      for (const packageId of [
        "card-library",
        "freeplay",
        "chapter-01",
      ] as const) {
        for (const phase of ["open", "query"] as const) {
          const fixture = await installedRpcFixture();
          const key = activeFileKey(fixture, packageId);
          const open = fixture.files.openDatabase.bind(fixture.files);
          let opens = 0;
          let hits = 0;
          vi.spyOn(fixture.files, "openDatabase").mockImplementation(
            (fileKey) => {
              const target = fileKey === key && ++opens === 2;
              if (target && phase === "open") {
                hits += 1;
                throw error;
              }
              const database = open(fileKey);
              if (!target) return database;
              return {
                ...database,
                all() {
                  hits += 1;
                  throw error;
                },
              };
            },
          );
          expect(
            await rpcResult(fixture.runtime, "verifyInstalled", []),
          ).toEqual({
            kind: "failed",
            error: { code, packageId },
          });
          expect(hits).toBe(1);
        }
      }
    },
  );

  it("RPC verify cancellation stays typed and settles once", async () => {
    const fixture = await installedRpcFixture();
    const post = vi.fn();
    const dispatcher = new StorageRpcDispatcher(fixture.runtime, post);
    const verifying = dispatcher.dispatch({
      id: "verify-cancel",
      method: "verifyInstalled",
      args: [],
    });
    await dispatcher.dispatch({
      id: "cancel",
      method: "cancel",
      args: ["verify-cancel"],
    });
    await verifying;
    expect(
      post.mock.calls
        .map(([response]) => response)
        .filter((response) => response.id === "verify-cancel"),
    ).toEqual([
      {
        id: "verify-cancel",
        kind: "result",
        result: { kind: "failed", error: { code: "OPERATION_CANCELLED" } },
      },
    ]);
  });

  it.each(packageOpenFailures)(
    "RPC preserves $label validation failures once",
    async ({ error, code }) => {
      for (const method of ["importPackages", "verifyInstalled"] as const) {
        for (const sql of validationFailureSql) {
          const fixture = createRuntimeFixture();
          const runtime = new AtomicPackageRuntime({
            ...fixture,
            now: () => "2026-09-24T12:00:00.000Z",
            randomId: () => "rpc-validation",
          });
          const core = createImportablePackageFixture("duel-core");
          core.database.close();
          const file = fixtureFile(core.file);
          if (method === "verifyInstalled")
            expect(
              (
                await runtime.importPackages(
                  [file],
                  0,
                  new AbortController().signal,
                  () => {},
                )
              ).kind,
            ).toBe("ok");
          const hits = injectValidationFailure(fixture.files, sql, error);
          expect(
            await rpcResult(
              runtime,
              method,
              method === "importPackages" ? [[file], 0] : [],
            ),
          ).toMatchObject({
            kind: "failed",
            error: {
              code,
              ...(method === "verifyInstalled"
                ? { packageId: "duel-core" }
                : {}),
            },
          });
          expect(hits()).toBe(1);
        }
      }
    },
  );

  it.each(crossPackageDefects)(
    "RPC verify rejects $label cross-reference once",
    async (defect) => {
      const fixture = await installedRpcFixture();
      breakCrossPackageReference(fixture, defect);
      expect(await rpcResult(fixture.runtime, "verifyInstalled", [])).toEqual({
        kind: "failed",
        error: {
          code: "PACKAGE_INTEGRITY_FAILED",
          packageId: defect.packageId,
        },
      });
    },
  );

  describe.each(queryFailureCases)("RPC $label native failures", (testCase) => {
    it.each(packageOpenFailures)(
      "classifies $label on open/query once",
      async ({ error, code }) => {
        for (const phase of ["open", "query"] as const) {
          const fixture = await installedRpcFixture();
          const hits = injectQueryFailure(
            fixture.files,
            activeFileKey(fixture, testCase.packageId),
            phase,
            testCase.sql,
            error,
          );
          const result = await rpcResult(fixture.runtime, "query", [
            testCase.request,
          ]);
          expect(hits()).toBe(1);
          if (phase === "query" && testCase.optional) {
            expect(result).toEqual({ kind: "ok", value: null });
            expect(fixture.warnings).toEqual([
              {
                packageId: testCase.packageId,
                path:
                  testCase.request.kind === "asset"
                    ? testCase.request.path
                    : "sets/fixture-set",
                reason: "unreadable",
              },
            ]);
          } else {
            expect(result).toMatchObject({
              kind: "failed",
              error: { code, packageId: testCase.packageId },
            });
            expect(fixture.warnings).toEqual([]);
          }
        }
      },
    );
  });

  it.each([
    null,
    {},
    { id: "", method: "current", args: [] },
    { id: "1", method: "unknown", args: [] },
    { id: "1", method: "current", args: [1] },
    { id: "1", method: "removePackage", args: ["../duel-core", 0] },
    { id: "1", method: "readUser", args: ["unknown", "key"] },
    { id: "1", method: "readUser", args: ["preferences", "x".repeat(257)] },
    {
      id: "1",
      method: "writeUser",
      args: [
        [
          {
            kind: "put",
            namespace: "preferences",
            key: "shell",
            expectedRevision: 0,
            payload: {},
          },
        ],
      ],
    },
    { id: "1", method: "restoreUserData", args: ["token", 0, false] },
    {
      id: "1",
      method: "query",
      args: [{ kind: "cards", locale: "en", afterCode: 0, limit: 501 }],
    },
  ])("rejects malformed request %# as RPC_INVALID", (request) => {
    expect(validateRpcRequest(request)).toEqual({
      kind: "failed",
      error: { code: "RPC_INVALID" },
    });
  });

  it("settles every pending request exactly once on Worker error", async () => {
    const worker = new FakeWorker();
    const client = new StorageRpcClient(worker);
    const first = client.request("current", []);
    const second = client.request("cleanupUnused", []);
    worker.fail("error");
    await expect(first).resolves.toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    await expect(second).resolves.toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    worker.fail("messageerror");
    expect(worker.terminated).toBe(1);
  });

  it("delivers progress/warnings by correlation and ignores duplicate terminal replies", async () => {
    const worker = new FakeWorker();
    const client = new StorageRpcClient(worker);
    const progress = vi.fn();
    const warning = vi.fn();
    client.subscribeMediaWarnings(warning);
    const pending = client.request("current", [], { progress });
    const request = worker.sent[0] as { id: string };
    worker.message({
      id: request.id,
      kind: "progress",
      progress: {
        operationId: "op",
        phase: "copying",
        fileName: "x",
        copiedBytes: 1,
        totalBytes: 2,
      },
    });
    worker.message({
      id: request.id,
      kind: "media-warning",
      warning: {
        packageId: "card-library",
        path: "card-back.jpg",
        reason: "missing",
      },
    });
    worker.message({
      id: request.id,
      kind: "result",
      result: { kind: "ok", value: 1 },
    });
    worker.message({
      id: request.id,
      kind: "result",
      result: { kind: "ok", value: 2 },
    });
    await expect(pending).resolves.toEqual({ kind: "ok", value: 1 });
    expect(progress).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledOnce();
  });

  it("denies second owner and releases lifetime Web Lock only on close", async () => {
    let held = false;
    let releaseFirst: (() => void) | undefined;
    const locks = {
      async request(
        _name: string,
        options: LockOptions,
        callback: (lock: Lock | null) => Promise<void>,
      ) {
        expect(options).toMatchObject({ mode: "exclusive", ifAvailable: true });
        if (held) return await callback(null);
        held = true;
        return await callback({
          name: "ascencio-sqlite-owner-v1",
          mode: "exclusive",
        } as Lock);
      },
    } as LockManager;
    const firstPromise = requestLifetimeOwnerLock(locks, async () => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });
    await Promise.resolve();
    const second = await requestLifetimeOwnerLock(locks, async () => {});
    expect(second).toEqual({ acquired: false });
    releaseFirst?.();
    expect(await firstPromise).toEqual({ acquired: true });
  });

  it("cancels an in-flight import without waiting for its terminal reply", async () => {
    const responses: unknown[] = [];
    const runtime = {
      importPackages(
        _files: readonly File[],
        _generation: number,
        signal: AbortSignal,
      ) {
        return new Promise((resolve) => {
          signal.addEventListener(
            "abort",
            () =>
              resolve({
                kind: "failed",
                error: { code: "OPERATION_CANCELLED" },
              }),
            { once: true },
          );
        });
      },
    };
    const dispatcher = new StorageRpcDispatcher(runtime as never, (response) =>
      responses.push(response),
    );
    const importing = dispatcher.dispatch({
      id: "import-1",
      method: "importPackages",
      args: [[new File([new Uint8Array(512)], "fixture.sqlite")], 0],
    });
    await Promise.resolve();
    await dispatcher.dispatch({
      id: "cancel-1",
      method: "cancel",
      args: ["import-1"],
    });
    await importing;
    expect(responses).toEqual([
      {
        id: "cancel-1",
        kind: "result",
        result: { kind: "ok", value: undefined },
      },
      {
        id: "import-1",
        kind: "result",
        result: {
          kind: "failed",
          error: { code: "OPERATION_CANCELLED" },
        },
      },
    ]);
  });

  it("dispatches every real user-data method; duplicate CAS and malformed requests settle once", async () => {
    const packageFixture = createRuntimeFixture();
    const packageRuntime = new AtomicPackageRuntime({
      ...packageFixture,
      now: () => "2026-09-24T12:00:00.000Z",
      randomId: () => "user-rpc-package",
    });
    const userFixture = createUserDataFixture();
    const userData = new UserDataRuntime({
      database: databaseAdapter(userFixture.database),
      files: packageFixture.files,
      randomId: () => crypto.randomUUID(),
    });
    const responses: RpcResponse[] = [];
    const dispatcher = new StorageRpcDispatcher(
      packageRuntime,
      (value) => responses.push(value),
      userData,
    );
    async function dispatch(id: string, method: string, args: unknown[]) {
      responses.length = 0;
      await dispatcher.dispatch({ id, method, args });
      expect(responses).toHaveLength(1);
      const response = responses[0]!;
      expect(response).toMatchObject({ id, kind: "result" });
      if (response.kind !== "result")
        throw new Error("missing terminal result");
      return response.result;
    }
    expect(
      await dispatch("write", "writeUser", [allUserMutations()]),
    ).toMatchObject({
      kind: "ok",
      value: expect.arrayContaining([
        {
          namespace: "story",
          key: "manual:1",
          revision: 1,
          payload: expect.any(Object),
        },
      ]),
    });
    const beforeDuplicate = logicalUserSnapshot(userFixture.database);
    expect(await dispatch("write", "writeUser", [allUserMutations()])).toEqual({
      kind: "failed",
      error: { code: "STORAGE_CONFLICT" },
    });
    expect(logicalUserSnapshot(userFixture.database)).toEqual(beforeDuplicate);
    expect(
      await dispatch("malformed", "writeUser", [
        [{ ...allUserMutations()[0], unexpected: true }],
      ]),
    ).toEqual({ kind: "failed", error: { code: "RPC_INVALID" } });
    expect(logicalUserSnapshot(userFixture.database)).toEqual(beforeDuplicate);
    expect(
      await dispatch("read", "readUser", ["story", "manual:1"]),
    ).toMatchObject({ kind: "ok", value: { revision: 1 } });
    expect(await dispatch("list", "listUser", ["preferences"])).toMatchObject({
      kind: "ok",
      value: expect.any(Array),
    });
    const exported = await dispatch("export", "exportUserData", []);
    if (exported.kind !== "ok" || !(exported.value instanceof Blob))
      throw new Error("export failed");
    const backup = new File(
      [await exported.value.arrayBuffer()],
      "user-data.sqlite",
    );
    const preview = await dispatch("inspect", "inspectUserDataBackup", [
      backup,
    ]);
    if (preview.kind !== "ok") throw new Error("inspect failed");
    const { token, currentRevision } = preview.value as {
      token: string;
      currentRevision: number;
    };
    expect(
      await dispatch("restore", "restoreUserData", [
        token,
        currentRevision,
        true,
      ]),
    ).toEqual({ kind: "ok", value: { revision: 2 } });
    const afterRestore = logicalUserSnapshot(userFixture.database);
    expect(afterRestore).toEqual({
      ...beforeDuplicate,
      meta: beforeDuplicate.meta.map((row) => ({ ...row, revision: 2 })),
    });
    expect(
      await dispatch("restore", "restoreUserData", [
        token,
        currentRevision,
        true,
      ]),
    ).toEqual({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });
    expect(logicalUserSnapshot(userFixture.database)).toEqual(afterRestore);
    expect(await dispatch("close", "close", [])).toEqual({
      kind: "ok",
      value: undefined,
    });
  });

  it.each(packageOpenFailures)(
    "RPC maps user-data $label failures once",
    async ({ error, code }) => {
      const packageFixture = createRuntimeFixture();
      const packageRuntime = new AtomicPackageRuntime({
        ...packageFixture,
        now: () => "2026-09-24T12:00:00.000Z",
        randomId: () => "user-failure-package",
      });
      const userFixture = createUserDataFixture();
      const base = databaseAdapter(userFixture.database);
      const failing = {
        ...base,
        all(
          sql: string,
          parameters?: readonly (
            string | number | bigint | null | Uint8Array
          )[],
        ) {
          if (sql.startsWith("SELECT namespace")) throw error;
          return base.all(sql, parameters);
        },
      };
      const userData = new UserDataRuntime({
        database: failing,
        files: createNodeFileStore(),
        randomId: () => "user-failure",
      });
      const post = vi.fn();
      await new StorageRpcDispatcher(packageRuntime, post, userData).dispatch({
        id: "user-failure",
        method: "readUser",
        args: ["preferences", "shell"],
      });
      expect(post).toHaveBeenCalledOnce();
      expect(post).toHaveBeenCalledWith({
        id: "user-failure",
        kind: "result",
        result: {
          kind: "failed",
          error: {
            code:
              code === "PACKAGE_INTEGRITY_FAILED" ? "USER_DATA_INVALID" : code,
          },
        },
      });
    },
  );
  it.each(packageOpenFailures)(
    "RPC preserves $label failure for staged import and installed verification",
    async ({ error, code }) => {
      for (const method of ["importPackages", "verifyInstalled"] as const) {
        const fixture = createRuntimeFixture();
        const runtime = new AtomicPackageRuntime({
          ...fixture,
          now: () => "2026-09-24T12:00:00.000Z",
          randomId: () => "rpc-open-failure",
        });
        const core = createImportablePackageFixture("duel-core");
        core.database.close();
        const file = fixtureFile(core.file);
        if (method === "verifyInstalled")
          expect(
            (
              await runtime.importPackages(
                [file],
                0,
                new AbortController().signal,
                () => {},
              )
            ).kind,
          ).toBe("ok");
        const open = fixture.files.openDatabase.bind(fixture.files);
        let opens = 0;
        vi.spyOn(fixture.files, "openDatabase").mockImplementation((key) => {
          if (method === "importPackages" || ++opens === 2) throw error;
          return open(key);
        });
        const post = vi.fn();
        await new StorageRpcDispatcher(runtime, post).dispatch({
          id: "open-failure",
          method,
          args: method === "importPackages" ? [[file], 0] : [],
        });
        const terminal = post.mock.calls
          .map(([response]) => response)
          .filter((response) => response.kind === "result");
        expect(terminal).toEqual([
          {
            id: "open-failure",
            kind: "result",
            result: {
              kind: "failed",
              error: {
                code,
                ...(method === "verifyInstalled"
                  ? { packageId: "duel-core" }
                  : {}),
              },
            },
          },
        ]);
      }
    },
  );
});
