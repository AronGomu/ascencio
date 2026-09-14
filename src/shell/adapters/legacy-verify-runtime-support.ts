interface RuntimeSupportReader {
  readJson<T>(path: string): Promise<T>;
}

/** Declared support plus every indexed script/global must close over verified files. */
export async function verifyRuntimeSupport(
  reader: RuntimeSupportReader,
  codes: readonly number[],
): Promise<void> {
  const reject = (): never => {
    throw new Error("Runtime support closure is incomplete");
  };
  if (!codes.length || new Set(codes).size !== codes.length) reject();
  const index = await reader.readJson<{
    official: unknown;
    preRelease: unknown;
    globals: unknown;
    shardCount: unknown;
  }>("scripts/index.json");
  if (!index || index.shardCount !== 256) reject();
  const scripts = new Map<string, Set<string>>();
  for (const values of [index.official, index.preRelease]) {
    if (!Array.isArray(values) || values.length > 50_000) reject();
    for (const name of values as unknown[]) {
      if (typeof name !== "string" || !/^c[1-9][0-9]{0,9}\.lua$/.test(name))
        reject();
      const scriptName = name as string;
      const code = Number(scriptName.slice(1, -4));
      if (!Number.isSafeInteger(code) || code > 0xffffffff) reject();
      const shard = (code % 256).toString(16).padStart(2, "0");
      const names = scripts.get(shard) ?? new Set<string>();
      names.add(scriptName);
      scripts.set(shard, names);
    }
  }
  for (const [shard, names] of scripts) {
    const records = await reader.readJson<Record<string, unknown>>(
      `scripts/cards/${shard}.json`,
    );
    if (!records || typeof records !== "object" || Array.isArray(records))
      reject();
    for (const name of names)
      if (!Object.hasOwn(records, name) || typeof records[name] !== "string")
        reject();
  }
  if (
    !Array.isArray(index.globals) ||
    index.globals.length > 2_048 ||
    index.globals.some(
      (name: unknown) =>
        typeof name !== "string" || !/^[a-z0-9_]+\.lua$/i.test(name),
    )
  )
    reject();
  const globals = await reader.readJson<Record<string, unknown>>(
    "scripts/globals.json",
  );
  if (!globals || typeof globals !== "object" || Array.isArray(globals))
    reject();
  for (const name of new Set([
    "constant.lua",
    "utility.lua",
    ...(index.globals as string[]),
  ])) {
    const source = globals[name];
    if (
      !Object.hasOwn(globals, name) ||
      typeof source !== "string" ||
      !source.trim()
    )
      reject();
  }

  const byShard = new Map<string, number[]>();
  for (const code of codes) {
    if (!Number.isSafeInteger(code) || code <= 0) reject();
    const shard = (code % 64).toString(16).padStart(2, "0");
    const group = byShard.get(shard) ?? [];
    group.push(code);
    byShard.set(shard, group);
  }
  for (const [shard, shardCodes] of byShard) {
    const [cards, texts] = await Promise.all([
      reader.readJson<readonly { readonly code: number }[]>(
        `catalog/cards/${shard}.json`,
      ),
      reader.readJson<readonly { readonly code: number }[]>(
        `catalog/texts/en/${shard}.json`,
      ),
    ]);
    const cardCodes = new Set(cards.map(({ code }) => code));
    const textCodes = new Set(texts.map(({ code }) => code));
    for (const code of shardCodes)
      if (!cardCodes.has(code) || !textCodes.has(code)) reject();
  }
}
