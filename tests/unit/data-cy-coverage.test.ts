import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  scanSvelteElements,
  staticDataCyValue,
  svelteFilesUnder,
} from "../fixtures/svelte-element-scan.ts";

describe("scanSvelteElements", () => {
  it("finds plain elements", () => {
    const tags = scanSvelteElements('<div class="a"></div>');
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("div");
    expect(tags[0]!.attributes).toContain("class");
  });

  it("survives > inside an expression attribute", () => {
    const tags = scanSvelteElements(
      '<button onclick={() => go()} data-cy="go">x</button>',
    );
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("button");
    expect(tags[0]!.attributes).toContain("data-cy");
  });

  it("survives > inside a quoted attribute", () => {
    const tags = scanSvelteElements('<img alt="a > b" data-cy="i" />');
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("img");
  });

  it("skips component tags", () => {
    const tags = scanSvelteElements("<CardControl foo={1} />");
    expect(tags).toHaveLength(0);
  });

  it("skips svelte specials but keeps svelte:element", () => {
    const tags = scanSvelteElements(
      '<svelte:window onkeydown={f} /><svelte:element this={t} data-cy="z" />',
    );
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("svelte:element");
  });

  it("ignores script, style and comment content", () => {
    const tags = scanSvelteElements(
      '<script>const a = "<div>";</script><!-- <p> --><b data-cy="b"></b>',
    );
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe("b");
  });
});

const appDirectory = fileURLToPath(new URL("../../src/app/", import.meta.url));

describe("data-cy coverage across src/app", () => {
  it("every src/app svelte element declares data-cy", () => {
    const files = svelteFilesUnder(appDirectory);
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const relativePath = relative(process.cwd(), file);
      for (const { tag, attributes, index } of scanSvelteElements(source)) {
        if (!/(^|\s)data-cy[=\s]/.test(attributes)) {
          violations.push(`${relativePath}:${tag}@${index}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("static data-cy values are unique across src/app", () => {
    const files = svelteFilesUnder(appDirectory);
    const seen = new Map<string, string[]>();

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const relativePath = relative(process.cwd(), file);
      for (const { attributes } of scanSvelteElements(source)) {
        const value = staticDataCyValue(attributes);
        if (value === null) {
          continue;
        }
        const locations = seen.get(value) ?? [];
        locations.push(relativePath);
        seen.set(value, locations);
      }
    }

    const duplicates = [...seen.entries()]
      .filter(([, locations]) => locations.length > 1)
      .map(([value, locations]) => `${value}: ${locations.join(", ")}`);

    expect(duplicates).toEqual([]);
  });
});
