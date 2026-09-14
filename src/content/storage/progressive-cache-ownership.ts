import { progressivePath } from "../parsers/progressive-file.ts";
import { applicationBase, progressiveFileKey } from "./content-cache.ts";

/** Only canonical GET keys in this app's progressive cache are owned. */
export function ownedProgressiveCacheKey(request: Request): string | null {
  const prefix = `${applicationBase()}__content/files/`;
  if (request.method !== "GET" || !request.url.startsWith(prefix)) return null;
  const match = /^([a-f0-9]{64})\/(.+)$/.exec(request.url.slice(prefix.length));
  if (!match) return null;
  const version = match[1]!;
  const path = match[2]!;
  try {
    progressivePath(path);
  } catch {
    return null;
  }
  const canonical = progressiveFileKey(path, version);
  return request.url === canonical ? canonical : null;
}
