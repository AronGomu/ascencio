<script lang="ts">
  import FreePlayMatchSetup from "../../../src/shell/screens/FreePlayMatchSetup.svelte";
  import { shellGameplayFixture } from "../../fixtures/shell-gameplay.ts";
  import { createShellSettingsStore } from "../../../src/shell/settings/shell-settings-store.ts";
  import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/shell-settings.ts";
  import { presentationPreferencePort } from "../../fixtures/presentation-preference-port.ts";
  import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";
  import type { DeckRepository } from "../../../src/decks/repository/index.ts";
  import { installedSelectableDecks } from "../../../src/battle/decks/installed-selectable-decks.ts";
  import { findSelectableDeck } from "../../../src/battle/decks/selectable-decks.ts";
  import { parseBattleRequest } from "../../../src/battle/battle-contracts.ts";
  import {
    listBotPackages,
    assertBotAvailable,
  } from "../../../src/battle/app/bots/package-host.ts";
  let width = 1280,
    height = 800;
  const gameplay = shellGameplayFixture();
  const settings = createShellSettingsStore(
    DEFAULT_SHELL_SETTINGS,
    presentationPreferencePort(DEFAULT_SHELL_SETTINGS),
  );
  const unsupported = async () => {
    throw new Error("Read-only UI fixture");
  };
  const repository: DeckRepository = {
    list: async () => [],
    load: async () => null,
    create: unsupported,
    createAndOpen: unsupported,
    save: unsupported,
    delete: unsupported,
    getLastOpened: async () => null,
    setLastOpened: unsupported,
    clearLastOpened: unsupported,
    getDefaultDeck: async () => null,
    setDefaultDeck: unsupported,
    appendAutosave: unsupported,
    listAutosaves: async () => [],
  };
  const loadBattle = async () => ({
    installedSelectableDecks,
    findSelectableDeck,
    parseBattleRequest,
    listBotPackages,
    assertBotAvailable,
  });
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />
<main
  class="app-stage"
  data-stage-route="free-play"
  data-layout-mode={width > height ? "horizontal" : "vertical"}
  style="height:100dvh"
>
  <FreePlayMatchSetup
    presentation={gameplay.presentation}
    ruleset={PROTOTYPE_RULESET}
    {settings}
    createRepository={() => repository}
    {loadBattle}
    onstart={() => {}}
    onback={() => {}}
    ondecks={() => {}}
  />
</main>
