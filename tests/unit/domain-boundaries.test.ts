import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as battle from "../../src/battle/index.ts";
import * as deckEditor from "../../src/deck-editor/index.ts";
import * as decks from "../../src/decks/index.ts";
import * as shell from "../../src/shell/index.ts";
import * as story from "../../src/story/index.ts";

/* ADR-022 boundaries, checked against resolved paths rather than specifier
   text. `eslint.config.js` carries the same rules for inline feedback, but a
   specifier glob reads the text a file wrote rather than the file it reaches,
   so this file is the airtight half of the pair. Both run in
   `npm run check:headless`. */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const sourceRoot = path.join(projectRoot, "src");

type Domain = "main" | "shell" | "story" | "deck-editor" | "battle" | "decks";

const PUBLIC_ENTRY: Readonly<Record<Domain, string | null>> = Object.freeze({
  main: null,
  shell: "src/shell/index.ts",
  story: "src/story/index.ts",
  "deck-editor": "src/deck-editor/index.ts",
  battle: "src/battle/index.ts",
  /* `src/decks` is the shared deck-data library the three UI domains all read,
     not a lazy UI domain. Its index is frozen below so widening it stays
     deliberate, but its modules are importable directly. */
  decks: "src/decks/index.ts",
});

/* Allowed per importing file, never per domain, and mirrored in
   `eslint.config.js`. All of these exist because the only entry that could
   legally carry them — `src/battle/index.ts` — also exports `BattleFacade`: a
   static import of it from the shell makes the duel an eager dependency and
   takes the entry chunk from 2.62 kB to 339.73 kB. Each allowance disappears
   when its module gets a legal home. */
const ALLOWANCES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "src/shell/admin/admin-actions.ts": [
    /* Deck-format and preset asset modules. `src/decks/index.ts` cannot carry
       them either: it is reached eagerly from `src/shell/routes.ts`, so six raw
       `.ydk` payloads would land in the entry chunk. */
    "src/battle/duel/presets/deck-parser.ts",
    "src/battle/duel/presets/deck-sources-browser.ts",
    /* The duel's snapshot database name, so the console can reset it. */
    "src/battle/storage/snapshot-store.ts",
  ],
  /* The duel's v2 UI-state key and shape, which the shell's v3 settings migrate
     from on first load. */
  "src/shell/settings/shell-settings.ts": [
    "src/battle/app/stores/persisted-ui-state.ts",
  ],
  /* The story's duel-handoff vocabulary. `src/story/index.ts` also exports
     `StoryApp`, so a static import of it from the shell would make the visual
     novel eager; this module holds pure functions and no component. */
  "src/shell/handoff/handoff-coordinator.ts": [
    "src/story/handoff/story-handoff.ts",
  ],
  /* The quarter-turn stage mapping the overlay thumb drags through. The panel
     it belongs to is shared, so the component now lives in the shell, but the
     mapping stays duel presentation: `src/battle/index.ts` exports
     `BattleFacade`, and the shell entry is eager. The allowance disappears when
     `stage-frame.ts` gets a legal home. */
  "src/shell/card-preview/OverlayScrollbar.svelte": [
    "src/battle/app/presentation/stage-frame.ts",
  ],
  "src/decks/ydk-adapter.ts": ["src/battle/duel/presets/deck-parser.ts"],
});

/* `src/acceptance-main.ts` is the build entry for the duel acceptance harness
   that lives in `src/battle/app/acceptance/`, so it belongs to battle. */
function domainOf(file: string): Domain {
  if (file === "src/main.ts") return "main";
  if (file === "src/acceptance-main.ts") return "battle";
  if (file.startsWith("src/shell/")) return "shell";
  if (file.startsWith("src/story/")) return "story";
  if (file.startsWith("src/deck-editor/")) return "deck-editor";
  if (file.startsWith("src/decks/")) return "decks";
  if (file.startsWith("src/battle/")) return "battle";
  throw new Error(
    `${file} belongs to no declared domain; classify it in tests/unit/domain-boundaries.test.ts`,
  );
}

function isLegalImport(from: string, to: string): boolean {
  if (ALLOWANCES[from]?.includes(to) === true) return true;

  const source = domainOf(from);
  const target = domainOf(to);
  if (source === target) return true;

  /* The entry document mounts the shell and nothing else. */
  if (source === "main") return target === "shell";
  /* Shared deck data is open to every domain. */
  if (target === "decks") return true;
  /* The visual novel types a battle handoff without mounting one. */
  if (source === "story" && to === "src/battle/battle-contracts.ts")
    return true;

  return to === PUBLIC_ENTRY[target];
}

function sourceFiles(): readonly string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory).sort()) {
      const absolute = path.join(directory, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
        continue;
      }
      if (entry.endsWith(".d.ts")) continue;
      if (!entry.endsWith(".ts") && !entry.endsWith(".svelte")) continue;
      found.push(
        path.relative(projectRoot, absolute).split(path.sep).join("/"),
      );
    }
  };
  walk(sourceRoot);
  return found;
}

const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

/** Repo-relative targets of every relative code specifier in `file`, ignoring
    bare package names, assets (css, svg, ydk) and anything outside `src/`. */
function importsOf(file: string): readonly string[] {
  const text = readFileSync(path.join(projectRoot, file), "utf8");
  const directory = path.posix.dirname(file);
  const targets: string[] = [];
  for (const [, specifier] of text.matchAll(SPECIFIER)) {
    if (specifier === undefined || !specifier.startsWith(".")) continue;
    const resolved = path.posix.normalize(
      path.posix.join(directory, specifier.split("?")[0] ?? specifier),
    );
    if (!resolved.startsWith("src/")) continue;
    if (!resolved.endsWith(".ts") && !resolved.endsWith(".svelte")) continue;
    targets.push(resolved);
  }
  return targets;
}

/** Value and type export names declared by a public entry's own source. */
function declaredExports(entry: string): {
  readonly values: readonly string[];
  readonly types: readonly string[];
} {
  const text = readFileSync(path.join(projectRoot, entry), "utf8");
  const values: string[] = [];
  const types: string[] = [];
  for (const [, typeKeyword, body] of text.matchAll(
    /export\s+(type\s+)?\{([^}]*)\}/g,
  )) {
    for (const raw of (body ?? "").split(",")) {
      const clause = raw.trim();
      if (clause === "") continue;
      const entryIsType =
        typeKeyword !== undefined || clause.startsWith("type ");
      const name = clause
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .at(-1);
      if (name === undefined) continue;
      (entryIsType ? types : values).push(name);
    }
  }
  for (const [, name] of text.matchAll(
    /export\s+(?:const|function|class)\s+([A-Za-z0-9_$]+)/g,
  ))
    if (name !== undefined) values.push(name);
  return { values: values.sort(), types: types.sort() };
}

describe("public domain APIs are frozen", () => {
  /* Widening any list below is a deliberate edit, not a silent change. */
  const expected = [
    {
      name: "battle",
      entry: "src/battle/index.ts",
      namespace: battle,
      /* T17, deliberate widening: the free-play match setup builds a
         `BattleRequest` before the duel mounts, so the shell needs the bundled
         list the picker offers, the seats a lost key falls back to, and the
         preset-only listing a library that will not open answers with. Deck
         metadata only — the `.ydk` payloads stay behind
         `deck-sources-browser.ts` — and every one of them is reached through
         `loaders.duel()`, never a static import, or the duel turns eager and
         the shell budget in `verify-browser-build.ts` rejects the build. */
      values: [
        "BattleFacade",
        "BattleRequestError",
        "DECK_CATALOG",
        "DEFAULT_OPPONENT_DECK_ID",
        "DEFAULT_PLAYER_DECK_ID",
        "findSelectableDeck",
        "listSelectableDecks",
        "parseBattleRequest",
        "presetSelectableDecks",
        "settleOnce",
        "supportedDuelCardCodes",
      ],
      types: [
        "BattleDeckSelection",
        "BattleFacadeResult",
        "BattleOutcome",
        "BattleRequest",
        "SelectableDeck",
      ],
    },
    {
      name: "decks",
      entry: "src/decks/index.ts",
      namespace: decks,
      values: [
        "DECK_DATABASE_NAME",
        "DeckMigrationError",
        "deckId",
        "resolveDeck",
      ],
      types: [
        "DeckId",
        "DeckRecord",
        "DeckRepository",
        "DeckValidationIssue",
        "ResolveDeckResult",
        "ValidatedDeckSnapshot",
      ],
    },
    {
      name: "deck-editor",
      entry: "src/deck-editor/index.ts",
      namespace: deckEditor,
      values: ["default"],
      types: ["DeckEditorRoute"],
    },
    {
      name: "story",
      entry: "src/story/index.ts",
      namespace: story,
      /* T22, deliberate widening of one name: `storyCardOwnership` reads the
         save's collection, so it needs `StoryState` and can only live here.
         Its `CardOwnership` type and free play's `unlimitedCardOwnership()`
         deliberately do *not* join it — they ship from
         `src/decks/card-ownership.ts`, which records the measurement that
         keeps them out of this entry.

         T23, deliberate widening of one more: `openStoryDeckContext` is the
         only constructor of a story deck context. The shell binds the editor
         to it, and building one outside the story would mean exporting the
         reducer and letting a caller pair one save's decks with another save's
         ownership. */
      values: [
        "ENCOUNTER_LABELS",
        "STORY_SAVES_DATABASE_NAME",
        "acceptsResult",
        "createStoryDeckRepository",
        "createStorySaveRepository",
        "default",
        "openStoryDeckContext",
        "restoreStoryState",
        "storyBattleResult",
        "storyCardOwnership",
        "toStoryResolution",
      ],
      types: [
        "EncounterId",
        "PendingStoryDuel",
        "StoryDuelResolution",
        "StoryEncounterIntent",
        "StoryEncounterRequest",
        "StoryHandoffOutcome",
        "StorySaveEnvelope",
        "StorySaveReadResult",
        "StorySaveRepository",
        "StorySaveSummary",
        "StorySaveWriteResult",
        "StorySlotKey",
        "StoryState",
      ],
    },
    {
      name: "shell",
      entry: "src/shell/index.ts",
      namespace: shell,
      values: [
        "CardPreviewPanel",
        "OverlayScrollbar",
        "STAGE_ASPECT_HEIGHT",
        "STAGE_ASPECT_WIDTH",
        "STAGE_BREAKPOINT_PX",
        "STAGE_CONTEXT_KEY",
        "computeStageBox",
        "selectStageMode",
      ],
      types: [
        "CardPreviewImageSource",
        "CardPreviewView",
        "StageBox",
        "StageMode",
      ],
    },
  ] as const;

  for (const domain of expected) {
    it(`${domain.name} public API is exact`, () => {
      expect(Object.keys(domain.namespace).sort()).toEqual([...domain.values]);
      expect(declaredExports(domain.entry).types).toEqual([...domain.types]);
    });
  }
});

describe("domain imports", () => {
  it("no deep cross-domain imports", () => {
    const violations = sourceFiles().flatMap((file) =>
      importsOf(file)
        .filter((target) => !isLegalImport(file, target))
        .map((target) => `${file} -> ${target}`),
    );
    expect(violations).toEqual([]);
  });

  it("no worker imports outside the battle domain", () => {
    const violations = sourceFiles()
      .filter((file) => domainOf(file) !== "battle")
      .flatMap((file) =>
        importsOf(file)
          .filter((target) => target.startsWith("src/battle/worker/"))
          .map((target) => `${file} -> ${target}`),
      );
    expect(violations).toEqual([]);
  });

  it("every allowance names a file that still needs it", () => {
    for (const [file, targets] of Object.entries(ALLOWANCES))
      expect(importsOf(file)).toEqual(expect.arrayContaining([...targets]));
  });
});

it("no catch-all source folders", () => {
  const catchAll = readdirSync(sourceRoot).filter((entry) =>
    ["shared", "common", "utils", "core"].includes(entry),
  );
  expect(catchAll).toEqual([]);
});
