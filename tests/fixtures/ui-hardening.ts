import { mount } from "svelte";
import "../../src/styles/app.css";
import UiHardeningHarness from "./UiHardeningHarness.svelte";

mount(UiHardeningHarness, { target: document.getElementById("app")! });
