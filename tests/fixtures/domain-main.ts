import { mount, unmount } from "svelte";
import AppShell from "../../src/shell/AppShell.svelte";
import "../../src/styles/app.css";

/** Keep fault commands on the one production storage Worker, never another DB root. */
let storageWorker: Worker | null = null;
function captureStorageWorker(worker: Worker): void {
  storageWorker = worker;
}
const NativeWorker = globalThis.Worker;
globalThis.Worker = class extends NativeWorker {
  constructor(url: string | URL, options?: WorkerOptions) {
    super(url, options);
    if (options?.name === "ascencio-sqlite") captureStorageWorker(this);
  }
};
export async function fixtureFault(operation: unknown): Promise<unknown> {
  if (storageWorker === null) throw new Error("Fixture storage Worker missing");
  const channel = new MessageChannel();
  return new Promise((resolve, reject) => {
    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data.error) reject(new Error(data.error));
      else resolve(data.value);
    };
    storageWorker!.postMessage({ domainFixtureFault: operation }, [
      channel.port2,
    ]);
  });
}
Object.assign(globalThis, { domainFixtureFault: fixtureFault });
const target = document.querySelector<HTMLElement>("#app");
if (target === null) throw new Error("Application mount point is missing");
target.dataset.appShell = "ready";
const app = mount(AppShell, { target });
Object.assign(globalThis, { domainFixtureUnmount: () => unmount(app) });
