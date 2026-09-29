import type { CardImageSource } from "../../../cards/images/index.ts";
import { createSemanticImageLeases } from "./semantic-image-leases.ts";
import {
  snapshotId,
  type CardCode,
  type SnapshotId,
} from "../../duel/contracts/ids.ts";
export type CardImageDiagnosticStatus =
  "cache-hit" | "cache-miss" | "missing" | "invalid";

export interface CardImageDiagnostic {
  readonly code: number;
  readonly status: CardImageDiagnosticStatus;
  readonly source: string;
  readonly detail?: string;
}

export interface CardImageLease {
  readonly url: string;
  /** Immediate snapshot, then readiness updates; release removes all listeners. */
  subscribe?(listener: (url: string) => void): () => void;
  release(): void;
}

export interface CardImageLibrary {
  readonly snapshotId: SnapshotId;
  readonly imageManifestSha256: string;
  readonly provider: "semantic-source";
  readonly cardBackUrl: string;
  readonly placeholderUrl: string;
  readonly diagnostics: readonly CardImageDiagnostic[];
  lease(code: CardCode | number): CardImageLease;
  dispose(): void;
}

export async function createCardImageSourceLibrary(
  source: CardImageSource | null,
  codes: readonly number[],
  runtimeSnapshotId: string,
  catalogRevision: string,
  onProgress: (completed: number, total: number) => void = () => undefined,
  signal?: AbortSignal,
): Promise<CardImageLibrary> {
  const cardBackUrl = svgDataUrl("Card back", "#241037", "#d9a441", "#6f2d62");
  const placeholderUrl = svgDataUrl(
    "Image unavailable",
    "#172033",
    "#76839a",
    "#27344d",
  );
  const mounted = createSemanticImageLeases(
    source,
    codes,
    placeholderUrl,
    onProgress,
    signal,
  );
  return Object.freeze({
    snapshotId: snapshotId(runtimeSnapshotId),
    imageManifestSha256: catalogRevision,
    provider: "semantic-source" as const,
    cardBackUrl,
    placeholderUrl,
    get diagnostics() {
      return mounted.diagnostics;
    },
    lease: mounted.lease,
    dispose: mounted.dispose,
  });
}

function svgDataUrl(
  label: string,
  background: string,
  foreground: string,
  accent: string,
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="260" viewBox="0 0 180 260"><rect width="180" height="260" rx="10" fill="${background}"/><rect x="10" y="10" width="160" height="240" rx="7" fill="none" stroke="${foreground}" stroke-width="5"/><path d="M30 130c30-70 90-70 120 0-30 70-90 70-120 0Z" fill="${accent}" stroke="${foreground}" stroke-width="4"/><text x="90" y="226" fill="${foreground}" text-anchor="middle" font-family="sans-serif" font-size="12">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
