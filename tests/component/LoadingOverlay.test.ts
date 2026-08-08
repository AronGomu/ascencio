// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import LoadingOverlay from "../../src/app/components/LoadingOverlay.svelte";

afterEach(() => {
  cleanup();
});

describe("LoadingOverlay", () => {
  it("shows a determinate bar", () => {
    render(LoadingOverlay, {
      label: "Preparing active card images",
      progress: 0.5,
    });

    const progress = document.querySelector(
      '[data-cy="loading-overlay-progress"]',
    ) as HTMLProgressElement;
    expect(progress.value).toBe(0.5);
    expect(progress.max).toBe(1);
  });

  it("shows an indeterminate bar", () => {
    render(LoadingOverlay, {
      label: "Activating verified snapshot",
      progress: null,
    });

    const progress = document.querySelector(
      '[data-cy="loading-overlay-progress"]',
    ) as HTMLProgressElement;
    expect(progress.hasAttribute("value")).toBe(false);
  });
});
