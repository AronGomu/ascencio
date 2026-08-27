import assert from "node:assert/strict";
import test from "node:test";
import { isJpeg } from "../scripts/lib/images.ts";
import {
  collectShopCodes,
  fetchImageCode,
  mergeShopImageRecords,
  type FetchLike,
} from "../scripts/lib/shop-set-image-codes.ts";

test("wanted image codes include the shop set data", () => {
  const shopJson = JSON.stringify({
    version: 1,
    sets: [
      {
        id: "s1",
        name: "Set 1",
        releaseYear: 2002,
        released: true,
        cards: [
          { code: 1, name: "Card A", rarity: "common" },
          { code: 2, name: "Card B", rarity: "rare" },
        ],
      },
    ],
  });
  const base = [
    {
      code: 2,
      full: "https://example.com/2.jpg",
      cropped: "https://example.com/c2.jpg",
    },
    {
      code: 3,
      full: "https://example.com/3.jpg",
      cropped: "https://example.com/c3.jpg",
    },
  ];
  const result = mergeShopImageRecords(base, collectShopCodes(shopJson));
  assert.deepEqual(
    result.map((r) => r.code),
    [1, 2, 3],
  );
});

test("a code the source cannot serve is reported, not fatal", async () => {
  const fakeFetch: FetchLike = async () => ({ status: 404, ok: false });
  const result = await fetchImageCode(
    999,
    "https://images.ygoprodeck.com/images/cards/999.jpg",
    fakeFetch,
  );
  assert.equal(result.status, "missing");
  assert.equal(result.code, 999);
});

test("isJpeg requires complete JPEG start and end markers", () => {
  assert.equal(
    isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9])),
    true,
  );
  assert.equal(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
  assert.equal(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), false);
  assert.equal(isJpeg(new Uint8Array([0xff, 0xd8])), false);
});
