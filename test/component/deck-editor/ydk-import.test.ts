// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import YdkImport from "../../../src/deck-editor/components/YdkImport.svelte";

afterEach(() => cleanup());

describe("YDK import UI", () => {
  it("invalidates old preview while a new file is reading", async () => {
    const onimport = vi.fn();
    render(YdkImport, { onimport, oncancel: vi.fn() });
    const input = screen.getByLabelText("Choose .ydk file");
    const pending = Promise.withResolvers<string>();
    await fireEvent.change(input, {
      target: {
        files: [
          {
            name: "a.ydk",
            size: 30,
            text: async () => "#main\n1\n#extra\n!side",
          },
        ],
      },
    });
    await screen.findByRole("button", { name: "Replace deck cards" });
    await fireEvent.change(input, {
      target: {
        files: [{ name: "b.ydk", size: 30, text: () => pending.promise }],
      },
    });
    expect(
      screen.queryByRole("button", { name: "Replace deck cards" }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Preview import",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    pending.resolve("#main\n2\n#extra\n!side");
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Replace deck cards" }));
    expect(onimport).toHaveBeenCalledWith(
      { main: [2], extra: [], side: [] },
      "Imported Deck",
    );
  });

  it.each(["new-file", "paste"])(
    "ignores late file results after %s supersession",
    async (replacement) => {
      const onimport = vi.fn();
      render(YdkImport, { onimport, oncancel: vi.fn() });
      const pending = Promise.withResolvers<string>();
      const input = screen.getByLabelText("Choose .ydk file");
      await fireEvent.change(input, {
        target: {
          files: [{ name: "a.ydk", size: 30, text: () => pending.promise }],
        },
      });
      if (replacement === "new-file") {
        await fireEvent.change(input, {
          target: {
            files: [
              {
                name: "b.ydk",
                size: 30,
                text: async () => "#main\n2\n#extra\n!side",
              },
            ],
          },
        });
      } else {
        await fireEvent.input(screen.getByLabelText("Or paste YDK text"), {
          target: { value: "#main\n2\n#extra\n!side" },
        });
        await fireEvent.click(
          screen.getByRole("button", { name: "Preview import" }),
        );
      }
      await screen.findByRole("button", { name: "Replace deck cards" });
      pending.resolve("#main\n1\n#extra\n!side");
      await pending.promise;
      await waitFor(() =>
        expect(
          (screen.getByLabelText("Or paste YDK text") as HTMLTextAreaElement)
            .value,
        ).toContain("\n2\n"),
      );
      await fireEvent.click(
        screen.getByRole("button", { name: "Replace deck cards" }),
      );
      expect(onimport).toHaveBeenCalledWith(
        { main: [2], extra: [], side: [] },
        "Imported Deck",
      );
    },
  );

  it("previews pasted YDK and preserves unknown codes", async () => {
    const user = userEvent.setup();
    const onimport = vi.fn();
    render(YdkImport, { onimport, oncancel: vi.fn() });
    await user.type(
      screen.getByLabelText("Or paste YDK text"),
      "#main{enter}99999999{enter}#extra{enter}!side{enter}",
    );
    await user.click(screen.getByRole("button", { name: "Preview import" }));
    expect(screen.getByText(/Main 1 · Extra 0 · Side 0/)).toBeTruthy();
    expect(screen.getByText("99999999")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Replace deck cards" }),
    );
    expect(onimport).toHaveBeenCalledWith(
      { main: [99999999], extra: [], side: [] },
      "Imported Deck",
    );
  });

  it("previews file input and warns about duplicate local names", async () => {
    const user = userEvent.setup();
    render(YdkImport, {
      onimport: vi.fn(),
      oncancel: vi.fn(),
      requireName: true,
      existingDeckNames: ["Imported Deck"],
    });
    const file = new File(["#main\n89631139\n#extra\n!side\n"], "deck.ydk", {
      type: "text/plain",
    });
    await user.upload(screen.getByLabelText("Choose .ydk file"), file);
    expect(await screen.findByText(/Main 1 · Extra 0 · Side 0/)).toBeTruthy();
    expect(screen.getByText(/already uses this name/)).toBeTruthy();
  });

  it("invalidates preview when pasted source changes", async () => {
    const user = userEvent.setup();
    render(YdkImport, { onimport: vi.fn(), oncancel: vi.fn() });
    const source = screen.getByLabelText("Or paste YDK text");
    await user.type(source, "#main{enter}1{enter}#extra{enter}!side");
    await user.click(screen.getByRole("button", { name: "Preview import" }));
    expect(
      screen.getByRole("button", { name: "Replace deck cards" }),
    ).toBeTruthy();
    await user.type(source, "{enter}2");
    expect(
      screen.queryByRole("button", { name: "Replace deck cards" }),
    ).toBeNull();
  });

  it("shows exact malformed line and supports Cancel", async () => {
    const user = userEvent.setup();
    const oncancel = vi.fn();
    render(YdkImport, { onimport: vi.fn(), oncancel });
    await user.type(
      screen.getByLabelText("Or paste YDK text"),
      "#main{enter}bad{enter}#extra{enter}!side",
    );
    await user.click(screen.getByRole("button", { name: "Preview import" }));
    expect(screen.getByRole("alert").textContent).toContain("line 2");
    expect(
      screen.getByLabelText("Or paste YDK text").getAttribute("aria-invalid"),
    ).toBe("true");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(oncancel).toHaveBeenCalledTimes(1);
  });
});
