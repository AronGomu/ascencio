import { fixtureFetch } from "./fixture-fetch.ts";
import { botHostCall } from "../../../src/battle/app/bots/package-host.ts";
const params = new URLSearchParams(location.search);
const runtime =
  (await fixtureFetch("/fixture/runtime").then((r) => r.json())) ??
  params.get("runtime") ??
  "wasm";
const worker = new Worker(new URL("./smoke.worker.ts", import.meta.url), {
  type: "module",
});
const mode = await fixtureFetch("/fixture/mode").then((r) => r.json());
const status = document.querySelector("pre")!;
worker.onmessage = async (event) => {
  const message = event.data;
  if (message.type === "memoryReady") {
    const api = performance as Performance & {
      measureUserAgentSpecificMemory?: () => Promise<unknown>;
    };
    let result: unknown;
    try {
      if (params.has("holdMemory")) {
        result = {
          method: "External Linux process-tree RSS sampling; bot retained",
        };
      } else {
        if (!api.measureUserAgentSpecificMemory)
          throw new Error("measureUserAgentSpecificMemory unavailable");
        result = await api.measureUserAgentSpecificMemory();
      }
    } catch (error) {
      result = { error: String(error) };
    }
    const report = {
      type: "complete",
      runtime,
      mode,
      environment: navigator.userAgent,
      crossOriginIsolated,
      result,
      scope:
        "Whole isolated page and workers, after 100 decisions with live bot and identical saved inputs; browser-enforced GC measurement outside timing",
    };
    status.textContent = JSON.stringify(report, null, 2);
    await fixtureFetch(`/fixture/result/${runtime}-memory`, {
      method: "POST",
      body: JSON.stringify(report),
    });
    if (!params.has("holdMemory")) worker.terminate();
    return;
  }

  if (message.type === "botHostCall") {
    try {
      worker.postMessage({
        type: "botHostResult",
        id: message.id,
        value: await botHostCall(message),
      });
    } catch (error) {
      worker.postMessage({
        type: "botHostResult",
        id: message.id,
        error: String(error),
      });
    }
    return;
  }
  status.textContent = JSON.stringify(message, null, 2);
  if (message.type === "complete" || message.type === "failed") {
    await fixtureFetch(
      `/fixture/result/${runtime}${mode === "smoke" ? "" : "-" + mode}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message),
      },
    );
    worker.terminate();
  }
};
worker.onerror = (event) => {
  status.textContent = event.message;
  void fixtureFetch(
    `/fixture/result/${runtime}${mode === "smoke" ? "" : "-" + mode}`,
    {
      method: "POST",
      body: JSON.stringify({ type: "failed", message: event.message }),
    },
  );
};
worker.postMessage({ runtime, mode });
