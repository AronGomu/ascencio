import { cardCode, type CardCode } from "../../cards/index.ts";
import type {
  CardImageLease,
  CardImageSource,
} from "../../cards/images/index.ts";
import {
  acquireInstalledAsset,
  type ContentReadPort,
  type InstalledGameplay,
} from "../../content/index.ts";

const MAXIMUM_CONCURRENT_READS = 4;

interface MissingCardMediaStatus {
  readonly kind: "missing-media";
  readonly reason: "missing" | "corrupt" | "unreadable";
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

export function createInstalledCardImageSource(
  reader: ContentReadPort,
  gameplay: InstalledGameplay,
  reportStatus: (status: MissingCardMediaStatus) => void,
): CardImageSource {
  const files = new Map(
    gameplay.cards.map((card) => [cardCode(card.code), card] as const),
  );
  let active = 0;
  const waiting: Array<() => void> = [];

  async function enter(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw abortError();
    if (active < MAXIMUM_CONCURRENT_READS) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const resume = () => {
        signal.removeEventListener("abort", abort);
        active += 1;
        resolve();
      };
      const abort = () => {
        const index = waiting.indexOf(resume);
        if (index >= 0) waiting.splice(index, 1);
        reject(abortError());
      };
      waiting.push(resume);
      signal.addEventListener("abort", abort, { once: true });
    });
  }

  function leave(): void {
    active -= 1;
    waiting.shift()?.();
  }

  function missing(reason: MissingCardMediaStatus["reason"]): null {
    reportStatus({ kind: "missing-media", reason });
    return null;
  }

  const source: CardImageSource = {
    async acquire(code, variant, signal): Promise<CardImageLease | null> {
      await enter(signal);
      try {
        if (signal.aborted) throw abortError();
        const card = files.get(code as CardCode);
        if (card === undefined) return missing("missing");
        let result: Awaited<ReturnType<typeof acquireInstalledAsset>>;
        try {
          result = await acquireInstalledAsset(
            reader,
            gameplay.content,
            variant === "full" ? card.fullImage : card.croppedImage,
          );
        } catch {
          if (signal.aborted) throw abortError();
          return missing("unreadable");
        }
        if (signal.aborted) {
          if (result.kind === "ok") result.value.release();
          throw abortError();
        }
        if (result.kind === "failed")
          return missing(
            result.code === "CONTENT_MISSING"
              ? "missing"
              : result.code === "CONTENT_INTEGRITY_FAILED"
                ? "corrupt"
                : "unreadable",
          );
        return result.value;
      } finally {
        leave();
      }
    },
  };
  return Object.freeze(source);
}
