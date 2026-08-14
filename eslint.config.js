import eslint from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

/* ADR-022 domain boundaries. Each zone below lists what its own files may NOT
   import; every message names the public entry to use instead. Two facts shape
   the patterns. First, the duel's source has not been relocated under
   `src/battle/` yet, so `src/app`, `src/duel`, `src/field`, `src/worker` and
   `src/storage` are battle internals reachable only through
   `src/battle/index.ts`. Second, `src/decks` is the shared deck-data library
   the three UI domains all read, not a lazy UI domain, so its modules stay
   importable everywhere and only its index shape is frozen.

   These patterns match specifier text, so they cannot tell `src/story/storage/`
   from `src/storage/`. `tests/unit/domain-boundaries.test.ts` resolves real
   paths and is the airtight half of the pair; both run in `check:headless`. */
const STORY_INTERNALS = ["**/story/**", "!**/story/index.ts"];
const DECK_EDITOR_INTERNALS = ["**/deck-editor/**", "!**/deck-editor/index.ts"];
const SHELL_INTERNALS = ["**/shell/**", "!**/shell/index.ts"];
const BATTLE_INTERNALS = [
  "**/battle/**",
  "!**/battle/index.ts",
  "**/app/**",
  "**/duel/**",
  "**/field/**",
  "**/worker/**",
  "**/storage/**",
];
/* Three allowances, each pinned to one file in the blocks at the bottom of this
   config and to the same file in `tests/unit/domain-boundaries.test.ts`. All
   three exist because the duel's source has not been relocated yet, and the
   only entry that could legally carry them — `src/battle/index.ts` — also
   exports `BattleFacade`. A static import of it from the shell turns the duel
   into an eager dependency: `vite build` reports INEFFECTIVE_DYNAMIC_IMPORT and
   the entry chunk goes from 2.62 kB to 339.73 kB. Each allowance disappears
   when the duel source moves.

   Re-including a directory before a file is required wherever the file's parent
   directory is itself excluded: a gitignore-style negation cannot reach into an
   excluded directory. */

/* Deck-format and preset asset modules, parked under `src/duel/presets`.
   `src/decks/index.ts` cannot carry them either — it is reached eagerly from
   `src/shell/routes.ts`, so six raw `.ydk` payloads would land in the entry. */
const DECK_FORMAT_PENDING_RELOCATION = [
  "!**/duel/presets",
  "!**/duel/presets/deck-parser.ts",
  "!**/duel/presets/deck-sources-browser.ts",
];
/* The duel's snapshot database name, read by the admin console to reset it. */
const DUEL_SNAPSHOT_NAME_PENDING_RELOCATION = ["!**/storage/snapshot-store.ts"];
/* The duel's v2 UI-state key and shape, which the shell's v3 settings migrate
   from on first load. */
const DUEL_UI_STATE_PENDING_RELOCATION = [
  "!**/app/stores",
  "!**/app/stores/persisted-ui-state.ts",
];

const STORY_MESSAGE =
  "Reach the visual novel through `src/story/index.ts` (ADR-022 domain boundary).";
const DECK_EDITOR_MESSAGE =
  "Reach the deck editor through `src/deck-editor/index.ts` (ADR-022 domain boundary).";
const SHELL_MESSAGE =
  "Reach the shell through `src/shell/index.ts` (ADR-022 domain boundary).";
const BATTLE_MESSAGE =
  "Reach the duel through `src/battle/index.ts`; `src/app`, `src/duel`, `src/field`, `src/worker` and `src/storage` are its internals (ADR-022 domain boundary).";

const boundaries = (files, patterns) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

export default tseslint.config(
  {
    ignores: [
      ".agentsystem/**",
      ".cache/**",
      ".pi/**",
      ".github/skills/**",
      ".github/hooks/**",
      "coverage/**",
      "dist*/**",
      "generated/**",
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
        __RUNTIME_REVISIONS__: "readonly",
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  boundaries(
    ["src/main.ts", "src/shell/**"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: BATTLE_INTERNALS, message: BATTLE_MESSAGE },
    ],
  ),
  /* `src/story` owns a `storage` subdirectory, so the storage pattern is
     dropped here; the resolved-path test covers story reaching `src/storage`. */
  boundaries(
    ["src/story/**"],
    [
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      {
        group: [
          ...BATTLE_INTERNALS.filter((pattern) => pattern !== "**/storage/**"),
          "!**/battle/battle-contracts.ts",
        ],
        message: `${BATTLE_MESSAGE} The visual novel may also type a handoff with \`src/battle/battle-contracts.ts\`.`,
      },
    ],
  ),
  boundaries(
    ["src/deck-editor/**"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      { group: BATTLE_INTERNALS, message: BATTLE_MESSAGE },
    ],
  ),
  boundaries(
    ["src/decks/**"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      { group: BATTLE_INTERNALS, message: BATTLE_MESSAGE },
    ],
  ),
  boundaries(
    [
      "src/acceptance-main.ts",
      "src/battle/**",
      "src/app/**",
      "src/duel/**",
      "src/field/**",
      "src/worker/**",
      "src/storage/**",
    ],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: ["**/shell/**"], message: SHELL_MESSAGE },
    ],
  ),
  /* The files carrying an allowance, and only those files. Each restates its
     zone because a later flat-config block replaces the rule outright. */
  boundaries(
    ["src/shell/admin/admin-actions.ts"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      {
        group: [
          ...BATTLE_INTERNALS,
          ...DECK_FORMAT_PENDING_RELOCATION,
          ...DUEL_SNAPSHOT_NAME_PENDING_RELOCATION,
        ],
        message: BATTLE_MESSAGE,
      },
    ],
  ),
  boundaries(
    ["src/shell/settings/shell-settings.ts"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      {
        group: [...BATTLE_INTERNALS, ...DUEL_UI_STATE_PENDING_RELOCATION],
        message: BATTLE_MESSAGE,
      },
    ],
  ),
  boundaries(
    ["src/decks/ydk-adapter.ts"],
    [
      { group: STORY_INTERNALS, message: STORY_MESSAGE },
      { group: DECK_EDITOR_INTERNALS, message: DECK_EDITOR_MESSAGE },
      { group: SHELL_INTERNALS, message: SHELL_MESSAGE },
      {
        group: [...BATTLE_INTERNALS, ...DECK_FORMAT_PENDING_RELOCATION],
        message: BATTLE_MESSAGE,
      },
    ],
  ),
);
