# ADR-035: Shop set data, rarity, pricing, rarity halos

Status: accepted · 2026-08-16 (rev. 2 after grill `artifacts/GRILL_2026_08_16_vn_feedback_and_shop/ANSWERS.md`; rev. 3 2026-08-17: pack price 100 → 150 DP after review measured pack expected sell value at ≈138–142 DP, making every pack a guaranteed profit) · Plan: `artifacts/PLAN_2026_08_16_vn_feedback_and_shop.md`

## Context

Feedback wants real-life YGO extensions (hundreds eventually), rarity-colored halos on every shop card, DP prices (common sells at 10). The pinned duel snapshot (~120 cards) carries **no** per-set membership and **no** rarity. Grill rounds 1–2 (user-confirmed) settled sourcing and scope.

## Decision

1. **Real set data, committed once.** `public/story/shop-sets.v1.json`: the first **50 TCG English booster sets** (LOB 2002 →), ordered by release. Each set: id, name, releaseYear, `released` flag, full card list `{code, name, rarity}`. Hand-assembled from YGOPRODeck data in one ticket; deliberately **no** lock/verify ceremony — it is static reference information, not a runtime-critical binary. First 3 sets start `released`; the flag doubles as "unlocked" until a progression system exists.
2. **Offline-first delivery.** The JSON is a `public/` asset, lazy-fetched on first shop entry, validated structurally on load, cached in Cache Storage (`story-shop-data`, cache-first). After one online session the shop browses fully offline — PWA rule holds. It never enters the story JS chunk, so the domain budget measures UI, not data.
3. **Full lists shown; collection is code-based.** Sets display their complete real card lists. Packs and singles grant any listed card into `collection[code]`. Cards without packaged art render placeholders until the image pipeline covers their codes (plan T14 extends `scripts/download-images.ts` — main-lane change). Cards outside the packaged pool stay deck/duel-unusable (engine snapshot expansion is a future ADR); packaged cards outside the 50 sets are invisible to the shop (test data).
4. **Rarity: printed first, inferred fallback.** A card's rarity = its printed rarity from the set data; printed at several rarities in one set → highest wins. Codes the data misses fall back to pure ordered rules over `DeckBuilderCardView` (ATK ≥ 3000 → secret; extra-deck → ultra; ritual or ATK ≥ 2000 → super; typed spell/trap or level ≥ 5 effect → rare; else common), then `common`. Off-union printed rarities map down (Short Print → common, Parallel → base, Gold → ultra, later specials → secret).
5. **Pricing.** `PACK_PRICE_DP = 150` (rev. 3 — must exceed a pack's expected sell value of ≈138–142 DP, or buy → open → sell mints DP without bound), `PACK_SIZE = 9` (8 commons + 1 rare-or-better, seeded-RNG-testable generator). Sell ladder common→ghost: 10 / 25 / 50 / 100 / 250 / 500 / 1000. **Singles: buyable at 4× sell price once their set is released** (common 40 DP), from the set card-list window. Start wallet 1000 DP ≈ six packs.
6. **Halo vocabulary is new.** `--rarity-*` tokens + `.rarity-halo[data-rarity]` classes scoped under `.story-app`. Duel-field halos (ADR-031) mean **legality/selection**; shop halos mean **rarity**. Different tokens, different domains, no shared CSS.

## Consequences

- Real names and rarities from day one; browsing is honest, halos meaningful, singles priced from the same table selling uses (no arbitrage: buy 4×, sell 1×; packs priced above their expected sell value).
- Loader + parser are unit-tested with fixtures; a data invariants test pins the shipped JSON (50 sets, ordered, ids unique, 3 released).
- The JSON is trusted-as-committed. Corruption risk is a bad hand-assembly, caught by the invariants test, not by hash pinning. Accepted per user decision.
- Placeholder art persists for any code upstream art cannot serve; visual gap only.

## Rejected

- Deterministic `code % 3` pseudo-sets (rev. 1 of this ADR): user chose real data now.
- Full pipeline pinning (lock + verify) for the JSON: rejected by user as ceremony for static information.
- Runtime API calls for set data: offline PWA rule forbids.
- Reusing duel halo tokens: same visual channel, opposite meaning — a gold "legal move" next to a gold "ultra rare" is a taught lie.
