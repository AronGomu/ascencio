/// <reference lib="webworker" />

import { PrecacheController } from "workbox-precaching";
import { readCoreApproval } from "./shell/application/core-update-approval.ts";
import {
  assertShellPrecacheEntries,
  installShellPrecache,
  isAppNavigationRequest,
  isFirstCoreInstall,
  SHELL_CACHE_PREFIX,
  shellCacheName,
} from "./shell/pwa/shell-cache-policy.ts";

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = shellCacheName(__APP_BUILD_ID__);
const precache = new PrecacheController({ cacheName });
const manifest = assertShellPrecacheEntries(
  (self as unknown as ServiceWorkerGlobalScope).__WB_MANIFEST,
);
precache.addToCacheList([...manifest]);

worker.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const firstInstall = isFirstCoreInstall(
        worker.registration.active !== null,
        await worker.caches.keys(),
      );
      if (!firstInstall) {
        const approval = await readCoreApproval(worker.indexedDB);
        if (
          approval === null ||
          approval.buildId !== __APP_BUILD_ID__ ||
          approval.coreContentApiVersion !== __CORE_CONTENT_API_VERSION__
        )
          throw new Error("CORE_UPDATE_NOT_APPROVED");
      }
      await installShellPrecache(
        firstInstall,
        async () => await precache.install(event),
        async () => await worker.caches.delete(cacheName),
      );
    })(),
  );
});

worker.addEventListener("message", (event) => {
  if (event.data !== "CORE_BUILD_IDENTITY") return;
  event.ports[0]?.postMessage({
    buildId: __APP_BUILD_ID__,
    coreContentApiVersion: __CORE_CONTENT_API_VERSION__,
  });
});

const indexUrl = new URL("index.html", worker.registration.scope).href;
worker.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (
    event.request.mode === "navigate" &&
    isAppNavigationRequest(event.request.url, worker.registration.scope)
  ) {
    event.respondWith(
      precache
        .matchPrecache(indexUrl)
        .then((response) => response ?? fetch(event.request)),
    );
    return;
  }
  if (precache.getCacheKeyForURL(event.request.url) === undefined) return;
  event.respondWith(
    precache
      .matchPrecache(event.request)
      .then((response) => response ?? fetch(event.request)),
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    worker.caches.keys().then(async (names) => {
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== cacheName,
          )
          .map(async (name) => await worker.caches.delete(name)),
      );
    }),
  );
});
