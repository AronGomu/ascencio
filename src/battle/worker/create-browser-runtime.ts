import type {
  ContentReadPort,
  ContentResult,
  ContentSetRef,
  InstalledRuntimeReceipt,
} from "../../content/index.ts";
import {
  loadInstalledGameplay,
  openContentReader,
} from "../../content/index.ts";
import { readInstalledRuntimeReceipt } from "../storage/installed-runtime-receipt.ts";
import { DuelOperationError } from "../duel/contracts/duel-error.ts";
import { verifyDigest } from "../../decks/catalog/snapshot-digest.ts";
import { installedDeckCatalog } from "../../decks/catalog/installed-gameplay-cards.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../decks/catalog/pinned-ruleset.ts";
import { loadInstalledRuntimeDependencies } from "./assets/installed-runtime-dependencies.ts";
import { loadBrowserRuntimeAssets } from "./assets/browser-runtime-assets.ts";
import {
  safeWorkerLogger,
  workerLog,
  type WorkerLogger,
} from "./diagnostics/worker-log.ts";
import { DuelWorkerRuntime } from "./DuelWorkerRuntime.ts";
import { OcgCoreAdapter } from "./engine/OcgCoreAdapter.ts";
import { runDuelRuntimeInitializationStage } from "./runtime-initialization.ts";

export interface BrowserDuelWorkerRuntimeOptions {
  readonly logger?: WorkerLogger;
  readonly openReader?: typeof openContentReader;
  readonly readReceipt?: typeof readInstalledRuntimeReceipt;
}

export function createBrowserDuelWorkerRuntime(
  options: BrowserDuelWorkerRuntimeOptions = {},
): DuelWorkerRuntime {
  const runtimeId = globalThis.crypto.randomUUID();
  const logger = safeWorkerLogger(options.logger ?? workerLog);
  const openReader = options.openReader ?? openContentReader;
  const readReceipt = options.readReceipt ?? readInstalledRuntimeReceipt;

  return new DuelWorkerRuntime(
    async (progress, signal, content) => {
      const reader = resultValue(
        await runDuelRuntimeInitializationStage(
          "snapshot_validation_failed",
          "Unable to open installed content",
          openReader,
        ),
      );
      try {
        signal.throwIfAborted();
        progress("installed-content", 0.05);
        const [gameplay, receipt] = await runDuelRuntimeInitializationStage(
          "snapshot_validation_failed",
          "Unable to validate installed content",
          async () =>
            await Promise.all([
              loadInstalledGameplay(reader, content).then(resultValue),
              readReceipt(content.snapshot, content.runtime).then(resultValue),
            ]),
        );
        await runDuelRuntimeInitializationStage(
          "snapshot_validation_failed",
          "Unable to validate installed runtime receipt files",
          () => assertInstalledRuntimeReceipt(receipt, content, reader),
        );
        signal.throwIfAborted();

        let lastProgressStage = "";
        let lastProgressPercent = -1;
        const assets = await runDuelRuntimeInitializationStage(
          "snapshot_validation_failed",
          "Unable to validate installed runtime files",
          () =>
            loadBrowserRuntimeAssets("https://installed.invalid/", {
              expectedManifestSha256: content.snapshot.runtimeManifestSha256,
              fetch: installedRuntimeFetch(reader, content, signal),
              cacheStorage: null,
              signal,
              onProgress: (stage, value) => {
                const mapped =
                  value === undefined ? undefined : 0.1 + value * 0.55;
                const percent =
                  mapped === undefined ? -1 : Math.floor(mapped * 100);
                if (
                  stage === lastProgressStage &&
                  percent === lastProgressPercent
                )
                  return;
                lastProgressStage = stage;
                lastProgressPercent = percent;
                progress(stage, mapped);
              },
            }),
        );
        if (assets.manifest.snapshotId !== content.snapshot.runtimeSnapshotId)
          throw new DuelOperationError({
            code: "snapshot_validation_failed",
            message:
              "Installed runtime snapshot does not match requested content",
            recoverable: false,
          });

        signal.throwIfAborted();
        progress("engine", 0.7);
        const adapter = await runDuelRuntimeInitializationStage(
          "engine_initialization_failed",
          "Unable to initialize the vendored engine",
          () =>
            OcgCoreAdapter.initialize({
              wasmBinary: assets.wasmBinary,
              onDiagnostic: ({ stream, message }) =>
                logger[stream === "stderr" ? "warn" : "debug"]({
                  event: "duel.worker.engine.initialization.diagnostic",
                  runtimeId,
                  stream,
                  message,
                }),
            }),
        );
        const coreVersion = adapter.getVersion();
        if (
          coreVersion[0] !== assets.manifest.engine.coreVersion[0] ||
          coreVersion[1] !== assets.manifest.engine.coreVersion[1]
        )
          throw new DuelOperationError({
            code: "engine_initialization_failed",
            message:
              "Vendored engine version does not match the runtime snapshot",
            recoverable: false,
          });

        const allowedCardCodes = new Set(
          gameplay.cards.map(({ code }) => code),
        );
        signal.throwIfAborted();
        progress("dependencies", 0.8);
        let dependencyGroupsLoaded = 0;
        const dependencies = await runDuelRuntimeInitializationStage(
          "dependency_resolution_failed",
          "Unable to resolve installed duel dependencies",
          () =>
            loadInstalledRuntimeDependencies(assets, (group) => {
              dependencyGroupsLoaded += 1;
              progress(
                `dependencies:${group}`,
                Math.min(0.98, 0.82 + dependencyGroupsLoaded * 0.02),
              );
            }),
        );
        signal.throwIfAborted();
        progress("ready", 1);
        return {
          adapter,
          dependencies,
          createPreset: () => {
            throw new Error(
              "Installed gameplay does not expose bundled presets",
            );
          },
          allowedCardCodes,
          deckCatalog: catalogByCode(installedDeckCatalog(gameplay).cards),
          deckRuleset: PROTOTYPE_RULESET,
          allowPresetDecks: false,
          snapshotId: assets.manifest.snapshotId,
          revisions: {
            babelCdb: assets.manifest.assets.babelCdbRevision,
            cardScripts: assets.manifest.assets.cardScriptsRevision,
            distribution: assets.manifest.assets.distributionRevision,
            activeImageManifestSha256: content.catalogSha256,
          },
        };
      } finally {
        reader.close();
      }
    },
    { runtimeId, logger },
  );
}

function resultValue<T>(result: ContentResult<T>): T {
  if (result.kind === "failed") throw new Error(result.code);
  return result.value;
}

export async function assertInstalledRuntimeReceipt(
  receipt: InstalledRuntimeReceipt,
  content: ContentSetRef,
  reader: ContentReadPort,
): Promise<void> {
  if (
    receipt.snapshot.activationId !== content.snapshot.activationId ||
    receipt.snapshot.runtimeSnapshotId !== content.snapshot.runtimeSnapshotId ||
    receipt.snapshot.runtimeManifestSha256 !==
      content.snapshot.runtimeManifestSha256 ||
    receipt.snapshot.releaseCatalogSha256 !==
      content.snapshot.releaseCatalogSha256 ||
    receipt.runtimePack.packId !== content.runtime.packId ||
    receipt.runtimePack.sha256 !== content.runtime.sha256 ||
    receipt.runtimePack.bytes !== content.runtime.bytes ||
    receipt.runtimeManifestFile.sha256 !==
      content.snapshot.runtimeManifestSha256
  )
    throw new Error("CONTENT_INTEGRITY_FAILED");
  const manifest = resultValue(
    await reader.readManifest(content.runtime),
  ).value;
  const files = [
    receipt.runtimeManifestFile,
    receipt.assetManifestFile,
    receipt.engineManifestFile,
  ];
  const paths = [
    "runtime/current/manifest.json",
    "runtime/assets/current/manifest.json",
    "runtime/engine/vendor-manifest.json",
  ];
  for (const [index, file] of files.entries()) {
    const installed = manifest.files.find(({ path }) => path === paths[index]);
    if (
      installed === undefined ||
      file.path !== installed.path ||
      file.bytes !== installed.bytes ||
      file.sha256 !== installed.sha256
    )
      throw new Error("CONTENT_INTEGRITY_FAILED");
  }
  for (const file of files) {
    const blob = resultValue(await reader.readFile(content.runtime, file.path));
    if (blob.size !== file.bytes) throw new Error("CONTENT_INTEGRITY_FAILED");
    await verifyDigest(
      file.path,
      new Uint8Array(await blob.arrayBuffer()),
      file.sha256,
    );
  }
}

function installedRuntimeFetch(
  reader: ContentReadPort,
  content: ContentSetRef,
  signal: AbortSignal,
): typeof globalThis.fetch {
  return async (input): Promise<Response> => {
    signal.throwIfAborted();
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const prefix = "/runtime/";
    if (
      url.origin !== "https://installed.invalid" ||
      !url.pathname.startsWith(prefix)
    )
      throw new Error("Installed runtime request path is invalid");
    const relativePath = url.pathname
      .slice(prefix.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    const result = await reader.readFile(
      content.runtime,
      `runtime/${relativePath}`,
    );
    signal.throwIfAborted();
    if (result.kind === "failed") throw new Error(result.code);
    return new Response(result.value);
  };
}
