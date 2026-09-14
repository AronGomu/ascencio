import type { CoreBootstrap } from "../../content/index.ts";
import type { ShellBootstrap } from "../core/installed-inputs.ts";
import type { createLegacyContentInstaller } from "../adapters/legacy-content-api.ts";

/** Display-only startup projection; installer implementation loads on explicit installation. */
export function createShellBootstrap(
  bootstrap: CoreBootstrap,
  createInstaller?: typeof createLegacyContentInstaller,
): ShellBootstrap {
  return Object.freeze({
    chapters: bootstrap.chapters,
    available: bootstrap.delivery !== null,
    async openInstaller() {
      const { createShellInstaller } = await import("./legacy-installer.ts");
      return createShellInstaller(bootstrap, createInstaller);
    },
  });
}
