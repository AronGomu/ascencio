import { describe, expect, it } from "vitest";
import {
  buildSetImageManifest,
  resolveSetImageSources,
  setImageRuntimePath,
  verifySetImageManifest,
} from "../../scripts/lib/set-images.ts";

/* NIST vectors, so the expected digests are independent of the code under
   test: sha256("abc") and sha256("hello"). */
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const HELLO_SHA256 =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

const encoder = new TextEncoder();

function manifestOfTwo() {
  return buildSetImageManifest([
    {
      setId: "metal-raiders",
      sourceUrl: "https://images.ygoprodeck.com/images/sets/MRD.jpg",
      bytes: encoder.encode("hello"),
    },
    {
      setId: "legend-of-blue-eyes-white-dragon",
      sourceUrl: "https://images.ygoprodeck.com/images/sets/LOB.jpg",
      bytes: encoder.encode("abc"),
    },
  ]);
}

function filesOnDisk() {
  return [
    {
      fileName: "legend-of-blue-eyes-white-dragon.jpg",
      bytes: 3,
      sha256: ABC_SHA256,
    },
    { fileName: "metal-raiders.jpg", bytes: 5, sha256: HELLO_SHA256 },
  ];
}

describe("set image manifest", () => {
  it("builds a manifest entry per downloaded set", () => {
    const manifest = manifestOfTwo();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.provider).toBe("ygoprodeck");
    expect(manifest.files).toEqual([
      {
        setId: "legend-of-blue-eyes-white-dragon",
        sha256: ABC_SHA256,
        bytes: 3,
        sourceUrl: "https://images.ygoprodeck.com/images/sets/LOB.jpg",
      },
      {
        setId: "metal-raiders",
        sha256: HELLO_SHA256,
        bytes: 5,
        sourceUrl: "https://images.ygoprodeck.com/images/sets/MRD.jpg",
      },
    ]);
    expect(manifest.missing).toEqual([]);
  });

  it("records sets with no upstream image as missing", () => {
    const sources = resolveSetImageSources(
      [
        { id: "legend-of-blue-eyes-white-dragon", name: "Legend of Blue Eyes" },
        { id: "two-player-starter-set", name: "2-Player Starter Set" },
      ],
      [
        {
          set_name: "Legend of Blue Eyes",
          set_image: "https://images.ygoprodeck.com/images/sets/LOB.jpg",
        },
        { set_name: "2-Player Starter Set" },
      ],
    );
    const manifest = buildSetImageManifest(
      sources.map((source) => ({
        ...source,
        bytes: source.sourceUrl === null ? null : encoder.encode("abc"),
      })),
    );

    expect(sources[1]).toEqual({
      setId: "two-player-starter-set",
      sourceUrl: null,
    });
    expect(manifest.missing).toEqual(["two-player-starter-set"]);
    expect(manifest.files.map((file) => file.setId)).toEqual([
      "legend-of-blue-eyes-white-dragon",
    ]);
  });

  it("resolves art hosted off the pinned upstream origin as missing", () => {
    expect(
      resolveSetImageSources(
        [{ id: "metal-raiders", name: "Metal Raiders" }],
        [
          {
            set_name: "Metal Raiders",
            set_image: "https://images.ygoprodeck.com.evil.test/sets/MRD.jpg",
          },
        ],
      ),
    ).toEqual([{ setId: "metal-raiders", sourceUrl: null }]);
  });

  it("resolves a set whose name is absent upstream as missing", () => {
    expect(
      resolveSetImageSources(
        [{ id: "invented-set", name: "Invented Set" }],
        [],
      ),
    ).toEqual([{ setId: "invented-set", sourceUrl: null }]);
  });

  it("rejects a set id that would escape the image directory", () => {
    expect(() =>
      resolveSetImageSources([{ id: "../evil", name: "Evil" }], []),
    ).toThrow("Set id is not a safe file name: ../evil");
  });

  it("verification passes for matching bytes", () => {
    expect(verifySetImageManifest(manifestOfTwo(), filesOnDisk())).toEqual({
      status: "ok",
      failures: [],
    });
  });

  it("verification fails on a changed byte", () => {
    const drifted = filesOnDisk();
    drifted[1] = { ...drifted[1]!, sha256: ABC_SHA256 };

    const result = verifySetImageManifest(manifestOfTwo(), drifted);

    expect(result.status).toBe("failed");
    expect(result.failures).toEqual([
      `Set image bytes drifted: metal-raiders expected ${HELLO_SHA256}, found ${ABC_SHA256}`,
    ]);
  });

  it("verification fails on an extra unlisted file", () => {
    const result = verifySetImageManifest(manifestOfTwo(), [
      ...filesOnDisk(),
      { fileName: "spell-ruler.jpg", bytes: 3, sha256: ABC_SHA256 },
    ]);

    expect(result.status).toBe("failed");
    expect(result.failures).toEqual([
      "Set image is not listed in the manifest: spell-ruler.jpg",
    ]);
  });

  it("verification fails on a missing file", () => {
    const result = verifySetImageManifest(manifestOfTwo(), [filesOnDisk()[0]!]);

    expect(result.status).toBe("failed");
    expect(result.failures).toEqual(["Set image is missing: metal-raiders"]);
  });

  it("verification fails on a truncated file of the recorded digest length", () => {
    const truncated = filesOnDisk();
    truncated[1] = { ...truncated[1]!, bytes: 4 };

    const result = verifySetImageManifest(manifestOfTwo(), truncated);

    expect(result.status).toBe("failed");
    expect(result.failures).toEqual([
      "Set image byte length changed: metal-raiders expected 5, found 4",
    ]);
  });

  it("set ids map to a runtime URL", () => {
    expect(setImageRuntimePath("LOB")).toBe("runtime/sets/LOB.jpg");
    expect(setImageRuntimePath("legend-of-blue-eyes-white-dragon")).toBe(
      "runtime/sets/legend-of-blue-eyes-white-dragon.jpg",
    );
    expect(() => setImageRuntimePath("../../etc/passwd")).toThrow(
      "Set id is not a safe file name",
    );
  });
});
