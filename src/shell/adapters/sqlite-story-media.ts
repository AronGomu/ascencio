import type { CardImageLease } from "../../cards/images/index.ts";
import type {
  StoryMedia,
  StoryMediaLease,
  StorySet,
} from "../../story/ports/index.ts";
import type { ShellGameplay } from "../core/installed-inputs.ts";
import type { SqliteImageLeasePool } from "./sqlite-image-source.ts";

export function createSqliteStoryMedia(
  pool: SqliteImageLeasePool,
  chapterId: `chapter-${string}`,
  mapAssetPath: string | null,
  setIds: ReadonlySet<string>,
): StoryMedia {
  return Object.freeze({
    acquireEvent(
      requestedChapterId: string,
      logicalId: string,
      signal: AbortSignal,
    ): Promise<StoryMediaLease | null> {
      if (requestedChapterId !== chapterId) return Promise.resolve(null);
      return pool.acquire(
        `${chapterId}:${logicalId}`,
        { kind: "asset", packageId: chapterId, path: logicalId },
        signal,
      );
    },
    acquireMap(
      requestedChapterId: string,
      signal: AbortSignal,
    ): Promise<StoryMediaLease | null> {
      if (signal.aborted) return Promise.reject(abortError());
      if (requestedChapterId !== chapterId || mapAssetPath === null)
        return Promise.resolve(null);
      return pool.acquire(
        `${chapterId}:${mapAssetPath}`,
        { kind: "asset", packageId: chapterId, path: mapAssetPath },
        signal,
      );
    },
    acquireSetImage(
      setId: string,
      signal: AbortSignal,
    ): Promise<StoryMediaLease | null> {
      if (signal.aborted) return Promise.reject(abortError());
      if (!setIds.has(setId)) return Promise.resolve(null);
      return pool.acquire(
        `card-library:set:${setId}`,
        { kind: "set-image", setId },
        signal,
      );
    },
  });
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

export async function loadSqliteStoryImageLibrary(
  sets: readonly StorySet[],
  media: StoryMedia,
  signal: AbortSignal,
): Promise<Awaited<ReturnType<ShellGameplay["images"]>>> {
  const cardUrls = new Map<number, string>();
  const setUrls = new Map<string, string>();
  const leases: CardImageLease[] = [];
  const subscriptions: (() => void)[] = [];
  const dispose = () => {
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    for (const lease of leases.splice(0)) lease.release();
  };
  try {
    /* Full global card media stays on CardImageSource so visible consumers own
       bounded leases. This compatibility library may retain chapter set art,
       never every global card image. */
    for (const set of sets) {
      const lease = await media.acquireSetImage(set.id, signal);
      if (lease !== null) {
        leases.push(lease);
        setUrls.set(set.id, lease.url);
        const unsubscribe = lease.subscribe?.((url) => {
          if (url) setUrls.set(set.id, url);
          else setUrls.delete(set.id);
        });
        if (unsubscribe) subscriptions.push(unsubscribe);
      }
    }
    return Object.freeze({ cardUrls, setUrls, dispose });
  } catch (error) {
    dispose();
    throw error;
  }
}
