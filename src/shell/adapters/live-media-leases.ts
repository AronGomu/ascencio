import { boundedMediaImage } from "./media-image-bounds.ts";
import type { CardImageLease } from "../../cards/images/index.ts";
import type {
  ContentQueries,
  ContentQuery,
  QueryMap,
} from "../../storage/index.ts";

type MediaQuery = Extract<ContentQuery, { kind: "asset" | "set-image" }>;
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_VISIBLE = 128;
let activeReads = 0;
const waiting: (() => void)[] = [];
function limitedRead(run: () => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    const start = () => {
      activeReads++;
      void run().finally(() => {
        activeReads--;
        waiting.shift()?.();
        resolve();
      });
    };
    if (activeReads < 4) start();
    else waiting.push(start);
  });
}
interface Entry {
  readonly request: MediaQuery;
  readonly controller: AbortController;
  readonly listeners: Set<(url: string) => void>;
  pending: Promise<void>;
  url: string;
  bytes: number;
  revision: string | null;
  owners: number;
  failures: number;
  nextCheck: number;
}

/** Only visible owners retain media; a single bounded poll observes filesystem revisions. */
export class LiveMediaLeases {
  readonly #content: ContentQueries;
  readonly #entries = new Map<string, Entry>();
  #timer: ReturnType<typeof setTimeout> | null = null;
  #closed = false;
  #bytes = 0;
  #polling = false;
  constructor(content: ContentQueries) {
    this.#content = content;
  }

  async acquire(
    key: string,
    request: MediaQuery,
    signal: AbortSignal,
  ): Promise<CardImageLease | null> {
    signal.throwIfAborted();
    if (this.#closed) throw new Error("SQLITE_IMAGE_SOURCE_CLOSED");
    let entry = this.#entries.get(key);
    if (!entry) {
      if (this.#entries.size >= MAX_VISIBLE) return null;
      entry = {
        request,
        controller: new AbortController(),
        listeners: new Set(),
        pending: Promise.resolve(),
        url: "",
        bytes: 0,
        revision: null,
        owners: 0,
        failures: 0,
        nextCheck: 0,
      };
      this.#entries.set(key, entry);
      entry.pending = this.#refresh(entry);
    }
    const current = entry;
    current.owners++;
    let released = false;
    const ownedListeners = new Set<(url: string) => void>();
    const release = () => {
      if (released) return;
      released = true;
      for (const listener of ownedListeners) current.listeners.delete(listener);
      ownedListeners.clear();
      if (--current.owners === 0) {
        current.controller.abort();
        if (this.#entries.get(key) === current) this.#entries.delete(key);
        this.#replace(current, "", 0);
      }
      if (!this.#entries.size && this.#timer !== null) {
        clearTimeout(this.#timer);
        this.#timer = null;
      }
    };
    const abort = () => release();
    signal.addEventListener("abort", abort, { once: true });
    const cancelled = Promise.withResolvers<never>();
    const rejectAbort = () =>
      cancelled.reject(
        signal.reason ?? new DOMException("Aborted", "AbortError"),
      );
    signal.addEventListener("abort", rejectAbort, { once: true });
    try {
      await Promise.race([current.pending, cancelled.promise]);
      signal.throwIfAborted();
      if (this.#closed) throw new Error("SQLITE_IMAGE_SOURCE_CLOSED");
      this.#schedule();
      return Object.freeze({
        get url() {
          return released ? "" : current.url;
        },
        subscribe(listener: (url: string) => void) {
          if (released) return () => {};
          ownedListeners.add(listener);
          current.listeners.add(listener);
          listener(current.url);
          return () => {
            ownedListeners.delete(listener);
            current.listeners.delete(listener);
          };
        },
        release,
      });
    } catch (error) {
      release();
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
      signal.removeEventListener("abort", rejectAbort);
    }
  }
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    for (const entry of this.#entries.values()) {
      entry.controller.abort();
      entry.listeners.clear();
      this.#replace(entry, "", 0);
    }
    this.#entries.clear();
  }
  #schedule(): void {
    if (
      this.#closed ||
      this.#polling ||
      this.#timer !== null ||
      !this.#entries.size
    )
      return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#poll();
    }, 2000);
  }
  async #poll(): Promise<void> {
    this.#polling = true;
    try {
      const visible = [...this.#entries.values()].filter(
        (e) => e.owners && e.nextCheck <= Date.now(),
      );
      for (let i = 0; i < visible.length && !this.#closed; i += 4)
        await Promise.all(
          visible.slice(i, i + 4).map((e) => (e.pending = this.#refresh(e))),
        );
    } finally {
      this.#polling = false;
      this.#schedule();
    }
  }
  #refresh(entry: Entry): Promise<void> {
    return limitedRead(() => this.#refreshNow(entry));
  }
  async #refreshNow(entry: Entry): Promise<void> {
    const signal = entry.controller.signal;
    try {
      signal.throwIfAborted();
      const revision = await this.#content.mediaRevision!(
        entry.request,
        signal,
      );
      signal.throwIfAborted();
      if (revision === null) {
        entry.revision = null;
        this.#replace(entry, "", 0);
        this.#backoff(entry);
        return;
      }
      if (revision === entry.revision && entry.url) {
        entry.failures = 0;
        entry.nextCheck = Date.now() + 2000;
        return;
      }
      const result = await this.#content.query(entry.request, signal);
      signal.throwIfAborted();
      const asset =
        result.kind === "ok" ? (result.value as QueryMap["asset"]) : null;
      if (
        !asset ||
        !boundedMediaImage(asset.bytes, asset.mime) ||
        asset.bytes.byteLength + this.#bytes - entry.bytes > MAX_BYTES
      ) {
        this.#replace(entry, "", 0);
        entry.revision = null;
        this.#backoff(entry);
        return;
      }
      // Ignore a read spanning a replacement. Next check obtains the current revision.
      if (
        revision !== (await this.#content.mediaRevision!(entry.request, signal))
      ) {
        entry.nextCheck = 0;
        return;
      }
      signal.throwIfAborted();
      const url = URL.createObjectURL(
        new Blob([asset.bytes.slice()], { type: asset.mime }),
      );
      this.#replace(entry, url, asset.bytes.byteLength);
      entry.revision = revision;
      entry.failures = 0;
      entry.nextCheck = Date.now() + 2000;
    } catch {
      if (!signal.aborted) {
        entry.revision = null;
        this.#replace(entry, "", 0);
        this.#backoff(entry);
      }
    }
  }
  #backoff(entry: Entry): void {
    entry.failures = Math.min(3, entry.failures + 1);
    entry.nextCheck = Date.now() + 1000 * 2 ** entry.failures;
  }
  #replace(entry: Entry, url: string, bytes: number): void {
    const previous = entry.url;
    this.#bytes += bytes - entry.bytes;
    entry.url = url;
    entry.bytes = bytes;
    if (previous !== url) {
      for (const listener of entry.listeners) listener(url);
      if (previous) URL.revokeObjectURL(previous);
    }
  }
}
