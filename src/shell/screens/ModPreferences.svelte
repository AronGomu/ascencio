<script lang="ts">
  import { onMount } from "svelte";
  import {
    DEFAULT_MOD_PREFERENCES,
    isModPreferences,
    openLocalStorage,
    invokeNative,
    type ModPreferences,
    type LocalStorageClient,
    type UserRecord,
  } from "../../storage/index.ts";
  import { isNativeDesktop } from "../native/content.ts";
  let storage: LocalStorageClient | null = null;
  let record: UserRecord | null = null;
  let mode: ModPreferences["mode"] = "normal";
  let root: ModPreferences["root"] = DEFAULT_MOD_PREFERENCES.root;
  let enabled = "";
  let busy = true;
  let message = "Loading mod settings…";
  let alive = true;
  const desktop = isNativeDesktop();
  onMount(() => {
    void (async () => {
      try {
        const result = await openLocalStorage();
        if (result.kind === "failed") throw new Error(result.error.code);
        const saved = await result.value.userData.readUser(
          "preferences",
          "content-mods",
        );
        if (saved.kind === "failed") throw new Error(saved.error.code);
        if (!alive) return;
        storage = result.value;
        record = saved.value;
        const prefs = record?.payload ?? DEFAULT_MOD_PREFERENCES;
        if (!isModPreferences(prefs))
          throw new Error("MOD_PREFERENCES_INVALID");
        mode = prefs.mode;
        root = prefs.root;
        enabled = prefs.enabled.join(", ");
        message = "Changes apply after restarting the application.";
      } catch (error) {
        if (alive)
          message = error instanceof Error ? error.message : String(error);
      } finally {
        if (alive) busy = false;
      }
    })();
    return () => {
      alive = false;
    };
  });
  async function run(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try {
      await action();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
    }
  }
  async function chooseRoot() {
    const selected = await invokeNative<string | null>(
      "native_mods_choose_root",
    );
    if (selected) root = { kind: "desktop", path: selected };
  }
  async function save() {
    const preferences: ModPreferences = {
      schemaVersion: 1,
      mode,
      root,
      enabled: enabled
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    };
    if (!isModPreferences(preferences))
      throw new Error("Enter up to 32 unique mod IDs, separated by commas.");
    if (!storage) throw new Error("Mod settings are unavailable.");
    const result = await storage.userData.writeUser([
      {
        kind: "put",
        namespace: "preferences",
        key: "content-mods",
        expectedRevision: record?.revision ?? null,
        payload: preferences,
      },
    ]);
    if (result.kind === "failed") throw new Error(result.error.code);
    record = result.value[0] ?? null;
    message = "Mod settings saved. Restart the application to use them.";
  }
  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    try {
      if (!file) return;
      await run(async () => {
        if (file.size > 128 * 1024 * 1024)
          throw new Error("Mod bundle exceeds 128 MiB.");
        const id = await invokeNative<string>("native_mods_import", {
          source: await file.text(),
        });
        root = { kind: "managed", path: null };
        message = `Imported ${id}. Add its ID to enabled mods, save settings, then restart.`;
      });
    } finally {
      input.value = "";
    }
  }
</script>

<section data-cy="mod-settings" aria-labelledby="mod-settings-heading">
  <h2 id="mod-settings-heading" data-cy="mod-settings-heading">Mods</h2>
  <p data-cy="mod-settings-status" role="status" aria-live="polite">
    {message}
  </p>
  <label data-cy="mod-mode-label" for="mod-mode">Content mode</label>
  <select
    id="mod-mode"
    data-cy="mod-mode"
    bind:value={mode}
    disabled={busy || !storage}
  >
    <option data-cy="mod-mode-normal" value="normal">Official content</option>
    <option data-cy="mod-mode-modded" value="modded">Enabled mods</option>
  </select>
  <p data-cy="mod-root">
    Mod folder: {root.kind === "managed" ? "App-managed imports" : root.path}
  </p>
  {#if desktop}
    <button
      data-cy="mod-choose-folder"
      disabled={busy || !storage}
      onclick={() => run(chooseRoot)}>Choose folder</button
    >
    <button
      data-cy="mod-use-managed"
      disabled={busy || !storage}
      onclick={() => {
        root = { kind: "managed", path: null };
      }}>Use app-managed imports</button
    >
  {/if}
  <label data-cy="mod-import-label" for="mod-import">Import mod bundle</label>
  <input
    id="mod-import"
    data-cy="mod-import"
    type="file"
    accept=".json,application/json"
    disabled={busy || !storage}
    onchange={importFile}
  />
  <label data-cy="mod-enabled-label" for="mod-enabled"
    >Enabled mod IDs, separated by commas</label
  >
  <input
    id="mod-enabled"
    data-cy="mod-enabled"
    bind:value={enabled}
    disabled={busy || !storage}
    spellcheck="false"
    placeholder="my-cards, my-story"
  />
  <button
    data-cy="mod-save-settings"
    disabled={busy || !storage}
    onclick={() => run(save)}>Save mod settings</button
  >
</section>

<style>
  section {
    display: grid;
    gap: 0.75rem;
    margin-block: 1.5rem;
    padding-block: 1rem;
    border-block-start: 1px solid var(--border);
  }
  input,
  select,
  button {
    min-height: 44px;
    padding: 0.6rem;
    color: var(--text);
    background: var(--panel);
    border: 1px solid var(--border);
    font: inherit;
  }
  button {
    justify-self: start;
  }
  :is(input, select, button):focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
</style>
