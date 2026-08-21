export const INITIAL_RESULT_WINDOW = 60;
const RESULT_WINDOW_STEP = 60;

export function initialResultWindow(total: number): number {
  return Math.min(INITIAL_RESULT_WINDOW, Math.max(0, total));
}

export function nextResultWindow(current: number, total: number): number {
  return Math.min(current + RESULT_WINDOW_STEP, Math.max(0, total));
}
