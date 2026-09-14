import type {
  ContentInstaller,
  ContentReadPort,
  ContentResult,
  ContentSetRef,
  CoreBootstrap,
  InstalledGameplay,
  InstalledImageLibrary,
  OwnedContentReader,
  RuntimeActivationPort,
  SavedContentRefsPort,
} from "../../content/index.ts";

export async function createLegacyContentInstaller(options: {
  readonly bootstrap: CoreBootstrap;
  readonly savedRefs: SavedContentRefsPort;
  readonly activation: RuntimeActivationPort;
}): Promise<ContentResult<ContentInstaller>> {
  const { createContentInstaller } = await import("../../content/index.ts");
  return createContentInstaller(options);
}

export async function parseLegacyCoreBootstrap(
  value: unknown,
  appBaseUrl: string,
): Promise<CoreBootstrap> {
  const { parseCoreBootstrap } = await import("../../content/index.ts");
  return parseCoreBootstrap(value, appBaseUrl);
}

export async function openLegacyContentReader(): Promise<
  ContentResult<OwnedContentReader>
> {
  const { openContentReader } = await import("../../content/index.ts");
  return openContentReader();
}

export async function loadLegacyGameplay(
  reader: ContentReadPort,
  content: ContentSetRef,
): Promise<ContentResult<InstalledGameplay>> {
  const { loadInstalledGameplay } = await import("../../content/index.ts");
  return loadInstalledGameplay(reader, content);
}

export async function loadLegacyInstalledImages(
  reader: ContentReadPort,
  gameplay: InstalledGameplay,
  signal?: AbortSignal,
): Promise<InstalledImageLibrary> {
  const { loadInstalledImages } = await import("../../content/index.ts");
  return loadInstalledImages(reader, gameplay, signal);
}
