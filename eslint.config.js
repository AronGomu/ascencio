import eslint from "@eslint/js";
import { builtinModules } from "node:module";
import path from "node:path";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

/* ADR-022 domain boundaries. Each zone below lists what its own files may NOT
   import; every message names the public entry to use instead. One fact shapes
   the patterns beyond the domain folders themselves: `src/decks` is the shared
   deck-data library the three UI domains all read, not a lazy UI domain, so its
   modules stay importable everywhere and only its index shape is frozen.

   These patterns match specifier text rather than resolved paths.
   `tests/unit/domain-boundaries.test.ts` resolves real paths and is the
   airtight half of the pair; both run in `check:headless`. */
const STORY_INTERNALS = [
  "**/story/**",
  "!**/story/index.ts",
  "!**/story/ports",
  "!**/story/ports/index.ts",
  "!**/story/saves",
  "!**/story/saves/index.ts",
];
const DECK_EDITOR_INTERNALS = ["**/deck-editor/**", "!**/deck-editor/index.ts"];
const EDITOR_PORT = ["!**/deck-editor/ports", "!**/deck-editor/ports/index.ts"];
const DECK_SELECT_INTERNALS = ["**/deck-select/**", "!**/deck-select/index.ts"];
const SHELL_INTERNALS = ["**/shell/**", "!**/shell/index.ts"];
const BATTLE_INTERNALS = ["**/battle/**", "!**/battle/index.ts"];
const BATTLE_PORTS = ["!**/battle/ports", "!**/battle/ports/index.ts"];
/* Three allowances, each pinned to one file in the blocks at the bottom of this
   config and to the same file in `tests/unit/domain-boundaries.test.ts`. All
   three exist because the only entry that could legally carry them —
   `src/battle/index.ts` — also exports `BattleFacade`. A static import of it
   from the shell turns the duel into an eager dependency: `vite build` reports
   INEFFECTIVE_DYNAMIC_IMPORT and the entry chunk goes from 2.62 kB to
   339.73 kB. Each allowance disappears when its module gets a legal home.

   Re-including a directory before a file is required wherever the file's parent
   directory is itself excluded: a gitignore-style negation cannot reach into an
   excluded directory. The battle pattern excludes every level below `battle`,
   so each allowance re-includes the whole chain down to its file. */

/* Deck-format and preset asset modules, parked under `src/battle/duel/presets`.
   `src/decks/index.ts` cannot carry them either — it is reached eagerly from
   `src/shell/routes.ts`, so six raw `.ydk` payloads would land in the entry. */
const DECK_FORMAT_PENDING_RELOCATION = [
  "!**/battle/duel",
  "!**/battle/duel/presets",
  "!**/battle/duel/presets/deck-parser.ts",
  "!**/battle/duel/presets/deck-sources-browser.ts",
];
/* The duel's snapshot database name, read by the admin console to reset it. */
const DUEL_SNAPSHOT_NAME_PENDING_RELOCATION = [
  "!**/battle/storage",
  "!**/battle/storage/snapshot-store.ts",
];
/* The duel's v2 UI-state key and shape, which the shell's v3 settings migrate
   from on first load. */
const DUEL_UI_STATE_PENDING_RELOCATION = [
  "!**/battle/app",
  "!**/battle/app/stores",
  "!**/battle/app/stores/persisted-ui-state.ts",
];
/* The story's duel-handoff vocabulary, read by the shell's coordinator. It is
   the same shape of allowance as the three above and exists for the same
   reason: `src/story/index.ts` also exports `StoryApp`, so a static import of
   it from the shell would make the visual novel an eager dependency. The
   module holds pure functions and no component, so the allowance costs the
   entry chunk nothing. */
const STORY_HANDOFF_TYPES_PENDING_RELOCATION = [
  "!**/story/handoff",
  "!**/story/handoff/story-handoff.ts",
];
const STORY_MESSAGE =
  "Reach the visual novel through `src/story/index.ts` (ADR-022 domain boundary).";
const DECK_EDITOR_MESSAGE =
  "Reach the deck editor through `src/deck-editor/index.ts` (ADR-022 domain boundary).";
const DECK_SELECT_MESSAGE =
  "Reach the shared deck-selection screen through `src/deck-select/index.ts` (ADR-022 domain boundary).";
const SHELL_MESSAGE =
  "Reach the shell through `src/shell/index.ts` (ADR-022 domain boundary).";
const BATTLE_MESSAGE =
  "Reach the duel through `src/battle/index.ts`; everything else under `src/battle/` is its internals (ADR-022 domain boundary).";

const boundaries = (files, patterns) => ({
  files,
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          ...patterns.map((pattern) =>
            files.some(
              (file) => file.startsWith("src/shell/") || file === "src/main.ts",
            ) && pattern.group === DECK_EDITOR_INTERNALS
              ? {
                  ...pattern,
                  group: [...DECK_EDITOR_INTERNALS, ...EDITOR_PORT],
                }
              : pattern,
          ),
          ...(files.some(
            (file) =>
              file.startsWith("src/decks/") ||
              file.startsWith("src/deck-editor/"),
          )
            ? [
                {
                  group: ["**/content/**"],
                  message:
                    "Domains consume semantic ports; Content is composed by Shell.",
                },
              ]
            : []),
          ...(files.includes("src/content/**")
            ? []
            : [
                {
                  group: [
                    "**/content/contracts/**",
                    "**/content/parsers/**",
                    "**/content/content-*.ts",
                    // Shell-owned error copy is not a player-content internal.
                    "!**/content/content-error-copy.ts",
                  ],
                  message:
                    "Reach player content through `src/content/index.ts`; parsers and type-only ports stay isolated.",
                },
              ]),
        ],
      },
    ],
  },
});

export default tseslint.config(
  {
    ignores: [
      ".agents/**",
      ".agentsystem/**",
      ".cache/**",
      ".claude/**",
      ".pi/**",
      ".github/skills/**",
      ".github/hooks/**",
      ".pi-subagents/",
      ".tmp/",
      "artifacts/",
      "coverage/**",
      "dist*/**",
      "generated/**",
      "assets/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "vendor/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs["flat/recommended"],
  ...svelte.configs["flat/prettier"],
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "preserve-caught-error": "off",
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      globals: {
        ...globals.browser,
        __RUNTIME_MANIFEST_SHA256__: "readonly",
        __RUNTIME_SNAPSHOT_ID__: "readonly",
        __ACTIVATION_SNAPSHOT_ID__: "readonly",
        __APP_BUILD_ID__: "readonly",
        __ACTIVE_IMAGE_MANIFEST_SHA256__: "readonly",
        __ACTIVE_IMAGE_MANIFEST__: "readonly",
        __ACTIVE_CARD_TEXTS__: "readonly",
        __ACTIVE_CARD_DATA__: "readonly",
        __RUNTIME_REVISIONS__: "readonly",
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.svelte"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            ":matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^(?:@aws-sdk\\/|.*scripts\\/lib\\/asset-delivery\\/)/]",
          message:
            "Node-only asset delivery stays in scripts; never import it into app domains.",
        },
        {
          selector:
            "ImportExpression[source.value=/^(?:@aws-sdk\\/|.*scripts\\/lib\\/asset-delivery\\/)/]",
          message:
            "Node-only asset delivery stays in scripts; never import it into app domains.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.svelte"],
    plugins: {
      "focused-domains": {
        rules: {
          imports: {
            meta: {
              type: "problem",
              schema: [],
              messages: {
                boundary:
                  "Use the exact Cards/Decks public entry; migrated domains cannot import Content or foreign internals.",
              },
            },
            create(context) {
              const from = path
                .relative(import.meta.dirname, context.filename)
                .split(path.sep)
                .join("/");
              const source = from.split("/")[1];
              const check = (node) => {
                if (!node || typeof node.value !== "string") return;
                const to = node.value.startsWith(".")
                  ? path.posix
                      .normalize(
                        path.posix.join(
                          path.posix.dirname(from),
                          node.value.split("?")[0],
                        ),
                      )
                      .replace(/\.js$/, ".ts")
                  : node.value;
                const target = to.startsWith("src/") ? to.split("/")[1] : null;
                if (source === target) return;
                const deckEntries = [
                  "index",
                  "contracts/index",
                  "repository/index",
                  "editing/index",
                  "validation/index",
                  "catalog/index",
                ];
                const cardEntries = [
                  "index",
                  "classification/index",
                  "images/index",
                ];
                if (
                  source === "cards" ||
                  (source === "shell" &&
                    target === "content" &&
                    !from.startsWith("src/shell/application/") &&
                    !from.startsWith("src/shell/adapters/")) ||
                  (["decks", "deck-editor", "story"].includes(source) &&
                    target === "content") ||
                  (target === "decks" &&
                    !deckEntries.some(
                      (entry) => to === `src/decks/${entry}.ts`,
                    )) ||
                  (target === "cards" &&
                    !cardEntries.some(
                      (entry) => to === `src/cards/${entry}.ts`,
                    ))
                )
                  context.report({ node, messageId: "boundary" });
              };
              return {
                ImportDeclaration: (node) => check(node.source),
                ExportNamedDeclaration: (node) => check(node.source),
                ExportAllDeclaration: (node) => check(node.source),
                ImportExpression: (node) => {
                  if (
                    ["cards", "decks", "deck-editor"].includes(source) &&
                    typeof node.source.value !== "string"
                  )
                    context.report({ node, messageId: "boundary" });
                  else check(node.source);
                },
                TSImportType: (node) => check(node.source),
                CallExpression: (node) => {
                  if (
                    node.callee.type === "Identifier" &&
                    node.callee.name === "require"
                  )
                    check(node.arguments[0]);
                },
              };
            },
          },
        },
      },
    },
    rules: { "focused-domains/imports": "error" },
  },
  boundaries(
    ["src/shared-svelte-ui/**"],
    [
      {
        group: [
          "**/cards/**",
          "**/content/**",
          "**/decks/**",
          "**/deck-editor/**",
          "**/deck-select/**",
          "**/battle/**",
          "**/shell/**",
          "**/story/**",
          "**/vendor/**",
          "**/scripts/**",
          "node:*",
          ...builtinModules,
        ],
        message:
          "Shared Svelte views import no domain, data source, persistence, engine, or tooling module.",
      },
    ],
  ),
  boundaries(
    ["src/cards/**"],
    [
      {
        group: [
          "**/decks/**",
          "**/deck-editor/**",
          "**/deck-select/**",
          "**/battle/**",
          "**/shell/**",
          "**/story/**",
          "**/content/**",
          "**/vendor/**",
          "**/scripts/**",
          "node:*",
          ...builtinModules,
        ],
        message:
          "Canonical Cards has no domain, vendor runtime, or tooling dependency.",
      },
    ],
  ),
  boundaries(
    ["src/content/**"],
    [
      {
        group: [
          "**/battle/**",
          "**/story/**",
          "**/shell/**",
          "**/decks/**",
          "**/deck-editor/**",
          "**/deck-select/**",
          "**/scripts/**",
          "node:*",
          ...builtinModules,
          "@aws-sdk/**",
        ],
        message:
          "Player content vocabulary/parsers import no domain, engine, DB, Node tooling or SDK.",
      },
    ],
  ),
  {
    files: ["src/content/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `ImportExpression[source.value=/^(?:node:|@aws-sdk\\/|.*scripts\\/|(?:${builtinModules.map((name) => name.replaceAll("/", "\\/")).join("|")})$)/]`,
          message:
            "Player content cannot dynamically import Node tooling or SDKs.",
        },
        {
          selector: "ImportExpression[source.type!='Literal']",
          message:
            "Player content dynamic imports require literal paths for boundary validation.",
        },
      ],
    },
  },
  boundaries(
    ["src/main.ts", "src/shell/**"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      {
        group: [...BATTLE_INTERNALS, ...BATTLE_PORTS],
        message: BATTLE_MESSAGE,
      },
    ],
  ),
  boundaries(
    ["src/story/**"],
    [
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      {
        group: [...BATTLE_INTERNALS, "!**/battle/battle-contracts.ts"],
        message: `${BATTLE_MESSAGE} The visual novel may also type a handoff with \`src/battle/battle-contracts.ts\`.`,
      },
    ],
  ),
  boundaries(
    ["src/deck-editor/**"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      { group: BATTLE_INTERNALS, message: BATTLE_MESSAGE },
    ],
  ),
  /* The shared deck-selection screen is presentational and self-contained: the
     hosts map their own records into its view models, so it reads no other
     domain at all. Its own zone therefore excludes every sibling, and every
     sibling zone excludes its internals. */
  boundaries(
    ["src/deck-select/**"],
    [
      {
        group: [
          "**/cards/**",
          "**/content/**",
          "**/decks/**",
          "**/shared-svelte-ui/**",
        ],
        message:
          "Deck Select is pure presentation; hosts provide complete view models.",
      },
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      { group: BATTLE_INTERNALS, message: BATTLE_MESSAGE },
    ],
  ),
  boundaries(
    ["src/decks/**"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      { group: BATTLE_INTERNALS, message: BATTLE_MESSAGE },
    ],
  ),
  /* The duel reads the shell the way every other domain does: through
     `src/shell/index.ts` and nothing deeper. It did not need the entry until
     the shared card preview panel moved there, so this zone used to exclude
     the whole shell — including the entry its own message names. */
  boundaries(
    ["src/acceptance-main.ts", "src/battle/**"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
    ],
  ),
  /* The files carrying an allowance, and only those files. Each restates its
     zone because a later flat-config block replaces the rule outright. */
  boundaries(
    ["src/shell/admin/admin-actions.ts"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      {
        group: [...BATTLE_INTERNALS, ...DUEL_SNAPSHOT_NAME_PENDING_RELOCATION],
        message: BATTLE_MESSAGE,
      },
    ],
  ),
  boundaries(
    ["src/shell/settings/shell-settings.ts"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      {
        group: [...BATTLE_INTERNALS, ...DUEL_UI_STATE_PENDING_RELOCATION],
        message: BATTLE_MESSAGE,
      },
    ],
  ),
  boundaries(
    ["src/shell/handoff/handoff-coordinator.ts"],
    [
      {
        group: [...STORY_INTERNALS, ...STORY_HANDOFF_TYPES_PENDING_RELOCATION],
        message: STORY_MESSAGE,
      },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      { group: BATTLE_INTERNALS, message: BATTLE_MESSAGE },
    ],
  ),
  boundaries(
    ["src/decks/ydk-adapter.ts"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: DECK_SELECT_INTERNALS, message: DECK_SELECT_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      {
        group: [...BATTLE_INTERNALS, ...DECK_FORMAT_PENDING_RELOCATION],
        message: BATTLE_MESSAGE,
      },
    ],
  ),
);
