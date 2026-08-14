export {
  computeStageBox,
  selectStageMode,
  STAGE_ASPECT_HEIGHT,
  STAGE_ASPECT_WIDTH,
  STAGE_BREAKPOINT_PX,
  type StageBox,
  type StageMode,
} from "./stage-layout.ts";

/** Domains read the live stage box with `getContext(STAGE_CONTEXT_KEY)`; the
    value is a readable store of `StageBox`, so no domain has to measure the
    viewport or import shell internals itself. */
export const STAGE_CONTEXT_KEY = "shell:stage";
