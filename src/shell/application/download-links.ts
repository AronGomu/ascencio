import configuredLinks from "../../../assets/app/download-links.json" with { type: "json" };
import type { PackageId } from "../../storage/index.ts";

export interface PackageDownloadLink {
  readonly packageId: PackageId;
  readonly title: string;
  readonly url: string | null;
}

export function parseDownloadLinks(
  value: unknown,
): readonly PackageDownloadLink[] {
  if (!record(value) || exactKeys(value, ["links", "schemaVersion"]) === false)
    throw invalid();
  if (value.schemaVersion !== 1 || !Array.isArray(value.links)) throw invalid();
  const seen = new Set<PackageId>();
  const links = value.links.map((candidate): PackageDownloadLink => {
    if (
      !record(candidate) ||
      !exactKeys(candidate, ["packageId", "title", "url"]) ||
      !packageId(candidate.packageId) ||
      typeof candidate.title !== "string" ||
      candidate.title.length === 0 ||
      candidate.title.length > 128 ||
      !(candidate.url === null || validHttpsUrl(candidate.url)) ||
      seen.has(candidate.packageId)
    )
      throw invalid();
    seen.add(candidate.packageId);
    return Object.freeze({
      packageId: candidate.packageId,
      title: candidate.title,
      url: candidate.url,
    });
  });
  return Object.freeze(links);
}

export const PACKAGE_DOWNLOAD_LINKS = parseDownloadLinks(configuredLinks);

function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.href === value
    );
  } catch {
    return false;
  }
}

function packageId(value: unknown): value is PackageId {
  return (
    value === "duel-core" ||
    value === "card-library" ||
    value === "freeplay" ||
    (typeof value === "string" &&
      /^chapter-(?:0[1-9]|[1-9][0-9]+)$/.test(value))
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
}

function invalid(): Error {
  return new Error("DOWNLOAD_LINKS_INVALID");
}
