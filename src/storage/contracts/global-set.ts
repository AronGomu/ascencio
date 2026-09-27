import type { StorySet } from "../../story/ports/index.ts";

/** Global source dates may be unknown; dated chapter presentation stays strict. */
export type GlobalSet = Omit<StorySet, "releaseYear"> & {
  readonly releaseYear: number | null;
};
