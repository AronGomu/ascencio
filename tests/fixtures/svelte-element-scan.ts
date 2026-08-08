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

export function staticDataCyValue(attributes: string): string | null {
  const match = attributes.match(/data-cy\s*=\s*("([^"]*)"|'([^']*)')/);
  if (!match) {
    return null;
  }
  return match[2] !== undefined ? match[2] : (match[3] ?? "");
}
