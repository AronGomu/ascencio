import type { CommerceContent } from "./content.ts";
import { mergeCommerce, validateCommerce } from "./validation.ts";
export interface CommerceModule {
  readonly id: string;
  readonly dependencies: readonly string[];
  readonly sets: readonly string[];
  readonly commerce?: CommerceContent | undefined;
  readonly shopId?: string | undefined;
  readonly selectedSetIds?: readonly string[] | undefined;
}
/** Only declared dependency closures can supply references; installation order is irrelevant. */
export function validateCommerceStack(
  modules: readonly CommerceModule[],
): void {
  const byId = new Map(modules.map((module) => [module.id, module]));
  mergeCommerce(
    modules.flatMap((module) =>
      module.commerce === undefined ? [] : [module.commerce],
    ),
  );
  for (const module of modules) {
    const ids = new Set<string>();
    function visit(id: string): void {
      if (ids.has(id)) return;
      const current = byId.get(id);
      if (!current) throw new Error("COMMERCE_DEPENDENCY_MISSING");
      ids.add(id);
      for (const dependency of current.dependencies) visit(dependency);
    }
    visit(module.id);
    const closure = modules.filter((module) => ids.has(module.id));
    const commerce = mergeCommerce(
      closure.flatMap((module) =>
        module.commerce === undefined ? [] : [module.commerce],
      ),
    );
    if (
      !validateCommerce(
        commerce,
        new Set(closure.flatMap((module) => module.sets)),
      )
    )
      throw new Error("COMMERCE_REFERENCE_MISSING");
    if (module.shopId !== undefined) {
      const shop = commerce.shops.find((shop) => shop.id === module.shopId);
      if (
        !shop ||
        shop.offers.some(
          (offer) =>
            !module.selectedSetIds?.includes(
              commerce.boosters.find(
                (product) => product.id === offer.boosterId,
              )!.setId,
            ),
        )
      )
        throw new Error("COMMERCE_SHOP_MISSING");
    }
  }
}
