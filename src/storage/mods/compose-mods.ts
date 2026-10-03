import { sha256 } from "@noble/hashes/sha2.js";
import {
  readableCard,
  ReadableCardFailure,
} from "../snapshot/readable-card.ts";
import {
  fieldsOverlap,
  OverrideFieldsFailure,
  replaceOverrideFields,
  writtenFields,
} from "./override-fields.ts";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { CriticalSnapshot } from "../contracts/critical-snapshot.ts";
import type {
  StartupDiagnostic,
  DiagnosticLocation,
} from "../contracts/startup-diagnostic.ts";
import {
  parseCriticalSnapshot,
  SnapshotFailure,
} from "../snapshot/parse-critical-snapshot.ts";
import { validAssetPath } from "../schema/package-database.ts";
import { validModId } from "./mod-preferences.ts";
import type {
  ContentComposition,
  LoadedMod,
  ModManifest,
} from "./mod-contracts.ts";

export class ModCompositionFailure extends Error {
  readonly diagnostics: readonly StartupDiagnostic[];
  constructor(diagnostics: readonly StartupDiagnostic[]) {
    super("MOD_COMPOSITION_FAILED");
    this.diagnostics = diagnostics;
  }
}
const encoder = new TextEncoder();
function hash(value: string): string {
  return bytesToHex(sha256(encoder.encode(value)));
}
function source(mod: string, file: string, pointer = ""): DiagnosticLocation {
  return { modId: mod, file, pointer };
}
function diagnostic(
  code: string,
  message: string,
  location: DiagnosticLocation,
  related?: DiagnosticLocation,
): StartupDiagnostic {
  return {
    code,
    severity: "error",
    phase: "mod-composition",
    message,
    source: location,
    notes: related ? [{ message: "Previous writer", source: related }] : [],
    causes: [],
    remediation:
      "Correct this enabled mod, its references or dependency/conflict declarations, then retry startup.",
  };
}
function fail(
  code: string,
  message: string,
  location: DiagnosticLocation,
  related?: DiagnosticLocation,
): never {
  throw new ModCompositionFailure([
    diagnostic(code, message, location, related),
  ]);
}
function exact(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join() === [...keys].sort().join()
  );
}
function version(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value)
  );
}

export function validateModManifest(
  value: unknown,
  expectedId?: string,
): ModManifest {
  const location = source(expectedId ?? "unknown", "mod.json");
  if (
    !exact(value, [
      "schemaVersion",
      "id",
      "version",
      "contentApi",
      "base",
      "dependencies",
      "entities",
      "media",
    ]) ||
    value.schemaVersion !== 1 ||
    value.contentApi !== 1 ||
    !validModId(value.id) ||
    (expectedId !== undefined && value.id !== expectedId) ||
    !version(value.version)
  )
    fail(
      "MOD_MANIFEST_SCHEMA",
      "Expected a versioned content API 1 mod manifest",
      location,
    );
  for (const key of ["base", "dependencies", "entities", "media"] as const)
    if (
      !Array.isArray(value[key]) ||
      value[key].length > (key === "entities" || key === "media" ? 10_000 : 64)
    )
      fail("MOD_SIZE", `Too many ${key}`, { ...location, pointer: `/${key}` });
  const m = value as unknown as ModManifest;
  const dependencyIds = new Set<string>();
  for (const [i, dependency] of m.dependencies.entries()) {
    if (
      !exact(dependency, ["id", "version"]) ||
      !validModId(dependency.id) ||
      !version(dependency.version) ||
      dependency.id === m.id ||
      dependencyIds.has(dependency.id)
    )
      fail("MOD_DEPENDENCY_INVALID", "Expected unique versioned dependencies", {
        ...location,
        pointer: `/dependencies/${i}`,
      });
    dependencyIds.add(dependency.id);
  }
  for (const [i, base] of m.base.entries())
    if (
      !exact(base, ["packageId", "version"]) ||
      typeof base.packageId !== "string" ||
      !version(base.version)
    )
      fail("MOD_BASE_INVALID", "Expected a package and exact base version", {
        ...location,
        pointer: `/base/${i}`,
      });
  const paths = new Set<string>();
  for (const [i, entity] of m.entities.entries()) {
    if (
      !exact(entity, [
        "kind",
        "packageId",
        "operation",
        "id",
        "path",
        "resolves",
      ]) ||
      ![
        "cards",
        "scripts",
        "sets",
        "decks",
        "opponents",
        "limits",
        "stories",
        "config",
      ].includes(entity.kind) ||
      typeof entity.packageId !== "string" ||
      !["add", "override"].includes(entity.operation) ||
      typeof entity.id !== "string" ||
      entity.id.length < 1 ||
      entity.id.length > 256 ||
      !validAssetPath(entity.path) ||
      entity.path.split("/").length > 8 ||
      !Array.isArray(entity.resolves) ||
      !entity.resolves.every(validModId) ||
      new Set(entity.resolves).size !== entity.resolves.length ||
      paths.has(entity.path)
    )
      fail(
        "MOD_ENTITY_SCHEMA",
        "Expected a unique scoped entity file and explicit operation",
        { ...location, pointer: `/entities/${i}` },
      );
    paths.add(entity.path);
  }
  for (const [i, mapping] of m.media.entries())
    if (
      !exact(mapping, [
        "packageId",
        "id",
        "path",
        "mime",
        "operation",
        "resolves",
      ]) ||
      typeof mapping.packageId !== "string" ||
      typeof mapping.id !== "string" ||
      typeof mapping.path !== "string" ||
      typeof mapping.mime !== "string" ||
      mapping.id.length > 1024 ||
      mapping.path.length > 1024 ||
      mapping.mime.length > 256 ||
      !["add", "override"].includes(mapping.operation) ||
      !Array.isArray(mapping.resolves) ||
      !mapping.resolves.every(validModId)
    )
      fail(
        "MOD_MEDIA_SCHEMA",
        "Expected a logical media mapping and explicit operation",
        { ...location, pointer: `/media/${i}` },
      );
  return m;
}

/** Stable high-range codes; collisions fail rather than depend on discovery order. */
export function modEngineCode(qualifiedId: string): number {
  return (
    0x4000_0000 +
    (Number.parseInt(hash(qualifiedId).slice(0, 8), 16) & 0x3fff_ffff)
  );
}

export function composeMods(
  base: readonly CriticalSnapshot[],
  input: readonly LoadedMod[],
  baseIdentities: readonly string[],
) {
  const mods = new Map<string, LoadedMod>();
  for (const entry of input) {
    const manifest = validateModManifest(entry.manifest, entry.manifest.id);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256) || mods.has(manifest.id))
      fail(
        "MOD_DUPLICATE",
        "Duplicate mod identity or invalid content receipt",
        source(manifest.id, "mod.json"),
      );
    mods.set(manifest.id, entry);
  }
  const ordered: LoadedMod[] = [],
    active = new Set<string>(),
    done = new Set<string>();
  function visit(mod: LoadedMod) {
    const m = mod.manifest;
    if (done.has(m.id)) return;
    if (active.has(m.id))
      fail(
        "MOD_DEPENDENCY_CYCLE",
        "Mod dependency cycle",
        source(m.id, "mod.json", "/dependencies"),
      );
    active.add(m.id);
    for (const d of [...m.dependencies].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const parent = mods.get(d.id);
      if (!parent || parent.manifest.version !== d.version)
        fail(
          "MOD_DEPENDENCY_MISSING",
          `Enable ${d.id} version ${d.version}`,
          source(m.id, "mod.json", "/dependencies"),
        );
      visit(parent);
    }
    for (const required of m.base)
      if (
        !base.some(
          (p) =>
            p.manifest.packageId === required.packageId &&
            p.manifest.version === required.version,
        )
      )
        fail(
          "MOD_BASE_INCOMPATIBLE",
          `Requires ${required.packageId} ${required.version}`,
          source(m.id, "mod.json", "/base"),
        );
    active.delete(m.id);
    done.add(m.id);
    ordered.push(mod);
  }
  for (const mod of [...mods.values()].sort((a, b) =>
    a.manifest.id.localeCompare(b.manifest.id),
  ))
    visit(mod);
  const packs = structuredClone(base) as CriticalSnapshot[];
  const codes = new Set<number>(
    base.flatMap((p) => p.cards.map((c) => c.definition.code)),
  );
  const allocated = new Map<string, number>();
  for (const mod of ordered)
    for (const e of mod.manifest.entities.filter(
      (e) => e.kind === "cards" && e.operation === "add",
    )) {
      if (!e.id.startsWith(`${mod.manifest.id}:`))
        fail(
          "MOD_ID_NAMESPACE",
          "Added card IDs must start with the mod ID",
          source(mod.manifest.id, e.path, "/id"),
        );
      const code = modEngineCode(e.id);
      if (codes.has(code) || allocated.has(e.id))
        fail(
          "MOD_CODE_COLLISION",
          `Engine code collision for ${e.id}`,
          source(mod.manifest.id, e.path),
        );
      codes.add(code);
      allocated.set(e.id, code);
    }
  const writers = new Map<
    string,
    { mod: string; location: DiagnosticLocation }
  >();
  const fieldWriters = new Map<
    string,
    Map<string, { mod: string; location: DiagnosticLocation }>
  >();
  const mediaOwners = new Map<
    string,
    { modId: string; packageId: string; id: string }
  >();
  function ancestors(id: string, target: string): boolean {
    return mods
      .get(id)!
      .manifest.dependencies.some(
        (d) => d.id === target || ancestors(d.id, target),
      );
  }
  function numberRef(value: unknown, location: DiagnosticLocation): number {
    if (typeof value === "number") return value;
    if (typeof value === "string" && allocated.has(value))
      return allocated.get(value)!;
    if (
      typeof value === "string" &&
      /^[1-9][0-9]*$/.test(value) &&
      codes.has(Number(value))
    )
      return Number(value);
    if (
      typeof value === "string" &&
      /^official:[1-9][0-9]*$/.test(value) &&
      codes.has(Number(value.slice(9)))
    )
      return Number(value.slice(9));
    fail("MOD_REFERENCE_MISSING", `Unknown card ${String(value)}`, location);
  }
  for (const mod of ordered) {
    const m = mod.manifest,
      files = new Map(mod.files.map((f) => [f.path, f.value]));
    if (files.size !== mod.files.length || files.size !== m.entities.length)
      fail(
        "MOD_SOURCE_SET",
        "Entity files differ from the manifest",
        source(m.id, "mod.json"),
      );
    for (const e of m.entities) {
      const location = source(m.id, e.path);
      const pack = packs.find((p) => p.manifest.packageId === e.packageId);
      if (!pack)
        fail("MOD_TARGET_MISSING", `Missing package ${e.packageId}`, location);
      if (
        ["cards", "scripts", "sets"].includes(e.kind) &&
        pack.manifest.packageType !== "card-library"
      )
        fail(
          "MOD_ENTITY_PACKAGE",
          `${e.kind} must target a card-library module`,
          location,
        );
      if (!m.base.some((pin) => pin.packageId === e.packageId))
        fail(
          "MOD_BASE_UNDECLARED",
          `Declare the exact base version for ${e.packageId}`,
          source(m.id, "mod.json", "/base"),
        );
      if (e.packageId === "duel-core")
        fail(
          "MOD_ENGINE_OVERRIDE_REFUSED",
          "Frozen engine resources/config cannot be overridden",
          location,
        );
      let value = structuredClone(files.get(e.path));
      if (value === undefined)
        fail("MOD_SOURCE_MISSING", "Declared entity file missing", location);
      let target = e.id;
      if (
        e.kind === "cards" &&
        value &&
        typeof value === "object" &&
        "engine" in value
      ) {
        try {
          value = readableCard(value);
        } catch (error) {
          fail("MOD_CARD_SCHEMA", "Invalid readable card fields", {
            ...location,
            pointer: error instanceof ReadableCardFailure ? error.pointer : "",
          });
        }
      }
      let patchFields: unknown;
      if (e.operation === "override" && exact(value, ["fields"])) {
        patchFields = value.fields;
        const targetCode =
          allocated.get(e.id) ?? Number(e.id.replace(/^official:/, ""));
        const original =
          e.kind === "config"
            ? pack.config
            : (pack[e.kind] as readonly unknown[]).find((row) => {
                const record = row as Record<string, unknown>;
                return e.kind === "cards"
                  ? (record.definition as { code: number }).code === targetCode
                  : e.kind === "scripts"
                    ? record.name ===
                      (e.id.startsWith("card:")
                        ? `c${numberRef(e.id.slice(5), location)}.lua`
                        : e.id)
                    : e.kind === "stories"
                      ? record.contentId === e.id
                      : e.kind === "limits"
                        ? (row as readonly unknown[])[0] ===
                          numberRef(e.id, location)
                        : record.id === e.id;
              });
        if (!original)
          fail(
            "MOD_TARGET_MISSING",
            `Missing override target ${e.id}`,
            location,
          );
        try {
          value = replaceOverrideFields(original, patchFields);
          if (e.kind === "cards") value = { id: e.id, ...(value as object) };
        } catch (error) {
          fail(
            "MOD_OVERRIDE_FIELD",
            "Override fields must be declared by the target schema and preserve identity",
            {
              ...location,
              pointer:
                error instanceof OverrideFieldsFailure
                  ? `/fields${error.pointer}`
                  : "/fields",
            },
          );
        }
      }
      if (e.kind === "cards") {
        if (
          !exact(value, ["id", "definition", "texts"]) ||
          value.id !== e.id ||
          !value.definition ||
          typeof value.definition !== "object"
        )
          fail(
            "MOD_CARD_SCHEMA",
            "Expected id, engine definition and localized texts",
            location,
          );
        const definition = value.definition as Record<string, unknown>;
        const code =
          e.operation === "add"
            ? allocated.get(e.id)!
            : (allocated.get(e.id) ?? Number(e.id.replace(/^official:/, "")));
        if (
          e.operation === "add" &&
          definition.code !== 0 &&
          definition.code !== code
        )
          fail(
            "MOD_CODE_EXPLICIT",
            `Use code 0 or deterministic code ${code}`,
            { ...location, pointer: "/definition/code" },
          );
        if (e.operation === "override" && definition.code !== code)
          fail(
            "MOD_IDENTITY_CHANGED",
            "An override must preserve the official engine code",
            { ...location, pointer: "/definition/code" },
          );
        definition.code = code;
        target = String(code);
        value = { definition, texts: value.texts };
      } else if (e.kind === "scripts") {
        if (typeof value !== "string")
          fail("MOD_SCRIPT_SCHEMA", "Expected Lua source bytes", location);
        target = e.id.startsWith("card:")
          ? `c${numberRef(e.id.slice(5), location)}.lua`
          : e.id;
        value = { name: target, source: value };
      } else if (e.kind === "decks") {
        if (!value || typeof value !== "object" || Array.isArray(value))
          fail("MOD_DECK_SCHEMA", "Expected deck fields", location);
        const deck = value as Record<string, unknown>;
        for (const zone of ["main", "extra", "side"]) {
          if (!Array.isArray(deck[zone]))
            fail("MOD_DECK_SCHEMA", "Expected card references", {
              ...location,
              pointer: `/${zone}`,
            });
          deck[zone] = (deck[zone] as unknown[]).map((v) =>
            numberRef(v, location),
          );
        }
      }
      if (
        e.kind === "sets" &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        const set = value as Record<string, unknown>;
        if (!Array.isArray(set.cards))
          fail("MOD_SET_SCHEMA", "Expected card printings", {
            ...location,
            pointer: "/cards",
          });
        set.cards = set.cards.map((card, index) => {
          if (!card || typeof card !== "object" || Array.isArray(card))
            fail("MOD_SET_SCHEMA", "Expected printing fields", {
              ...location,
              pointer: `/cards/${index}`,
            });
          return {
            ...card,
            code: numberRef((card as Record<string, unknown>).code, {
              ...location,
              pointer: `/cards/${index}/code`,
            }),
          };
        });
      }
      if (e.kind === "limits") {
        target = String(numberRef(e.id, location));
        if (!Array.isArray(value) || value.length !== 2)
          fail(
            "MOD_LIMIT_SCHEMA",
            "Expected a card reference and quantity",
            location,
          );
        value = [numberRef(value[0], { ...location, pointer: "/0" }), value[1]];
      }
      const identity = `${e.packageId}:${e.kind}:${target}`;
      const previous = writers.get(identity);
      const fields = writtenFields(patchFields ?? value);
      const priorFields = fieldWriters.get(identity) ?? new Map();
      for (const field of fields)
        for (const [prior, writer] of priorFields) {
          if (
            fieldsOverlap(field, prior) &&
            (e.operation !== "override" ||
              !e.resolves.includes(writer.mod) ||
              !ancestors(m.id, writer.mod))
          )
            fail(
              "MOD_OVERRIDE_CONFLICT",
              `Ambiguous writes to ${identity}${field}; explicitly depend on and resolve ${writer.mod}`,
              { ...location, pointer: patchFields ? `/fields${field}` : field },
              writer.location,
            );
        }
      for (const resolved of e.resolves)
        if (!ancestors(m.id, resolved))
          fail(
            "MOD_RESOLUTION_DEPENDENCY",
            `Resolution requires dependency ${resolved}`,
            location,
          );
      if (e.kind === "config") {
        if (e.operation !== "override" || e.id !== "config")
          fail(
            "MOD_OPERATION_INVALID",
            "Config requires an explicit override",
            location,
          );
        (pack as { config: unknown }).config = value;
      } else {
        const list = pack[e.kind] as unknown[];
        const identityOf = (v: unknown): string => {
          const r = v as Record<string, unknown>;
          return e.kind === "cards"
            ? String((r.definition as { code: number }).code)
            : e.kind === "scripts"
              ? String(r.name)
              : e.kind === "stories"
                ? String(r.contentId)
                : e.kind === "limits"
                  ? String((v as unknown[])[0])
                  : String(r.id);
        };
        const index = list.findIndex((row) => identityOf(row) === target);
        if ((e.operation === "add") === index >= 0)
          fail(
            e.operation === "add" ? "MOD_ENTITY_EXISTS" : "MOD_TARGET_MISSING",
            `Invalid ${e.operation} target ${identity}`,
            location,
            previous?.location,
          );
        if (identityOf(value) !== target)
          fail(
            "MOD_IDENTITY_CHANGED",
            `Entity ID must equal ${target}`,
            location,
          );
        if (index >= 0) list[index] = value;
        else list.push(value);
      }
      writers.set(identity, { mod: m.id, location });
      for (const field of fields)
        for (const prior of priorFields.keys())
          if (prior === field || prior.startsWith(`${field}/`))
            priorFields.delete(prior);
      for (const field of fields)
        priorFields.set(field, {
          mod: m.id,
          location: {
            ...location,
            pointer: patchFields ? `/fields${field}` : field,
          },
        });
      fieldWriters.set(identity, priorFields);
    }
    for (const [index, mapping] of m.media.entries()) {
      const location = source(m.id, "mod.json", `/media/${index}`);
      const pack = packs.find(
        (p) => p.manifest.packageId === mapping.packageId,
      );
      if (!pack)
        fail(
          "MOD_TARGET_MISSING",
          `Missing media package ${mapping.packageId}`,
          location,
        );
      if (!m.base.some((pin) => pin.packageId === mapping.packageId))
        fail(
          "MOD_BASE_UNDECLARED",
          `Declare the exact base version for ${mapping.packageId}`,
          source(m.id, "mod.json", "/base"),
        );
      const identity = `${mapping.packageId}:media:${mapping.id}`,
        previous = writers.get(identity);
      if (
        previous &&
        (mapping.operation !== "override" ||
          !mapping.resolves.includes(previous.mod) ||
          !ancestors(m.id, previous.mod))
      )
        fail(
          "MOD_OVERRIDE_CONFLICT",
          `Ambiguous media mapping ${identity}`,
          location,
          previous.location,
        );
      for (const resolved of mapping.resolves)
        if (!ancestors(m.id, resolved))
          fail(
            "MOD_RESOLUTION_DEPENDENCY",
            `Resolution requires dependency ${resolved}`,
            location,
          );
      const mappings = pack.media as {
        id: string;
        path: string;
        mime: string;
      }[];
      const i = mappings.findIndex((x) => x.id === mapping.id);
      if ((mapping.operation === "add") === i >= 0)
        fail(
          "MOD_OPERATION_INVALID",
          `Invalid ${mapping.operation} media target`,
          location,
        );
      const value = { id: mapping.id, path: mapping.path, mime: mapping.mime };
      if (i >= 0) mappings[i] = value;
      else mappings.push(value);
      writers.set(identity, { mod: m.id, location });
      mediaOwners.set(identity, {
        modId: m.id,
        packageId: mapping.packageId,
        id: mapping.id,
      });
    }
  }
  const errors: StartupDiagnostic[] = [];
  for (const pack of packs) {
    try {
      parseCriticalSnapshot(pack);
    } catch (error) {
      const pointer = error instanceof SnapshotFailure ? error.pointer : "";
      const [, kind, index, ...suffix] = pointer.split("/");
      const row =
        kind &&
        kind in pack &&
        Array.isArray(pack[kind as keyof CriticalSnapshot])
          ? ((pack[kind as keyof CriticalSnapshot] as readonly unknown[])[
              Number(index)
            ] as Record<string, unknown> | undefined)
          : undefined;
      const identity =
        kind === "cards"
          ? (row?.definition as { code?: number } | undefined)?.code
          : kind === "scripts"
            ? row?.name
            : kind === "stories"
              ? row?.contentId
              : kind === "limits"
                ? (row as unknown as unknown[] | undefined)?.[0]
                : kind === "config"
                  ? "config"
                  : row?.id;
      const key = `${pack.manifest.packageId}:${kind}:${identity}`;
      const field = `/${suffix.join("/")}`;
      const fieldWriter = [...(fieldWriters.get(key)?.entries() ?? [])].find(
        ([written]) => fieldsOverlap(written, field),
      )?.[1];
      const writer = fieldWriter ?? writers.get(key);
      const location = writer
        ? {
            ...writer.location,
            pointer: fieldWriter
              ? (fieldWriter.location.pointer ?? "")
              : suffix.length
                ? `/${suffix.join("/")}`
                : "",
          }
        : { file: `${pack.manifest.packageId}/critical.json`, pointer };
      errors.push(
        diagnostic(
          error instanceof SnapshotFailure ? error.code : "MOD_SCHEMA",
          error instanceof Error ? error.message : String(error),
          location,
        ),
      );
    }
  }
  const allCards = new Set<number>(
      packs.flatMap((p) => p.cards.map((c) => c.definition.code)),
    ),
    allScripts = new Set(packs.flatMap((p) => p.scripts.map((s) => s.name)));
  for (const pack of packs) {
    for (const deck of pack.decks)
      for (const code of [...deck.main, ...deck.extra, ...deck.side])
        if (!allCards.has(code))
          errors.push(
            diagnostic(
              "MOD_REFERENCE_MISSING",
              `Deck ${deck.id} refers to missing card ${code}`,
              writers.get(`${pack.manifest.packageId}:decks:${deck.id}`)
                ?.location ?? {
                file: `${pack.manifest.packageId}/critical.json`,
                pointer: "/decks",
              },
            ),
          );
    for (const set of pack.sets)
      for (const card of set.cards)
        if (!allCards.has(card.code))
          errors.push(
            diagnostic(
              "MOD_REFERENCE_MISSING",
              `Set ${set.id} refers to missing card ${card.code}`,
              writers.get(`${pack.manifest.packageId}:sets:${set.id}`)
                ?.location ?? {
                file: `${pack.manifest.packageId}/critical.json`,
                pointer: "/sets",
              },
            ),
          );
    if ("requiredScripts" in pack.config)
      for (const name of [
        ...pack.config.requiredScripts.cards,
        ...pack.config.requiredScripts.globals,
      ])
        if (!allScripts.has(name))
          errors.push(
            diagnostic(
              "MOD_SCRIPT_MISSING",
              `Required script ${name} is missing`,
              {
                file: `${pack.manifest.packageId}/critical.json`,
                pointer: "/config/requiredScripts",
              },
            ),
          );
    for (const c of pack.cards)
      if (
        writers.has(`${pack.manifest.packageId}:cards:${c.definition.code}`) &&
        (c.definition.type & 32) !== 0 &&
        !allScripts.has(`c${c.definition.code}.lua`) &&
        c.definition.alias === 0
      )
        errors.push(
          diagnostic(
            "MOD_SCRIPT_MISSING",
            `Effect card ${c.definition.code} has no script`,
            writers.get(
              `${pack.manifest.packageId}:cards:${c.definition.code}`,
            )!.location,
          ),
        );
  }
  if (errors.length) throw new ModCompositionFailure(errors);
  const requiredMods = ordered.map((m) => ({
    id: m.manifest.id,
    version: m.manifest.version,
    sha256: m.sha256,
  }));
  const composition: ContentComposition = {
    identity: hash(
      JSON.stringify({ base: [...baseIdentities].sort(), mods: requiredMods }),
    ),
    requiredMods,
  };
  return {
    packs,
    composition,
    allocatedCodes: allocated,
    mediaOwners: [...mediaOwners.values()],
  };
}
