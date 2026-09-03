// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DuelErrorDialog from "../../src/battle/app/components/DuelErrorDialog.svelte";

afterEach(cleanup);

describe("DuelErrorDialog chrome", () => {
  it("marks its existing danger title with the shared dialog title class", () => {
    const rendered = render(DuelErrorDialog, {
      error: {
        code: "engine_error",
        message: "Test failure",
        recoverable: false,
      },
      ondownload: vi.fn(),
      onrestore: vi.fn(),
      onretry: vi.fn(),
    });

    const title = rendered.container.querySelector(
      '[data-cy="duel-error-heading"]',
    );
    expect(title?.classList).toContain("ui-dialog-title");
    expect(title?.classList).toContain("duel-error-dialog-title");
  });
});
