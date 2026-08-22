/* The shop's whole screen surface, behind one dynamic import so it lands as
   one chunk instead of inside the story entry.

   Nothing here is reachable until the player walks into the shop, but the
   story was charged for all of it on every narrative route: measured, these
   components and what only they pull in are 24,119 bytes of the story's
   129,057-byte closure against the 143,750-byte budget, which
   `tests/unit/domain-chunk-closure.test.ts` requires 10% headroom under. Loaded
   here, the shop pays for itself, the way `loadCollectionScreen` already makes
   the collection browser pay for itself.

   One module rather than one import per screen: greeting → browse → cards →
   sell is a walk the player takes in seconds, and six boundaries would make it
   six round trips. The pack dialog is here for the same reason — it is only
   openable from inside the shop, so it is never the load that is waited on. */
export { default as BoosterInventoryDialog } from "./BoosterInventoryDialog.svelte";
export { default as BoosterOpeningScreen } from "./BoosterOpeningScreen.svelte";
export { default as BoosterResultsScreen } from "./BoosterResultsScreen.svelte";
export { default as ShopBrowseScreen } from "./ShopBrowseScreen.svelte";
export { default as ShopCardListScreen } from "./ShopCardListScreen.svelte";
export { default as ShopGreetingScreen } from "./ShopGreetingScreen.svelte";
export { default as ShopSellScreen } from "./ShopSellScreen.svelte";
