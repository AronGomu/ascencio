/** Isolated presentation fixture; no fake gameplay acceptance or production content changes. */
import { createServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { browserBotPackagesPlugin } from "../lib/browser-bot-packages.ts";
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [svelte(), browserBotPackagesPlugin(process.cwd())],
  server: { host: "127.0.0.1", port: 4215, strictPort: true },
});
await server.listen();
server.printUrls();
