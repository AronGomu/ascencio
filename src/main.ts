import { mount } from "svelte";
import AppShell from "./shell/AppShell.svelte";
import "./styles/app.css";

const target = document.querySelector<HTMLElement>("#app");
if (target === null) throw new Error("Application mount point is missing");

try {
  target.dataset.appShell = "ready";
  mount(AppShell, { target });
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
      : "Required application code failed to load.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Retry";
  retry.addEventListener("click", () => globalThis.location.reload());
  main.append(heading, message, retry);
  target.append(main);
}
