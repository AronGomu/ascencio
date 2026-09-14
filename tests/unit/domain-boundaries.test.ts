import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parse as parseSvelte } from "svelte/compiler";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as battle from "../../src/battle/index.ts";
import * as content from "../../src/content/index.ts";
import * as deckEditor from "../../src/deck-editor/index.ts";
import * as deckSelect from "../../src/deck-select/index.ts";
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

type Domain =
  | "main"
  | "shell"
  | "story"
  | "deck-editor"
  | "deck-select"
  | "battle"
  | "decks"
  | "content"
  | "cards"
  | "shared-svelte-ui";

const PUBLIC_ENTRY: Readonly<Record<Domain, string | null>> = Object.freeze({
  main: null,
  cards: "src/cards/index.ts",
  "shared-svelte-ui": null,
  content: "src/content/index.ts",
  shell: "src/shell/index.ts",
  story: "src/story/index.ts",
  "deck-editor": "src/deck-editor/index.ts",
  "deck-select": "src/deck-select/index.ts",
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
  /* Installed-content readers stay behind route/startup dynamic imports.
     Importing the broad content entry at these sites adds its full export graph
     to the shell closure and exceeds the machine-enforced shell budget. */
  "src/shell/AppShell.svelte": ["src/content/load-installed-images.ts"],
  "src/shell/core/core-gate.ts": [
    "src/content/storage/content-reader.ts",
    "src/content/load-installed-gameplay.ts",
  ],
  // Shared pure deck rules, never UI/gameplay chunks; owner-approved T4 exception.
  "src/content/install/verify-gameplay.ts": [
    "src/decks/catalog/pinned-ruleset.ts",
    "src/decks/catalog/ocg-mask.ts",
  ],
  "src/content/storage/content-database.ts": ["idb"],
  "src/content/storage/content-reader.ts": ["idb"],
  "src/shell/admin/admin-actions.ts": [
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
  "src/decks/ydk-adapter.ts": ["src/battle/duel/presets/deck-parser.ts"],
});

/* Root entrypoints compose owned domains. `src/acceptance-main.ts` is the
   battle acceptance entry; service worker composes shell-owned PWA policy. */
function domainOf(file: string): Domain {
  if (file === "src/main.ts" || file === "src/service-worker.ts") return "main";
  if (file === "src/acceptance-main.ts") return "battle";
  if (file.startsWith("src/cards/")) return "cards";
  if (file.startsWith("src/shared-svelte-ui/")) return "shared-svelte-ui";
  if (file.startsWith("src/content/")) return "content";
  if (file.startsWith("src/shell/")) return "shell";
  if (file.startsWith("src/story/")) return "story";
  if (file.startsWith("src/deck-editor/")) return "deck-editor";
  if (file.startsWith("src/deck-select/")) return "deck-select";
  if (file.startsWith("src/decks/")) return "decks";
  if (file.startsWith("src/battle/")) return "battle";
  throw new Error(
    `${file} belongs to no declared domain; classify it in tests/unit/domain-boundaries.test.ts`,
  );
}

function isLegalImport(from: string, to: string): boolean {
  if (ALLOWANCES[from]?.includes(to) === true) return true;
  if (to === "unresolved-dynamic-import") return false;

  const source = domainOf(from);
  if (source === "content") return to.startsWith("src/content/");
  if (source === "cards") return to.startsWith("src/cards/");
  if (source === "shared-svelte-ui")
    return to.startsWith("src/shared-svelte-ui/");
  const target = domainOf(to);
  if (
    target === "content" &&
    ["battle", "decks", "deck-editor", "story"].includes(source)
  )
    return false;
  if (source === target) return true;
  if (source === "deck-select") return false;

  /* The entry document mounts the shell and nothing else. */
  if (source === "main") return target === "shell";
  if (target === "decks")
    return [
      "index",
      "contracts/index",
      "repository/index",
      "editing/index",
      "validation/index",
      "catalog/index",
    ].some((entry) => to === `src/decks/${entry}.ts`);
  if (target === "cards")
    return ["index", "classification/index", "images/index"].some(
      (entry) => to === `src/cards/${entry}.ts`,
    );
  if (target === "shared-svelte-ui")
    return ["card-preview", "geometry", "scrollbar"].some(
      (entry) => to === `src/shared-svelte-ui/${entry}/index.ts`,
    );
  if (target === "deck-editor" && to === "src/deck-editor/ports/index.ts")
    return source === "shell";
  if (target === "battle" && to === "src/battle/ports/index.ts")
    return source === "shell";
  if (
    target === "story" &&
    ["src/story/ports/index.ts", "src/story/saves/index.ts"].includes(to)
  )
    return source === "shell";
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

function syntaxTree(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

/** Resolve AST imports, re-exports, dynamic imports and require calls. */
function importsOf(
  file: string,
  text = readFileSync(path.join(projectRoot, file), "utf8"),
): readonly string[] {
  const targets: string[] = [];
  const add = (specifier: string) => {
    if (!specifier.startsWith(".")) {
      if (["content", "cards"].includes(domainOf(file)))
        targets.push(specifier);
      return;
    }
    let resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), specifier.split("?")[0]!),
    );
    if (resolved.endsWith(".js")) resolved = resolved.slice(0, -3) + ".ts";
    if (
      ["content", "cards"].includes(domainOf(file)) ||
      (resolved.startsWith("src/") && /\.(ts|svelte|ydk)$/.test(resolved))
    )
      targets.push(resolved);
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      add(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) add(argument.text);
      else if (["cards", "decks", "deck-editor"].includes(domainOf(file)))
        targets.push("unresolved-dynamic-import");
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      add(node.argument.literal.text);
    ts.forEachChild(node, visit);
  };
  if (file.endsWith(".svelte")) {
    const walk = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      const node = value as Record<string, unknown>;
      if (
        [
          "ImportDeclaration",
          "ExportNamedDeclaration",
          "ExportAllDeclaration",
          "ImportExpression",
          "TSImportType",
        ].includes(String(node.type))
      ) {
        const source = (
          node.type === "TSImportType" ? node.argument : node.source
        ) as { value?: unknown } | undefined;
        if (typeof source?.value === "string") add(source.value);
        else if (
          node.type === "ImportExpression" &&
          ["cards", "decks", "deck-editor"].includes(domainOf(file))
        )
          targets.push("unresolved-dynamic-import");
      }
      if (node.type === "CallExpression") {
        const callee = node.callee as
          { type?: unknown; name?: unknown } | undefined;
        if (callee?.type === "Identifier" && callee.name === "require") {
          const argument = (node.arguments as { value?: unknown }[])[0];
          if (typeof argument?.value === "string") add(argument.value);
          else if (["cards", "decks", "deck-editor"].includes(domainOf(file)))
            targets.push("unresolved-dynamic-import");
        }
      }
      for (const child of Object.values(node)) walk(child);
    };
    walk(parseSvelte(text, { modern: true }));
  } else visit(syntaxTree(file, text));
  return targets;
}

/** Value and type export names declared by a public entry's own source. */
function declaredExports(
  entry: string,
  text = readFileSync(path.join(projectRoot, entry), "utf8"),
): {
  readonly values: readonly string[];
  readonly types: readonly string[];
} {
  const tree = syntaxTree(entry, text);
  const values: string[] = [];
  const types: string[] = [];
  for (const node of tree.statements) {
    if (ts.isExportAssignment(node))
      values.push(node.isExportEquals ? "export=" : "default");
    if (ts.isExportDeclaration(node)) {
      if (!node.exportClause || !ts.isNamedExports(node.exportClause))
        throw new Error(`Public export-star forbidden: ${entry}`);
      for (const element of node.exportClause.elements)
        (node.isTypeOnly || element.isTypeOnly ? types : values).push(
          element.name.text,
        );
    }
    if (
      ts.canHaveModifiers(node) &&
      ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (
        ts
          .getModifiers(node)
          ?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
      )
        (ts.isInterfaceDeclaration(node) ? types : values).push("default");
      else if (
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node)
      )
        types.push(node.name.text);
      else if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isEnumDeclaration(node)) &&
        node.name
      )
        values.push(node.name.text);
      else if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name))
            throw new Error(`Public destructuring export forbidden: ${entry}`);
          values.push(declaration.name.text);
        }
      }
    }
  }
  return { values: values.sort(), types: types.sort() };
}

describe("focused Cards/Decks public entries", () => {
  it.each([
    "export default 123;",
    "export default function named() {}",
    "export default function() {}",
    "export default class Named {}",
    "export default class {}",
    "export default interface Named {}",
    'export { cardCode as default } from "./contracts.ts";',
  ])("exact named export inventory detects %s", (extra) => {
    const entry = "src/cards/index.ts";
    const source = readFileSync(path.join(projectRoot, entry), "utf8");
    const original = declaredExports(entry, source);
    const changed = declaredExports(entry, `${source}\n${extra}`);
    expect([...changed.values, ...changed.types]).toContain("default");
    expect(changed).not.toEqual(original);
  });
  it("src/cards/index.ts exact named exports", () => {
    const declared = declaredExports("src/cards/index.ts");
    expect([...declared.values, ...declared.types].sort()).toEqual(
      [
        "CardCode",
        "cardCode",
        "CardDefinition",
        "CardImageRef",
        "CardImageVariant",
        "Cards",
        "createCards",
        "parseCardDefinitions",
        "validateCardConsistency",
        "CardFrame",
        "cardFrameOf",
        "CARD_FRAME_COLORS",
      ].sort(),
    );
  });
  it("src/cards/classification/index.ts exact named exports", () => {
    const declared = declaredExports("src/cards/classification/index.ts");
    expect([...declared.values, ...declared.types].sort()).toEqual(
      ["OCG_TYPE", "OCG_ATTRIBUTE", "OCG_RACE", "hasOcgType"].sort(),
    );
  });
  it("src/cards/images/index.ts exact named exports", () => {
    const declared = declaredExports("src/cards/images/index.ts");
    expect([...declared.values, ...declared.types].sort()).toEqual(
      ["CardImageLease", "CardImageSource"].sort(),
    );
  });
  it("src/decks/contracts/index.ts exact named exports", () => {
    const declared = declaredExports("src/decks/contracts/index.ts");
    expect([...declared.values, ...declared.types].sort()).toEqual(
      [
        "deckId",
        "DeckId",
        "DeckZone",
        "DeckIssueSeverity",
        "DeckValidationIssue",
        "DeckValidationSummary",
        "DeckCardLists",
        "DeckRecord",
        "ValidatedDeckSnapshot",
        "ResolveDeckResult",
        "DeckCardUpdate",
        "DeckHistory",
        "StoredDeck",
        "DeckAutosaveRecord",
        "cloneCardLists",
      ].sort(),
    );
  });
  it("src/decks/repository/index.ts exact named exports", () => {
    const declared = declaredExports("src/decks/repository/index.ts");
    expect([...declared.values, ...declared.types].sort()).toEqual(
      [
        "DeckRepository",
        "IndexedDbDeckRepository",
        "DeckStorageError",
        "DeckRevisionConflictError",
        "DeckMigrationError",
        "DECK_DATABASE_NAME",
        "MAXIMUM_DECK_AUTOSAVES",
        "DeckContext",
        "resolveDeckRepository",
        "resolveDeck",
      ].sort(),
    );
  });
  it("src/decks/editing/index.ts exact named exports", () => {
    const declared = declaredExports("src/decks/editing/index.ts");
    expect([...declared.values, ...declared.types].sort()).toEqual(
      [
        "emptyDeckHistory",
        "pushDeckUpdate",
        "redoDeckUpdate",
        "undoDeckUpdate",
        "MAXIMUM_DECK_NAME_LENGTH",
        "SortDirection",
        "SortMode",
        "FIFTEEN_CARD_GRID",
        "mainDeckGridPlan",
        "DeckGridPlan",
        "applyDeckCommand",
        "createBlankDeck",
        "derivedDeckName",
        "normalizeDeckName",
        "DeckCommand",
        "ensureStarterDeck",
        "STARTER_DECK_LIST",
        "STARTER_DECK_NAME",
        "exportYdk",
        "ydkFilename",
        "importYdk",
        "MAXIMUM_YDK_SOURCE_LENGTH",
        "YdkImportResult",
        "LEGACY_STARTER_DECK_LIST",
      ].sort(),
    );
  });
  it("src/decks/validation/index.ts exact named exports", () => {
    const declared = declaredExports("src/decks/validation/index.ts");
    expect([...declared.values, ...declared.types].sort()).toEqual(
      [
        "validateDeckDraft",
        "validatePublishedDecks",
        "validationDigest",
        "DeckValidationInput",
        "PROTOTYPE_RULESET",
        "quantityLimit",
        "catalogByCode",
        "PinnedDeckRuleset",
        "unlimitedCardOwnership",
        "CardOwnership",
      ].sort(),
    );
  });
  it("src/decks/catalog/index.ts exact named exports", () => {
    const declared = declaredExports("src/decks/catalog/index.ts");
    expect([...declared.values, ...declared.types].sort()).toEqual(
      [
        "cardsDeckCatalog",
        "DeckBuilderCardView",
        "deckBuildableCards",
        "buildDeckCatalogIndex",
        "filterQuickDeckCatalogIndex",
        "filterDeckCatalogIndex",
        "catalogTypeOptions",
        "EMPTY_CATALOG_FILTERS",
        "DeckCatalogFilters",
        "EMPTY_ADVANCED_DECK_CATALOG_FILTERS",
        "advancedDeckCatalogOptions",
        "DeckCatalogQuery",
        "EMPTY_DECK_CATALOG_QUERY",
        "AdvancedDeckCatalogFilters",
        "AdvancedDeckCatalogOptions",
        "CardTrait",
        "LinkMarkerRule",
        "NameMatch",
        "SpellProperty",
        "SummonFrame",
        "TrapProperty",
        "CatalogTypeTag",
        "numericCriterionError",
        "NumericCriterion",
        "NumericOperator",
      ].sort(),
    );
  });
  it("Editor port exact named exports", () => {
    expect(declaredExports("src/deck-editor/ports/index.ts")).toEqual({
      values: [],
      types: ["EditorCatalogInput"],
    });
  });
});

describe("public domain APIs are frozen", () => {
  /* Widening any list below is a deliberate edit, not a silent change. */
  const expected = [
    {
      name: "content",
      entry: "src/content/index.ts",
      namespace: content,
      values: [
        "CONTENT_CACHE_NAME",
        "CONTENT_DATABASE_NAME",
        "CONTENT_DATABASE_VERSION",
        "CONTENT_FILE_MAX_BYTES",
        "CONTENT_INSTALLER_LOCK",
        "ZIP_PART_MAX_BYTES",
        "ZIP_PART_MAX_UNPACKED_BYTES",
        "acquireInstalledAsset",
        "contentObjectUrl",
        "createContentInstaller",
        "loadInstalledGameplay",
        "loadInstalledImages",
        "openContentReader",
        "openProgressiveContentStore",
        "parseChapterGameplay",
        "parseChapterSelections",
        "parseChapterStoryDocument",
        "parseContentIndex",
        "parseContentManifest",
        "parseCoreBootstrap",
        "parseLatestContentPointer",
        "parseProgressiveManifest",
      ],
      types: [
        "ChapterCard",
        "ChapterChoiceId",
        "ChapterContentPolicy",
        "ChapterDeck",
        "ChapterFileRef",
        "ChapterGameplay",
        "ChapterId",
        "ChapterOpponent",
        "ChapterRarity",
        "ChapterReadiness",
        "ChapterRelease",
        "ChapterSelection",
        "ChapterSelections",
        "ChapterSet",
        "ChapterStoryDocument",
        "ContentError",
        "ContentErrorCode",
        "ContentFailure",
        "ContentFailureCode",
        "ContentIndex",
        "ContentInstaller",
        "ContentManager",
        "ContentManifest",
        "ContentMediaType",
        "ContentReadPort",
        "ContentReader",
        "ContentResult",
        "ContentSessionLease",
        "ContentSetRef",
        "CoreBootstrap",
        "CoreChapterId",
        "CoreRange",
        "DownloadJob",
        "DownloadPhase",
        "DownloadProgress",
        "DownloadRequest",
        "DownloadResult",
        "DownloadTarget",
        "FileVersion",
        "InstallReceipt",
        "InstalledAssetLease",
        "InstalledContentSet",
        "InstalledGameplay",
        "InstalledImageLibrary",
        "InstalledRuntimeReceipt",
        "LatestContentPointer",
        "LegacyDownloadJob",
        "LegacyDownloadProgress",
        "ManifestRef",
        "OwnedContentReader",
        "PackId",
        "PackedFile",
        "PersistedDownloadJob",
        "ProgressiveContentStore",
        "ProgressiveCoreBootstrap",
        "ProgressiveManifest",
        "ReleaseFile",
        "RuntimeActivationPort",
        "RuntimeReceiptFile",
        "RuntimeSnapshotRef",
        "SavedContentRefsPort",
        "Sha256",
        "StagedContent",
        "StoryContentBinding",
        "VerifiedMetadata",
        "ZipPart",
      ],
    },

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
        "installedSelectableDecks",
        "listSelectableDecks",
        "parseBattleRequest",
        "parseBattleRuntimeInput",
        "presetSelectableDecks",
        "settleOnce",
        "validateBattleRuntime",
      ],
      types: [
        "BattleDeckSelection",
        "BattleFacadeResult",
        "BattleOutcome",
        "BattlePresentationDeck",
        "BattlePresentationInput",
        "BattlePresentationOpponent",
        "BattleRequest",
        "BattleRuntimeCard",
        "BattleRuntimeInput",
        "BattleRuntimeSource",
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
        "installedDeckCatalog",
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
      name: "deck-select",
      entry: "src/deck-select/index.ts",
      namespace: deckSelect,
      /* T11: a new public entry. The deck-selection screen is one shared
         presentational library the shell, the visual novel and the deck editor
         all mount, so it is a domain of its own rather than a folder inside
         any one of them. It holds view models and pure functions only — hosts
         map their own records into `DeckTileModel`, so nothing here reads
         storage and nothing here can turn a host eager.

         T12, deliberate widening of one name: `DeckTile` is the one tile the
         grid, the library, the seat cards and the mobile list all render, so
         every host reaches the same component instead of copying it. It is a
         presentational component with no store and no loader, so naming it
         here makes no host eager.

         T13, deliberate widening of three names: the tile's kebab sheet and
         the rename and delete dialogs its actions open. Every host that shows
         a tile shows the same four actions, and the dialogs are the shape the
         host confirms them with, so all three are reached here rather than
         re-authored per screen. Presentational like the tile — the host owns
         the menu/dialog state and performs the operation itself.

         T14, deliberate widening of one name: `DeckSelectScreen`, the screen
         those parts compose into. It is the whole point of the library — the
         hosts mount it instead of re-assembling header, tools, grid and footer
         each time — and it owns the menu/dialog state machine the four names
         above deliberately left to a host. Still presentational: it takes view
         models and callbacks, so it reads no storage and turns no host
         eager.

         T16, deliberate widening of one name: `pinSelectedFirst`, the narrow
         layout's extra list transform. It sits beside `orderDeckTiles` because
         it is the same kind of thing — a pure ranking step over view models —
         and a host that renders its own phone list has to reach the same order
         the screen does rather than re-derive it.

         T17, deliberate widening of one name: `DecklistPanel`, the sectioned
         Main/Extra/Side list of one deck. The screen renders it twice over —
         floated beside a hovered duel-start tile, docked in the library's
         second column — so it is the same one-atom argument as `DeckTile`, and
         a host showing a decklist of its own reaches it here. Presentational
         like the rest: it takes a `DecklistView` the host resolved and reads
         nothing itself. */
      values: [
        "DeckSelectScreen",
        "DeckTile",
        "DeckTileMenu",
        "DecklistPanel",
        "DeleteDeckConfirm",
        "RenameDeckDialog",
        "orderDeckTiles",
        "pinSelectedFirst",
      ],
      types: [
        "DeckSelectMode",
        "DeckSelectScope",
        "DeckSort",
        "DeckTileModel",
        "DecklistRow",
        "DecklistView",
        "OpponentView",
      ],
    },
    {
      name: "story",
      entry: "src/story/index.ts",
      namespace: story,
      /* R3, deliberate narrowing of two names: `createStoryDeckRepository` and
         `storyCardOwnership` are gone from this entry. Neither had a consumer
         outside `src/story/` — the shell binds `openStoryDeckContext` — and
         between them they re-opened the hole T23 closed: a caller holding the
         bare constructor could assemble `{ kind: "story", createRepository,
         ownership: unlimitedCardOwnership() }` and type-check, which is a story
         save edited against every printed card. Both modules stay where they
         are and are still reached from inside the domain.

         T23, deliberate widening of one name: `openStoryDeckContext` is the
         only constructor of a story deck context. The shell binds the editor
         to it, and building one outside the story would mean exporting the
         reducer and letting a caller pair one save's decks with another save's
         ownership.

         T29, deliberate widening of three more: the collection browser. A
         collection is counts only, so the rarity every tile is grouped by is
         resolved from the shop's set data and the inference beside it — story
         internals the shell may not reach — while the screen itself is mounted
         for both worlds. All three are reached through the shell's lazy
         `import("../story/index.ts")`, never a static import, or the visual
         novel turns eager and the shell budget in `verify-browser-build.ts`
         rejects the build. `loadCollectionScreen` is a loader rather than a
         re-export of the component for the same reason one level down:
         `StoryApp` never renders that screen, and carrying it took the story
         closure from 126,110 to 132,976 bytes, inside the 143,750 budget but
         under the 10% headroom `domain-chunk-closure.test.ts` requires.

         T28, deliberate widening of one more: `encounterDeck` resolves the deck
         an encounter is fought with. A reload that lands on a duel session has
         no story mounted to resolve it and the shell has neither the save's
         ownership nor the catalog, so the resolver has to be reachable — and
         there must be exactly one of it, or the briefing and the duel could
         disagree about which decks are legal. */
      values: [
        "ENCOUNTER_LABELS",
        "STORY_SAVES_DATABASE_NAME",
        "acceptsResult",
        "default",
        "encounterDeck",
        "loadCollectionCatalog",
        "loadCollectionScreen",
        "openStoryDeckContext",
        "restoreStoryState",
        "storyBattleResult",
        "toStoryResolution",
      ],
      types: [
        "CollectionCatalog",
        "EncounterId",
        "GenerationSaveRepository",
        "PendingStoryDuel",
        "StoryDuelResolution",
        "StoryEncounterIntent",
        "StoryEncounterRequest",
        "StoryHandoffOutcome",
        "StorySaveEnvelope",
        "StorySaveReadResult",
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
        "STAGE_ASPECT_HEIGHT",
        "STAGE_ASPECT_WIDTH",
        "STAGE_BREAKPOINT_PX",
        "STAGE_CONTEXT_KEY",
        "TOAST_CONTEXT_KEY",
        "computeStageBox",
        "routeLabel",
        "selectStageMode",
      ],
      types: [
        "StageBox",
        "StageMode",
        "ToastPublisher",
        "ToastRequest",
        "ToastTone",
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
  it.each([
    '<script lang="ts">type Reader = import("../content/index.ts").ContentReadPort;</script>',
    '<script lang="ts">const reader = require("../content/index.ts");</script>',
    '{#if require("../content/index.ts")}<p>loaded</p>{/if}',
  ])("Svelte AST resolves forbidden Content dependency: %s", (text) => {
    const file = "src/deck-editor/Probe.svelte";
    const targets = importsOf(file, text);
    expect(targets).toEqual(["src/content/index.ts"]);
    expect(isLegalImport(file, targets[0]!)).toBe(false);
  });
  it("Svelte AST rejects computed require dependencies", () => {
    const file = "src/deck-editor/Probe.svelte";
    const targets = importsOf(
      file,
      "<script>const reader = require(target);</script>",
    );
    expect(targets).toEqual(["unresolved-dynamic-import"]);
    expect(isLegalImport(file, targets[0]!)).toBe(false);
  });
  it("AST resolver ignores comments and resolves re-exports/dynamic .js imports", () => {
    expect(
      importsOf(
        "src/decks/probe.ts",
        '/* import "../content/index.ts" */ export { X } from "../content/index.js"; import("../content/index.ts");',
      ),
    ).toEqual(["src/content/index.ts", "src/content/index.ts"]);
  });
  it("AST resolver rejects type-only, Svelte-template and computed boundary bypasses", () => {
    for (const [file, text] of [
      [
        "src/decks/probe.ts",
        'type Reader = import("../content/index.ts").ContentReadPort;',
      ],
      [
        "src/deck-editor/Probe.svelte",
        '{#await import("../content/index.ts")}<p>loading</p>{/await}',
      ],
      ["src/decks/probe.ts", "import(target);"],
    ]) {
      const targets = importsOf(file!, text!);
      expect(targets).toHaveLength(1);
      expect(isLegalImport(file!, targets[0]!)).toBe(false);
    }
  });
  it("Boundary negative fixture: Deck Select imports no sibling", () => {
    expect(
      isLegalImport("src/deck-select/probe.ts", "src/cards/index.ts"),
    ).toBe(false);
    expect(
      isLegalImport(
        "src/deck-select/probe.ts",
        "src/shared-svelte-ui/card-preview/index.ts",
      ),
    ).toBe(false);
  });

  it("Boundary negative fixture: Decks imports Content / Cards imports Decks", () => {
    expect(isLegalImport("src/decks/probe.ts", "src/content/index.ts")).toBe(
      false,
    );
    expect(
      isLegalImport("src/deck-editor/probe.ts", "src/content/index.ts"),
    ).toBe(false);
    expect(isLegalImport("src/cards/probe.ts", "src/decks/index.ts")).toBe(
      false,
    );
    expect(isLegalImport("src/story/probe.ts", "src/decks/deck-model.ts")).toBe(
      false,
    );
  });
  it("progressive storage rejects incoming deep imports and outgoing semantic domain imports", () => {
    expect(
      isLegalImport(
        "src/story/probe.ts",
        "src/content/storage/progressive-content-store.ts",
      ),
    ).toBe(false);
    expect(
      isLegalImport(
        "src/content/storage/progressive-content-store.ts",
        "src/story/index.ts",
      ),
    ).toBe(false);
    expect(isLegalImport("src/shell/probe.ts", "src/content/index.ts")).toBe(
      true,
    );
  });
  it("installer exceptions remain exact-file pure validation boundaries", () => {
    expect(
      isLegalImport(
        "src/content/install/verify-gameplay.ts",
        "src/decks/catalog/pinned-ruleset.ts",
      ),
    ).toBe(true);
    expect(
      isLegalImport(
        "src/content/probe.ts",
        "src/decks/catalog/pinned-ruleset.ts",
      ),
    ).toBe(false);
    expect(
      isLegalImport(
        "src/content/install/verify-gameplay.ts",
        "src/decks/index.ts",
      ),
    ).toBe(false);
    expect(
      isLegalImport(
        "src/shell/screens/InstallContentScreen.svelte",
        "src/shell/adapters/runtime-activation.ts",
      ),
    ).toBe(true);
    expect(
      isLegalImport(
        "src/battle/probe.ts",
        "src/shell/adapters/runtime-activation.ts",
      ),
    ).toBe(false);
  });
  it("content rejects dynamic Node and scripts imports", () => {
    for (const specifier of [
      "node:fs",
      "fs",
      "fs/promises",
      "../../scripts/content-catalog.ts",
      "../../scripts/lib/asset-delivery/bundle.ts",
    ]) {
      const targets = importsOf(
        "src/content/probe.ts",
        `import("${specifier}")`,
      );
      expect(targets).toHaveLength(1);
      expect(isLegalImport("src/content/probe.ts", targets[0]!)).toBe(false);
    }
    expect(isLegalImport("src/content/probe.ts", "src/content/index.ts")).toBe(
      true,
    );
  });
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

describe("Battle Content isolation", () => {
  it("rejects every Content import from Battle", () => {
    expect(isLegalImport("src/battle/probe.ts", "src/content/index.ts")).toBe(
      false,
    );
    expect(
      sourceFiles()
        .filter((file) => file.startsWith("src/battle/"))
        .flatMap((file) =>
          importsOf(file).filter((ref) => String(ref).includes("src/content/")),
        ),
    ).toEqual([]);
  });
});

describe("Story Content isolation", () => {
  it("rejects Content imports including type aliases and raw path fixtures", () => {
    expect(
      isLegalImport("src/story/model/fixture.ts", "src/content/index.ts"),
    ).toBe(false);
    expect(
      sourceFiles()
        .filter((file) => file.startsWith("src/story/"))
        .flatMap((file) =>
          importsOf(file).filter((ref) => String(ref).includes("src/content/")),
        ),
    ).toEqual([]);
  });
});

it("Story pure ports/saves entries expose exact generation contracts without UI", async () => {
  const ports = await import("../../src/story/ports/index.ts");
  const saves = await import("../../src/story/saves/index.ts");
  expect(Object.keys(ports).sort()).toEqual([
    "parseStoryRelease",
    "validateStoryContinuity",
    "validateStoryRelease",
  ]);
  expect(Object.keys(saves).sort()).toEqual([
    "STORY_SAVES_DATABASE_NAME",
    "STORY_SLOT_KEYS",
    "createStoryMigrationPort",
  ]);
  expect(declaredExports("src/story/ports/index.ts").types).toEqual([
    "StoryChoiceId",
    "StoryDocument",
    "StoryMedia",
    "StoryMediaLease",
    "StoryRarity",
    "StoryRelease",
    "StorySet",
  ]);
  expect(declaredExports("src/story/saves/index.ts").types).toEqual([
    "GenerationSaveRepository",
    "StoryBinding",
    "StoryGenerationId",
    "StoryGenerationSeal",
    "StoryMigrationPort",
    "StorySaveEnvelope",
    "StorySaveReadResult",
    "StorySaveSummary",
    "StorySaveWriteResult",
    "StorySlotKey",
  ]);
  for (const entry of [
    "src/story/ports/index.ts",
    "src/story/saves/index.ts",
  ]) {
    expect(isLegalImport("src/shell/adapters/fixture.ts", entry)).toBe(true);
    expect(importsOf(entry).some((path) => path.endsWith(".svelte"))).toBe(
      false,
    );
  }
});

it("freezes the semantic Battle ports including InitializeRuntimeCommand", () => {
  expect(declaredExports("src/battle/ports/index.ts")).toEqual({
    values: ["parseBattleRuntimeInput", "validateBattleRuntime"],
    types: [
      "BattlePresentationDeck",
      "BattlePresentationInput",
      "BattlePresentationOpponent",
      "BattleRuntimeCard",
      "BattleRuntimeInput",
      "BattleRuntimeSource",
      "InitializeRuntimeCommand",
    ],
  });
});
