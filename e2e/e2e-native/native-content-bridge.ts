import { readFileSync, statSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Page } from "@playwright/test";
import type {
  CriticalRelease,
  CriticalSnapshot,
} from "../../src/storage/contracts/critical-snapshot.ts";

export interface NativeTestControl {
  failNextUserCommitContaining(fragment: string): Promise<void>;
}

declare global {
  interface Window {
    nativeTestControl: NativeTestControl;
  }
}

/** Readable resource bridge only. Actual Rust filesystem/decoder acceptance is separate. */
export async function installNativeContentBridge(page: Page): Promise<void> {
  const folder = path.resolve(
    process.env.NATIVE_TEST_CONTENT_DIR ??
      "src-tauri/resources/readable-content",
  );
  const release = JSON.parse(
    readFileSync(path.join(folder, "release.json"), "utf8"),
  ) as CriticalRelease;
  const snapshots = release.packages.map(
    (pack) =>
      JSON.parse(
        readFileSync(path.join(folder, pack.path), "utf8"),
      ) as CriticalSnapshot,
  );
  const metadata = JSON.stringify(snapshots);
  const engine = readFileSync(
    path.join(folder, "duel-core/engine/ocgcore.sync.wasm"),
  );
  const vendorManifest = readFileSync(
    path.join(folder, "duel-core/engine/vendor-manifest.json"),
    "utf8",
  );
  let contentSession: string | null = null;
  await page.route("**/game-content/**", async (route) => {
    const parts = new URL(route.request().url()).pathname
      .split("/")
      .filter(Boolean);
    const [namespace, sessionId, kind, packageId, token] = parts;
    if (namespace !== "game-content" || sessionId !== contentSession) {
      await route.fulfill({ status: 410 });
      return;
    }
    if (
      parts.length === 3 &&
      (kind === "metadata.json" || kind === "engine.wasm")
    ) {
      await route.fulfill({
        body: kind === "metadata.json" ? metadata : engine,
        contentType:
          kind === "metadata.json" ? "application/json" : "application/wasm",
      });
      return;
    }
    if (
      parts.length !== 5 ||
      (kind !== "media" && kind !== "revision") ||
      !token ||
      !/^(?:[a-f0-9]{2})+$/.test(token)
    ) {
      await route.fulfill({ status: 404 });
      return;
    }
    const logicalId = Buffer.from(token, "hex").toString("utf8");
    const mapping = snapshots
      .find((pack) => pack.manifest.packageId === packageId)
      ?.media.find((mapping) => mapping.id === logicalId);
    if (!mapping) {
      await route.fulfill({ status: 404 });
      return;
    }
    try {
      const root = realpathSync(path.join(folder, String(packageId)));
      const file = realpathSync(path.join(root, mapping.path));
      if (!file.startsWith(`${root}${path.sep}`))
        throw new Error("MEDIA_PATH_REFUSED");
      const stat = statSync(file);
      if (!stat.isFile() || stat.size > 64 * 1024 * 1024)
        throw new Error("MEDIA_TOO_LARGE");
      await route.fulfill({
        body:
          kind === "revision"
            ? JSON.stringify(`${stat.size}:${stat.mtimeMs}:${stat.ino}`)
            : readFileSync(file),
        contentType: kind === "revision" ? "application/json" : mapping.mime,
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      await route.fulfill(
        kind === "revision"
          ? { body: "null", contentType: "application/json" }
          : { status: 404 },
      );
    }
  });
  let userJson: string | null = null;
  let userRevision = 0;
  let failNextUserCommitContaining: string | null = null;
  const log = {
    sessionId: "fixture",
    path: null,
    loggingError: null,
    diagnostics: [],
    droppedDiagnostics: 0,
  };
  await page.exposeFunction(
    "nativeTestInvoke",
    async (command: string, args: Record<string, unknown> = {}) => {
      switch (command) {
        case "native_startup_log_status":
          return log;
        case "native_startup_log_record":
          return { ...log, diagnostics: [args.diagnostic] };
        case "native_startup_load":
          contentSession = String(args.sessionId);
          return {
            sessionId: args.sessionId,
            generation: 1,
            metadataBytes: Buffer.byteLength(metadata),
            metadataSha256: createHash("sha256").update(metadata).digest("hex"),
            engineBytes: engine.length,
            engineSha256: createHash("sha256").update(engine).digest("hex"),
            vendorManifest,
            packages: release.packages,
          };
        case "native_content_location":
          return folder;
        case "native_startup_cancel":
        case "native_startup_close":
          if (args.sessionId === contentSession) contentSession = "";
          return;
        case "native_user_json_close":
        case "native_io_trace_maintenance":
          return;
        case "native_user_json_open":
          return { sessionId: "fixture-writer", source: userJson };
        case "native_user_json_commit": {
          const source = String(args.source);
          if (
            failNextUserCommitContaining !== null &&
            source.includes(failNextUserCommitContaining)
          ) {
            failNextUserCommitContaining = null;
            return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
          }
          if (args.expectedRevision !== userRevision)
            return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
          userJson = source;
          userRevision = (JSON.parse(userJson) as { revision: number })
            .revision;
          return { kind: "ok", value: null };
        }
        case "native_test_fail_next_user_commit":
          if (typeof args.fragment !== "string" || args.fragment.length === 0)
            throw new Error("A non-empty commit fragment is required");
          failNextUserCommitContaining = args.fragment;
          return;
        case "native_live_media_revision":
        case "native_live_media_read": {
          const snapshot = snapshots.find(
            (pack) => pack.manifest.packageId === args.packageId,
          );
          const mapping = snapshot?.media.find(
            (media) => media.id === args.logicalId,
          );
          if (
            !mapping ||
            mapping.path
              .split("/")
              .some((part) => !part || part === ".." || part === ".") ||
            /[\\:\0]/.test(mapping.path)
          )
            return null;
          const root = path.join(folder, String(args.packageId));
          try {
            const resolved = realpathSync(path.join(root, mapping.path));
            if (!resolved.startsWith(`${root}${path.sep}`)) return null;
            const stat = statSync(resolved);
            if (!stat.isFile() || stat.size > 64 * 1024 * 1024) return null;
            return command === "native_live_media_revision"
              ? `${stat.size}:${stat.mtimeMs}:${stat.ino}`
              : { base64: readFileSync(resolved).toString("base64") };
          } catch {
            return null;
          }
        }
        case "plugin:event|listen":
          return 1;
        case "plugin:event|unlisten":
          return;
        default:
          throw new Error(`Unexpected native command: ${command}`);
      }
    },
  );
  await page.addInitScript(() => {
    const runtime = globalThis as unknown as {
      isTauri: boolean;
      nativeTestInvoke: (command: string, args: unknown) => Promise<unknown>;
      __TAURI_INTERNALS__: Record<string, unknown>;
    };
    runtime.isTauri = true;
    Object.defineProperty(globalThis, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
      value: { unregisterListener: () => {} },
    });
    let id = 0;
    runtime.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      transformCallback: () => ++id,
      unregisterCallback: () => {},
      convertFileSrc: (filePath: string) =>
        new URL(filePath, `${location.origin}/`).href,
      invoke: async (command: string, args: unknown) => {
        const value = await runtime.nativeTestInvoke(command, args);
        if (value && typeof value === "object" && "text" in value)
          return new TextEncoder().encode(String(value.text)).buffer;
        if (value && typeof value === "object" && "base64" in value)
          return Uint8Array.from(atob(String(value.base64)), (c) =>
            c.charCodeAt(0),
          ).buffer;
        return value;
      },
    };
    Object.defineProperty(globalThis, "nativeTestControl", {
      value: Object.freeze({
        failNextUserCommitContaining: async (fragment: string) => {
          await runtime.nativeTestInvoke("native_test_fail_next_user_commit", {
            fragment,
          });
        },
      }),
    });
  });
}
