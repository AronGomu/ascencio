import { cardCode } from "../../duel/contracts/ids.ts";
import {
  loadActiveDuelDependencies,
  type ActiveDependencyProgress,
} from "./active-duel-dependencies.ts";
import type { BrowserRuntimeAssets } from "./browser-runtime-assets.ts";

/** Runtime support is the verified runtime closure, not permission to sleeve a card. */
export async function loadInstalledRuntimeDependencies(
  assets: BrowserRuntimeAssets,
  onProgress?: ActiveDependencyProgress,
) {
  const codes = new Set<number>();
  const scripts = new Map<string, string>();
  for (const file of assets.manifest.assets.files) {
    if (/^catalog\/cards\/[a-f0-9]{2}\.json$/.test(file.path)) {
      const records = await assets.readJson<readonly { code: number }[]>(
        file.path,
      );
      for (const { code } of records) codes.add(code);
    }
    if (/^scripts\/cards\/[a-f0-9]{2}\.json$/.test(file.path)) {
      const records = await assets.readJson<Record<string, string>>(file.path);
      for (const [name, source] of Object.entries(records))
        scripts.set(name, source);
    }
  }
  const dependencies = await loadActiveDuelDependencies(
    assets,
    new Set([...codes].map(cardCode)),
    onProgress,
  );
  for (const [name, source] of dependencies.scripts) scripts.set(name, source);
  return Object.freeze({
    ...dependencies,
    scripts,
    counts: Object.freeze({ ...dependencies.counts, scripts: scripts.size }),
  });
}
