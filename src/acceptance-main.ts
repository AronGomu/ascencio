import { mount } from "svelte";
import AcceptanceHarness from "./app/acceptance/AcceptanceHarness.svelte";
import "./styles/app.css";

mount(AcceptanceHarness, { target: document.getElementById("app")! });
