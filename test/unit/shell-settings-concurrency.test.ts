import { get } from "svelte/store";
import { describe, expect, it, vi } from "vitest";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../src/shell/settings/index.ts";
import type {
  AsyncPreferencePort,
  StorageResult,
} from "../../src/storage/index.ts";

function controlledPort() {
  const patches: Partial<typeof DEFAULT_SHELL_SETTINGS>[] = [];
  let fail = false;
  const port: AsyncPreferencePort<typeof DEFAULT_SHELL_SETTINGS> = {
    read: async () => DEFAULT_SHELL_SETTINGS,
    async update(patch) {
      patches.push(patch);
      return fail
        ? { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } }
        : {
            kind: "ok",
            value: { ...DEFAULT_SHELL_SETTINGS, ...patch },
          };
    },
    flush: async (): Promise<StorageResult<void>> => ({
      kind: "ok",
      value: undefined,
    }),
  };
  return { port, patches, setFail: () => (fail = true) };
}

describe("shell settings persistence controller", () => {
  it("observes each rapid update through injected async port", async () => {
    const fixture = controlledPort();
    const store = createShellSettingsStore(
      DEFAULT_SHELL_SETTINGS,
      fixture.port,
    );
    store.dismissRotationNotice();
    store.rememberFreePlayOpponent("blaze-circuit");
    await Promise.resolve();

    expect(fixture.patches).toEqual([
      { rotationNoticeDismissed: true },
      { freePlayOpponentId: "blaze-circuit" },
    ]);
    expect(get(store)).toMatchObject({
      rotationNoticeDismissed: true,
      freePlayOpponentId: "blaze-circuit",
    });
  });

  it("reports failed writes without reverting usable UI state", async () => {
    const fixture = controlledPort();
    fixture.setFail();
    const failure = vi.fn();
    const store = createShellSettingsStore(
      DEFAULT_SHELL_SETTINGS,
      fixture.port,
      failure,
    );
    store.dismissRotationNotice();
    await vi.waitFor(() => expect(failure).toHaveBeenCalledOnce());
    expect(failure).toHaveBeenCalledWith({ code: "STORAGE_UNAVAILABLE" });
    expect(get(store).rotationNoticeDismissed).toBe(true);
  });

  it("uses memory only when no persistence port is injected", () => {
    const store = createShellSettingsStore();
    store.rememberFreePlayOpponent("practice-bot");
    expect(get(store).freePlayOpponentId).toBe("practice-bot");
  });
});
