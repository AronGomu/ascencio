/**
 * One-shot assembler — pulls YGOPRODeck cardinfo for the first 50 TCG English
 * booster sets and writes public/story/shop-sets.v1.json.
 *
 * Run: node scripts/generate-shop-sets.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

type ShopRarity =
  | "common"
  | "rare"
  | "super-rare"
  | "ultra-rare"
  | "secret-rare"
  | "ultimate-rare"
  | "ghost-rare";

const RARITY_RANK: Record<ShopRarity, number> = {
  common: 0,
  rare: 1,
  "super-rare": 2,
  "ultra-rare": 3,
  "secret-rare": 4,
  "ultimate-rare": 5,
  "ghost-rare": 6,
};

function mapRarity(raw: string): ShopRarity {
  switch (raw) {
    case "Common":
      return "common";
    case "Rare":
      return "rare";
    case "Super Rare":
      return "super-rare";
    case "Ultra Rare":
      return "ultra-rare";
    case "Secret Rare":
      return "secret-rare";
    case "Ultimate Rare":
      return "ultimate-rare";
    case "Ghost Rare":
      return "ghost-rare";
    // Short Prints → common
    case "Short Print":
    case "Super Short Print":
    case "Duel Terminal Normal Parallel Rare":
      return "common";
    // Parallel variants → base rarity
    case "Parallel Rare":
    case "Duel Terminal Rare Parallel Rare":
    case "Mosaic Rare":
    case "Shatterfoil Rare":
      return "rare";
    case "Super Parallel Rare":
    case "Duel Terminal Super Parallel Rare":
      return "super-rare";
    case "Gold Rare":
    case "Premium Gold Rare":
    case "Ultra Parallel Rare":
    case "Duel Terminal Ultra Parallel Rare":
    case "Ultra Rare (Pharaoh's Rare)":
      return "ultra-rare";
    case "Secret Parallel Rare":
    case "Duel Terminal Secret Parallel Rare":
    case "Starlight Rare":
    case "Collector's Rare":
    case "Prismatic Secret Rare":
    case "Gold Secret Rare":
    case "Platinum Secret Rare":
    case "Extra Secret Rare":
      return "secret-rare";
    case "Quarter Century Secret Rare":
      return "secret-rare";
    default:
      console.warn(`  ⚠ unknown rarity "${raw}" — mapped to common`);
      return "common";
  }
}

interface SetSpec {
  id: string;
  name: string;
  apiName: string;
  releaseYear: number;
  released: boolean;
}

// TCG English booster sets in release order, LOB through LVAL.
// "released" flag: LOB, MRD, PSV only (per grill decision).
const SETS: readonly SetSpec[] = [
  {
    id: "legend-of-blue-eyes-white-dragon",
    name: "Legend of Blue Eyes White Dragon",
    apiName: "Legend of Blue Eyes White Dragon",
    releaseYear: 2002,
    released: true,
  },
  {
    id: "metal-raiders",
    name: "Metal Raiders",
    apiName: "Metal Raiders",
    releaseYear: 2002,
    released: true,
  },
  {
    id: "spell-ruler",
    name: "Spell Ruler",
    apiName: "Spell Ruler",
    releaseYear: 2002,
    released: false,
  },
  {
    id: "pharaohs-servant",
    name: "Pharaoh's Servant",
    apiName: "Pharaoh's Servant",
    releaseYear: 2002,
    released: true,
  },
  {
    id: "labyrinth-of-nightmare",
    name: "Labyrinth of Nightmare",
    apiName: "Labyrinth of Nightmare",
    releaseYear: 2003,
    released: false,
  },
  {
    id: "legacy-of-darkness",
    name: "Legacy of Darkness",
    apiName: "Legacy of Darkness",
    releaseYear: 2003,
    released: false,
  },
  {
    id: "pharaonic-guardian",
    name: "Pharaonic Guardian",
    apiName: "Pharaonic Guardian",
    releaseYear: 2003,
    released: false,
  },
  {
    id: "magicians-force",
    name: "Magician's Force",
    apiName: "Magician's Force",
    releaseYear: 2003,
    released: false,
  },
  {
    id: "dark-crisis",
    name: "Dark Crisis",
    apiName: "Dark Crisis",
    releaseYear: 2003,
    released: false,
  },
  {
    id: "invasion-of-chaos",
    name: "Invasion of Chaos",
    apiName: "Invasion of Chaos",
    releaseYear: 2004,
    released: false,
  },
  {
    id: "ancient-sanctuary",
    name: "Ancient Sanctuary",
    apiName: "Ancient Sanctuary",
    releaseYear: 2004,
    released: false,
  },
  {
    id: "soul-of-the-duelist",
    name: "Soul of the Duelist",
    apiName: "Soul of the Duelist",
    releaseYear: 2004,
    released: false,
  },
  {
    id: "rise-of-destiny",
    name: "Rise of Destiny",
    apiName: "Rise of Destiny",
    releaseYear: 2004,
    released: false,
  },
  {
    id: "flaming-eternity",
    name: "Flaming Eternity",
    apiName: "Flaming Eternity",
    releaseYear: 2005,
    released: false,
  },
  {
    id: "the-lost-millennium",
    name: "The Lost Millennium",
    apiName: "The Lost Millennium",
    releaseYear: 2005,
    released: false,
  },
  {
    id: "cybernetic-revolution",
    name: "Cybernetic Revolution",
    apiName: "Cybernetic Revolution",
    releaseYear: 2005,
    released: false,
  },
  {
    id: "elemental-energy",
    name: "Elemental Energy",
    apiName: "Elemental Energy",
    releaseYear: 2005,
    released: false,
  },
  {
    id: "shadow-of-infinity",
    name: "Shadow of Infinity",
    apiName: "Shadow of Infinity",
    releaseYear: 2006,
    released: false,
  },
  {
    id: "enemy-of-justice",
    name: "Enemy of Justice",
    apiName: "Enemy of Justice",
    releaseYear: 2006,
    released: false,
  },
  {
    id: "power-of-the-duelist",
    name: "Power of the Duelist",
    apiName: "Power of the Duelist",
    releaseYear: 2006,
    released: false,
  },
  {
    id: "cyberdark-impact",
    name: "Cyberdark Impact",
    apiName: "Cyberdark Impact",
    releaseYear: 2006,
    released: false,
  },
  {
    id: "strike-of-neos",
    name: "Strike of Neos",
    apiName: "Strike of Neos",
    releaseYear: 2007,
    released: false,
  },
  {
    id: "force-of-the-breaker",
    name: "Force of the Breaker",
    apiName: "Force of the Breaker",
    releaseYear: 2007,
    released: false,
  },
  {
    id: "tactical-evolution",
    name: "Tactical Evolution",
    apiName: "Tactical Evolution",
    releaseYear: 2007,
    released: false,
  },
  {
    id: "gladiators-assault",
    name: "Gladiator's Assault",
    apiName: "Gladiator's Assault",
    releaseYear: 2007,
    released: false,
  },
  {
    id: "phantom-darkness",
    name: "Phantom Darkness",
    apiName: "Phantom Darkness",
    releaseYear: 2008,
    released: false,
  },
  {
    id: "light-of-destruction",
    name: "Light of Destruction",
    apiName: "Light of Destruction",
    releaseYear: 2008,
    released: false,
  },
  {
    id: "the-duelist-genesis",
    name: "The Duelist Genesis",
    apiName: "The Duelist Genesis",
    releaseYear: 2008,
    released: false,
  },
  {
    id: "crossroads-of-chaos",
    name: "Crossroads of Chaos",
    apiName: "Crossroads of Chaos",
    releaseYear: 2008,
    released: false,
  },
  {
    id: "crimson-crisis",
    name: "Crimson Crisis",
    apiName: "Crimson Crisis",
    releaseYear: 2009,
    released: false,
  },
  {
    id: "raging-battle",
    name: "Raging Battle",
    apiName: "Raging Battle",
    releaseYear: 2009,
    released: false,
  },
  {
    id: "ancient-prophecy",
    name: "Ancient Prophecy",
    apiName: "Ancient Prophecy",
    releaseYear: 2009,
    released: false,
  },
  {
    id: "stardust-overdrive",
    name: "Stardust Overdrive",
    apiName: "Stardust Overdrive",
    releaseYear: 2009,
    released: false,
  },
  {
    id: "absolute-powerforce",
    name: "Absolute Powerforce",
    apiName: "Absolute Powerforce",
    releaseYear: 2010,
    released: false,
  },
  {
    id: "the-shining-darkness",
    name: "The Shining Darkness",
    apiName: "The Shining Darkness",
    releaseYear: 2010,
    released: false,
  },
  {
    id: "duelist-revolution",
    name: "Duelist Revolution",
    apiName: "Duelist Revolution",
    releaseYear: 2010,
    released: false,
  },
  {
    id: "starstrike-blast",
    name: "Starstrike Blast",
    apiName: "Starstrike Blast",
    releaseYear: 2010,
    released: false,
  },
  {
    id: "storm-of-ragnarok",
    name: "Storm of Ragnarok",
    apiName: "Storm of Ragnarok",
    releaseYear: 2011,
    released: false,
  },
  {
    id: "extreme-victory",
    name: "Extreme Victory",
    apiName: "Extreme Victory",
    releaseYear: 2011,
    released: false,
  },
  {
    id: "generation-force",
    name: "Generation Force",
    apiName: "Generation Force",
    releaseYear: 2011,
    released: false,
  },
  {
    id: "photon-shockwave",
    name: "Photon Shockwave",
    apiName: "Photon Shockwave",
    releaseYear: 2011,
    released: false,
  },
  {
    id: "order-of-chaos",
    name: "Order of Chaos",
    apiName: "Order of Chaos",
    releaseYear: 2012,
    released: false,
  },
  {
    id: "galactic-overlord",
    name: "Galactic Overlord",
    apiName: "Galactic Overlord",
    releaseYear: 2012,
    released: false,
  },
  {
    id: "return-of-the-duelist",
    name: "Return of the Duelist",
    apiName: "Return of the Duelist",
    releaseYear: 2012,
    released: false,
  },
  {
    id: "abyss-rising",
    name: "Abyss Rising",
    apiName: "Abyss Rising",
    releaseYear: 2012,
    released: false,
  },
  {
    id: "cosmo-blazer",
    name: "Cosmo Blazer",
    apiName: "Cosmo Blazer",
    releaseYear: 2013,
    released: false,
  },
  {
    id: "lord-of-the-tachyon-galaxy",
    name: "Lord of the Tachyon Galaxy",
    apiName: "Lord of the Tachyon Galaxy",
    releaseYear: 2013,
    released: false,
  },
  {
    id: "judgment-of-the-light",
    name: "Judgment of the Light",
    apiName: "Judgment of the Light",
    releaseYear: 2013,
    released: false,
  },
  {
    id: "shadow-specters",
    name: "Shadow Specters",
    apiName: "Shadow Specters",
    releaseYear: 2013,
    released: false,
  },
  {
    id: "legacy-of-the-valiant",
    name: "Legacy of the Valiant",
    apiName: "Legacy of the Valiant",
    releaseYear: 2014,
    released: false,
  },
];

interface CardEntry {
  id: number;
  name: string;
  card_sets: Array<{ set_name: string; set_rarity: string }>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSetCards(
  apiName: string,
): Promise<Array<{ code: number; name: string; rarity: ShopRarity }>> {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(apiName)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching "${apiName}"`);
  }
  const json = (await response.json()) as { data: CardEntry[] };

  // Per-code: collect all rarities this card appears at in this set, then keep highest.
  const byCode = new Map<number, { name: string; best: ShopRarity }>();
  for (const card of json.data) {
    const printings = card.card_sets.filter((s) => s.set_name === apiName);
    for (const printing of printings) {
      const rarity = mapRarity(printing.set_rarity);
      const existing = byCode.get(card.id);
      if (
        existing === undefined ||
        RARITY_RANK[rarity] > RARITY_RANK[existing.best]
      ) {
        byCode.set(card.id, { name: card.name, best: rarity });
      }
    }
  }

  return Array.from(byCode.entries()).map(([code, { name, best }]) => ({
    code,
    name,
    rarity: best,
  }));
}

console.log(`Fetching ${SETS.length} sets from YGOPRODeck…`);

const outputSets = [];
for (const spec of SETS) {
  process.stdout.write(
    `  [${outputSets.length + 1}/${SETS.length}] ${spec.apiName}… `,
  );
  const cards = await fetchSetCards(spec.apiName);
  console.log(`${cards.length} cards`);
  outputSets.push({
    id: spec.id,
    name: spec.name,
    releaseYear: spec.releaseYear,
    released: spec.released,
    cards,
  });
  // Rate-limit: 150 ms between requests
  if (outputSets.length < SETS.length) await sleep(150);
}

const output = { version: 1, sets: outputSets };
const outPath = path.join(projectRoot, "public", "story", "shop-sets.v1.json");
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`\nWrote ${outPath}`);
console.log(
  `Total sets: ${output.sets.length}, total cards: ${output.sets.reduce((n, s) => n + s.cards.length, 0)}`,
);
