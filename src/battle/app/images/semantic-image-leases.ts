import { cardCode } from "../../../cards/index.ts";
import type {
  CardImageLease as SourceImageLease,
  CardImageSource,
} from "../../../cards/images/index.ts";
import type {
  CardImageDiagnostic,
  CardImageLease,
  CardImageLibrary,
} from "./card-image-cache.ts";

interface ImageOwner {
  readonly listeners: Set<(url: string) => void>;
  released: boolean;
}
interface MountedImage {
  readonly code: number;
  readonly controller: AbortController;
  readonly owners: Set<ImageOwner>;
  lease: SourceImageLease | null;
  readonly start: () => Promise<void>;
}

// Share capacity, never image identities/leases, across replacement libraries.
const queue = new Set<MountedImage>();
let active = 0;
function pump(): void {
  while (active < 4 && queue.size > 0) {
    const entry = queue.values().next().value!;
    queue.delete(entry);
    active++;
    void entry.start();
  }
}

/** Pending work and URLs belong only to live mounted handles. */
export function createSemanticImageLeases(
  source: CardImageSource | null,
  codes: readonly number[],
  placeholderUrl: string,
  onProgress: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Pick<CardImageLibrary, "lease" | "dispose" | "diagnostics"> {
  const allowed = new Set(codes);
  const entries = new Map<number, MountedImage>();
  const diagnostics = new Map<number, CardImageDiagnostic>();
  let disposed = false;
  signal?.throwIfAborted();
  signal?.addEventListener("abort", dispose, { once: true });

  function forget(entry: MountedImage): void {
    entries.delete(entry.code);
    entry.controller.abort();
    entry.lease?.release();
    entry.lease = null;
    queue.delete(entry);
  }
  function record(entry: MountedImage, detail?: string): void {
    diagnostics.set(entry.code, {
      code: entry.code,
      status: entry.lease === null ? "missing" : "cache-hit",
      source: "semantic-card-image-source",
      ...(detail === undefined ? {} : { detail }),
    });
    onProgress(diagnostics.size, allowed.size);
    for (const owner of entry.owners)
      for (const listener of owner.listeners)
        listener(entry.lease?.url ?? placeholderUrl);
  }
  async function acquire(entry: MountedImage): Promise<void> {
    try {
      const lease = await source!.acquire(
        cardCode(entry.code),
        "full",
        entry.controller.signal,
      );
      if (
        disposed ||
        entry.controller.signal.aborted ||
        entries.get(entry.code) !== entry
      ) {
        lease?.release();
        return;
      }
      entry.lease = lease;
      record(entry);
    } catch (error) {
      if (
        !disposed &&
        !entry.controller.signal.aborted &&
        entries.get(entry.code) === entry
      )
        record(entry, error instanceof Error ? error.message : String(error));
    } finally {
      active--;
      pump();
    }
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", dispose);
    for (const entry of entries.values()) {
      for (const owner of entry.owners) {
        owner.released = true;
        owner.listeners.clear();
      }
      entry.owners.clear();
      forget(entry);
    }
  }
  return {
    get diagnostics() {
      return Object.freeze([...diagnostics.values()]);
    },
    lease(code): CardImageLease {
      const number = Number(code);
      if (disposed || source === null || !allowed.has(number))
        return Object.freeze({ url: placeholderUrl, release: () => undefined });
      let entry = entries.get(number);
      if (entry === undefined) {
        entry = {
          code: number,
          controller: new AbortController(),
          owners: new Set(),
          lease: null,
          start: () => acquire(entry!),
        };
        entries.set(number, entry);
        queue.add(entry);
      }
      const mounted = entry;
      const owner: ImageOwner = { listeners: new Set(), released: false };
      mounted.owners.add(owner);
      const url = (): string =>
        owner.released
          ? placeholderUrl
          : (mounted.lease?.url ?? placeholderUrl);
      const handle: CardImageLease = Object.freeze({
        get url() {
          return url();
        },
        subscribe(listener: (url: string) => void): () => void {
          if (owner.released) return () => undefined;
          owner.listeners.add(listener);
          // Register before immediate snapshot delivery: readiness cannot be missed.
          listener(url());
          return () => {
            owner.listeners.delete(listener);
          };
        },
        release(): void {
          if (owner.released) return;
          owner.released = true;
          owner.listeners.clear();
          mounted.owners.delete(owner);
          if (mounted.owners.size === 0) forget(mounted);
        },
      });
      pump();
      return handle;
    },
    dispose,
  };
}
