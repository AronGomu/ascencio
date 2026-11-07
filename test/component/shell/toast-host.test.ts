// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ToastHost from "../../../src/shell/toast/ToastHost.svelte";
import { createToastStore } from "../../../src/shell/toast/toast-store.ts";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function find(value: string): HTMLElement | null {
  return document.querySelector(`[data-cy="${value}"]`);
}

describe("ToastHost", () => {
  it("renders polite feedback and assertive errors", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    const info = store.show({ message: "Deck imported.", tone: "success" });
    const error = store.show({ message: "Copy failed.", tone: "error" });
    render(ToastHost, { store });

    expect(find(`shell-toast-${info}`)?.getAttribute("role")).toBe("status");
    expect(find(`shell-toast-${error}`)?.getAttribute("role")).toBe("alert");
    expect(find(`shell-toast-message-${info}`)?.textContent).toBe(
      "Deck imported.",
    );
  });

  it("dismiss button removes its notification", async () => {
    vi.useFakeTimers();
    const store = createToastStore();
    const id = store.show({ message: "Temporary" });
    render(ToastHost, { store });

    await fireEvent.click(find(`shell-toast-dismiss-${id}`)!);

    expect(find(`shell-toast-${id}`)).toBeNull();
  });
});
