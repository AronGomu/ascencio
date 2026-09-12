/// <reference lib="webworker" />

import { PrecacheController } from "workbox-precaching";
import {
  assertShellPrecacheEntries,
  isAppNavigationRequest,
  SHELL_CACHE_PREFIX,
  shellCacheName,
} from "./shell/pwa/shell-cache-policy.ts";

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = shellCacheName(__APP_BUILD_ID__);
const precache = new PrecacheController({ cacheName });
const manifest = assertShellPrecacheEntries(
  (self as unknown as ServiceWorkerGlobalScope).__WB_MANIFEST,
);

precache.precache([...manifest]);

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
