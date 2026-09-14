import {
  openProgressiveContentStore,
  type LatestContentPointer,
} from "../../src/content/index.ts";
import { createApplicationService } from "../../src/shell/application/application-service.ts";
import { createApplicationSelector } from "../../src/shell/application/application-selector.ts";
import {
  prepareRelease,
  type PreparedRelease,
} from "../../src/shell/application/prepared-release.ts";
import { createStoryMigrationPort } from "../../src/story/saves/index.ts";
import { createInitialStoryState } from "../../src/story/model/story-state.ts";
import type { ShellDomainSession } from "../../src/shell/core/shell-application.ts";

const store = await openProgressiveContentStore(
  location.origin + "/atomic-fixture/",
);
const service = createApplicationService({
  factory: indexedDB,
  locks: navigator.locks,
  store,
  coreContentApiVersion: 1,
  isHome: () => location.hash === "#/" || location.hash === "",
});
let prepared: PreparedRelease | null = null;
let held: ShellDomainSession | null = null;
const signal = () => new AbortController().signal;
export const atomic = {
  async stage(pointer: LatestContentPointer) {
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
    prepared = await prepareRelease(store, staged, signal());
    return staged;
  },
  async candidate() {
    const selection = await service.selector.read();
    prepared = await prepareRelease(store, selection.content!, signal());
  },
  read: () => service.selector.read(),
  activate: (expected: number) =>
    service.activate(expected, prepared!, signal()),
  async notifyThrow(expected: number) {
    const selector = createApplicationSelector({
      factory: indexedDB,
      locks: navigator.locks,
      store,
      coreContentApiVersion: 1,
      notify: () => {
        throw new Error("fixture notification failed");
      },
      notificationError: () =>
        console.log("notification failure observed after commit"),
    });
    return selector.activate(
      expected,
      prepared!,
      createStoryMigrationPort(indexedDB),
      signal(),
    );
  },
  async hold() {
    held = await service.application.acquire(signal());
  },
  async release() {
    await held?.close();
    held = null;
  },
  async save(dp: number) {
    const session = await service.application.acquire(signal());
    try {
      const chapter = session.storyRelease.chapters[0]!;
      const current = await session.saves.read("manual:1");
      return await session.saves.write(
        "manual:1",
        {
          ...createInitialStoryState(),
          screen: "narrative",
          progressExists: true,
          dp,
        },
        current.kind === "ready" ? current.envelope.revision : null,
        {
          chapterId: chapter.id,
          contentId: "prototype-prologue-v1",
          revision: session.storyRelease.revision,
          completedChapterIds: [],
        },
      );
    } finally {
      await session.close();
    }
  },
  async checkpoint() {
    const session = await service.application.acquire(signal());
    try {
      const chapter = session.storyRelease.chapters[0]!;
      return await session.saves.write(
        "checkpoint:pre-duel",
        {
          ...createInitialStoryState(),
          encounterId: "old-arena",
          pendingHandoffId: "native-handoff",
        },
        null,
        {
          chapterId: chapter.id,
          contentId: "prototype-prologue-v1",
          revision: session.storyRelease.revision,
          completedChapterIds: [],
        },
      );
    } finally {
      await session.close();
    }
  },
  async saved() {
    const session = await service.application.acquire(signal());
    try {
      return await session.saves.read("manual:1");
    } finally {
      await session.close();
    }
  },
  download: (version: string) =>
    service.download(
      {
        jobId: crypto.randomUUID(),
        manifestVersion: version,
        chapterIds: ["chapter-01"],
        kind: "media",
      },
      signal(),
      () => undefined,
    ),
};
Object.assign(globalThis, { atomic });
