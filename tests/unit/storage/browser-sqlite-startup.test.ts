import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, it, vi } from "vitest";
import {
  createImportablePackageFixture,
  createRegistryFixture,
  createUserDataFixture,
} from "./sqlite-fixtures.ts";
import { databaseAdapter, packageOpenFailures } from "./runtime-fixtures.ts";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import { UserDataRuntime } from "../../../src/storage/runtime/user-data-runtime.ts";
import { StorageRpcDispatcher } from "../../../src/storage/runtime/rpc-dispatch.ts";
const mocks = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@sqlite.org/sqlite-wasm", () => ({ default: mocks.init }));
import { openBrowserSqliteRuntime } from "../../../src/storage/runtime/browser-sqlite.ts";

function nativeFixture(
  options: {
    failKey?: string;
    failAt?: "open" | "pragma";
    error?: Error;
    corrupt?: boolean;
  } = {},
) {
  const registry = createRegistryFixture();
  const user = createUserDataFixture();
  const core = options.corrupt
    ? createImportablePackageFixture("duel-core")
    : null;
  core?.database.close();
  if (core) {
    const bytes = readFileSync(core.file);
    registry.database
      .prepare("INSERT INTO installed_packages VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        "duel-core",
        JSON.stringify(core.manifest),
        "/packages/core.sqlite",
        bytes.byteLength,
        createHash("sha256").update(bytes).digest("hex"),
        "2026-09-24T00:00:00.000Z",
      );
  }
  registry.database.close();
  user.database.close();
  if (options.corrupt)
    writeFileSync(user.file, Buffer.from("not sqlite user bytes; preserve"));
  const before = readFileSync(user.file);
  const handles: { key: string; close: ReturnType<typeof vi.fn> }[] = [];
  const pauseVfs = vi.fn();
  class NativeDatabase {
    readonly pointer = this;
    readonly database: DatabaseSync;
    readonly close;
    constructor(readonly key: string) {
      if (options.failKey === key && options.failAt === "open")
        throw options.error;
      this.database = new DatabaseSync(
        key === "/content-registry.sqlite"
          ? registry.file
          : key === "/packages/core.sqlite" && core
            ? core.file
            : user.file,
      );
      this.close = vi.fn(() => this.database.close());
      handles.push(this);
    }
    exec(
      input:
        | string
        | {
            sql: string;
            bind?: readonly never[];
            resultRows?: unknown[];
            callback?: (row: unknown) => boolean | void;
            rowMode?: string | number;
          },
    ) {
      const sql = typeof input === "string" ? input : input.sql;
      if (
        options.failKey === this.key &&
        options.failAt === "pragma" &&
        sql === "PRAGMA trusted_schema=OFF"
      )
        throw options.error;
      if (typeof input === "string") {
        this.database.exec(sql);
        return;
      }
      const stmt = this.database.prepare(sql);
      for (const row of stmt.iterate(...(input.bind ?? []))) {
        input.resultRows?.push(
          input.rowMode === 0 ? Object.values(row)[0] : row,
        );
        if (input.callback?.(row) === false) break;
      }
    }
  }
  const pool = {
    vfsName: "fixture",
    getFileNames: () => [
      "/content-registry.sqlite",
      "/user-data.sqlite",
      ...(core ? ["/packages/core.sqlite"] : []),
    ],
    pauseVfs,
  };
  mocks.init.mockResolvedValue({
    oo1: { DB: NativeDatabase },
    installOpfsSAHPoolVfs: vi.fn(async () => pool),
    capi: {
      sqlite3_js_db_export: (native: NativeDatabase) =>
        databaseAdapter(native.database).exportBytes(),
    },
  });
  return { registry, user, before, handles, pauseVfs };
}

it("keeps content/current/query usable with corrupt user DB and preserves its bytes", async () => {
  const fixture = nativeFixture({ corrupt: true });
  const opened = await openBrowserSqliteRuntime();
  expect(opened.kind).toBe("ok");
  if (opened.kind !== "ok") throw new Error("startup failed");
  const browser = opened.value;
  expect(browser.userData).toEqual({
    kind: "failed",
    error: { code: "USER_DATA_INVALID" },
  });
  const packages = new AtomicPackageRuntime({
    registry: browser.registry,
    files: browser.files,
    now: () => "2026-09-24T00:00:00.000Z",
    randomId: () => "degraded",
  });
  const userData = new UserDataRuntime({
    ...(browser.userData.kind === "ok"
      ? { database: browser.userData.value }
      : { failure: browser.userData.error }),
    files: browser.files,
    randomId: () => "degraded-user",
  });
  const post = vi.fn();
  const dispatcher = new StorageRpcDispatcher(packages, post, userData);
  await dispatcher.dispatch({ id: "current", method: "current", args: [] });
  expect(post.mock.lastCall?.[0]).toMatchObject({ result: { kind: "ok" } });
  await dispatcher.dispatch({
    id: "query",
    method: "query",
    args: [{ kind: "config", packageId: "duel-core" }],
  });
  expect(post.mock.lastCall?.[0]).toMatchObject({
    result: { kind: "ok", value: expect.any(Object) },
  });
  for (const [method, args] of [
    ["readUser", ["preferences", "shell"]],
    ["listUser", ["preferences"]],
    ["writeUser", [[]]],
    ["exportUserData", []],
    ["inspectUserDataBackup", [new File([], "backup.sqlite")]],
    ["restoreUserData", ["token", 0, true]],
  ]) {
    await dispatcher.dispatch({ id: method, method, args });
    expect(post.mock.lastCall?.[0]).toMatchObject({
      result: { kind: "failed", error: { code: "USER_DATA_INVALID" } },
    });
  }
  expect(readFileSync(fixture.user.file)).toEqual(fixture.before);
  await dispatcher.dispatch({ id: "close", method: "close", args: [] });
  for (const handle of fixture.handles)
    expect(handle.close).toHaveBeenCalledOnce();
  expect(fixture.pauseVfs).toHaveBeenCalledOnce();
});

it.each(packageOpenFailures)(
  "preserves typed native $label startup cause and closes opened handles",
  async ({ error, code }) => {
    for (const failKey of ["/content-registry.sqlite", "/user-data.sqlite"]) {
      for (const failAt of ["open", "pragma"] as const) {
        const fixture = nativeFixture({ failKey, failAt, error });
        const opened = await openBrowserSqliteRuntime();
        const expected =
          code === "PACKAGE_INTEGRITY_FAILED"
            ? failKey === "/user-data.sqlite"
              ? "USER_DATA_INVALID"
              : "STORAGE_UNAVAILABLE"
            : code;
        if (failKey === "/content-registry.sqlite") {
          expect(opened).toEqual({ kind: "failed", error: { code: expected } });
        } else {
          expect(opened.kind).toBe("ok");
          if (opened.kind !== "ok") throw new Error("startup failed");
          expect(opened.value.userData).toEqual({
            kind: "failed",
            error: { code: expected },
          });
          opened.value.registry.close();
          opened.value.files.close();
        }
        for (const handle of fixture.handles)
          expect(handle.close).toHaveBeenCalledOnce();
        expect(fixture.pauseVfs).toHaveBeenCalledOnce();
        expect(readFileSync(fixture.user.file)).toEqual(fixture.before);
      }
    }
  },
);

it("closes staged handle if secure-open pragmas fail", async () => {
  const fixture = nativeFixture({
    failKey: "/staged.sqlite",
    failAt: "pragma",
    error: new Error("injected pragma"),
  });
  const opened = await openBrowserSqliteRuntime();
  expect(opened.kind).toBe("ok");
  if (opened.kind !== "ok") throw new Error("startup failed");
  expect(() => opened.value.files.openDatabase("/staged.sqlite")).toThrow(
    "injected pragma",
  );
  if (opened.value.userData.kind === "ok") opened.value.userData.value.close();
  opened.value.registry.close();
  opened.value.files.close();
  for (const handle of fixture.handles)
    expect(handle.close).toHaveBeenCalledOnce();
});

it.each(packageOpenFailures)(
  "preserves native $label during pool initialization",
  async ({ error, code }) => {
    mocks.init.mockRejectedValueOnce(error);
    expect(await openBrowserSqliteRuntime()).toEqual({
      kind: "failed",
      error: {
        code: code === "PACKAGE_INTEGRITY_FAILED" ? "SQLITE_UNAVAILABLE" : code,
      },
    });
  },
);
