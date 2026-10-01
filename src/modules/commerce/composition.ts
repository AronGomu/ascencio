import type { CanonicalSet, CommerceContent } from "./content.ts";
import {
  exact,
  reference,
  validCanonicalSet,
  validateCommerce,
} from "./validation.ts";
const KINDS = ["sets", "economies", "boosters", "shops"] as const;
type Kind = (typeof KINDS)[number];
type Bundle = CommerceContent & { readonly sets?: readonly CanonicalSet[] };
export interface CommerceReferences {
  readonly setIds: readonly string[];
  readonly commerce: CommerceContent;
}
function validBundle(value: Bundle, references?: CommerceReferences): boolean {
  const { sets, ...commerce } = value;
  if (
    sets !== undefined &&
    (!Array.isArray(sets) ||
      !sets.every(validCanonicalSet) ||
      sets.length > 10000 ||
      sets.reduce((sum, set) => sum + set.cards.length, 0) > 1000000)
  )
    return false;
  const combined = references
    ? {
        schemaVersion: 1,
        economies: [...references.commerce.economies, ...commerce.economies],
        boosters: [...references.commerce.boosters, ...commerce.boosters],
        shops: [...references.commerce.shops, ...commerce.shops],
      }
    : commerce;
  return validateCommerce(
    combined,
    sets === undefined && references === undefined
      ? undefined
      : new Set([
          ...(sets ?? []).map((s) => s.id),
          ...(references?.setIds ?? []),
        ]),
  );
}
export class ContentDiagnostic extends Error {
  readonly code: string;
  readonly source: string;
  readonly pointer: string;
  readonly related: readonly string[];
  constructor(
    code: string,
    source: string,
    pointer: string,
    related: readonly string[] = [],
  ) {
    super(`${code}: ${source}${pointer}`);
    this.code = code;
    this.source = source;
    this.pointer = pointer;
    this.related = related;
  }
}
function fail(
  code: string,
  mod: string,
  pointer: string,
  related: readonly string[] = [],
): never {
  throw new ContentDiagnostic(code, mod, pointer, related);
}
/** Pure candidate compilation: input objects are never changed, including on failure. */
export function composeContent<T extends Bundle>(
  base: T,
  rawMods: readonly unknown[],
  baseVersion: string,
  references?: CommerceReferences,
): T {
  const { sets: baseSets } = base;
  if (
    !validBundle(base, references) ||
    (baseSets !== undefined &&
      (!baseSets.every(validCanonicalSet) ||
        new Set(baseSets.map((s) => s.id)).size !== baseSets.length))
  )
    fail("CONTENT_INVALID", "base", "");
  if (rawMods.length > 256) fail("MOD_LIMIT", "mods", "");
  const mods = new Map<string, Record<string, unknown>>();
  for (const raw of rawMods) {
    if (
      !exact(raw, [
        "id",
        "apiVersion",
        "baseVersion",
        "dependencies",
        "additions",
        "overrides",
      ]) ||
      !reference(raw.id) ||
      raw.apiVersion !== 1 ||
      raw.baseVersion !== baseVersion ||
      !Array.isArray(raw.dependencies) ||
      raw.dependencies.length > 256 ||
      !raw.dependencies.every(reference) ||
      new Set(raw.dependencies).size !== raw.dependencies.length ||
      !Array.isArray(raw.additions) ||
      raw.additions.length > 10000 ||
      !Array.isArray(raw.overrides) ||
      raw.overrides.length > 10000
    )
      fail("MOD_INVALID", "mods", "");
    if (mods.has(raw.id)) fail("MOD_DUPLICATE", raw.id, "/id");
    mods.set(raw.id, raw);
  }
  const ordered: string[] = [],
    visiting = new Set<string>(),
    visited = new Set<string>();
  const closure = new Map<string, Set<string>>();
  function visit(id: string): void {
    if (visiting.has(id)) fail("MOD_DEPENDENCY_CYCLE", id, "/dependencies");
    if (visited.has(id)) return;
    const mod = mods.get(id);
    if (!mod) fail("MOD_DEPENDENCY_MISSING", id, "/dependencies");
    visiting.add(id);
    const ancestors = new Set<string>();
    for (const dependency of [...(mod.dependencies as string[])].sort()) {
      visit(dependency);
      ancestors.add(dependency);
      for (const transitive of closure.get(dependency)!)
        ancestors.add(transitive);
    }
    closure.set(id, ancestors);
    visiting.delete(id);
    visited.add(id);
    ordered.push(id);
  }
  for (const id of [...mods.keys()].sort()) visit(id);
  const candidate = structuredClone(base);
  const entities = new Map<Kind, Map<string, Record<string, unknown>>>();
  for (const kind of KINDS)
    entities.set(
      kind,
      new Map(
        (candidate[kind] ?? []).map((entity) => [
          entity.id,
          entity as unknown as Record<string, unknown>,
        ]),
      ),
    );
  const writes = new Map<string, string>();
  const owners = new Map<string, string>();
  for (const id of ordered) {
    const mod = mods.get(id)!;
    for (const [index, addition] of (mod.additions as unknown[]).entries()) {
      if (
        !exact(addition, ["kind", "value"]) ||
        !KINDS.includes(addition.kind as Kind) ||
        typeof addition.value !== "object" ||
        addition.value === null ||
        Array.isArray(addition.value) ||
        !reference((addition.value as Record<string, unknown>).id)
      )
        fail("MOD_ADDITION_INVALID", id, `/additions/${index}`);
      const entity = structuredClone(addition.value) as Record<
        string,
        unknown
      > & { id: string };
      const map = entities.get(addition.kind as Kind)!;
      if (map.has(entity.id))
        fail("MOD_DUPLICATE_ENTITY", id, `/additions/${index}/value/id`);
      if (addition.kind === "sets" && base.sets === undefined)
        fail("MOD_ADDITION_INVALID", id, `/additions/${index}/kind`);
      map.set(entity.id, entity);
      owners.set(`${addition.kind}:${entity.id}`, id);
      for (const key of Object.keys(entity))
        writes.set(`${addition.kind}:${entity.id}:${key}`, id);
    }
    for (const [index, override] of (mod.overrides as unknown[]).entries()) {
      const pointer = `/overrides/${index}`;
      if (
        !exact(override, ["kind", "targetId", "replace", "overrides"]) ||
        !KINDS.includes(override.kind as Kind) ||
        !reference(override.targetId) ||
        typeof override.replace !== "object" ||
        override.replace === null ||
        Array.isArray(override.replace) ||
        !Array.isArray(override.overrides) ||
        !override.overrides.every(reference) ||
        new Set(override.overrides).size !== override.overrides.length
      )
        fail("MOD_OVERRIDE_INVALID", id, pointer);
      if (
        !(override.overrides as string[]).every((prior) =>
          closure.get(id)!.has(prior),
        )
      )
        fail("MOD_OVERRIDE_ORDER", id, pointer);
      const entity = entities
        .get(override.kind as Kind)!
        .get(override.targetId);
      const owner = owners.get(`${override.kind}:${override.targetId}`);
      if (owner !== undefined && owner !== id && !closure.get(id)!.has(owner))
        fail("MOD_OVERRIDE_ORDER", id, pointer, [owner]);
      if (!entity) fail("MOD_OVERRIDE_TARGET_MISSING", id, pointer);
      for (const [field, value] of Object.entries(override.replace)) {
        if (field === "id" || !Object.hasOwn(entity, field))
          fail("MOD_OVERRIDE_FIELD", id, `${pointer}/replace/${field}`);
        const key = `${override.kind}:${override.targetId}:${field}`,
          previous = writes.get(key);
        if (
          previous !== undefined &&
          (previous === id ||
            !(override.overrides as string[]).includes(previous))
        )
          fail("MOD_OVERRIDE_CONFLICT", id, `${pointer}/replace/${field}`, [
            previous,
          ]);
        entity[field] = structuredClone(value);
        writes.set(key, id);
      }
    }
  }
  for (const kind of KINDS)
    if (kind !== "sets" || base.sets !== undefined)
      (candidate as unknown as Record<string, unknown>)[kind] = [
        ...entities.get(kind)!.values(),
      ].sort((a, b) => String(a.id).localeCompare(String(b.id), "en"));
  const { sets } = candidate;
  if (
    (sets !== undefined && !sets.every(validCanonicalSet)) ||
    !validBundle(candidate, references)
  )
    fail("CONTENT_INVALID", ordered.at(-1) ?? "base", "");
  return candidate;
}
