import { cardCode, type CardCode } from "../../cards/index.ts";

const MAX_WASM_BYTES = 16 * 1024 * 1024;
const MAX_CARDS = 50_000;
const MAX_SCRIPTS = 50_000;
const MAX_SCRIPT_SOURCE_UNITS = 1024 * 1024;
const MAX_SCRIPT_SOURCE_TOTAL_UNITS = 128 * 1024 * 1024;
const MAX_STRING_ENTRIES = 50_000;
const MAX_TEXT_UNITS = 64 * 1024 * 1024;
const MAX_CARD_STRINGS = 128;
const MAX_SETCODES = 64;
const FROZEN_CORE_VERSION = [11, 0] as const;

export interface BattleRuntimeCard {
  readonly code: CardCode;
  readonly alias: number;
  readonly setcodes: readonly number[];
  readonly type: number;
  readonly level: number;
  readonly attribute: number;
  readonly race: string;
  readonly attack: number;
  readonly defense: number;
  readonly lscale: number;
  readonly rscale: number;
  readonly linkMarker: number;
}

export interface BattleRuntimeInput {
  readonly schemaVersion: 1;
  readonly snapshotId: string;
  readonly coreVersion: readonly [number, number];
  readonly wasmBinary: ArrayBuffer;
  readonly cards: readonly BattleRuntimeCard[];
  readonly texts: readonly {
    readonly code: CardCode;
    readonly name: string;
    readonly description: string;
    readonly strings: readonly string[];
  }[];
  readonly scripts: readonly {
    readonly name: string;
    readonly source: string;
  }[];
  readonly requiredScripts: Readonly<{
    cards: readonly string[];
    globals: readonly string[];
  }>;
  readonly strings: Readonly<{
    system: Readonly<Record<string, string>>;
    victory: Readonly<Record<string, string>>;
    counter: Readonly<Record<string, string>>;
    setname: Readonly<Record<string, string>>;
  }>;
  readonly allowedCardCodes: readonly CardCode[];
  readonly ruleset: Readonly<{
    id: string;
    revision: string;
    quantityByCode: readonly (readonly [CardCode, 0 | 1 | 2 | 3])[];
  }>;
  readonly revisions: Readonly<{
    babelCdb: string;
    cardScripts: string;
  }>;
}

export interface InitializeRuntimeCommand {
  readonly type: "initialize";
  readonly runtime: BattleRuntimeInput;
}

export interface BattleRuntimeSource {
  load(signal: AbortSignal): Promise<BattleRuntimeInput>;
}

export function parseBattleRuntimeInput(value: unknown): BattleRuntimeInput {
  try {
    const input = record(value, [
      "schemaVersion",
      "snapshotId",
      "coreVersion",
      "wasmBinary",
      "cards",
      "texts",
      "scripts",
      "requiredScripts",
      "strings",
      "allowedCardCodes",
      "ruleset",
      "revisions",
    ]);
    if (input.schemaVersion !== 1) invalid();
    const snapshotId = boundedString(input.snapshotId, 64);
    if (!/^[a-f0-9]{64}$/.test(snapshotId)) invalid();
    const coreVersion = denseArray(input.coreVersion, 2).map(
      nonnegativeInteger,
    );
    if (coreVersion.length !== 2) invalid();
    if (!(input.wasmBinary instanceof ArrayBuffer)) invalid();
    if (
      input.wasmBinary.byteLength < 1 ||
      input.wasmBinary.byteLength > MAX_WASM_BYTES
    )
      invalid();

    const cards = denseArray(input.cards, MAX_CARDS).map((value) => {
      const card = record(value, [
        "code",
        "alias",
        "setcodes",
        "type",
        "level",
        "attribute",
        "race",
        "attack",
        "defense",
        "lscale",
        "rscale",
        "linkMarker",
      ]);
      const race = boundedString(card.race, 20);
      if (
        !/^(?:0|[1-9]\d*)$/.test(race) ||
        race.length > 20 ||
        (race.length === 20 && race > "18446744073709551615")
      )
        invalid();
      return Object.freeze({
        code: parsedCardCode(card.code),
        alias: nonnegativeInteger(card.alias),
        setcodes: Object.freeze(
          denseArray(card.setcodes, MAX_SETCODES).map(nonnegativeInteger),
        ),
        type: nonnegativeInteger(card.type),
        level: nonnegativeInteger(card.level),
        attribute: nonnegativeInteger(card.attribute),
        race,
        attack: integer(card.attack),
        defense: integer(card.defense),
        lscale: nonnegativeInteger(card.lscale),
        rscale: nonnegativeInteger(card.rscale),
        linkMarker: nonnegativeInteger(card.linkMarker),
      });
    });
    unique(cards.map(({ code }) => code));

    let textUnits = 0;
    const texts = denseArray(input.texts, MAX_CARDS).map((value) => {
      const text = record(value, ["code", "name", "description", "strings"]);
      const name = boundedString(text.name, 512);
      const description = boundedString(text.description, 64 * 1024, true);
      const strings = denseArray(text.strings, MAX_CARD_STRINGS).map((entry) =>
        boundedString(entry, 16 * 1024, true),
      );
      textUnits +=
        name.length +
        description.length +
        strings.reduce((total, entry) => total + entry.length, 0);
      if (textUnits > MAX_TEXT_UNITS) invalid();
      return Object.freeze({
        code: parsedCardCode(text.code),
        name,
        description,
        strings: Object.freeze(strings),
      });
    });
    unique(texts.map(({ code }) => code));

    let scriptUnits = 0;
    const scripts = denseArray(input.scripts, MAX_SCRIPTS).map((value) => {
      const script = record(value, ["name", "source"]);
      const name = scriptName(script.name);
      const source = boundedString(
        script.source,
        MAX_SCRIPT_SOURCE_UNITS,
        true,
      );
      scriptUnits += source.length;
      if (scriptUnits > MAX_SCRIPT_SOURCE_TOTAL_UNITS) invalid();
      return Object.freeze({ name, source });
    });
    unique(scripts.map(({ name }) => name));

    const requiredScripts = record(input.requiredScripts, ["cards", "globals"]);
    const requiredCards = denseArray(requiredScripts.cards, MAX_SCRIPTS).map(
      scriptName,
    );
    const requiredGlobals = denseArray(
      requiredScripts.globals,
      MAX_SCRIPTS,
    ).map(scriptName);
    unique(requiredCards);
    unique(requiredGlobals);
    sorted(requiredCards);
    sorted(requiredGlobals);

    const stringGroups = record(input.strings, [
      "system",
      "victory",
      "counter",
      "setname",
    ]);
    let stringEntries = 0;
    const parseStringGroup = (
      value: unknown,
    ): Readonly<Record<string, string>> => {
      if (typeof value !== "object" || value === null || Array.isArray(value))
        invalid();
      const result: Record<string, string> = {};
      for (const [key, entry] of Object.entries(value)) {
        if (
          key.length === 0 ||
          key.length > 128 ||
          key === "__proto__" ||
          key === "constructor" ||
          key === "prototype"
        )
          invalid();
        stringEntries += 1;
        if (stringEntries > MAX_STRING_ENTRIES) invalid();
        result[key] = boundedString(entry, 16 * 1024, true);
      }
      return Object.freeze(result);
    };
    const strings = Object.freeze({
      system: parseStringGroup(stringGroups.system),
      victory: parseStringGroup(stringGroups.victory),
      counter: parseStringGroup(stringGroups.counter),
      setname: parseStringGroup(stringGroups.setname),
    });

    const allowedCardCodes = denseArray(input.allowedCardCodes, MAX_CARDS).map(
      parsedCardCode,
    );
    unique(allowedCardCodes);
    numericSorted(allowedCardCodes);

    const rulesetRecord = record(input.ruleset, [
      "id",
      "revision",
      "quantityByCode",
    ]);
    const quantityByCode = denseArray(
      rulesetRecord.quantityByCode,
      MAX_CARDS,
    ).map((value) => {
      const pair = denseArray(value, 2);
      if (pair.length !== 2 || ![0, 1, 2, 3].includes(pair[1] as number))
        invalid();
      return Object.freeze([
        parsedCardCode(pair[0]),
        pair[1] as 0 | 1 | 2 | 3,
      ]) as readonly [CardCode, 0 | 1 | 2 | 3];
    });
    unique(quantityByCode.map(([code]) => code));
    numericSorted(quantityByCode.map(([code]) => code));

    const revisionsRecord = record(input.revisions, [
      "babelCdb",
      "cardScripts",
    ]);
    const parsed: BattleRuntimeInput = Object.freeze({
      schemaVersion: 1,
      snapshotId,
      coreVersion: Object.freeze([
        coreVersion[0]!,
        coreVersion[1]!,
      ]) as readonly [number, number],
      wasmBinary: input.wasmBinary,
      cards: Object.freeze(cards),
      texts: Object.freeze(texts),
      scripts: Object.freeze(scripts),
      requiredScripts: Object.freeze({
        cards: Object.freeze(requiredCards),
        globals: Object.freeze(requiredGlobals),
      }),
      strings,
      allowedCardCodes: Object.freeze(allowedCardCodes),
      ruleset: Object.freeze({
        id: boundedString(rulesetRecord.id, 128),
        revision: boundedString(rulesetRecord.revision, 128),
        quantityByCode: Object.freeze(quantityByCode),
      }),
      revisions: Object.freeze({
        babelCdb: boundedString(revisionsRecord.babelCdb, 128),
        cardScripts: boundedString(revisionsRecord.cardScripts, 128),
      }),
    });
    validateBattleRuntime(parsed);
    return parsed;
  } catch {
    throw new Error("BATTLE_RUNTIME_INVALID");
  }
}

export function validateBattleRuntime(input: BattleRuntimeInput): void {
  try {
    if (
      input.coreVersion[0] !== FROZEN_CORE_VERSION[0] ||
      input.coreVersion[1] !== FROZEN_CORE_VERSION[1]
    )
      invalid();
    const cards = new Set(input.cards.map(({ code }) => Number(code)));
    const texts = new Set(input.texts.map(({ code }) => Number(code)));
    for (const code of cards) if (!texts.has(code)) invalid();
    for (const code of input.allowedCardCodes)
      if (!cards.has(Number(code))) invalid();
    for (const card of input.cards)
      if (card.alias !== 0 && !cards.has(card.alias)) invalid();

    const scripts = new Set(input.scripts.map(({ name }) => name));
    for (const name of [
      ...input.requiredScripts.cards,
      ...input.requiredScripts.globals,
    ])
      if (!scripts.has(name)) invalid();
    for (const name of input.requiredScripts.cards) {
      const match = /^c([1-9]\d*)\.lua$/.exec(name);
      if (match === null || !cards.has(Number(match[1]))) invalid();
    }
    if (
      Object.keys(input.strings.system).length === 0 ||
      Object.keys(input.strings.victory).length === 0
    )
      invalid();
    for (const [code] of input.ruleset.quantityByCode)
      if (!cards.has(Number(code))) invalid();
  } catch {
    throw new Error("BATTLE_RUNTIME_INVALID");
  }
}

function record(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    invalid();
  const own = Object.keys(value);
  if (own.length !== keys.length || own.some((key) => !keys.includes(key)))
    invalid();
  return value as Readonly<Record<string, unknown>>;
}

function denseArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) invalid();
  for (let index = 0; index < value.length; index += 1)
    if (!(index in value)) invalid();
  return value;
}

function boundedString(value: unknown, maximum: number, empty = false): string {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    (!empty && value.length === 0)
  )
    invalid();
  return value;
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) invalid();
  return value;
}

function nonnegativeInteger(value: unknown): number {
  const parsed = integer(value);
  if (parsed < 0) invalid();
  return parsed;
}

function parsedCardCode(value: unknown): CardCode {
  return cardCode(integer(value));
}

function scriptName(value: unknown): string {
  const name = boundedString(value, 128);
  if (!/^(?:c[1-9]\d*|[A-Za-z0-9_]+)\.lua$/.test(name)) invalid();
  return name;
}

function unique(values: readonly (string | number)[]): void {
  if (new Set(values).size !== values.length) invalid();
}

function sorted(values: readonly string[]): void {
  for (let index = 1; index < values.length; index += 1)
    if (values[index - 1]! >= values[index]!) invalid();
}

function numericSorted(values: readonly number[]): void {
  for (let index = 1; index < values.length; index += 1)
    if (values[index - 1]! >= values[index]!) invalid();
}

function invalid(): never {
  throw new Error("BATTLE_RUNTIME_INVALID");
}
