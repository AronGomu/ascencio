// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { handleModalKeydown } from "../../../src/deck-editor/focus-trap.ts";

afterEach(() => document.body.replaceChildren());

describe("handleModalKeydown", () => {
  it("keeps keyboard shortcuts from reaching the screen behind a modal", () => {
    const dialog = document.createElement("div");
    const button = document.createElement("button");
    dialog.append(button);
    document.body.append(dialog);
    dialog.addEventListener("keydown", (event) =>
      handleModalKeydown(event, vi.fn()),
    );
    const screenShortcut = vi.fn();
    window.addEventListener("keydown", screenShortcut);

    try {
      button.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(screenShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", screenShortcut);
    }
  });
});
