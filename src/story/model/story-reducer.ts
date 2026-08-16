import {
  CHOICE_RESPONSES,
  LATER_ACKNOWLEDGMENTS,
} from "../content/prologue.ts";
import {
  createInitialStoryState,
  type BattleResult,
  type ChoiceId,
  type LocationId,
  type OpenedCard,
  type ShopRarity,
  type StoryState,
  type StoryScreen,
} from "./story-state.ts";
import {
  isShopRarity,
  PACK_PRICE_DP,
  SELL_PRICE_DP,
  singlePriceDp,
} from "../shop/data/shop-pricing.ts";

export type StoryCommand =
  | { readonly type: "new-game" }
  | { readonly type: "continue" }
  | { readonly type: "load"; readonly slot: "manual" | "autosave" | "empty" }
  | { readonly type: "advance"; readonly inputId: number }
  | { readonly type: "choose"; readonly choice: ChoiceId }
  | { readonly type: "go-to-map" }
  | { readonly type: "select-location"; readonly locationId: LocationId }
  | { readonly type: "start-battle" }
  | { readonly type: "battle-result"; readonly result: BattleResult }
  | { readonly type: "continue-outcome" }
  | { readonly type: "acknowledge-reward" }
  | { readonly type: "open-shop" }
  | { readonly type: "leave-shop" }
  | {
      readonly type: "shop-navigate";
      readonly to: "greeting" | "browse" | "sell";
    }
  | {
      readonly type: "buy-packs";
      readonly setId: string;
      readonly count: number;
    }
  | { readonly type: "view-set-cards"; readonly setId: string }
  | {
      readonly type: "buy-single";
      readonly code: number;
      readonly rarity: ShopRarity;
    }
  | {
      readonly type: "open-boosters";
      readonly picks: readonly {
        readonly setId: string;
        readonly count: number;
      }[];
      readonly cards: readonly OpenedCard[];
      readonly mode: "sequential" | "all";
    }
  | { readonly type: "acknowledge-opened" }
  | { readonly type: "finish-opening" }
  | {
      readonly type: "sell-cards";
      /* The receipt names what is being sold, never what it is worth: the
         price belongs to the rarity ladder this reducer owns. */
      readonly items: readonly {
        readonly code: number;
        readonly quantity: number;
        readonly rarity: ShopRarity;
      }[];
    }
  | { readonly type: "reset" };

export function reduceStory(
  state: StoryState,
  command: StoryCommand,
): StoryState {
  switch (command.type) {
    case "new-game":
      return {
        ...createInitialStoryState(),
        screen: "narrative",
        savedScreen: "narrative",
        progressExists: true,
      };
    case "continue":
      return state.progressExists
        ? { ...state, screen: state.savedScreen }
        : state;
    case "load":
      if (command.slot === "empty") return state;
      return {
        ...state,
        progressExists: true,
        screen: command.slot === "manual" ? "narrative" : "map",
        savedScreen: command.slot === "manual" ? "narrative" : "map",
        narrativeIndex: command.slot === "manual" ? 18 : state.narrativeIndex,
      };
    case "advance":
      if (state.screen !== "narrative" || state.lastInputId === command.inputId)
        return state;
      return {
        ...state,
        narrativeIndex: state.narrativeIndex + 1,
        lastInputId: command.inputId,
      };
    case "choose":
      if (state.screen !== "narrative" || state.choice !== null) return state;
      return {
        ...state,
        choice: command.choice,
        choiceResponse: CHOICE_RESPONSES[command.choice],
      };
    case "go-to-map":
      return {
        ...state,
        screen: "map",
        savedScreen: "map",
        laterAcknowledgment:
          state.choice === null ? null : LATER_ACKNOWLEDGMENTS[state.choice],
      };
    case "select-location": {
      if (state.screen !== "map") return state;
      const location = state.locations.find(
        ({ id }) => id === command.locationId,
      );
      if (location?.access !== "available") return state;
      if (command.locationId === "card-shop") {
        return { ...state, screen: "shop-greeting", shopReturnScreen: "map" };
      }
      return {
        ...state,
        screen: "pre-battle",
        encounterId: command.locationId,
      };
    }
    case "start-battle":
      return state.screen === "pre-battle"
        ? { ...state, screen: "battle-mock" }
        : state;
    case "battle-result":
      if (state.screen !== "battle-mock") return state;
      return {
        ...state,
        screen: "outcome",
        outcome: command.result,
        outcomeScene: outcomeScene(command.result),
      };
    case "continue-outcome":
      if (state.screen !== "outcome") return state;
      if (state.outcome === "abort" || state.outcome === "failure")
        return {
          ...state,
          screen: "map",
          outcome: null,
          outcomeScene: null,
          encounterId: null,
        };
      if (state.outcome !== "win" && state.outcome !== "loss") return state;
      return state.rewardGranted
        ? {
            ...state,
            screen: "map",
            outcome: null,
            outcomeScene: null,
            savedScreen: "map",
            encounterId: null,
          }
        : { ...state, screen: "reward", rewardGranted: true };
    case "acknowledge-reward":
      if (state.screen !== "reward" || state.rewardAcknowledged) return state;
      return {
        ...state,
        screen: "map",
        savedScreen: "map",
        rewardAcknowledged: true,
        encounterId: null,
        objective: "Signal decoded — inspect the newly opened Archive route",
        locations: state.locations.map((location) =>
          location.id === "old-arena"
            ? { ...location, completed: true }
            : location.id === "archive"
              ? { ...location, access: "available" }
              : location,
        ),
      };
    case "open-shop":
      if (state.screen !== "narrative" && state.screen !== "map") return state;
      return {
        ...state,
        screen: "shop-greeting",
        shopReturnScreen: state.screen,
      };
    case "leave-shop":
      if (!state.screen.startsWith("shop-")) return state;
      return {
        ...state,
        screen: state.shopReturnScreen ?? "map",
        shopReturnScreen: null,
      };
    case "shop-navigate": {
      if (!state.screen.startsWith("shop-")) return state;
      const screenMap: Record<"greeting" | "browse" | "sell", StoryScreen> = {
        greeting: "shop-greeting",
        browse: "shop-browse",
        sell: "shop-sell",
      };
      const next = { ...state, screen: screenMap[command.to] };
      return command.to === "browse" ? { ...next, shopSetId: null } : next;
    }
    case "view-set-cards": {
      if (state.screen !== "shop-browse") return state;
      return { ...state, screen: "shop-cards", shopSetId: command.setId };
    }
    case "buy-single": {
      if (state.screen !== "shop-cards") return state;
      if (!isShopRarity(command.rarity)) return state;
      const price = singlePriceDp(command.rarity);
      if (state.dp < price) return state;
      return {
        ...state,
        dp: state.dp - price,
        collection: {
          ...state.collection,
          [command.code]: (state.collection[command.code] ?? 0) + 1,
        },
      };
    }
    case "buy-packs": {
      if (state.screen !== "shop-browse") return state;
      const { setId, count } = command;
      if (!Number.isInteger(count) || count < 1) return state;
      const cost = count * PACK_PRICE_DP;
      if (state.dp < cost) return state;
      return {
        ...state,
        dp: state.dp - cost,
        boosters: {
          ...state.boosters,
          [setId]: (state.boosters[setId] ?? 0) + count,
        },
      };
    }
    case "open-boosters": {
      if (!state.screen.startsWith("shop-")) return state;
      const { picks, cards, mode } = command;
      /* Totalled per set before anything is checked: two picks naming one set
         each pass a per-pick check the pair cannot pass together, and the
         shelf would go negative. */
      const wanted = new Map<string, number>();
      for (const { setId, count } of picks) {
        if (!Number.isInteger(count) || count < 1) return state;
        wanted.set(setId, (wanted.get(setId) ?? 0) + count);
      }
      for (const [setId, count] of wanted)
        if ((state.boosters[setId] ?? 0) < count) return state;
      const boosters: Record<string, number> = { ...state.boosters };
      for (const [setId, count] of wanted) {
        const remaining = (boosters[setId] ?? 0) - count;
        if (remaining === 0) delete boosters[setId];
        else boosters[setId] = remaining;
      }
      const collection: Record<number, number> = { ...state.collection };
      for (const { code } of cards) {
        collection[code] = (collection[code] ?? 0) + 1;
      }
      return {
        ...state,
        boosters,
        collection,
        openedCards: cards,
        openingMode: mode,
        screen: mode === "sequential" ? "shop-opening" : "shop-results",
      };
    }
    case "acknowledge-opened":
      if (state.screen !== "shop-results") return state;
      return {
        ...state,
        screen: "shop-browse",
        openedCards: null,
        openingMode: null,
      };
    case "finish-opening":
      if (state.screen !== "shop-opening") return state;
      return { ...state, screen: "shop-results" };
    case "sell-cards": {
      if (state.screen !== "shop-sell") return state;
      /* Totalled per code before anything is checked: two rows naming one
         card each pass a per-row check the pair cannot pass together, and the
         collection would go negative — a save this build can no longer
         read. */
      const wanted = new Map<number, number>();
      for (const { code, quantity, rarity } of command.items) {
        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          !isShopRarity(rarity)
        )
          return state;
        wanted.set(code, (wanted.get(code) ?? 0) + quantity);
      }
      for (const [code, quantity] of wanted)
        if ((state.collection[code] ?? 0) < quantity) return state;
      const collection: Record<number, number> = { ...state.collection };
      let dp = state.dp;
      for (const { quantity, rarity } of command.items)
        dp += quantity * SELL_PRICE_DP[rarity];
      for (const [code, quantity] of wanted) {
        const remaining = (collection[code] ?? 0) - quantity;
        if (remaining === 0) delete collection[code];
        else collection[code] = remaining;
      }
      return { ...state, dp, collection };
    }
    case "reset":
      return createInitialStoryState();
  }
}

function outcomeScene(result: BattleResult): string {
  switch (result) {
    case "win":
      return "The arena signal fractures beneath your final attack.";
    case "loss":
      return "Your field fades, but the signal opens a channel instead of closing one.";
    case "abort":
      return "The duel pauses safely. Retry or return when ready.";
    case "failure":
      return "Technical failure interrupted the simulation; no story defeat occurred.";
  }
}
