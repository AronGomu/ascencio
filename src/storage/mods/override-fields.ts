function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export class OverrideFieldsFailure extends Error {
  readonly pointer: string;
  constructor(pointer: string) {
    super(`MOD_OVERRIDE_FIELD: ${pointer}`);
    this.pointer = pointer;
  }
}
/** Arrays replace whole fields. Records permit only fields present in the target schema. */
export function replaceOverrideFields(
  current: unknown,
  fields: unknown,
  pointer = "",
): unknown {
  if (!object(current) || !object(fields) || !Object.keys(fields).length)
    throw new OverrideFieldsFailure(pointer);
  const result = { ...current };
  for (const [key, value] of Object.entries(fields)) {
    const field = `${pointer}/${key}`;
    if (
      !Object.hasOwn(current, key) ||
      ["id", "contentId", "code", "schemaVersion", "compilerVersion"].includes(
        key,
      )
    )
      throw new OverrideFieldsFailure(field);
    result[key] = object(value)
      ? replaceOverrideFields(current[key], value, field)
      : value;
  }
  return result;
}
export function writtenFields(value: unknown, pointer = ""): string[] {
  if (!object(value) || !Object.keys(value).length) return [pointer];
  return Object.entries(value).flatMap(([key, field]) =>
    writtenFields(field, `${pointer}/${key}`),
  );
}
export function fieldsOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
