// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  readCoreApproval,
  writeCoreApproval,
} from "../../src/shell/application/core-update-approval.ts";

const candidate = (buildId: string, coreContentApiVersion = 2) => ({
  schemaVersion: 1 as const,
  buildId,
  coreContentApiVersion,
});

describe("CORE update approval", () => {
  it("is durable for exact app build and blocks a third build while waiting", async () => {
    const factory = new IDBFactory();
    const b = await writeCoreApproval(
      factory,
      candidate("build-b"),
      "build-a",
      10,
    );
    expect(await readCoreApproval(factory)).toEqual(b);
    await expect(
      writeCoreApproval(factory, candidate("build-c"), "build-a", 11),
    ).rejects.toThrow("CORE_UPDATE_PENDING");
    await expect(
      writeCoreApproval(factory, candidate("build-b"), "build-a", 12),
    ).resolves.toMatchObject({ buildId: "build-b", approvedAt: 12 });
    await expect(
      writeCoreApproval(factory, candidate("build-c"), "build-b", 13),
    ).resolves.toMatchObject({ buildId: "build-c" });
  });

  it("stores no content selection generation or selector prerequisite", async () => {
    const factory = new IDBFactory();
    await expect(
      writeCoreApproval(factory, candidate("build-b"), "build-a", 10),
    ).resolves.toEqual({
      schemaVersion: 1,
      buildId: "build-b",
      coreContentApiVersion: 2,
      approvedAt: 10,
    });
  });

  it("SW cold install reads exact app-only approval before precache and never forces activation", async () => {
    const source = await readFile(
      new URL("../../src/service-worker.ts", import.meta.url),
      "utf8",
    );
    const approvalSource = await readFile(
      new URL(
        "../../src/shell/application/core-update-approval.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const controllerSource = await readFile(
      new URL(
        "../../src/shell/application/app-update-controller.ts",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain("precache.addToCacheList");
    expect(source).toContain("readCoreApproval");
    expect(source).toContain('throw new Error("CORE_UPDATE_NOT_APPROVED")');
    expect(source.indexOf("readCoreApproval")).toBeLessThan(
      source.indexOf("await precache.install(event)"),
    );
    expect(source).not.toContain("precache.precache(");
    expect(source).not.toContain("skipWaiting");
    expect(source).not.toContain("clients.claim");
    expect(approvalSource).not.toContain("parseApplicationSelection");
    expect(approvalSource).not.toContain("selectionGeneration");
    expect(controllerSource).not.toContain('from "./application-state.ts"');
    expect(controllerSource).not.toContain('from "./application-locks.ts"');
    expect(controllerSource).not.toContain('from "../../content/');
  });
});
