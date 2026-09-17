import { createHash } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import type { ProgressiveManifest } from "../../src/content/index.ts";

export interface SelectedMediaRow {
  readonly path: string;
  readonly version: string;
  readonly bytes: number;
  readonly cacheKey: string;
  readonly mediaType: string;
  readonly body: string;
}

/** Capture real installed media only; no selector, save, job or required receipt. */
export async function captureSelectedMedia(
  page: Page,
  manifest: ProgressiveManifest,
): Promise<SelectedMediaRow[]> {
  const files = manifest.files.filter(({ role }) => role === "media");
  const rows: SelectedMediaRow[] = [];
  for (let start = 0; start < files.length; start += 20) {
    const batch = await page.evaluate(
      async (files) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("ygo-content-files-v1");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const cache = await caches.open("ygo-content-files-v1");
        try {
          return await Promise.all(
            files.map(async (file) => {
              const row = await new Promise<{
                path: string;
                version: string;
                bytes: number;
                cacheKey: string;
              }>((resolve, reject) => {
                const req = db
                  .transaction("files", "readonly")
                  .objectStore("files")
                  .get([file.path, file.version]);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
              });
              const response = await cache.match(row.cacheKey);
              if (!response) throw new Error("Installed media missing");
              const bytes = new Uint8Array(await response.arrayBuffer());
              let binary = "";
              for (let offset = 0; offset < bytes.length; offset += 8192)
                binary += String.fromCharCode(
                  ...bytes.subarray(offset, offset + 8192),
                );
              return { ...row, mediaType: file.mediaType, body: btoa(binary) };
            }),
          );
        } finally {
          db.close();
        }
      },
      files.slice(start, start + 20),
    );
    for (const row of batch) {
      const file = files.find(({ path }) => path === row.path)!;
      const body = Buffer.from(row.body, "base64");
      expect(row.version).toBe(file.version);
      expect(row.bytes).toBe(file.bytes);
      expect(body.length).toBe(file.bytes);
      expect(createHash("sha256").update(body).digest("hex")).toBe(
        file.version,
      );
      expect(row.cacheKey).toBe(
        new URL(
          `__content/files/${file.version}/${file.path}`,
          page.url().split("#")[0],
        ).href,
      );
      rows.push(row);
    }
  }
  return rows;
}

/** Profile restore of verified optional bytes. Required install/activation stays real. */
export async function restoreSelectedMedia(
  page: Page,
  rows: readonly SelectedMediaRow[],
) {
  for (let start = 0; start < rows.length; start += 20) {
    await page.evaluate(
      async (rows) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("ygo-content-files-v1");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const cache = await caches.open("ygo-content-files-v1");
        try {
          for (const { body, mediaType, ...row } of rows) {
            const bytes = Uint8Array.from(atob(body), (character) =>
              character.charCodeAt(0),
            );
            const hash = Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
              (byte) => byte.toString(16).padStart(2, "0"),
            ).join("");
            if (hash !== row.version || bytes.length !== row.bytes)
              throw new Error("Media profile integrity failed");
            await cache.put(
              row.cacheKey,
              new Response(bytes, { headers: { "Content-Type": mediaType } }),
            );
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction("files", "readwrite");
              tx.objectStore("files").put(row, [row.path, row.version]);
              tx.oncomplete = () => resolve();
              tx.onabort = () => reject(tx.error);
            });
          }
        } finally {
          db.close();
        }
      },
      rows.slice(start, start + 20),
    );
  }
}
