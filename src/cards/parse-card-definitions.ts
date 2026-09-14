import { cardCode, type CardDefinition } from "./contracts.ts";

function invalid(): never {
  throw new Error("CARDS_INVALID_DEFINITION");
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid();
  return value as Record<string, unknown>;
}

function integer(value: unknown, minimum = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    invalid();
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

export function parseCardDefinitions(
  value: unknown,
): readonly CardDefinition[] {
  if (!Array.isArray(value)) invalid();
  return Object.freeze(
    Array.from(value, (item: unknown): CardDefinition => {
      const row = object(item);
      const code = cardCode(integer(row.code, 1));
      const race = text(row.race);
      if (!/^(0|[1-9][0-9]*)$/.test(race)) invalid();
      if (!Array.isArray(row.setcodes) || !Array.isArray(row.strings))
        invalid();
      const images = object(row.images);
      for (const variant of ["full", "cropped"] as const) {
        const image = object(images[variant]);
        if (
          image.code !== code ||
          image.variant !== variant ||
          Object.keys(image).some((key) => !["code", "variant"].includes(key))
        )
          invalid();
      }
      return Object.freeze({
        code,
        alias: integer(row.alias),
        setcodes: Object.freeze(
          Array.from(row.setcodes, (value) => integer(value)),
        ),
        type: integer(row.type),
        level: integer(row.level),
        attribute: integer(row.attribute),
        race,
        attack: integer(row.attack, -Number.MAX_SAFE_INTEGER),
        defense: integer(row.defense, -Number.MAX_SAFE_INTEGER),
        lscale: integer(row.lscale),
        rscale: integer(row.rscale),
        linkMarker: integer(row.linkMarker),
        scope: integer(row.scope),
        name: text(row.name),
        description: text(row.description),
        strings: Object.freeze(Array.from(row.strings, text)),
        images: Object.freeze({
          full: Object.freeze({ code, variant: "full" }),
          cropped: Object.freeze({ code, variant: "cropped" }),
        }),
      });
    }),
  );
}
