import { acquireInstalledAsset } from "./acquire-installed-asset.ts";
import type { ContentReadPort } from "./contracts/content-read-port.ts";
import type { InstalledAssetLease } from "./contracts/installed-asset-lease.ts";
import type { InstalledGameplay } from "./contracts/installed-gameplay.ts";

export interface InstalledImageLibrary {
  readonly cardUrls: ReadonlyMap<number, string>;
  readonly setUrls: ReadonlyMap<string, string>;
  dispose(): void;
}

export async function loadInstalledImages(
  reader: ContentReadPort,
  gameplay: InstalledGameplay,
  signal?: AbortSignal,
): Promise<InstalledImageLibrary> {
  const leases: InstalledAssetLease[] = [];
  const cardUrls = new Map<number, string>();
  const setUrls = new Map<string, string>();
  try {
    for (const card of gameplay.cards) {
      signal?.throwIfAborted();
      const acquired = await acquireInstalledAsset(
        reader,
        gameplay.content,
        card.fullImage,
      );
      if (acquired.kind === "failed") throw acquired;
      leases.push(acquired.value);
      signal?.throwIfAborted();
      cardUrls.set(card.code, acquired.value.url);
    }
    for (const set of gameplay.sets) {
      if (set.image === null) continue;
      signal?.throwIfAborted();
      const acquired = await acquireInstalledAsset(
        reader,
        gameplay.content,
        set.image,
      );
      if (acquired.kind === "failed") throw acquired;
      leases.push(acquired.value);
      signal?.throwIfAborted();
      setUrls.set(set.id, acquired.value.url);
    }
  } catch (error) {
    for (const lease of leases) lease.release();
    throw error;
  }
  let disposed = false;
  return Object.freeze({
    cardUrls,
    setUrls,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const lease of leases) lease.release();
      leases.length = 0;
      cardUrls.clear();
      setUrls.clear();
    },
  });
}
