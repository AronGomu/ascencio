import { mount } from "svelte";
import AppShell from "./shell/AppShell.svelte";
import { registerServiceWorker } from "./shell/pwa/register-service-worker.ts";
import { isNativeApp, seedNativeContent } from "./shell/native/content.ts";
import "./styles/app.css";

const target = document.querySelector<HTMLElement>("#app");
if (target === null) throw new Error("Application mount point is missing");

async function start(target: HTMLElement): Promise<void> {
  try {
    if (isNativeApp()) {
      target.textContent = "Checking installed content…";
      await seedNativeContent();
    }
    target.dataset.appShell = "ready";
    target.replaceChildren();
    mount(AppShell, { target });
    /* Registration reports every outcome through Settings. No activation request
     is sent: updated code waits until every old controlled tab has closed. */
    if (!isNativeApp()) void registerServiceWorker();
  } catch (error) {
    target.replaceChildren();
    const main = document.createElement("main");
    main.setAttribute("role", "alert");
    const heading = document.createElement("h1");
    heading.textContent = "Application could not start";
    const message = document.createElement("p");
    message.textContent =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Required application code failed to load.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => globalThis.location.reload());
    main.append(heading, message, retry);
    target.append(main);
  }
}

void start(target);
