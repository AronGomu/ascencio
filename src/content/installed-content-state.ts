import type { ContentReadPort } from "./contracts/content-read-port.ts";
import type { ContentResult } from "./contracts/content-result.ts";
import type { ContentSetRef } from "./contracts/content-set-ref.ts";

export interface InstalledContentState {
  readonly inspections: Map<string, Promise<ContentResult<ContentSetRef>>>;
  readonly listeners: Set<() => void>;
  revision: number;
}

const states = new WeakMap<ContentReadPort, InstalledContentState>();

export function installedContentState(
  reader: ContentReadPort,
): InstalledContentState {
  const existing = states.get(reader);
  if (existing !== undefined) return existing;
  const state: InstalledContentState = {
    inspections: new Map(),
    listeners: new Set(),
    revision: 0,
  };
  states.set(reader, state);
  reader.subscribeCurrent(() => {
    state.revision += 1;
    state.inspections.clear();
    for (const listener of state.listeners) listener();
  });
  return state;
}
