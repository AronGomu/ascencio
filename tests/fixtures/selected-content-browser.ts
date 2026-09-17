import {
  openProgressiveContentStore,
  type LatestContentPointer,
} from "../../src/content/index.ts";
import { createApplicationService } from "../../src/shell/application/application-service.ts";
import { prepareRelease } from "../../src/shell/application/prepared-release.ts";
import type { StorySlotKey } from "../../src/story/saves/index.ts";
import type { StoryState } from "../../src/story/model/story-state.ts";

const store = await openProgressiveContentStore(
  location.origin + "/domain-fixture/",
);
const service = createApplicationService({
  factory: indexedDB,
  locks: navigator.locks,
  store,
  coreContentApiVersion: 1,
  isHome: () => location.hash === "#/" || location.hash === "",
});
const signal = () => new AbortController().signal;
export const selectedContent = {
  async install(pointer: LatestContentPointer) {
    await store.cacheManifest(pointer, signal());
    await service.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: pointer.manifest.version,
        chapterIds: ["chapter-01"],
        kind: "required",
      },
      signal(),
      () => undefined,
    );
    const staged = await store.sealRequired(pointer.manifest.version, [
      "chapter-01",
    ]);
    const prepared = await prepareRelease(store, staged, signal());
    try {
      return await service.activate(0, prepared, signal());
    } finally {
      prepared.dispose();
    }
  },
  async media() {
    const selection = await service.selector.read();
    await service.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: selection.content!.manifestVersion,
        chapterIds: ["chapter-01"],
        kind: "media",
      },
      signal(),
      () => undefined,
    );
  },
  async save(slot: StorySlotKey, state: StoryState) {
    const session = await service.application.acquire(signal());
    try {
      const current = await session.saves.read(slot);
      const result = await session.saves.write(
        slot,
        state,
        current.kind === "ready" ? current.envelope.revision : null,
        {
          chapterId: session.storyRelease.chapters[0]!.id,
          contentId: "prototype-prologue-v1",
          revision: session.storyRelease.revision,
          completedChapterIds: [],
        },
      );
      if (result.kind !== "written") throw new Error(JSON.stringify(result));
      return result;
    } finally {
      await session.close();
    }
  },
  async slots() {
    const session = await service.application.acquire(signal());
    try {
      return (await session.saves.list()).map(({ slot }) => slot);
    } finally {
      await session.close();
    }
  },
  async snapshot() {
    const session = await service.application.acquire(signal());
    try {
      return {
        selection: await service.selector.read(),
        slots: await Promise.all(
          (
            [
              "manual:1",
              "manual:2",
              "manual:3",
              "autosave",
              "checkpoint:pre-duel",
            ] as const
          ).map((slot) => session.saves.read(slot)),
        ),
      };
    } finally {
      await session.close();
    }
  },
  async clear(slot: StorySlotKey) {
    const session = await service.application.acquire(signal());
    try {
      await session.saves.clear(slot);
    } finally {
      await session.close();
    }
  },
  async corrupt(slot: StorySlotKey, value: unknown) {
    const session = await service.application.acquire(signal());
    try {
      const selection = await service.selector.read();
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("ygo-story-saves");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("generationSaves", "readwrite");
          tx.objectStore("generationSaves").put(value, [
            selection.storyGenerationId!,
            slot,
          ]);
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    } finally {
      await session.close();
    }
  },
};
Object.assign(globalThis, { selectedContent });
