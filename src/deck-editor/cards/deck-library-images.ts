import {
  cardCode,
  type CardCode,
  type CardImageVariant,
} from "../../cards/index.ts";
import type {
  CardImageLease,
  CardImageSource,
} from "../../cards/images/index.ts";

interface LibraryImage {
  readonly key: string;
  readonly code: CardCode;
  readonly variant: CardImageVariant;
  readonly source: CardImageSource;
  readonly controller: AbortController;
  lease: CardImageLease | null;
}

/** Own only library covers and the selected deck's crop/full presentation leases. */
export function createDeckLibraryImages(
  changed: (urls: ReadonlyMap<string, string>) => void,
  failed: (error: unknown) => void,
) {
  const entries = new Map<string, LibraryImage>();
  let queue: LibraryImage[] = [];
  let active = 0;
  let disposed = false;
  let currentSource: CardImageSource | null = null;

  function publish(): void {
    const urls = new Map<string, string>();
    for (const entry of entries.values())
      if (entry.lease !== null) urls.set(entry.key, entry.lease.url);
    changed(urls);
  }
  function release(entry: LibraryImage): void {
    entry.controller.abort();
    entry.lease?.release();
    entry.lease = null;
  }
  async function acquire(entry: LibraryImage): Promise<void> {
    try {
      const lease = await entry.source.acquire(
        entry.code,
        entry.variant,
        entry.controller.signal,
      );
      if (
        disposed ||
        entry.controller.signal.aborted ||
        entries.get(entry.key) !== entry
      )
        lease?.release();
      else {
        entry.lease = lease;
        publish();
      }
    } catch (error) {
      if (
        !disposed &&
        !entry.controller.signal.aborted &&
        entries.get(entry.key) === entry
      )
        failed(error);
    } finally {
      active--;
      pump();
    }
  }
  function pump(): void {
    while (!disposed && active < 4 && queue.length > 0) {
      const entry = queue.shift()!;
      active++;
      void acquire(entry);
    }
  }
  return {
    synchronize(
      source: CardImageSource | null,
      covers: readonly number[],
      selected: readonly number[],
    ): void {
      if (disposed) return;
      const wanted = new Map<
        string,
        { code: CardCode; variant: CardImageVariant }
      >();
      if (source !== null) {
        for (const variant of ["cropped", "full"] as const) {
          for (const code of variant === "cropped"
            ? [...covers, ...selected]
            : selected) {
            wanted.set(`${code}:${variant}`, { code: cardCode(code), variant });
          }
        }
      }
      let removed = false;
      for (const [key, entry] of entries) {
        if (source !== currentSource || !wanted.has(key)) {
          entries.delete(key);
          release(entry);
          removed = true;
        }
      }
      queue = queue.filter((entry) => entries.get(entry.key) === entry);
      currentSource = source;
      if (removed) publish();
      if (source !== null) {
        for (const [key, value] of wanted) {
          if (entries.has(key)) continue;
          const entry: LibraryImage = {
            key,
            ...value,
            source,
            controller: new AbortController(),
            lease: null,
          };
          entries.set(key, entry);
          queue.push(entry);
        }
      }
      pump();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) release(entry);
      entries.clear();
      queue = [];
    },
  };
}
