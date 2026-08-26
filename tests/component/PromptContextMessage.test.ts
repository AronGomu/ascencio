// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import PromptContextMessage from "../../src/battle/app/components/duel-field/PromptContextMessage.svelte";
import type { PromptMessageSegment } from "../../src/battle/app/presentation/prompt-context-message.ts";

afterEach(() => cleanup());

const SEGMENTS: readonly PromptMessageSegment[] = [
  { kind: "actor", value: "Opponent" },
  { kind: "text", value: " has activated " },
  { kind: "card", value: "Mystical Space Typhoon" },
  { kind: "text", value: ", targeting " },
  { kind: "card", value: "Blue-Eyes White Dragon" },
  { kind: "text", value: " in the " },
  { kind: "zone", value: "Monster Zone" },
  { kind: "text", value: "." },
];

describe("PromptContextMessage", () => {
  it("weights the acting seat and italicises every card it names", () => {
    const { container } = render(PromptContextMessage, { segments: SEGMENTS });
    const line = container.querySelector('[data-cy="prompt-context-message"]');
    if (line === null) throw new Error("context line did not render");
    expect(line.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Opponent has activated Mystical Space Typhoon, targeting Blue-Eyes White Dragon in the Monster Zone.",
    );
    const actors = [...line.querySelectorAll("strong")];
    expect(actors.map((element) => element.textContent)).toEqual(["Opponent"]);
    const cards = [...line.querySelectorAll("em")];
    expect(cards.map((element) => element.textContent)).toEqual([
      "Mystical Space Typhoon",
      "Blue-Eyes White Dragon",
    ]);
    expect(
      line.querySelector('[data-cy="prompt-context-zone-6"]')?.textContent,
    ).toBe("Monster Zone");
  });

  it("renders nothing when the duel has no context to state", () => {
    const { container } = render(PromptContextMessage, { segments: [] });
    expect(
      container.querySelector('[data-cy="prompt-context-message"]'),
    ).toBeNull();
  });
});
