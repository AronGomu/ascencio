import { get } from "svelte/store";
import { describe, expect, it } from "vitest";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";
import { readShellSettings } from "../../src/shell/settings/shell-settings.ts";

function liveStorage(): Pick<Storage, "getItem" | "setItem"> {
  const entries: Record<string, string> = {};
  return {
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => {
      entries[key] = value;
    },
  };
}

describe("shell settings store concurrency", () => {
  it("preserves unsaved live settings across repeated quota failures", () => {
    const store = createShellSettingsStore({
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    });

    store.dismissRotationNotice();
    expect(get(store).rotationNoticeDismissed).toBe(true);
    store.rememberFreePlayOpponent("blaze-circuit");

    expect(
      get(store).rotationNoticeDismissed,
      "later mutation must preserve unsaved live settings",
    ).toBe(true);
    expect(get(store).freePlayOpponentId).toBe("blaze-circuit");
  });

  it("retries dirty fields with their latest values while rebasing unrelated fields", () => {
    const storage = liveStorage();
    let writeFails = true;
    const firstTab = createShellSettingsStore({
      getItem: storage.getItem,
      setItem(key, value) {
        if (writeFails) throw new DOMException("quota", "QuotaExceededError");
        storage.setItem(key, value);
      },
    });
    const secondTab = createShellSettingsStore(storage);
    const pairing = { player: "preset:nekroz", opponent: "preset:shaddoll" };

    firstTab.dismissRotationNotice();
    firstTab.rememberFreePlayOpponent("practice-bot");
    firstTab.rememberFreePlayOpponent("blaze-circuit");
    secondTab.rememberFreePlayPairing(pairing);
    writeFails = false;
    firstTab.dismissRotationNotice();

    expect(readShellSettings(storage)).toMatchObject({
      rotationNoticeDismissed: true,
      freePlayOpponentId: "blaze-circuit",
      freePlayPairing: pairing,
    });
    expect(get(firstTab)).toEqual(readShellSettings(storage));

    secondTab.rememberFreePlayOpponent("practice-bot");
    firstTab.rememberFreePlayPairing(pairing);
    expect(readShellSettings(storage).freePlayOpponentId).toBe("practice-bot");
    expect(get(firstTab)).toEqual(readShellSettings(storage));
  });

  it("preserves dirty pairing through read and write failures until recovery", () => {
    const storage = liveStorage();
    let unavailable = true;
    const store = createShellSettingsStore({
      getItem(key) {
        if (unavailable) throw new Error("blocked");
        return storage.getItem(key);
      },
      setItem(key, value) {
        if (unavailable) throw new Error("blocked");
        storage.setItem(key, value);
      },
    });
    const pairing = { player: "preset:nekroz", opponent: "preset:shaddoll" };

    store.rememberFreePlayPairing(pairing);
    store.dismissRotationNotice();
    expect(get(store).freePlayPairing).toEqual(pairing);
    unavailable = false;
    store.rememberFreePlayOpponent("blaze-circuit");

    expect(readShellSettings(storage)).toMatchObject({
      rotationNoticeDismissed: true,
      freePlayPairing: pairing,
      freePlayOpponentId: "blaze-circuit",
    });
    expect(get(store)).toEqual(readShellSettings(storage));
  });

  it("preserves sequential live changes without storage", () => {
    const store = createShellSettingsStore(null);
    store.dismissRotationNotice();
    store.rememberFreePlayOpponent("blaze-circuit");
    expect(get(store)).toMatchObject({
      rotationNoticeDismissed: true,
      freePlayOpponentId: "blaze-circuit",
    });
  });

  it("preserves settings written by another live store", () => {
    const storage = liveStorage();
    const firstTab = createShellSettingsStore(storage);
    const secondTab = createShellSettingsStore(storage);

    firstTab.dismissRotationNotice();
    secondTab.rememberFreePlayOpponent("blaze-circuit");

    expect(readShellSettings(storage)).toMatchObject({
      rotationNoticeDismissed: true,
      freePlayOpponentId: "blaze-circuit",
    });
  });
});
