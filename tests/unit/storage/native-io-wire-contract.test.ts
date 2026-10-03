import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  IO_CATEGORIES,
  IO_OPERATIONS,
} from "../../../src/storage/contracts/io-trace.ts";
import { STARTUP_PHASES } from "../../../src/storage/contracts/startup.ts";

it("keeps native and frontend startup/I/O enum vocabularies identical", () => {
  const source = readFileSync("src-tauri/src/native_io_trace.rs", "utf8");
  function variants(name: string) {
    const body = source.match(
      new RegExp(`pub\\(crate\\) enum ${name}\\s*\\{([^}]+)\\}`),
    )?.[1];
    expect(body).toBeDefined();
    return body!
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((name) => name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase())
      .sort();
  }
  expect(variants("Category")).toEqual([...IO_CATEGORIES].sort());
  expect(variants("Operation")).toEqual([...IO_OPERATIONS].sort());
  expect(variants("Phase")).toEqual([...STARTUP_PHASES].sort());
});
