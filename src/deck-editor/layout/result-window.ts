export const INITIAL_RESULT_WINDOW = 60;
export const RESULT_WINDOW_STEP = 60;

export function initialResultWindow(total: number): number {
  return Math.min(INITIAL_RESULT_WINDOW, Math.max(0, total));
}

export function nextResultWindow(
  current: number,
  total: number,
  step = RESULT_WINDOW_STEP,
): number {
  return Math.min(current + step, Math.max(0, total));
}
