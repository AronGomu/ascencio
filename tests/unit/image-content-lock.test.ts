import { describe, expect, it } from "vitest";
import {
  buildImageContentLock,
  parseImageContentLock,
  verifyLockedCardImages,
  verifyLockedSetImages,
} from "../../scripts/lib/image-content-lock.ts";

/* NIST vectors, so the expected digests are independent of the code under
   test: sha256("abc") and sha256("hello"). */
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const HELLO_SHA256 =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

function lockOfTwo() {
  return buildImageContentLock(
    [
      { code: 46986414, bytes: 5, sha256: HELLO_SHA256 },
      { code: 10802915, bytes: 3, sha256: ABC_SHA256 },
    ],
    [
      { setId: "metal-raiders", bytes: 5, sha256: HELLO_SHA256 },
      { setId: "abyss-rising", bytes: 3, sha256: ABC_SHA256 },
    ],
  );
}

function packagedCards() {
  return [
    { code: 10802915, bytes: 3, sha256: ABC_SHA256 },
    { code: 46986414, bytes: 5, sha256: HELLO_SHA256 },
  ];
}

function setFilesOnDisk() {
  return [
    { fileName: "abyss-rising.jpg", bytes: 3, sha256: ABC_SHA256 },
    { fileName: "metal-raiders.jpg", bytes: 5, sha256: HELLO_SHA256 },
  ];
}

describe("image content lock", () => {
  it("verification passes when packaged images match the tracked lock", () => {
    const lock = lockOfTwo();

    expect(verifyLockedCardImages(lock, packagedCards())).toEqual([]);
    expect(verifyLockedSetImages(lock, setFilesOnDisk())).toEqual([]);
  });

  it("verification fails when a packaged card image no longer matches the tracked lock", () => {
    const drifted = packagedCards();
    drifted[1] = { ...drifted[1]!, sha256: ABC_SHA256 };

    expect(verifyLockedCardImages(lockOfTwo(), drifted)).toEqual([
      `Locked card image bytes drifted: 46986414 expected ${HELLO_SHA256}, found ${ABC_SHA256}`,
    ]);
  });

  it("verification fails when a set image no longer matches the tracked lock", () => {
    const drifted = setFilesOnDisk();
    drifted[0] = { ...drifted[0]!, sha256: HELLO_SHA256 };

    expect(verifyLockedSetImages(lockOfTwo(), drifted)).toEqual([
      `Locked set image bytes drifted: abyss-rising expected ${ABC_SHA256}, found ${HELLO_SHA256}`,
    ]);
  });

  it("verification fails on a truncated image of the pinned digest length", () => {
    const truncated = packagedCards();
    truncated[0] = { ...truncated[0]!, bytes: 2 };

    expect(verifyLockedCardImages(lockOfTwo(), truncated)).toEqual([
      "Locked card image byte length changed: 10802915 expected 3, found 2",
    ]);
  });

  it("verification fails when pinned art is absent", () => {
    expect(verifyLockedCardImages(lockOfTwo(), [packagedCards()[0]!])).toEqual([
      "Locked card image is missing: 46986414",
    ]);
    expect(verifyLockedSetImages(lockOfTwo(), [setFilesOnDisk()[1]!])).toEqual([
      "Locked set image is missing: abyss-rising",
    ]);
  });

  /* Shipping art the lock never covered is the same hole reopened: a code added
     to a deck would otherwise ship unpinned bytes until someone regenerated. */
  it("verification fails when shipped art is not pinned by the lock", () => {
    expect(
      verifyLockedCardImages(lockOfTwo(), [
        ...packagedCards(),
        { code: 89631139, bytes: 3, sha256: ABC_SHA256 },
      ]),
    ).toEqual(["Card image is not pinned by the image lock: 89631139"]);
    expect(
      verifyLockedSetImages(lockOfTwo(), [
        ...setFilesOnDisk(),
        { fileName: "spell-ruler.jpg", bytes: 3, sha256: ABC_SHA256 },
      ]),
    ).toEqual(["Set image is not pinned by the image lock: spell-ruler.jpg"]);
  });

  it("lock generation is deterministic for the same inputs", () => {
    const lock = lockOfTwo();
    const fromReversedInput = buildImageContentLock(
      [
        { code: 10802915, bytes: 3, sha256: ABC_SHA256 },
        { code: 46986414, bytes: 5, sha256: HELLO_SHA256 },
      ],
      [
        { setId: "abyss-rising", bytes: 3, sha256: ABC_SHA256 },
        { setId: "metal-raiders", bytes: 5, sha256: HELLO_SHA256 },
      ],
    );

    expect(JSON.stringify(fromReversedInput)).toBe(JSON.stringify(lock));
    expect(Object.keys(lock)).toEqual([
      "schemaVersion",
      "provider",
      "cards",
      "sets",
    ]);
    expect(Object.keys(lock.cards[0]!)).toEqual(["code", "bytes", "sha256"]);
    expect(Object.keys(lock.sets[0]!)).toEqual(["setId", "bytes", "sha256"]);
    expect(lock.cards.map(({ code }) => code)).toEqual([10802915, 46986414]);
    expect(lock.sets.map(({ setId }) => setId)).toEqual([
      "abyss-rising",
      "metal-raiders",
    ]);
  });

  it("parsing round-trips a valid lock", () => {
    const lock = lockOfTwo();

    expect(parseImageContentLock(JSON.parse(JSON.stringify(lock)))).toEqual(
      lock,
    );
  });

  it("parsing rejects a lock it cannot verify against", () => {
    expect(() =>
      parseImageContentLock({ ...lockOfTwo(), schemaVersion: 2 }),
    ).toThrow("image-content-lock.json is not a valid image lock");
    expect(() =>
      parseImageContentLock({
        ...lockOfTwo(),
        cards: [{ code: 10802915, bytes: 3, sha256: "not-a-digest" }],
      }),
    ).toThrow("image-content-lock.json has an invalid card entry");
    expect(() =>
      parseImageContentLock({
        ...lockOfTwo(),
        sets: [{ setId: "../escape", bytes: 3, sha256: ABC_SHA256 }],
      }),
    ).toThrow("Set id is not a safe file name: ../escape");
  });
});
