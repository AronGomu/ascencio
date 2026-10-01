export const COMMERCE_RARITIES = [
  "common",
  "rare",
  "super-rare",
  "ultra-rare",
  "secret-rare",
  "ultimate-rare",
  "ghost-rare",
] as const;
export type CommerceRarity = (typeof COMMERCE_RARITIES)[number];
