import { readFileSync } from "node:fs";
import { validateCommerceStack } from "../../../src/modules/commerce/stack.ts";
import { describe, expect, it } from "vitest";
import {
  validateCommerce,
  mergeCommerce,
} from "../../../src/modules/commerce/validation.ts";
import { composeContent } from "../../../src/modules/commerce/composition.ts";
import { commerceFixture } from "../../fixtures/commerce.ts";
describe("canonical commerce", () => {
  it("validates bounded policies and references", () => {
    expect(validateCommerce(commerceFixture(), new Set(["set-a"]))).toBe(true);
    for (const mutate of [
      (v: ReturnType<typeof commerceFixture>) => {
        v.shops[0]!.offers[0]!.priceDp = -1;
      },
      (v: ReturnType<typeof commerceFixture>) => {
        v.boosters[0]!.slots[0]!.count = 101;
      },
      (v: ReturnType<typeof commerceFixture>) => {
        v.shops[0]!.economyId = "missing";
      },
    ]) {
      const value = commerceFixture();
      mutate(value);
      expect(validateCommerce(value, new Set(["set-a"]))).toBe(false);
    }
    expect(validateCommerce({ ...commerceFixture(), unknown: true })).toBe(
      false,
    );
  });
  it("merges additive package content and rejects conflicting identities", () => {
    const base = commerceFixture();
    expect(
      mergeCommerce([
        base,
        { schemaVersion: 1, economies: [], boosters: [], shops: [] },
      ]),
    ).toEqual(base);
    expect(() => mergeCommerce([base, base])).toThrow(
      "COMMERCE_IDENTITY_CONFLICT",
    );
  });
  it("composes explicit dependencies, preserves base and rejects ambiguous writes atomically", () => {
    const base = commerceFixture();
    const mod = {
      id: "cheap",
      apiVersion: 1,
      baseVersion: "1.0.0",
      dependencies: [],
      additions: [],
      overrides: [
        {
          kind: "shops",
          targetId: "shop",
          replace: {
            offers: [
              {
                boosterId: "set-a",
                priceDp: 12,
                enabled: true,
                requiresProgress: [],
              },
            ],
          },
          overrides: [],
        },
      ],
    };
    const result = composeContent(base, [mod], "1.0.0");
    expect(result.shops[0]!.offers[0]!.priceDp).toBe(12);
    expect(base.shops[0]!.offers[0]!.priceDp).toBe(100);
    expect(() =>
      composeContent(base, [mod, { ...mod, id: "other" }], "1.0.0"),
    ).toThrow("MOD_OVERRIDE_CONFLICT");
    expect(
      composeContent(
        base,
        [
          mod,
          {
            ...mod,
            id: "other",
            dependencies: ["cheap"],
            overrides: [{ ...mod.overrides[0]!, overrides: ["cheap"] }],
          },
        ],
        "1.0.0",
      ),
    ).toEqual(result);
    expect(() =>
      composeContent(
        base,
        [
          {
            ...mod,
            overrides: [{ ...mod.overrides[0]!, replace: { id: "renamed" } }],
          },
        ],
        "1.0.0",
      ),
    ).toThrow();
  });
  it("validates base duplicates before composition and requires dependency for added targets", () => {
    const base = commerceFixture();
    expect(() =>
      composeContent(
        { ...base, economies: [...base.economies, ...base.economies] },
        [],
        "1.0.0",
      ),
    ).toThrow("CONTENT_INVALID");
    const added = {
      id: "a",
      apiVersion: 1,
      baseVersion: "1.0.0",
      dependencies: [],
      additions: [
        { kind: "boosters", value: { ...base.boosters[0], id: "added" } },
      ],
      overrides: [],
    };
    const override = {
      id: "b",
      apiVersion: 1,
      baseVersion: "1.0.0",
      dependencies: [],
      additions: [],
      overrides: [
        {
          kind: "boosters",
          targetId: "added",
          replace: { name: "Changed" },
          overrides: ["a"],
        },
      ],
    };
    expect(() => composeContent(base, [added, override], "1.0.0")).toThrow(
      "MOD_OVERRIDE_ORDER",
    );
    expect(
      composeContent(
        base,
        [added, { ...override, dependencies: ["a"] }],
        "1.0.0",
      ).boosters.find((b) => b.id === "added")?.name,
    ).toBe("Changed");
  });
  it("checks references against declared dependency closure and selected chapter sets", () => {
    const base = {
      id: "card-library",
      dependencies: [],
      sets: ["set-a"],
      commerce: commerceFixture(),
    };
    const chapter = {
      id: "chapter-01",
      dependencies: ["card-library"],
      sets: [],
      shopId: "shop",
      selectedSetIds: ["set-a"],
    };
    expect(() => validateCommerceStack([base, chapter])).not.toThrow();
    expect(() =>
      validateCommerceStack([base, { ...chapter, dependencies: [] }]),
    ).toThrow("COMMERCE_SHOP_MISSING");
    expect(() =>
      validateCommerceStack([base, { ...chapter, selectedSetIds: [] }]),
    ).toThrow("COMMERCE_SHOP_MISSING");
  });
  it("compiles the documented small-pack example against matching stable identities", () => {
    const base = commerceFixture();
    const id = "legend-of-blue-eyes-white-dragon";
    base.boosters[0]!.id = id;
    base.boosters[0]!.setId = id;
    base.shops[0]!.id = "chapter-01";
    base.shops[0]!.offers[0]!.boosterId = id;
    const mod = JSON.parse(
      readFileSync("content/commerce/examples/small-packs.json", "utf8"),
    );
    const result = composeContent(base, [mod], "1.0.0");
    expect(
      result.boosters
        .map((b) => b.slots.reduce((sum, slot) => sum + slot.count, 0))
        .sort(),
    ).toEqual([3, 5]);
    expect(result.shops[0]!.offers.map((o) => o.priceDp)).toEqual([12, 25]);
  });
  it("does not resolve shop policy through an installed but undeclared sibling", () => {
    const content = commerceFixture();
    const base = {
      id: "card-library",
      dependencies: [],
      sets: ["set-a"],
      commerce: content,
    };
    const sibling = {
      id: "card-pack-policy",
      dependencies: ["card-library"],
      sets: [],
      commerce: {
        schemaVersion: 1 as const,
        economies: [{ ...content.economies[0]!, id: "sibling-policy" }],
        boosters: [],
        shops: [],
      },
    };
    const addon = {
      id: "card-pack-shop",
      dependencies: ["card-library"],
      sets: [],
      commerce: {
        schemaVersion: 1 as const,
        economies: [],
        boosters: [],
        shops: [
          {
            ...content.shops[0]!,
            id: "addon-shop",
            economyId: "sibling-policy",
          },
        ],
      },
    };
    expect(() => validateCommerceStack([base, sibling, addon])).toThrow();
    expect(() =>
      validateCommerceStack([
        base,
        sibling,
        { ...addon, dependencies: ["card-library", "card-pack-policy"] },
      ]),
    ).not.toThrow();
  });
});
