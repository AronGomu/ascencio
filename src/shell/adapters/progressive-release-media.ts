import type {
  ChapterFileRef,
  ContentReader,
  ProgressiveManifest,
  StagedContent,
} from "../../content/index.ts";
import type { CardCode, CardImageVariant } from "../../cards/index.ts";
import type {
  CardImageLease,
  CardImageSource,
} from "../../cards/images/index.ts";
import type { StoryMedia, StoryMediaLease } from "../../story/ports/index.ts";

export interface ProgressiveReleaseMedia {
  readonly images: CardImageSource;
  readonly story: StoryMedia;
  dispose(): void;
}

export function createProgressiveReleaseMedia(
  reader: ContentReader,
  staged: StagedContent,
  manifest: ProgressiveManifest,
  imageRefs: ReadonlyMap<string, ChapterFileRef>,
  mapRefs: ReadonlyMap<string, ChapterFileRef>,
  setImageRefs: ReadonlyMap<string, ChapterFileRef>,
): ProgressiveReleaseMedia {
  const active = new Map<string, () => void>();
  const manifestVersion = staged.manifestVersion;
  let reading = 0;
  const waiting: (() => void)[] = [];
  async function enter(signal: AbortSignal): Promise<void> {
    checkAbort(signal);
    if (reading < 4) {
      reading++;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const resume = () => {
        signal.removeEventListener("abort", abort);
        reading++;
        resolve();
      };
      const abort = () => {
        const index = waiting.indexOf(resume);
        if (index >= 0) waiting.splice(index, 1);
        reject(new DOMException("The operation was aborted.", "AbortError"));
      };
      waiting.push(resume);
      signal.addEventListener("abort", abort, { once: true });
    });
  }
  function leave(): void {
    reading--;
    waiting.shift()?.();
  }
  let disposed = false;

  async function acquire(
    ref: ChapterFileRef | undefined,
    signal: AbortSignal,
  ): Promise<CardImageLease | StoryMediaLease | null> {
    checkAbort(signal);
    if (disposed || ref === undefined) return null;
    const file = manifest.files.find(
      ({ path, packIds, required, role }) =>
        path === ref.path &&
        packIds.includes(ref.packId) &&
        !required &&
        role === "media",
    );
    if (file === undefined) return null;
    await enter(signal);
    let url: string | null = null;
    try {
      checkAbort(signal);
      if (disposed) return null;
      const bytes = await reader.readFile(manifestVersion, file.path, signal);
      checkAbort(signal);
      if (disposed || bytes === null) return null;
      url = URL.createObjectURL(
        new Blob([bytes.slice()], { type: file.mediaType }),
      );
      let released = false;
      const leased = url;
      const release = (): void => {
        if (released) return;
        released = true;
        active.delete(leased);
        URL.revokeObjectURL(leased);
      };
      active.set(leased, release);
      return Object.freeze({ url: leased, release });
    } catch {
      if (url !== null) URL.revokeObjectURL(url);
      checkAbort(signal);
      return null;
    } finally {
      leave();
    }
  }

  return Object.freeze({
    images: Object.freeze({
      acquire(
        code: CardCode,
        variant: CardImageVariant,
        signal: AbortSignal,
      ): Promise<CardImageLease | null> {
        return acquire(imageRefs.get(`${code}:${variant}`), signal);
      },
    }),
    story: Object.freeze({
      acquireMap(
        chapterId: string,
        signal: AbortSignal,
      ): Promise<StoryMediaLease | null> {
        return acquire(mapRefs.get(chapterId), signal);
      },
      acquireSetImage(
        setId: string,
        signal: AbortSignal,
      ): Promise<StoryMediaLease | null> {
        return acquire(setImageRefs.get(setId), signal);
      },
    }),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const release of active.values()) release();
      active.clear();
    },
  });
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted)
    throw new DOMException("The operation was aborted.", "AbortError");
}
