import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertNoCriticalReads } from "../../../src/storage/diagnostics/io-trace.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/index.ts";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));

beforeEach(() => {
  vi.resetModules();
  native.invoke.mockReset();
  Reflect.deleteProperty(globalThis, "__ASCENCIO_IO_TRACE__");
});

async function enable() {
  const api = await import("../../../src/storage/native/invoke.ts");
  await api.invokeNative("native_content_status");
  return api;
}

describe("production native I/O telemetry", () => {
  it("rejects capture races that could hide a native writer's nested read", async () => {
    native.invoke.mockResolvedValueOnce({ ioTraceSessionId: "attempt" });
    const api = await enable();
    const response = Promise.withResolvers<unknown>();
    native.invoke.mockReturnValueOnce(response.promise);
    const capturing = api.nativeIoTrace.snapshot();
    native.invoke.mockResolvedValueOnce({ kind: "ok" });
    await api.invokeNative("native_user_json_write", {
      source: "private",
      expected: null,
    });
    response.resolve({ events: [] });
    await expect(capturing).rejects.toThrow("IO_TRACE_CAPTURE_CHANGED");
  });
  it("makes no telemetry calls when tracing is disabled", async () => {
    native.invoke.mockResolvedValue({ packages: [] });
    const api = await enable();
    await api.nativeIoTrace.markBaselineReady();
    expect(await api.nativeIoTrace.snapshot()).toEqual({
      frontend: null,
      native: null,
    });
    expect("__ASCENCIO_IO_TRACE__" in globalThis).toBe(false);
    expect(native.invoke.mock.calls.map(([command]) => command)).toEqual([
      "native_content_status",
    ]);
  });

  it("observes existing catalog, script and user rereads through the real adapters", async () => {
    let saved: string | null = null;
    native.invoke.mockImplementation(
      async (command: string, args?: Record<string, unknown>) => {
        switch (command) {
          case "native_content_status":
            return { ioTraceSessionId: "native-attempt-1" };
          case "native_io_trace_baseline_ready":
            return;
          case "native_io_trace_snapshot":
            return {
              schemaVersion: 1,
              sessionId: "native-attempt-1",
              enabled: true,
              droppedEvents: 0,
              pendingEvents: 0,
              events: [],
            };
          case "native_package_stack":
            return { kind: "ok", value: { generation: 1, packages: [] } };
          case "native_content_query":
            return { kind: "ok", value: [] };
          case "native_user_json_open":
            return { sessionId: "writer", source: saved };
          case "native_user_json_commit":
            saved = args!.source as string;
            return { kind: "ok" };
          case "native_user_json_close":
            return;
          default:
            throw new Error("unexpected command");
        }
      },
    );
    const api = await enable();
    expect("__ASCENCIO_IO_TRACE__" in globalThis).toBe(true);
    const { openNativeStorage } =
      await import("../../../src/storage/native/storage-client.ts");
    const opened = await openNativeStorage();
    if (opened.kind !== "ok") throw new Error("fixture failed");
    await api.nativeIoTrace.markBaselineReady();
    for (let navigation = 0; navigation < 2; navigation++) {
      for (const request of [
        { kind: "cards", locale: "en", afterCode: 0, limit: 500 },
        { kind: "scripts", afterName: "", limit: 500 },
      ] as const) {
        expect(
          (
            await opened.value.content.query(
              request,
              new AbortController().signal,
            )
          ).kind,
        ).toBe("ok");
      }
      expect((await opened.value.userData.listUser("decks")).kind).toBe("ok");
    }
    expect(
      (
        await opened.value.userData.writeUser([
          {
            kind: "put",
            namespace: "preferences",
            key: "shell",
            expectedRevision: null,
            payload: DEFAULT_SHELL_SETTINGS,
          },
        ])
      ).kind,
    ).toBe("ok");
    const { frontend } = await api.nativeIoTrace.snapshot();
    expect(frontend?.sessionId).toBe("native-attempt-1");
    expect(() => assertNoCriticalReads(frontend!, "baseline-ready")).toThrow(
      "CRITICAL_READ_AFTER_READY",
    );
    for (const category of ["registry", "gameplay", "scripts", "user-data"])
      expect(
        frontend!.events.filter(
          (event) =>
            event.phase === "baseline-ready" &&
            event.category === category &&
            event.operation === "command",
        ).length,
      ).toBeGreaterThanOrEqual(category === "user-data" ? 1 : 2);
    const text = JSON.stringify(frontend);
    expect(text).not.toContain("ascencio-user-data-json");
    expect(text).not.toContain("expectedRevision");
    await opened.value.close();
  });

  it("preserves arguments, rejected invokes, and raw binary import options", async () => {
    native.invoke.mockResolvedValueOnce({ ioTraceSessionId: "attempt" });
    const api = await enable();
    const bytes = new Uint8Array([1, 2]);
    const options = { headers: { "x-content-token": "private-token" } };
    native.invoke.mockRejectedValueOnce(new Error("lost reply"));
    await expect(
      api.invokeNative("native_import_chunk", bytes, options),
    ).rejects.toThrow("lost reply");
    expect(native.invoke).toHaveBeenLastCalledWith(
      "native_import_chunk",
      bytes,
      options,
    );
    native.invoke.mockResolvedValueOnce({ events: [] });
    const snapshot = await api.nativeIoTrace.snapshot();
    expect(snapshot.frontend?.pendingEvents).toBe(0);
    expect(JSON.stringify(snapshot.frontend)).not.toContain("private-token");
  });

  it("a telemetry marker failure cannot change admission or produce a false pass", async () => {
    native.invoke.mockResolvedValueOnce({ ioTraceSessionId: "attempt" });
    const api = await enable();
    native.invoke.mockRejectedValueOnce(new Error("unavailable"));
    await expect(
      api.nativeIoTrace.markBaselineReady(),
    ).resolves.toBeUndefined();
    native.invoke.mockResolvedValueOnce({ events: [] });
    const snapshot = await api.nativeIoTrace.snapshot();
    expect(() =>
      assertNoCriticalReads(snapshot.frontend!, "baseline-ready"),
    ).toThrow("IO_TRACE_BOUNDARY_MISSING");
  });
});
