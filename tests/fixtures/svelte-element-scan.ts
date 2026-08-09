import { readdirSync } from "node:fs";
import { join } from "node:path";

export interface SvelteElementTag {
  readonly tag: string;
  readonly attributes: string;
  readonly index: number;
}

const IGNORED_SVELTE_SPECIALS = new Set([
  "svelte:window",
  "svelte:body",
  "svelte:document",
  "svelte:boundary",
  "svelte:options",
  "svelte:fragment",
  "svelte:self",
  "svelte:component",
]);

function blankOutRanges(
  source: string,
  openPattern: RegExp,
  closePattern: string,
): string {
  let result = source;
  openPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = openPattern.exec(result)) !== null) {
    const start = match.index;
    const closeIndex = result.indexOf(closePattern, start + match[0].length);
    const end =
      closeIndex === -1 ? result.length : closeIndex + closePattern.length;
    result =
      result.slice(0, start) + " ".repeat(end - start) + result.slice(end);
    openPattern.lastIndex = start + 1;
  }
  return result;
}

function stripNonMarkup(source: string): string {
  let result = source;
  result = blankOutRanges(result, /<script\b[^>]*>/gi, "</script>");
  result = blankOutRanges(result, /<style\b[^>]*>/gi, "</style>");
  result = blankOutRanges(result, /<svelte:head\b[^>]*>/gi, "</svelte:head>");
  result = blankOutRanges(result, /<!--/g, "-->");
  return result;
}

export function scanSvelteElements(
  source: string,
): readonly SvelteElementTag[] {
  const text = stripNonMarkup(source);
  const tags: SvelteElementTag[] = [];
  const length = text.length;
  let i = 0;

  while (i < length) {
    const char = text[i];
    if (char === "<" && /[A-Za-z]/.test(text[i + 1] ?? "")) {
      const tagStart = i;
      let j = i + 1;
      while (j < length && /[^\s/>]/.test(text[j] ?? "")) {
        j += 1;
      }
      const tagName = text.slice(i + 1, j);

      let quote: '"' | "'" | null = null;
      let braceDepth = 0;
      let k = j;
      while (k < length) {
        const c = text[k];
        if (quote !== null) {
          if (c === quote) {
            quote = null;
          }
        } else if (c === '"' || c === "'") {
          quote = c;
        } else if (c === "{") {
          braceDepth += 1;
        } else if (c === "}") {
          braceDepth -= 1;
        } else if (c === ">" && braceDepth === 0) {
          break;
        }
        k += 1;
      }

      const attributes = text.slice(j, k);
      const isComponent = /^[A-Z]/.test(tagName);
      const isIgnoredSpecial =
        tagName.startsWith("svelte:") &&
        tagName !== "svelte:element" &&
        IGNORED_SVELTE_SPECIALS.has(tagName);

      if (!isComponent && !isIgnoredSpecial) {
        tags.push({ tag: tagName, attributes, index: tagStart });
      }

      i = k + 1;
      continue;
    }
    i += 1;
  }

  return tags;
}

export function svelteFilesUnder(directory: string): readonly string[] {
  const entries = readdirSync(directory, {
    recursive: true,
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const dirent of entries) {
    if (!dirent.isFile() || !dirent.name.endsWith(".svelte")) {
      continue;
    }
    files.push(join(dirent.parentPath, dirent.name));
  }
  return files.sort((a, b) => a.localeCompare(b));
}

export interface SvelteAttribute {
  readonly name: string;
  /* `null` for a valueless attribute (`disabled`), otherwise the raw source of
     the value including its quotes or braces. */
  readonly raw: string | null;
}

export type DataCyDeclaration =
  | { readonly kind: "absent" }
  /* Present but carrying no selector: `data-cy`, `data-cy=""`, `data-cy={""}`.
     An empty value is not a name, so the contract treats it as absent. */
  | { readonly kind: "empty" }
  /* An expression the scanner cannot resolve to one literal — typically a
     per-item value such as `` {`field-card-${card.id}`} ``. */
  | { readonly kind: "dynamic"; readonly expression: string }
  | { readonly kind: "static"; readonly value: string };

/* Consumes a brace-delimited Svelte expression starting at `start`, returning
   the index just past its closing brace. Quotes and template literals are
   skipped whole, so `${…}` inside a template never miscounts the depth. */
function skipBraces(text: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  let i = start;
  while (i < text.length) {
    const char = text[i]!;
    if (quote !== null) {
      if (char === "\\") {
        i += 2;
        continue;
      }
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return text.length;
}

export function parseAttributes(
  attributes: string,
): readonly SvelteAttribute[] {
  const parsed: SvelteAttribute[] = [];
  const length = attributes.length;
  let i = 0;
  while (i < length) {
    const char = attributes[i]!;
    if (/\s/.test(char) || char === "/") {
      i += 1;
      continue;
    }
    /* Spread (`{...rest}`) and shorthand (`{disabled}`) carry no literal
       `data-cy`, so they are consumed and discarded. */
    if (char === "{") {
      i = skipBraces(attributes, i);
      continue;
    }
    const nameStart = i;
    while (i < length && !/[\s=/]/.test(attributes[i]!)) i += 1;
    const name = attributes.slice(nameStart, i);
    while (i < length && /\s/.test(attributes[i]!)) i += 1;
    if (attributes[i] !== "=") {
      parsed.push({ name, raw: null });
      continue;
    }
    i += 1;
    while (i < length && /\s/.test(attributes[i]!)) i += 1;
    const valueStart = i;
    const opener = attributes[i];
    if (opener === '"' || opener === "'") {
      i += 1;
      while (i < length && attributes[i] !== opener) i += 1;
      i += 1;
    } else if (opener === "{") {
      i = skipBraces(attributes, i);
    } else {
      while (i < length && !/\s/.test(attributes[i]!)) i += 1;
    }
    parsed.push({ name, raw: attributes.slice(valueStart, i) });
  }
  return parsed;
}

const SINGLE_LITERAL = /^"([^"]*)"$|^'([^']*)'$|^`((?:[^`$\\]|\$(?!\{))*)`$/;

function literalValue(raw: string): string | null {
  const match = raw.match(SINGLE_LITERAL);
  if (match === null) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

/* Module constants a component hoists a `data-cy` value into. Without these
   `data-cy={LIST_DATA_CY}` would read as an unresolvable expression and slip
   past the uniqueness scan entirely. */
export function scriptStringConstants(
  source: string,
): ReadonlyMap<string, string> {
  const constants = new Map<string, string>();
  const scripts = source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    const body = script[1] ?? "";
    const declarations = body.matchAll(
      /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=;]+)?=\s*("[^"]*"|'[^']*'|`(?:[^`$\\]|\$(?!\{))*`)/g,
    );
    for (const declaration of declarations) {
      const value = literalValue(declaration[2] ?? "");
      if (value !== null) constants.set(declaration[1]!, value);
    }
  }
  return constants;
}

export function dataCyDeclaration(
  attributes: string,
  constants: ReadonlyMap<string, string> = new Map(),
): DataCyDeclaration {
  const attribute = parseAttributes(attributes).find(
    ({ name }) => name === "data-cy",
  );
  if (attribute === undefined) return { kind: "absent" };
  const raw = attribute.raw;
  if (raw === null) return { kind: "empty" };
  const direct = literalValue(raw);
  if (direct !== null)
    return direct === ""
      ? { kind: "empty" }
      : { kind: "static", value: direct };
  if (!raw.startsWith("{")) return { kind: "dynamic", expression: raw };
  const expression = raw.slice(1, -1).trim();
  const inner = literalValue(expression) ?? constants.get(expression) ?? null;
  if (inner === null) return { kind: "dynamic", expression };
  return inner === "" ? { kind: "empty" } : { kind: "static", value: inner };
}

export function staticDataCyValue(
  attributes: string,
  constants: ReadonlyMap<string, string> = new Map(),
): string | null {
  const declaration = dataCyDeclaration(attributes, constants);
  return declaration.kind === "static" ? declaration.value : null;
}
