/** Read-only adapter for the current compiled startup snapshots. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { CriticalSnapshot } from "../../src/storage/contracts/critical-snapshot.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";

export async function loadCriticalInputs(root: string) {
  const files = await Promise.all(
    ["card-library", "duel-core"].map(async (id) => {
      const bytes = await readFile(path.join(root, id, "critical.json"));
      const data = JSON.parse(bytes.toString()) as CriticalSnapshot;
      if (
        data.schemaVersion !== 1 ||
        data.compilerVersion !== 1 ||
        data.manifest.packageId !== id
      )
        throw new Error(`Unsupported critical snapshot: ${id}`);
      return {
        id,
        data,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
  const cards: Map<
    number,
    ActiveDuelDependencies["cards"] extends ReadonlyMap<number, infer C>
      ? C
      : never
  > = new Map();
  const texts = new Map();
  const scripts = new Map<string, string>();
  for (const { data } of files) {
    for (const { definition: d, texts: localized } of data.cards) {
      cards.set(d.code, {
        ...d,
        setcodes: [...d.setcodes],
        race: BigInt(d.race),
        link_marker: d.linkMarker,
      });
      const text = localized.find((t) => t.locale === "en");
      if (text) texts.set(d.code, { ...text, code: d.code });
    }
    for (const script of data.scripts) scripts.set(script.name, script.source);
  }
  const config = files[1]!.data.config;
  const strings = "strings" in config ? config.strings : undefined;
  if (!strings) throw new Error("Missing core strings");
  const dependencies: ActiveDuelDependencies = {
    cards,
    texts,
    scripts,
    strings,
    images: new Map(),
    counts: {
      cards: cards.size,
      texts: texts.size,
      scripts: scripts.size,
      globals: [...scripts.keys()].filter((n) => !/^c\d+\.lua$/.test(n)).length,
      images: 0,
    },
  };
  const identities = files.map(({ id, sha256, data }) => ({
    id,
    sha256,
    manifest: data.manifest,
  }));
  return {
    dependencies,
    manifest: {
      snapshotId: createHash("sha256")
        .update(JSON.stringify(identities))
        .digest("hex"),
      critical: identities,
    },
  };
}
