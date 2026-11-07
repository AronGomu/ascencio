import { mount, unmount } from "svelte";
import AppShell from "../../src/shell/AppShell.svelte";
import "../../src/styles/app.css";

import { fixtureFault } from "./domain-user-json-faults.ts";

Object.assign(globalThis, { domainFixtureFault: fixtureFault });
const target = document.querySelector<HTMLElement>("#app");
if (target === null) throw new Error("Application mount point is missing");
target.dataset.appShell = "ready";
const app = mount(AppShell, { target });
Object.assign(globalThis, { domainFixtureUnmount: () => unmount(app) });
