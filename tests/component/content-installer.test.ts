// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstallContentScreen from "../../src/shell/screens/InstallContentScreen.svelte";
import type {
  ContentInstaller,
  CoreBootstrap,
  DownloadProgress,
  DownloadResult,
} from "../../src/content/index.ts";
import { contentInstallFixture } from "../fixtures/content-install-fixture.ts";

const bootstrap: CoreBootstrap = {
  schemaVersion: 1,
  appSchemaVersion: 1,
  contentSchemaVersion: 2,
  hashAlgorithm: "SHA-256",
  delivery: null,
  chapters: [
    { id: "chapter-01", title: "Chapter 1", description: "Prototype" },
  ],
};
afterEach(cleanup);
describe("CORE installer screen", () => {
  it("initializes when asynchronous CORE bootstrap arrives", async () => {
    const createInstaller = vi.fn(async () => ({
      kind: "failed" as const,
      code: "CONTENT_STORAGE_UNAVAILABLE" as const,
      packId: null,
      path: null,
    }));
    const view = render(InstallContentScreen, {
      gate: { kind: "checking" },
      bootstrap: null,
      onback: vi.fn(),
      createInstaller,
    });
    await view.rerender({ bootstrap });
    await waitFor(() => expect(createInstaller).toHaveBeenCalledOnce());
    expect(view.getByRole("alert").textContent).toBe(
      "Browser storage is unavailable. CORE remains usable.",
    );
    await fireEvent.click(view.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(createInstaller).toHaveBeenCalledTimes(2));
  });
  it("shows exact sizes/dependencies, live progress, network failure and actionable retry", async () => {
    const fixture = await contentInstallFixture();
    const bytes = fixture.objects.get(
      `content/indexes/${fixture.bootstrap.delivery!.index.sha256}.json`,
    )!;
    const chapterArchive = fixture.objects.get(
      `content/parts/${fixture.chapter.manifest.parts[0]!.sha256}.zip`,
    )!;
    const chapterZip = new ZipReader(new Uint8ArrayReader(chapterArchive));
    const gameplayEntry = (await chapterZip.getEntries()).find(
      ({ filename }) => filename === fixture.chapter.manifest.gameplayPath,
    );
    if (gameplayEntry === undefined || gameplayEntry.directory)
      throw new Error("Fixture gameplay entry is missing");
    const gameplayBytes = await gameplayEntry.getData!(new Uint8ArrayWriter());
    await chapterZip.close();
    let report: ((progress: DownloadProgress) => void) | undefined;
    let finish: ((result: DownloadResult) => void) | undefined;
    let publish:
      Parameters<ContentInstaller["subscribeCurrent"]>[0] | undefined;
    const download = vi.fn<ContentInstaller["download"]>(
      (_target, onProgress) =>
        new Promise((resolve) => {
          report = onProgress;
          finish = resolve;
        }),
    );
    const oninstalled = vi.fn();
    const close = vi.fn();
    const installer = {
      current: async () => ({
        kind: "ok",
        value: { generation: 1, current: fixture.content, previous: null },
      }),
      subscribeCurrent: (
        listener: Parameters<ContentInstaller["subscribeCurrent"]>[0],
      ) => {
        publish = listener;
        return () => undefined;
      },
      readCatalog: async () => ({
        kind: "ok",
        value: { bytes, value: JSON.parse(new TextDecoder().decode(bytes)) },
      }),
      readManifest: async (ref: { packId: string }) => ({
        kind: "ok",
        value: {
          bytes: new Uint8Array(),
          value:
            ref.packId === "runtime"
              ? fixture.runtime.manifest
              : fixture.chapter.manifest,
        },
      }),
      readFile: async (_ref: unknown, filePath: string) => {
        const fileBytes =
          filePath === fixture.chapter.manifest.gameplayPath
            ? gameplayBytes
            : undefined;
        if (fileBytes === undefined)
          return {
            kind: "failed" as const,
            code: "CONTENT_MISSING" as const,
            packId: null,
            path: filePath,
          };
        return { kind: "ok" as const, value: new Blob([fileBytes]) };
      },
      inspectContent: async () => ({
        kind: "ok" as const,
        value: fixture.content,
      }),
      download,
      close,
    } as unknown as ContentInstaller;
    const view = render(InstallContentScreen, {
      gate: { kind: "locked", reason: "content-required" },
      bootstrap: fixture.bootstrap,
      onback: vi.fn(),
      oninstalled,
      createInstaller: async () => ({ kind: "ok", value: installer }),
    });
    const manifests = [fixture.runtime.manifest, fixture.chapter.manifest];
    const total = manifests
      .flatMap((m) => m.parts)
      .reduce((n, p) => n + p.bytes, 0);
    const installed = manifests
      .flatMap((m) => m.files)
      .reduce((n, f) => n + f.bytes, 0);
    await waitFor(() =>
      expect(
        view.container
          .querySelector('[data-cy="install-content-sizes-chapter-01"]')
          ?.textContent?.replace(/\s+/g, " ")
          .trim(),
      ).toBe(
        `Download: ${total.toLocaleString()} bytes · Installed: ${installed.toLocaleString()} bytes · Dependencies: runtime`,
      ),
    );
    const install = view.getByRole("button", {
      name: "Install",
    }) as HTMLButtonElement;
    await fireEvent.click(install);
    expect(download).toHaveBeenCalledWith(
      { kind: "chapter", chapterId: "chapter-01" },
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(install.disabled).toBe(true);
    const progress: DownloadProgress = {
      jobId: "job",
      packId: "runtime",
      phase: "downloading",
      verifiedDownloadBytes: 0,
      totalDownloadBytes: total,
      currentPartReceivedBytes: 8,
      currentPartTotalBytes: fixture.runtime.manifest.parts[0]!.bytes,
    };
    report?.(progress);
    await waitFor(() =>
      expect(
        view.container
          .querySelector('[data-cy="install-content-progress"]')
          ?.textContent?.replace(/\s+/g, " ")
          .trim(),
      ).toBe(`downloading · 0 / ${total.toLocaleString()} bytes`),
    );
    report?.({ ...progress, phase: "verifying", verifiedDownloadBytes: total });
    await waitFor(() =>
      expect(
        view.container.querySelector('[data-cy="install-content-progress"]')
          ?.textContent,
      ).toContain("verifying"),
    );
    finish?.({
      kind: "failed",
      code: "CONTENT_NETWORK_FAILED",
      packId: null,
      path: null,
    });
    await waitFor(() =>
      expect(view.getByRole("alert").textContent).toBe(
        "Download failed. Check connection, then retry.",
      ),
    );
    await fireEvent.click(
      view.getByRole("button", { name: "Retry installation" }),
    );
    expect(download).toHaveBeenCalledTimes(2);
    expect(view.queryByRole("alert")).toBeNull();
    publish?.({
      kind: "ok",
      value: { generation: 1, current: fixture.content, previous: null },
    });
    await waitFor(() =>
      expect(view.getByText("Installed — preparing gameplay…")).toBeTruthy(),
    );
    expect(oninstalled).not.toHaveBeenCalled();
    finish?.({ kind: "complete", content: fixture.content });
    await waitFor(() =>
      expect(
        view.getByText("Verified installed — gameplay ready."),
      ).toBeTruthy(),
    );
    expect(oninstalled).toHaveBeenCalledWith(
      expect.objectContaining({ chapterIds: ["chapter-01"] }),
      installer,
      1,
    );
    expect(
      (view.getByRole("button", { name: "Install" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    view.unmount();
    expect(close).not.toHaveBeenCalled();
  });
  it("keeps installed content pending until gameplay is loaded", async () => {
    const close = vi.fn();
    const current = {
      generation: 1,
      current: { chapters: [{ packId: "chapter-01" }] },
      previous: null,
    };
    const installer = {
      current: async () => ({ kind: "ok", value: current }),
      subscribeCurrent: () => () => undefined,
      close,
    } as unknown as ContentInstaller;
    const view = render(InstallContentScreen, {
      gate: { kind: "locked", reason: "content-required" },
      bootstrap,
      onback: vi.fn(),
      createInstaller: async () => ({ kind: "ok", value: installer }),
    });
    await waitFor(() =>
      expect(view.getByText("Installed — preparing gameplay…")).toBeTruthy(),
    );
    expect(
      (
        view.getByRole("button", {
          name: "Update / remove unavailable",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    view.unmount();
    expect(close).toHaveBeenCalledOnce();
  });
});
