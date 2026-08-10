// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DuelField from "../../src/app/components/DuelField.svelte";
import CardTray from "../../src/app/components/duel-field/CardTray.svelte";
import { createInteractionSession } from "../../src/app/prompts/interaction-session.ts";
import {
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
} from "../../src/app/prompts/interaction-spec.ts";
import {
  cardInstanceId,
  choiceId,
  promptId,
} from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
} from "../../src/duel/contracts/player-prompt.ts";
import type { PlayerIndex } from "../../src/duel/contracts/public-duel-state.ts";
import { mapSnapshotToBoard } from "../../src/field/board-view-model.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
} from "../fixtures/board-view-model.ts";
import {
  PUBLIC_STATE_CARD_TEXTS,
  publicStateCard,
} from "../fixtures/board-public-states.ts";
import {
  dataCyDeclaration,
  scanSvelteElements,
  scriptStringConstants,
  staticDataCyValue,
  svelteFilesUnder,
} from "../fixtures/svelte-element-scan.ts";

afterEach(() => {
  cleanup();
});

describe("scanSvelteElements", () => {
  it("finds plain elements", () => {
    const tags = scanSvelteElements('<div class="a"></div>');
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("div");
    expect(tags[0]!.attributes).toContain("class");
  });

  it("survives > inside an expression attribute", () => {
    const tags = scanSvelteElements(
      '<button onclick={() => go()} data-cy="go">x</button>',
    );
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("button");
    expect(tags[0]!.attributes).toContain("data-cy");
  });

  it("survives > inside a quoted attribute", () => {
    const tags = scanSvelteElements('<img alt="a > b" data-cy="i" />');
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("img");
  });

  it("skips component tags", () => {
    const tags = scanSvelteElements("<CardControl foo={1} />");
    expect(tags).toHaveLength(0);
  });

  it("skips svelte specials but keeps svelte:element", () => {
    const tags = scanSvelteElements(
      '<svelte:window onkeydown={f} /><svelte:element this={t} data-cy="z" />',
    );
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("svelte:element");
  });

  it("ignores script, style and comment content", () => {
    const tags = scanSvelteElements(
      '<script>const a = "<div>";</script><!-- <p> --><b data-cy="b"></b>',
    );
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("b");
  });
});

describe("dataCyDeclaration", () => {
  it("reads a quoted literal", () => {
    expect(dataCyDeclaration(' data-cy="duel-field"')).toEqual({
      kind: "static",
      value: "duel-field",
    });
  });

  it("treats an empty value as absent rather than as a selector", () => {
    expect(dataCyDeclaration(' data-cy=""').kind).toBe("empty");
    expect(dataCyDeclaration(" data-cy={''}").kind).toBe("empty");
    expect(dataCyDeclaration(" data-cy").kind).toBe("empty");
    expect(staticDataCyValue(' data-cy=""')).toBeNull();
  });

  it("reports a missing attribute as absent", () => {
    expect(dataCyDeclaration(' class="a"').kind).toBe("absent");
  });

  it("keeps a per-item template literal dynamic", () => {
    expect(dataCyDeclaration(" data-cy={`field-card-${card.id}`}").kind).toBe(
      "dynamic",
    );
  });

  it("resolves a hoisted constant so the uniqueness scan can see it", () => {
    const constants = scriptStringConstants(
      '<script lang="ts">\n  const LIST_DATA_CY = "a-list";\n</script>',
    );
    expect(dataCyDeclaration(" data-cy={LIST_DATA_CY}", constants)).toEqual({
      kind: "static",
      value: "a-list",
    });
    expect(dataCyDeclaration(" data-cy={LIST_DATA_CY}").kind).toBe("dynamic");
  });

  it("ignores a data-cy substring inside another attribute value", () => {
    expect(dataCyDeclaration(' aria-describedby="data-cy=nope"').kind).toBe(
      "absent",
    );
  });
});

/* Resolved from the working directory rather than `import.meta.url`: under the
   jsdom environment this file needs, `import.meta.url` is an http URL. */
const appDirectory = resolve(process.cwd(), "src/app");

interface ScannedValue {
  readonly value: string;
  readonly location: string;
}

/* Values emitted from more than one source site on purpose. Both sites must
   live in one component and sit in mutually exclusive branches, so at most one
   ever reaches a rendered document. The DOM gate at the bottom of this file is
   what actually proves that; this map only keeps the static approximation from
   crying wolf. */
const BRANCH_EXCLUSIVE_VALUES: ReadonlyMap<string, string> = new Map([
  [
    "field-action-bar-list",
    "src/app/components/duel-field/FieldActionBar.svelte",
  ],
]);

function presenceViolations(source: string, relativePath: string): string[] {
  const constants = scriptStringConstants(source);
  const violations: string[] = [];
  for (const { tag, attributes, index } of scanSvelteElements(source)) {
    const declaration = dataCyDeclaration(attributes, constants);
    if (declaration.kind === "absent")
      violations.push(`${relativePath}:${tag}@${index} has no data-cy`);
    else if (declaration.kind === "empty")
      violations.push(`${relativePath}:${tag}@${index} has an empty data-cy`);
  }
  return violations;
}

function staticValues(source: string, relativePath: string): ScannedValue[] {
  const constants = scriptStringConstants(source);
  const values: ScannedValue[] = [];
  for (const { attributes } of scanSvelteElements(source)) {
    const value = staticDataCyValue(attributes, constants);
    if (value !== null) values.push({ value, location: relativePath });
  }
  return values;
}

function duplicateStaticValues(scanned: readonly ScannedValue[]): string[] {
  const seen = new Map<string, string[]>();
  for (const { value, location } of scanned) {
    const locations = seen.get(value) ?? [];
    locations.push(location);
    seen.set(value, locations);
  }
  return [...seen.entries()]
    .filter(([value, locations]) => {
      if (locations.length < 2) return false;
      const allowed = BRANCH_EXCLUSIVE_VALUES.get(value);
      return (
        allowed === undefined ||
        locations.some((location) => location !== allowed)
      );
    })
    .map(([value, locations]) => `${value}: ${locations.join(", ")}`);
}

describe("data-cy coverage across src/app", () => {
  it("every src/app svelte element declares a non-empty data-cy", () => {
    const violations: string[] = [];
    for (const file of svelteFilesUnder(appDirectory)) {
      violations.push(
        ...presenceViolations(
          readFileSync(file, "utf8"),
          relative(process.cwd(), file),
        ),
      );
    }
    expect(violations).toEqual([]);
  });

  it("flags an empty data-cy exactly as it flags a missing one", () => {
    expect(
      presenceViolations('<b data-cy=""></b>', "synthetic.svelte"),
    ).toEqual(["synthetic.svelte:b@0 has an empty data-cy"]);
    expect(presenceViolations("<b></b>", "synthetic.svelte")).toEqual([
      "synthetic.svelte:b@0 has no data-cy",
    ]);
  });

  it("static data-cy values are unique across src/app", () => {
    const scanned: ScannedValue[] = [];
    for (const file of svelteFilesUnder(appDirectory)) {
      scanned.push(
        ...staticValues(
          readFileSync(file, "utf8"),
          relative(process.cwd(), file),
        ),
      );
    }
    expect(duplicateStaticValues(scanned)).toEqual([]);
  });

  it("sees a value hoisted into a module constant", () => {
    const source =
      '<script lang="ts">\n  const SHARED = "shared-value";\n</script>\n\n<b data-cy={SHARED}></b>\n<i data-cy={SHARED}></i>\n';
    const scanned = staticValues(source, "other.svelte");
    expect(scanned.map(({ value }) => value)).toEqual([
      "shared-value",
      "shared-value",
    ]);
    expect(duplicateStaticValues(scanned)).toEqual([
      "shared-value: other.svelte, other.svelte",
    ]);
  });

  it("every branch-exclusive exemption still names a real source site", () => {
    for (const [value, location] of BRANCH_EXCLUSIVE_VALUES) {
      const scanned = staticValues(readFileSync(location, "utf8"), location);
      expect(
        scanned.filter((entry) => entry.value === value).length,
        `${value} is exempted but not emitted twice by ${location}`,
      ).toBeGreaterThan(1);
    }
  });
});

/* The static scan above reads one source site at a time, so a single literal
   inside a component mounted once per card looks unique to it while the live
   document carries one copy per card. Only a rendered document can settle the
   `AGENT.md` contract, so these render the fixture boards and count. */

const CONTEXT = { workerGeneration: 1, sessionGeneration: 2 } as const;

function fixtureBoard(state: keyof typeof BOARD_VIEW_MODEL_FIXTURES) {
  const result = mapSnapshotToBoard(
    BOARD_VIEW_MODEL_FIXTURES[state],
    BOARD_CARD_TEXTS,
  );
  if (!result.ok)
    throw new Error(`Fixture mapping failed: ${result.error.type}`);
  return result.value;
}

function mountedChoice(
  id: string,
  label: string,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return {
    id: choiceId(id),
    label,
    action: "select",
    card: {
      instanceId: cardInstanceId(`prompt-${id}`),
      controller: 0,
      location: "monster",
      sequence: 0,
      position: "faceUpAttack",
    },
    ...overrides,
  } as PromptChoice;
}

function fieldPrompt(
  kind: PromptKind,
  choices: readonly PromptChoice[],
  overrides: Partial<PlayerPrompt> = {},
): PlayerPrompt {
  return {
    id: promptId(`${kind}-data-cy-uniqueness`),
    kind,
    player: 0,
    title: `Test ${kind}`,
    choices,
    minimum: 1,
    maximum: 1,
    cancelable: true,
    ordered: false,
    ...overrides,
  };
}

function specFor(value: PlayerPrompt): ActiveInteractionSpec {
  const spec = mapPromptToInteractionSpec(
    value,
    BOARD_VIEW_MODEL_FIXTURES["ST-05"],
    fixtureBoard("ST-05"),
    CONTEXT,
  );
  if (spec.kind === "inactive") throw new Error("Expected active field spec");
  return spec;
}

function duplicateRenderedValues(): readonly string[] {
  const values = [...document.body.querySelectorAll("[data-cy]")].map(
    (element) => element.getAttribute("data-cy") ?? "",
  );
  expect(values.length).toBeGreaterThan(0);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

describe("data-cy uniqueness in a rendered document", () => {
  const fixtureIds = Object.keys(
    BOARD_VIEW_MODEL_FIXTURES,
  ) as (keyof typeof BOARD_VIEW_MODEL_FIXTURES)[];

  it.each(fixtureIds)("%s renders no duplicate data-cy", (state) => {
    render(DuelField, {
      board: fixtureBoard(state),
      phase: "main1",
    });
    expect(duplicateRenderedValues()).toEqual([]);
  });

  it.each([
    [
      "cardAction chips and the global choice row",
      fieldPrompt("idleCommand", [
        mountedChoice("activate", "Activate effect", { action: "activate" }),
        {
          id: choiceId("battle"),
          label: "Enter Battle Phase",
          action: "battlePhase",
        } as PromptChoice,
      ]),
      0,
    ],
    [
      "the counterAllocation list",
      fieldPrompt(
        "selectCounter",
        [mountedChoice("c1", "Spell Counter", { allocationMaximum: 2 })],
        { minimum: 1, maximum: 2 },
      ),
      1,
    ],
    [
      "the order list",
      fieldPrompt(
        "sortCard",
        [mountedChoice("c1", "First"), mountedChoice("c2", "Second")],
        { minimum: 2, maximum: 2, ordered: true },
      ),
      1,
    ],
  ])(
    "an active field decision renders no duplicate data-cy: %s",
    (_, value, listCount) => {
      const spec = specFor(value);
      render(DuelField, {
        board: fixtureBoard("ST-05"),
        prompt: value,
        spec,
        session: createInteractionSession(spec),
        oninteraction: vi.fn(),
      });
      expect(
        document.querySelectorAll('[data-cy="field-action-bar"]'),
      ).toHaveLength(1);
      /* Both `field-action-bar-list` source sites are exempted from the static
         duplicate scan on the claim that they are mutually exclusive; this is
         the claim being checked. */
      expect(
        document.querySelectorAll('[data-cy="field-action-bar-list"]'),
      ).toHaveLength(listCount);
      expect(duplicateRenderedValues()).toEqual([]);
    },
  );

  it("four open card trays render no duplicate data-cy", async () => {
    const trays = [
      { player: 0, zone: "graveyard", label: "Your GY" },
      { player: 0, zone: "banished", label: "Your Banished" },
      { player: 1, zone: "graveyard", label: "Opponent GY" },
      { player: 1, zone: "banished", label: "Opponent Banished" },
    ] as const;

    for (const tray of trays) {
      /* 30 cards forces the pagination row to mount as well, and each tray owns
         its own instance ids because a card lives in exactly one location. */
      const cards = Array.from({ length: 30 }, (_, sequence) =>
        publicStateCard(
          `tray-${tray.player}-${tray.zone}-${sequence}`,
          sequence % 2 === 0 ? 97590747 : 5053103,
          tray.player as PlayerIndex,
          tray.zone,
          sequence,
        ),
      );
      render(CardTray, {
        label: tray.label,
        player: tray.player as PlayerIndex,
        zone: tray.zone,
        count: cards.length,
        cards,
        cardTexts: PUBLIC_STATE_CARD_TEXTS,
      });
      const toggle = document.querySelector(
        `[data-cy="card-tray-toggle-button-${tray.player}-${tray.zone}"]`,
      );
      if (toggle === null)
        throw new Error(`Missing tray toggle for ${tray.label}`);
      await fireEvent.click(toggle);
    }

    expect(
      document.querySelectorAll('[data-cy^="card-tray-panel-"]'),
    ).toHaveLength(trays.length);
    expect(
      document.querySelectorAll('[data-cy^="card-tray-pagination-"]'),
    ).toHaveLength(trays.length);
    expect(duplicateRenderedValues()).toEqual([]);
  });
});
