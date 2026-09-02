// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DuelField from "../../src/battle/app/components/DuelField.svelte";
import CardTray from "../../src/battle/app/components/duel-field/CardTray.svelte";
import { createInteractionSession } from "../../src/battle/app/prompts/interaction-session.ts";
import {
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
} from "../../src/battle/app/prompts/interaction-spec.ts";
import {
  cardInstanceId,
  choiceId,
  promptId,
} from "../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
} from "../../src/battle/duel/contracts/player-prompt.ts";
import type { PlayerIndex } from "../../src/battle/duel/contracts/public-duel-state.ts";
import { mapSnapshotToBoard } from "../../src/battle/field/board-view-model.ts";
import type { PromptMessageSegment } from "../../src/battle/app/presentation/prompt-context-message.ts";
import PromptControls from "../../src/battle/app/prompts/PromptControls.svelte";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
} from "../fixtures/board-view-model.ts";
import CardCatalog from "../../src/deck-editor/components/CardCatalog.svelte";
import DeckZoneGrid from "../../src/deck-editor/components/DeckZoneGrid.svelte";
import DeckSelectScreen from "../../src/deck-select/DeckSelectScreen.svelte";
import type { DeckTileModel } from "../../src/deck-select/deck-select-contracts.ts";
import { PROTOTYPE_CATALOG } from "../../src/deck-editor/fixtures/catalog.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../src/decks/catalog/pinned-ruleset.ts";
import { mainDeckGridPlan } from "../../src/decks/deck-model.ts";
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

  it("ignores a slot placeholder, which renders no element of its own", () => {
    expect(scanSvelteElements('<slot name="handle" /><slot />')).toHaveLength(
      0,
    );
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
const CONTRACT_ROOTS = [
  /* The whole battle domain, not just `app/`: the facade and the rotation
     notice sit beside it under `src/battle/` and render elements of their own,
     which the narrower root left outside the contract entirely. */
  "src/battle",
  "src/shell",
  "src/deck-editor",
  "src/story",
  /* The shared deck-selection screen renders inside shell, deck-editor and
     story alike, so its elements are part of every host's document and belong
     under the same contract as the domains that mount it. */
  "src/deck-select",
] as const;

function contractFiles(): readonly string[] {
  return CONTRACT_ROOTS.flatMap((root) =>
    svelteFilesUnder(resolve(process.cwd(), root)),
  );
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/* A per-item value such as `` `deck-tile-${card.code}` `` is only as readable
   as its literal chunks, so those chunks — the template with every `${…}`
   removed — must still spell kebab-case characters and nothing else. */
const KEBAB_CASE_SKELETON = /^[a-z0-9-]+$/;

function templateSkeleton(expression: string): string {
  return expression.replace(/^`|`$/g, "").replace(/\$\{[^}]*\}/g, "");
}

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
    "src/battle/app/components/duel-field/FieldActionBar.svelte",
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

function namingViolations(source: string, relativePath: string): string[] {
  const constants = scriptStringConstants(source);
  const violations: string[] = [];
  for (const { tag, attributes, index } of scanSvelteElements(source)) {
    const declaration = dataCyDeclaration(attributes, constants);
    if (declaration.kind === "static" && !KEBAB_CASE.test(declaration.value))
      violations.push(
        `${relativePath}:${tag}@${index} data-cy "${declaration.value}" is not kebab-case`,
      );
    /* Only a template literal carries a readable prefix; a ternary between two
       literals is already covered by the kebab-case rule on each branch. */
    if (
      declaration.kind === "dynamic" &&
      declaration.expression.startsWith("`")
    ) {
      const skeleton = templateSkeleton(declaration.expression);
      if (!KEBAB_CASE_SKELETON.test(skeleton))
        violations.push(
          `${relativePath}:${tag}@${index} data-cy template "${skeleton}" is not kebab-case`,
        );
    }
  }
  return violations;
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

describe("data-cy coverage across the production domains", () => {
  it("every contract-root svelte element declares a non-empty data-cy", () => {
    const violations: string[] = [];
    for (const file of contractFiles()) {
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

  it("every contract-root data-cy value is kebab-case", () => {
    const violations: string[] = [];
    for (const file of contractFiles()) {
      violations.push(
        ...namingViolations(
          readFileSync(file, "utf8"),
          relative(process.cwd(), file),
        ),
      );
    }
    expect(violations).toEqual([]);
  });

  it("accepts a per-item template value and validates its prefix", () => {
    expect(
      namingViolations(
        "<b data-cy={`deck-tile-${card.code}`}></b>",
        "synthetic.svelte",
      ),
    ).toEqual([]);
    expect(
      namingViolations(
        "<b data-cy={`deckTile${card.code}`}></b>",
        "synthetic.svelte",
      ),
    ).toEqual([
      'synthetic.svelte:b@0 data-cy template "deckTile" is not kebab-case',
    ]);
    expect(
      namingViolations('<b data-cy="Deck_Tile"></b>', "synthetic.svelte"),
    ).toEqual(['synthetic.svelte:b@0 data-cy "Deck_Tile" is not kebab-case']);
  });

  it("static data-cy values are unique across the contract roots", () => {
    const scanned: ScannedValue[] = [];
    for (const file of contractFiles()) {
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
   `AGENTS.md` contract, so these render the fixture boards and count. */

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
    });
    expect(duplicateRenderedValues()).toEqual([]);
  });

  it.each([
    [
      "cardAction chips and the global choice row",
      fieldPrompt("idleCommand", [
        mountedChoice("activate", "Activate effect", { action: "activate" }),
        {
          id: choiceId("pass"),
          label: "Pass",
          action: "pass",
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

describe("data-cy uniqueness in deck editor rendered document", () => {
  const prototypeCatalogMap = catalogByCode(PROTOTYPE_CATALOG);

  it("catalog and zone grid with overlapping codes render no duplicate data-cy", () => {
    /* Pick two cards from the fixture catalog that exist. */
    const code1 = PROTOTYPE_CATALOG[0]!.code;
    const code2 = PROTOTYPE_CATALOG[1]!.code;
    /* The zone grid contains the same card twice, which pre-fix would have
       produced duplicate `deck-tile-{code}` values when both also appeared in
       the catalog. Post-fix the catalog uses `catalog-tile-{code}` and the
       zone uses `{zone}-tile-{index}`, so no collision. */
    const zoneCodes = [code1, code2, code1];

    render(CardCatalog, {
      cards: PROTOTYPE_CATALOG,
      ruleset: PROTOTYPE_RULESET,
    });

    render(DeckZoneGrid, {
      zone: "main",
      label: "Main Deck",
      codes: zoneCodes,
      plan: mainDeckGridPlan(zoneCodes.length),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
      totalCopies: new Map([
        [code1, 2],
        [code2, 1],
      ]),
    });

    /* Verify both surfaces mounted: catalog and zone grid are present. */
    expect(document.querySelector('[data-cy="deck-catalog"]')).not.toBeNull();
    expect(document.querySelector('[data-cy="deck-zone-main"]')).not.toBeNull();

    expect(duplicateRenderedValues()).toEqual([]);
  });
});

describe("data-cy uniqueness in deck select rendered document", () => {
  function deckTile(key: string, name: string): DeckTileModel {
    return {
      key,
      name,
      counts: { main: 40, extra: 15, side: 10 },
      meta: "Updated 20 Aug 2026",
      coverImageUrl: null,
      legal: true,
      blockReason: null,
      bundled: false,
      lockedBy: null,
      favourite: false,
      isDefault: false,
      deletable: true,
      updatedAt: "2026-08-20T10:00:00.000Z",
    };
  }

  it("duel start renders grid tiles and seat chips without collision", () => {
    /* Each seat now names its deck with a chip rather than cloning the grid
       tile, so grid identities remain singular in the rendered document. */
    const yours = deckTile("k1", "Aurora Fleet");
    const theirs = deckTile("k2", "Blaze Circuit");

    render(DeckSelectScreen, {
      mode: "duel-start",
      eyebrow: "Free play",
      title: "Choose your deck",
      tiles: [yours, theirs],
      selectedKey: "k1",
      opponent: {
        id: "vault-warden",
        name: "Vault Warden",
        line: "Locks the board, then closes it out.",
        locked: false,
      },
      opponentDeck: theirs,
      playerDeck: yours,
    });

    expect(document.querySelector('[data-cy="deck-tile-k1"]')).not.toBeNull();
    expect(document.querySelector('[data-cy="deck-tile-k2"]')).not.toBeNull();
    expect(
      document.querySelector('[data-cy="duel-start-your-deck"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="duel-start-opponent-deck"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy^="deck-tile-yours-"]')).toBeNull();
    expect(
      document.querySelector('[data-cy^="deck-tile-opponent-"]'),
    ).toBeNull();

    expect(duplicateRenderedValues()).toEqual([]);
  });
});

describe("data-cy uniqueness across prompt surfaces", () => {
  it("DuelField and PromptControls mounted together render no duplicate data-cy", () => {
    /* A chain prompt triggers FieldActionBar with PromptContextMessage. */
    const prompt = fieldPrompt("chain", [
      mountedChoice("respond", "Activate in response"),
      {
        id: choiceId("pass"),
        label: "Pass",
        action: "pass",
      } as PromptChoice,
    ]);

    /* Context message segments produce multiple data-cy elements inside
       PromptContextMessage. Pre-fix both surfaces used the same values;
       post-fix they differ by dataCyPrefix (field vs workspace). */
    const contextMessage: readonly PromptMessageSegment[] = [
      { kind: "actor", value: "Opponent" },
      { kind: "text", value: " activated " },
      { kind: "card", value: "Mirror Force" },
      { kind: "text", value: " targeting your " },
      { kind: "zone", value: "Monster Zone" },
      { kind: "text", value: "." },
    ];

    const spec = specFor(prompt);

    /* DuelField mounts FieldActionBar → PromptContextMessage with dataCyPrefix="field". */
    render(DuelField, {
      board: fixtureBoard("ST-05"),
      prompt,
      spec,
      session: createInteractionSession(spec),
      contextMessage,
      oninteraction: vi.fn(),
    });

    /* PromptControls mounts PromptContextMessage with dataCyPrefix="workspace". */
    render(PromptControls, {
      prompt,
      contextMessage,
      onsubmit: vi.fn(),
    });

    /* Verify both surfaces mounted their PromptContextMessage. */
    expect(
      document.querySelector('[data-cy="field-prompt-context-message"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="workspace-prompt-context-message"]'),
    ).not.toBeNull();

    expect(duplicateRenderedValues()).toEqual([]);
  });
});
