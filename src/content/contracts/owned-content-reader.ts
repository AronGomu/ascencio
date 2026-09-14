import type { ContentReadPort } from "./content-read-port.ts";

/** Caller owns database/channel lifetime until explicitly transferred. */
export interface OwnedContentReader extends ContentReadPort {
  close(): void;
}
