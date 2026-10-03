import type { CoreStartup } from "../core/core-gate.ts";

let startup: Promise<CoreStartup> | null = null;
export async function loadCoreStartup(
  signal = new AbortController().signal,
  progress: (completed: number, total: number) => void = () => {},
): Promise<CoreStartup> {
  const { bootstrapApplication } = await import("./application-bootstrap.ts");
  return (startup ??= bootstrapApplication(signal, progress));
}
export async function closeCoreStartup(): Promise<void> {
  const current = startup;
  startup = null;
  if (current) await (await current.catch(() => null))?.dispose?.();
}
