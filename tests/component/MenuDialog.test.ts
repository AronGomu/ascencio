// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import MenuDialog from "../../src/battle/app/components/MenuDialog.svelte";

afterEach(cleanup);

describe("MenuDialog chrome", () => {
  it("marks its existing title with the shared dialog title class", () => {
    const rendered = render(MenuDialog, {
      surrenderAvailable: false,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(() => true),
      onclose: vi.fn(),
    });

    const title = rendered.container.querySelector(
      '[data-cy="menu-dialog-heading"]',
    );
    expect(title?.classList).toContain("ui-dialog-title");
  });
});
