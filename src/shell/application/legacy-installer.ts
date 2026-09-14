import type {
  ContentInstaller,
  CoreBootstrap,
  ContentResult,
  InstalledContentSet,
} from "../../content/index.ts";
import type {
  ShellBootstrap,
  ShellInstaller,
  ShellResult,
} from "../core/installed-inputs.ts";
import {
  createLegacyContentInstaller,
  loadLegacyGameplay,
} from "../adapters/legacy-content-api.ts";
import { createRuntimeActivationPort } from "../adapters/runtime-activation.ts";
import { validateLegacyGameplay } from "../adapters/legacy-gameplay-validation.ts";
import { createShellGameplay } from "./legacy-content.ts";
import { readInstallerChapterSizes } from "./installer-chapter-sizes.ts";
import { savedContentRefs } from "./saved-content-refs.ts";

export { createShellBootstrap } from "./shell-bootstrap.ts";

export async function createShellInstaller(
  bootstrap: CoreBootstrap,
  createInstaller = createLegacyContentInstaller,
): Promise<ShellResult<ShellInstaller>> {
  const result = await createInstaller({
    bootstrap,
    savedRefs: savedContentRefs,
    activation: createRuntimeActivationPort(),
  });
  return result.kind === "failed"
    ? { kind: "failed", code: result.code }
    : { kind: "ok", value: shellInstaller(result.value, bootstrap) };
}

export function openShellInstaller(
  bootstrap: ShellBootstrap,
): Promise<ShellResult<ShellInstaller>> {
  return bootstrap.openInstaller();
}

function shellInstaller(
  installer: ContentInstaller,
  bootstrap: CoreBootstrap,
): ShellInstaller {
  const current = (
    result: ContentResult<InstalledContentSet>,
  ): ShellResult<readonly string[]> =>
    result.kind === "failed"
      ? { kind: "failed", code: result.code }
      : {
          kind: "ok",
          value:
            result.value.current?.chapters.map(({ packId }) => packId) ?? [],
        };
  const session = Object.freeze({ close: () => installer.close() });
  return Object.freeze({
    close: session.close,
    current: async () => current(await installer.current()),
    subscribeCurrent: (listener) =>
      installer.subscribeCurrent((state) => listener(current(state))),
    async descriptions() {
      const descriptions: Record<
        string,
        { download: number; installed: number; deps: string }
      > = {};
      if (bootstrap.delivery === null)
        return { kind: "ok", value: descriptions };
      const catalog = await installer.readCatalog(
        bootstrap.delivery.index.sha256,
      );
      if (catalog.kind === "failed")
        return { kind: "failed", code: catalog.code };
      for (const chapter of catalog.value.value.chapters) {
        if (chapter.status !== "published") continue;
        const sizes = await readInstallerChapterSizes(
          installer,
          chapter.manifest,
        );
        if (sizes.kind === "failed")
          return { kind: "failed", code: sizes.code };
        descriptions[chapter.id] = sizes.value;
      }
      return { kind: "ok", value: descriptions };
    },
    async install(chapterId, progress, signal) {
      if (!/^chapter-(0[1-9]|[1-9][0-9])$/.test(chapterId))
        return { kind: "failed", code: "CONTENT_INVALID_MANIFEST" };
      const result = await installer.download(
        { kind: "chapter", chapterId: chapterId as `chapter-${string}` },
        progress,
        signal,
      );
      if (result.kind === "failed")
        return { kind: "failed", code: result.code };
      if (result.kind !== "complete") return { kind: "pending" };
      const loaded = await loadLegacyGameplay(installer, result.content);
      if (loaded.kind === "failed")
        return { kind: "failed", code: loaded.code };
      try {
        await validateLegacyGameplay(loaded.value);
      } catch {
        return { kind: "failed", code: "APP_REQUIRED_INPUT_FAILED" };
      }
      const installed = await installer.current();
      if (installed.kind === "failed")
        return { kind: "failed", code: installed.code };
      return {
        kind: "ok",
        value: {
          gameplay: createShellGameplay(loaded.value, installer),
          reader: session,
          generation: installed.value.generation,
        },
      };
    },
  } satisfies ShellInstaller);
}
