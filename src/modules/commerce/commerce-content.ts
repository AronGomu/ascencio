import type { EconomyPolicy } from "./economy-policy.ts";
import type { BoosterProduct } from "./booster-product.ts";
import type { ShopDefinition } from "./shop-definition.ts";
export interface CommerceContent {
  readonly schemaVersion: 1;
  readonly economies: readonly EconomyPolicy[];
  readonly boosters: readonly BoosterProduct[];
  readonly shops: readonly ShopDefinition[];
}
