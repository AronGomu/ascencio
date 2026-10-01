import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { queryContent } from "../../src/storage/runtime/content-query-runtime.ts";
import type {
  ActivePackage,
  ContentQuery,
  PackageStack,
} from "../../src/storage/index.ts";
import type { RuntimeFileStore } from "../../src/storage/runtime/runtime-ports.ts";

/** Webview integration fixture: actual staged packages, disposable saves.
 * Rust query projection has a separate native regression test. No browser store
 * is installed and no real player data is read or written by this harness.
 */
export async function installNativeContentBridge(page: Page): Promise<void> {
  const folder =
    process.env.NATIVE_TEST_CONTENT_DIR ?? "src-tauri/resources/game-content";
  const manifest = JSON.parse(
    readFileSync(path.join(folder, "release.json"), "utf8"),
  ) as {
    packages: {
      packageId: ActivePackage["packageId"];
      version: string;
      bytes: number;
      sha256: string;
    }[];
  };
  const packages = manifest.packages.map((item) => {
    const fileKey = path.resolve(folder, `${item.packageId}.sqlite`);
    const db = new DatabaseSync(fileKey, { readOnly: true });
    try {
      const header = db.prepare("SELECT * FROM package_manifest").get()!;
      return {
        ...item,
        fileKey,
        packageType: header.package_type,
        schemaVersion: header.schema_version,
        dependencies: JSON.parse(String(header.dependencies_json)),
        createdAt: header.created_at,
      } as ActivePackage;
    } finally {
      db.close();
    }
  });
  const stack: PackageStack = { generation: 1, packages };
  const files = {
    openDatabase(fileKey: string) {
      const db = new DatabaseSync(fileKey, { readOnly: true });
      return {
        all: (sql: string, args: unknown[] = []) =>
          db.prepare(sql).all(...(args as never[])),
        close: () => db.close(),
      };
    },
  } as unknown as RuntimeFileStore;
  let userJson: string | null = null;
  await page.exposeFunction(
    "nativeTestInvoke",
    async (command: string, args: Record<string, unknown> = {}) => {
      switch (command) {
        case "native_content_status":
          return { contentFolder: folder, packages: manifest.packages };
        case "native_package_stack":
          return { kind: "ok", value: stack };
        case "native_package_acquire":
          return {
            kind: "ok",
            value: { sessionId: "native-test", generation: 1 },
          };
        case "native_package_release":
          return;
        case "native_user_json_read":
          return userJson;
        case "native_user_json_write":
          if (args.expected !== userJson)
            return {
              kind: "failed",
              error: { code: "USER_REVISION_CONFLICT" },
            };
          userJson = String(args.source);
          return { kind: "ok", value: null };
        case "native_content_query": {
          const result = queryContent(
            args.request as ContentQuery,
            stack,
            new AbortController().signal,
            files,
            () => {},
          );
          if (
            result.kind === "ok" &&
            result.value !== null &&
            typeof result.value === "object" &&
            "bytes" in result.value
          )
            return {
              kind: "ok",
              value: { ...result.value, bytes: Array.from(result.value.bytes) },
            };
          return result;
        }
        default:
          throw new Error(`Unexpected native command: ${command}`);
      }
    },
  );
  await page.addInitScript(() => {
    const runtime = globalThis as unknown as {
      isTauri: boolean;
      nativeTestInvoke: (command: string, args: unknown) => Promise<unknown>;
      __TAURI_INTERNALS__: {
        invoke: (command: string, args: unknown) => Promise<unknown>;
      };
    };
    runtime.isTauri = true;
    runtime.__TAURI_INTERNALS__ = {
      invoke: (command, args) => runtime.nativeTestInvoke(command, args),
    };
  });
}
