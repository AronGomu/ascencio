// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const workerClientSpies = vi.hoisted(() => {
  const runtimeSnapshotId = "a".repeat(64);
  Object.assign(globalThis, {
    __RUNTIME_SNAPSHOT_ID__: runtimeSnapshotId,
    __ACTIVATION_SNAPSHOT_ID__: runtimeSnapshotId,
    __ACTIVE_CARD_TEXTS__: [],
    __RUNTIME_MANIFEST_SHA256__: "b".repeat(64),
    __ACTIVE_IMAGE_MANIFEST_SHA256__: "c".repeat(64),
    __RUNTIME_REVISIONS__: {},
    __ACTIVE_IMAGE_MANIFEST__: {
      snapshotId: runtimeSnapshotId,
      files: [],
      missing: [],
    },
    __APP_BUILD_ID__: "component-test",
  });
  return { startDuel: vi.fn(), respond: vi.fn() };
});

vi.mock("../../src/app/DuelWorkerClient.ts", () => {
  class DuelWorkerClientMock {
    static instances: DuelWorkerClientMock[] = [];
    context = { workerGeneration: 1, sessionGeneration: 0 };
    listeners = new Set<(received: unknown) => void>();

    constructor() {
      DuelWorkerClientMock.instances.push(this);
    }

    subscribe(listener: (received: unknown) => void) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    initialize() {
      queueMicrotask(() => {
        for (const listener of this.listeners)
          listener({
            context: this.context,
            event: { type: "ready", coreVersion: [11, 0] },
          });
      });
      return true;
    }

    startDuel(...args: unknown[]) {
      workerClientSpies.startDuel(...args);
      this.context = { ...this.context, sessionGeneration: 1 };
      return this.context;
    }

    respond(...args: unknown[]) {
      workerClientSpies.respond(...args);
      return false;
    }

    surrender() {
      return false;
    }

    requestDiagnostics() {
      return false;
    }

    async replace() {
      this.context = {
        workerGeneration: this.context.workerGeneration + 1,
        sessionGeneration: 0,
      };
      return { graceful: true };
    }

    async dispose() {
      return { graceful: true };
    }
  }

  return { DuelWorkerClient: DuelWorkerClientMock };
});

import App from "../../src/app/App.svelte";
import { DuelWorkerClient as MockedDuelWorkerClient } from "../../src/app/DuelWorkerClient.ts";
import MenuDialog from "../../src/app/components/MenuDialog.svelte";
import SettingsDialog from "../../src/app/components/SettingsDialog.svelte";
import {
  choiceId,
  promptId,
  snapshotId,
} from "../../src/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/duel/contracts/player-prompt.ts";
import type { PublicDuelState } from "../../src/duel/contracts/public-duel-state.ts";

interface MockedWorkerInstance {
  readonly context: { workerGeneration: number; sessionGeneration: number };
  readonly listeners: Set<(received: unknown) => void>;
}
interface MockedWorkerClientCtor {
  instances: MockedWorkerInstance[];
}

const mockedWorkerClientCtor =
  MockedDuelWorkerClient as unknown as MockedWorkerClientCtor;

afterEach(() => {
  cleanup();
  localStorage.clear();
  workerClientSpies.startDuel.mockReset();
  workerClientSpies.respond.mockReset();
  mockedWorkerClientCtor.instances.length = 0;
});

async function renderReadyApp() {
  const rendered = render(App);
  await vi.waitFor(() =>
    expect(document.querySelector('[data-cy="deck-picker"]')).not.toBeNull(),
  );
  return rendered;
}

async function startDuelFromPicker(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(
    document.querySelector(
      '[data-cy="deck-picker-option-player-burning-abyss"]',
    ) as HTMLButtonElement,
  );
  await user.click(
    document.querySelector(
      '[data-cy="deck-picker-option-opponent-shaddoll"]',
    ) as HTMLButtonElement,
  );
  await user.click(
    document.querySelector(
      '[data-cy="deck-picker-start-button"]',
    ) as HTMLButtonElement,
  );
}

const EMPTY_SNAPSHOT: PublicDuelState = {
  snapshotId: snapshotId("d".repeat(64)),
  revision: 1,
  turn: 1,
  turnPlayer: 0,
  phase: "main1",
  layout: { extraMonsterZones: true },
  players: [
    {
      player: 0,
      lifePoints: 8000,
      deckCount: 40,
      deck: [],
      extraDeckCount: 0,
      handCount: 0,
      hand: [],
      extraDeck: [],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
    },
    {
      player: 1,
      lifePoints: 8000,
      deckCount: 40,
      deck: [],
      extraDeckCount: 0,
      handCount: 0,
      hand: [],
      extraDeck: [],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
    },
  ],
  chain: [],
};

function emitDuelState(state: PublicDuelState): void {
  const worker =
    mockedWorkerClientCtor.instances[
      mockedWorkerClientCtor.instances.length - 1
    ];
  if (worker === undefined) throw new Error("No mocked worker client instance");
  for (const listener of worker.listeners)
    listener({ context: worker.context, event: { type: "state", state } });
}

function emitPrompt(prompt: PlayerPrompt): void {
  const worker =
    mockedWorkerClientCtor.instances[
      mockedWorkerClientCtor.instances.length - 1
    ];
  if (worker === undefined) throw new Error("No mocked worker client instance");
  for (const listener of worker.listeners)
    listener({ context: worker.context, event: { type: "prompt", prompt } });
}

const LINK_FREE_SNAPSHOT: PublicDuelState = {
  ...EMPTY_SNAPSHOT,
  layout: { extraMonsterZones: false },
};

const SHARED_ZONE_PLACE_PROMPT: PlayerPrompt = {
  id: promptId("shared-zone-place"),
  kind: "selectPlace",
  player: 0,
  title: "Select field location(s)",
  choices: [
    {
      id: choiceId("shared-zone-place-5"),
      label: "Shared Extra Monster Zone left",
      action: "select",
      place: { player: 0, location: "monster", sequence: 5 },
    },
  ],
  minimum: 1,
  maximum: 1,
  cancelable: false,
  ordered: false,
};

async function startLinkFreeConflict(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await startDuelFromPicker(user);
  emitDuelState(LINK_FREE_SNAPSHOT);
  emitPrompt(SHARED_ZONE_PLACE_PROMPT);
  await vi.waitFor(() =>
    expect(
      document.querySelector('[data-cy="layout-profile-conflict"]'),
    ).not.toBeNull(),
  );
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

describe("App", () => {
  it("shows the deck picker instead of auto-starting", async () => {
    await renderReadyApp();

    expect(document.querySelector('[data-cy="deck-picker"]')).not.toBeNull();
    expect(workerClientSpies.startDuel).not.toHaveBeenCalled();
  });

  it("starting from the picker passes pair-derived preset id and both deck ids", async () => {
    const user = userEvent.setup();
    await renderReadyApp();

    await user.click(
      document.querySelector(
        '[data-cy="deck-picker-option-player-burning-abyss"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="deck-picker-option-opponent-shaddoll"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="deck-picker-start-button"]',
      ) as HTMLButtonElement,
    );

    expect(workerClientSpies.startDuel).toHaveBeenCalledOnce();
    expect(workerClientSpies.startDuel).toHaveBeenCalledWith(
      "bundled-v1:burning-abyss:vs:shaddoll",
      "burning-abyss",
      "shaddoll",
    );
  });

  it("blocks the duel view when a prompt still reaches an omitted shared zone", async () => {
    const user = userEvent.setup();
    await renderReadyApp();
    await startLinkFreeConflict(user);

    const alert = document.querySelector(
      '[data-cy="layout-profile-conflict"]',
    ) as HTMLElement;
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.getAttribute("data-conflict-zone-id")).toBe(
      "shared:extraMonster:left",
    );
    expect(alert.getAttribute("data-conflict-source")).toBe("prompt");
    expect(document.querySelector('[data-cy="duel-field"]')).toBeNull();
    expect(document.querySelector('[data-cy="prompt-dialog"]')).toBeNull();
    expect(
      document.querySelector('[data-cy="app-field-error-panel"]'),
    ).toBeNull();
    expect(workerClientSpies.respond).not.toHaveBeenCalled();
    expect(
      document
        .querySelector('[data-cy="app-main"]')
        ?.getAttribute("data-duel-viewport"),
    ).toBeNull();
  });

  it("suppresses workspace prompt controls during a layout profile conflict", async () => {
    const user = userEvent.setup();
    await renderReadyApp();
    await startDuelFromPicker(user);
    emitDuelState(LINK_FREE_SNAPSHOT);
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-cy="duel-right-rail-options"]'),
      ).not.toBeNull(),
    );
    await user.click(
      document.querySelector(
        '[data-cy="duel-right-rail-options"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-settings-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="settings-show-workspace-checkbox"]',
      ) as HTMLInputElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="settings-dialog-close-button"]',
      ) as HTMLButtonElement,
    );
    emitPrompt(SHARED_ZONE_PLACE_PROMPT);
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-cy="layout-profile-conflict"]'),
      ).not.toBeNull(),
    );

    expect(document.querySelector('[data-cy="workspace-grid"]')).not.toBeNull();
    expect(
      document.querySelector('[data-cy="prompt-controls-panel"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="prompt-panel-heading"]')?.textContent,
    ).toContain("No decision pending");
    expect(workerClientSpies.respond).not.toHaveBeenCalled();
  });

  it("keeps the normal prompt path when the layout and rules agree", async () => {
    const user = userEvent.setup();
    await renderReadyApp();
    await startDuelFromPicker(user);
    emitDuelState(EMPTY_SNAPSHOT);
    emitPrompt(SHARED_ZONE_PLACE_PROMPT);
    await vi.waitFor(() =>
      expect(workerClientSpies.respond).toHaveBeenCalledTimes(1),
    );

    expect(
      document.querySelector('[data-cy="layout-profile-conflict"]'),
    ).toBeNull();
  });

  it("marks default board mode as viewport constrained", async () => {
    const user = userEvent.setup();
    await renderReadyApp();
    await startDuelFromPicker(user);
    emitDuelState(EMPTY_SNAPSHOT);

    await vi.waitFor(() =>
      expect(
        document
          .querySelector('[data-cy="app-main"]')
          ?.getAttribute("data-duel-viewport"),
      ).toBe("true"),
    );
    const main = document.querySelector('[data-cy="app-main"]');
    expect(main?.classList.contains("is-duel-viewport")).toBe(true);
  });

  it("restores document mode for optional HUD", async () => {
    const user = userEvent.setup();
    await renderReadyApp();
    await startDuelFromPicker(user);
    emitDuelState(EMPTY_SNAPSHOT);
    await vi.waitFor(() =>
      expect(
        document
          .querySelector('[data-cy="app-main"]')
          ?.getAttribute("data-duel-viewport"),
      ).toBe("true"),
    );

    await user.click(
      document.querySelector(
        '[data-cy="duel-right-rail-options"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-settings-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="settings-show-duel-hud-checkbox"]',
      ) as HTMLInputElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="settings-dialog-close-button"]',
      ) as HTMLButtonElement,
    );

    const main = document.querySelector('[data-cy="app-main"]');
    await vi.waitFor(() =>
      expect(main?.getAttribute("data-duel-viewport")).toBeNull(),
    );
    expect(main?.classList.contains("is-duel-viewport")).toBe(false);
  });

  it("restores document mode for workspace", async () => {
    const user = userEvent.setup();
    await renderReadyApp();
    await startDuelFromPicker(user);
    emitDuelState(EMPTY_SNAPSHOT);
    await vi.waitFor(() =>
      expect(
        document
          .querySelector('[data-cy="app-main"]')
          ?.getAttribute("data-duel-viewport"),
      ).toBe("true"),
    );

    await user.click(
      document.querySelector(
        '[data-cy="duel-right-rail-options"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-settings-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="settings-show-workspace-checkbox"]',
      ) as HTMLInputElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="settings-dialog-close-button"]',
      ) as HTMLButtonElement,
    );

    const main = document.querySelector('[data-cy="app-main"]');
    await vi.waitFor(() =>
      expect(main?.getAttribute("data-duel-viewport")).toBeNull(),
    );
    expect(main?.classList.contains("is-duel-viewport")).toBe(false);
  });
});

describe("MenuDialog", () => {
  it("offers settings and surrender", () => {
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(() => true),
      onclose: vi.fn(),
    });

    const settingsButton = document.querySelector(
      '[data-cy="menu-dialog-settings-button"]',
    );
    const surrenderButton = document.querySelector(
      '[data-cy="menu-dialog-surrender-button"]',
    );
    expect(settingsButton).not.toBeNull();
    expect(surrenderButton).not.toBeNull();
    expect(surrenderButton?.classList.contains("danger")).toBe(true);
  });

  it("needs confirmation before surrendering", async () => {
    const user = userEvent.setup();
    const onsurrender = vi.fn(() => true);
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender,
      onclose: vi.fn(),
    });

    const surrenderButton = document.querySelector(
      '[data-cy="menu-dialog-surrender-button"]',
    ) as HTMLButtonElement;
    await user.click(surrenderButton);

    expect(onsurrender).not.toHaveBeenCalled();
    const confirmButton = document.querySelector(
      '[data-cy="menu-dialog-surrender-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirmButton).not.toBeNull();

    await user.click(confirmButton);
    expect(onsurrender).toHaveBeenCalledTimes(1);
  });

  it("cancel returns to the menu without surrendering", async () => {
    const user = userEvent.setup();
    const onsurrender = vi.fn(() => true);
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender,
      onclose: vi.fn(),
    });

    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-cancel-button"]',
      ) as HTMLButtonElement,
    );

    expect(
      document.querySelector('[data-cy="menu-dialog-surrender-button"]'),
    ).not.toBeNull();
    expect(onsurrender).not.toHaveBeenCalled();
  });

  it("closes the menu once a surrender is under way", async () => {
    const user = userEvent.setup();
    const onclose = vi.fn();
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(() => true),
      onclose,
    });

    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-confirm-button"]',
      ) as HTMLButtonElement,
    );

    expect(onclose).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('[data-cy="menu-dialog-surrender-error"]'),
    ).toBeNull();
  });

  /* A surrender the store refuses changes nothing, so dismissing the menu
     would leave the player believing an action they never committed. */
  it("keeps the menu open and announces a surrender that never started", async () => {
    const user = userEvent.setup();
    const onclose = vi.fn();
    const onsurrender = vi.fn(() => false);
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender,
      onclose,
    });

    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-confirm-button"]',
      ) as HTMLButtonElement,
    );

    expect(onsurrender).toHaveBeenCalledTimes(1);
    expect(onclose).not.toHaveBeenCalled();
    expect(document.querySelector('[data-cy="menu-dialog"]')).not.toBeNull();
    const failure = document.querySelector(
      '[data-cy="menu-dialog-surrender-error"]',
    );
    expect(failure?.getAttribute("role")).toBe("alert");
    expect(failure?.textContent).toContain("could not");
    expect(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-confirm-button"]',
      ),
    ).not.toBeNull();
  });

  it("clears a surrender failure when the player keeps playing", async () => {
    const user = userEvent.setup();
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(() => false),
      onclose: vi.fn(),
    });

    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-confirm-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-cancel-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-button"]',
      ) as HTMLButtonElement,
    );

    expect(
      document.querySelector('[data-cy="menu-dialog-surrender-error"]'),
    ).toBeNull();
  });

  it("hides surrender when unavailable", () => {
    render(MenuDialog, {
      surrenderAvailable: false,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(() => true),
      onclose: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="menu-dialog-surrender-button"]'),
    ).toBeNull();
  });

  it("disables the confirm button while a response is pending", async () => {
    const user = userEvent.setup();
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: true,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(() => true),
      onclose: vi.fn(),
    });

    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-button"]',
      ) as HTMLButtonElement,
    );
    const confirmButton = document.querySelector(
      '[data-cy="menu-dialog-surrender-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });

  it("closes on Escape", () => {
    const onclose = vi.fn();
    render(MenuDialog, {
      surrenderAvailable: false,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(() => true),
      onclose,
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", async () => {
    const user = userEvent.setup();
    const onclose = vi.fn();
    render(MenuDialog, {
      surrenderAvailable: false,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(() => true),
      onclose,
    });

    await user.click(
      document.querySelector('[data-cy="menu-dialog-backdrop"]') as HTMLElement,
    );
    expect(onclose).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsDialog", () => {
  it("reflects the current settings state", () => {
    render(SettingsDialog, {
      settings: {
        showDuelHud: true,
        showWorkspace: false,
        autoPlaceCards: true,
        autoResolveTrivialPrompts: true,
      },
      coreVersion: null,
      activeSnapshotId: null,
      fallbackSnapshotId: null,
      onshowduelhud: vi.fn(),
      onshowworkspace: vi.fn(),
      onautoplacecards: vi.fn(),
      onautoresolvetrivialprompts: vi.fn(),
      onclose: vi.fn(),
    });

    const hudCheckbox = document.querySelector(
      '[data-cy="settings-show-duel-hud-checkbox"]',
    ) as HTMLInputElement;
    const workspaceCheckbox = document.querySelector(
      '[data-cy="settings-show-workspace-checkbox"]',
    ) as HTMLInputElement;
    expect(hudCheckbox.checked).toBe(true);
    expect(workspaceCheckbox.checked).toBe(false);
  });

  it("exposes the auto-place and auto-resolve toggles", () => {
    render(SettingsDialog, {
      settings: {
        showDuelHud: false,
        showWorkspace: false,
        autoPlaceCards: true,
        autoResolveTrivialPrompts: true,
      },
      coreVersion: null,
      activeSnapshotId: null,
      fallbackSnapshotId: null,
      onshowduelhud: vi.fn(),
      onshowworkspace: vi.fn(),
      onautoplacecards: vi.fn(),
      onautoresolvetrivialprompts: vi.fn(),
      onclose: vi.fn(),
    });

    const autoPlaceCheckbox = document.querySelector(
      '[data-cy="settings-auto-place-cards-checkbox"]',
    ) as HTMLInputElement;
    const autoResolveCheckbox = document.querySelector(
      '[data-cy="settings-auto-resolve-checkbox"]',
    ) as HTMLInputElement;
    expect(autoPlaceCheckbox.checked).toBe(true);
    expect(autoResolveCheckbox.checked).toBe(true);
  });

  it("reports auto-resolve toggling through its callback", async () => {
    const user = userEvent.setup();
    const onautoresolvetrivialprompts = vi.fn();
    render(SettingsDialog, {
      settings: {
        showDuelHud: false,
        showWorkspace: false,
        autoPlaceCards: true,
        autoResolveTrivialPrompts: true,
      },
      coreVersion: null,
      activeSnapshotId: null,
      fallbackSnapshotId: null,
      onshowduelhud: vi.fn(),
      onshowworkspace: vi.fn(),
      onautoplacecards: vi.fn(),
      onautoresolvetrivialprompts,
      onclose: vi.fn(),
    });

    await user.click(
      document.querySelector(
        '[data-cy="settings-auto-resolve-checkbox"]',
      ) as HTMLInputElement,
    );
    expect(onautoresolvetrivialprompts).toHaveBeenCalledTimes(1);
    expect(onautoresolvetrivialprompts).toHaveBeenCalledWith(false);
  });

  it("reports toggles through callbacks", async () => {
    const user = userEvent.setup();
    const onshowworkspace = vi.fn();
    render(SettingsDialog, {
      settings: {
        showDuelHud: false,
        showWorkspace: false,
        autoPlaceCards: true,
        autoResolveTrivialPrompts: true,
      },
      coreVersion: null,
      activeSnapshotId: null,
      fallbackSnapshotId: null,
      onshowduelhud: vi.fn(),
      onshowworkspace,
      onautoplacecards: vi.fn(),
      onautoresolvetrivialprompts: vi.fn(),
      onclose: vi.fn(),
    });

    await user.click(
      document.querySelector(
        '[data-cy="settings-show-workspace-checkbox"]',
      ) as HTMLInputElement,
    );
    expect(onshowworkspace).toHaveBeenCalledTimes(1);
    expect(onshowworkspace).toHaveBeenCalledWith(true);
  });

  it("shows engine build and snapshot info", () => {
    render(SettingsDialog, {
      settings: {
        showDuelHud: false,
        showWorkspace: false,
        autoPlaceCards: true,
        autoResolveTrivialPrompts: true,
      },
      coreVersion: [11, 0],
      activeSnapshotId: "abc123def456ghi",
      fallbackSnapshotId: null,
      onshowduelhud: vi.fn(),
      onshowworkspace: vi.fn(),
      onautoplacecards: vi.fn(),
      onautoresolvetrivialprompts: vi.fn(),
      onclose: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="settings-engine-version"]')
        ?.textContent,
    ).toContain("ocgcore 11.0");
    expect(
      document.querySelector('[data-cy="settings-active-snapshot"]')
        ?.textContent,
    ).toContain("abc123def456");
  });
});
