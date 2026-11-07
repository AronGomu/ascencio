import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productionCallers = [
  "src/shell/screens/free-play-deck-actions.ts",
  "src/shell/screens/free-play-deck-listing.ts",
  "src/shell/screens/FreePlayMatchSetup.svelte",
  "src/battle/app/App.svelte",
  "src/shell/admin/AdminConsole.svelte",
  "src/decks/deck-repository-context.ts",
  "src/shell/AppShell.svelte",
  "src/shell/settings/shell-settings-store.ts",
  "src/battle/app/stores/persisted-ui-store.ts",
  "src/story/playback/story-playback-settings-store.ts",
  "src/story/StoryApp.svelte",
] as const;

describe("production user persistence callers", () => {
  it.each(productionCallers)(
    "has no live legacy user storage bypass in %s",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(
        /IndexedDbDeckRepository(?:\.open)?|globalThis\.localStorage|readStoryReadLog\(|writeStoryReadLog\(|readShellSettings\(|writeShellSettings\(|readPersistedUiState\(|writePersistedUiState\(|hasPersistedUiState\(|readStoryPlaybackSettings\(|writeStoryPlaybackSettings\(/,
      );
    },
  );
});

it.each([
  "application-service",
  "application-selector",
  "application-readiness",
])("%s has no live migration compatibility or argument casts", (name) => {
  expect(existsSync(`src/shell/application/${name}.ts`)).toBe(false);
});

it("confirmed preference reset invalidates Shell domain-mount snapshots too", () => {
  const source = readFileSync("src/shell/AppShell.svelte", "utf8");
  const reset = source.slice(
    source.indexOf("async function resetUserTarget("),
    source.indexOf("export let initialCoreGate"),
  );
  expect(reset).toContain('target.namespaces.includes("preferences")');
  // Battle mounts read the owner's committed snapshot, never a startup copy.
  expect(source).not.toContain("initialBattlePreferences");
  expect(source).toContain(
    "initialPersistedUi={userPersistence?.hydrated.battle",
  );
  expect(source).toMatch(
    /initialPersistedUiPresent=\{userPersistence\?\.hydrated\s*\.battlePresent \?\? false\}/,
  );
  const owner = readFileSync(
    "src/shell/application/user-persistence-owner.ts",
    "utf8",
  );
  const ownerReset = owner.slice(
    owner.indexOf("reset(namespaces: readonly UserNamespace[]) {"),
    owner.indexOf("exportUserData: () =>"),
  );
  expect(ownerReset).toContain('if (result.kind === "ok")');
  expect(ownerReset).toContain('selected.includes("preferences")');
  expect(ownerReset).toContain("battle: defaultPersistedUiState()");
  expect(ownerReset).toContain("battlePresent: false");
  expect(reset).toContain(
    "initialStoryPlayback = DEFAULT_STORY_PLAYBACK_SETTINGS",
  );
  expect(reset).toContain("DEFAULT_SHELL_SETTINGS");
  expect(reset).toContain('target.namespaces.includes("story-read-log")');
  expect(reset).toContain("initialStoryReadLog = new Set()");
});
