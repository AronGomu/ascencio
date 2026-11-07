const economy = {
  id: "base",
  sellPrices: {
    common: 1,
    rare: 2,
    "super-rare": 5,
    "ultra-rare": 20,
    "secret-rare": 50,
    "ultimate-rare": 50,
    "ghost-rare": 50,
  },
  singlesMultiplier: 4,
  maxPackResale: 21,
};
export const commerceFixture = () => ({
  schemaVersion: 1 as const,
  economies: [structuredClone(economy)],
  boosters: [
    {
      id: "set-a",
      name: "Base pack",
      setId: "set-a",
      replacement: "with" as const,
      slots: [
        {
          count: 8,
          rarities: [{ rarity: "common" as const, weight: 1 }],
          fallback: "all" as const,
        },
        {
          count: 1,
          rarities: [{ rarity: "rare" as const, weight: 1 }],
          fallback: "all" as const,
        },
      ],
    },
  ],
  shops: [
    {
      id: "shop",
      economyId: "base",
      offers: [
        {
          boosterId: "set-a",
          priceDp: 100,
          enabled: true,
          requiresProgress: [],
        },
      ],
      singles: true,
    },
  ],
});
