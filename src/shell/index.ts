export {
  computeStageBox,
  selectStageMode,
  STAGE_ASPECT_HEIGHT,
  STAGE_ASPECT_WIDTH,
  STAGE_BREAKPOINT_PX,
  type StageBox,
  type StageMode,
} from "./stage-layout.ts";

/* The card preview is one component shared by the duel and the deck editor.
   ADR-022 forbids the deck editor from reaching `src/battle/app/components/`,
   and `src/battle/index.ts` cannot carry it either: that entry also exports
   `BattleFacade`, so importing it would make the duel eager. The shell entry is
   the legal shared home (ADR-036). */
export { default as CardPreviewPanel } from "./card-preview/CardPreviewPanel.svelte";
export { default as OverlayScrollbar } from "./card-preview/OverlayScrollbar.svelte";
export type {
  CardPreviewImageSource,
  CardPreviewView,
} from "./card-preview/card-preview-view.ts";

/** Domains read the live stage box with `getContext(STAGE_CONTEXT_KEY)`; the
    value is a readable store of `StageBox`, so no domain has to measure the
    viewport or import shell internals itself. */
export const STAGE_CONTEXT_KEY = "shell:stage";

export {
  TOAST_CONTEXT_KEY,
  type ToastPublisher,
  type ToastRequest,
  type ToastTone,
} from "./toast/toast-context.ts";
