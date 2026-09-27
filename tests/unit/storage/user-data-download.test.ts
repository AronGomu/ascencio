import { describe, expect, it, vi } from "vitest";
import {
  downloadUserData,
  DOWNLOAD_FAILED,
  DOWNLOAD_REQUESTED,
  type UserDataDownloadAdapter,
} from "../../../src/shell/application/user-data-download.ts";

function fixture() {
  const consumed = Promise.withResolvers<void>();
  const anchor = { click: vi.fn(), remove: vi.fn() };
  const report = vi.fn();
  const adapter = {
    createObjectURL: vi.fn(() => "blob:backup"),
    createAnchor: vi.fn(() => anchor),
    afterDispatch: vi.fn(() => consumed.promise),
    revokeObjectURL: vi.fn(),
  } satisfies UserDataDownloadAdapter;
  return { consumed, anchor, report, adapter };
}

describe("backup download dispatch (no picker or screen)", () => {
  it("reports only after click; retains URL and anchor until browser consumption boundary", async () => {
    const f = fixture();
    f.anchor.click.mockImplementation(() =>
      expect(f.report).not.toHaveBeenCalled(),
    );
    const dispatched = downloadUserData(
      new Blob(["backup"]),
      f.report,
      f.adapter,
    );
    expect(f.report).toHaveBeenCalledExactlyOnceWith(DOWNLOAD_REQUESTED);
    expect(f.anchor.click).toHaveBeenCalledOnce();
    expect(f.anchor.remove).not.toHaveBeenCalled();
    expect(f.adapter.revokeObjectURL).not.toHaveBeenCalled();
    f.consumed.resolve();
    await dispatched;
    expect(f.anchor.remove).toHaveBeenCalledOnce();
    expect(f.adapter.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:backup",
    );
  });

  it.each(["createObjectURL", "createAnchor", "click"] as const)(
    "shows exact visible failure on %s, cleans owned resources, never claims saved",
    async (phase) => {
      const f = fixture();
      const fail = () => {
        throw new Error("DOWNLOAD_DISPATCH_FAILED");
      };
      if (phase === "click") f.anchor.click.mockImplementationOnce(fail);
      else f.adapter[phase].mockImplementationOnce(fail);
      await downloadUserData(new Blob(["backup"]), f.report, f.adapter);
      expect(f.report).toHaveBeenCalledExactlyOnceWith(DOWNLOAD_FAILED);
      expect(f.adapter.afterDispatch).not.toHaveBeenCalled();
      expect(f.anchor.remove).toHaveBeenCalledTimes(phase === "click" ? 1 : 0);
      expect(f.adapter.revokeObjectURL).toHaveBeenCalledTimes(
        phase === "createObjectURL" ? 0 : 1,
      );
    },
  );
});
