import { describe, expect, it } from "vitest";
import { parseDownloadLinks } from "../../../src/shell/application/download-links.ts";

describe("manual package download links", () => {
  it("accepts external HTTPS and null locations without creating requests", () => {
    const fetcher = globalThis.fetch;
    const parsed = parseDownloadLinks({
      schemaVersion: 1,
      links: [
        {
          packageId: "duel-core",
          title: "Duel Core",
          url: "https://downloads.example/duel-core.sqlite",
        },
        { packageId: "card-library", title: "Card Library", url: null },
      ],
    });

    expect(parsed).toEqual([
      {
        packageId: "duel-core",
        title: "Duel Core",
        url: "https://downloads.example/duel-core.sqlite",
      },
      { packageId: "card-library", title: "Card Library", url: null },
    ]);
    expect(globalThis.fetch).toBe(fetcher);
  });

  it.each([
    "http://downloads.example/freeplay.sqlite",
    "javascript:alert(1)",
    "data:application/vnd.sqlite3,bytes",
    "/relative/freeplay.sqlite",
    "https://user:secret@downloads.example/freeplay.sqlite",
  ])("rejects unsafe package URL %s", (url) => {
    expect(() =>
      parseDownloadLinks({
        schemaVersion: 1,
        links: [{ packageId: "freeplay", title: "Free Play", url }],
      }),
    ).toThrow("DOWNLOAD_LINKS_INVALID");
  });

  it("rejects duplicate IDs and unknown fields", () => {
    expect(() =>
      parseDownloadLinks({
        schemaVersion: 1,
        links: [
          { packageId: "freeplay", title: "Free Play", url: null },
          { packageId: "freeplay", title: "Again", url: null },
        ],
      }),
    ).toThrow("DOWNLOAD_LINKS_INVALID");
    expect(() =>
      parseDownloadLinks({
        schemaVersion: 1,
        links: [
          {
            packageId: "freeplay",
            title: "Free Play",
            url: null,
            license: "invented",
          },
        ],
      }),
    ).toThrow("DOWNLOAD_LINKS_INVALID");
  });
});
