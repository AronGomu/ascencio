import {
  array,
  freeze,
  integer,
  literal,
  record,
  text,
  unique,
} from "./release-value.ts";
export interface StoryEventChain {
  readonly schemaVersion: 1;
  readonly entryBeatId: string;
  readonly nodes: readonly {
    readonly beatId: string;
    readonly next: string | null;
    readonly choices: readonly {
      readonly id: string;
      readonly target: string;
    }[];
    readonly media?: {
      readonly kind: "image" | "audio" | "video";
      readonly logicalId: string;
      readonly timeoutMs: number;
    };
  }[];
}
function invalidChain(pointer: string): never {
  const error = new Error(`STORY_CHAIN_INVALID: ${pointer}`);
  Object.assign(error, { pointer });
  throw error;
}
export function parseStoryEventChain(
  value: unknown,
  beats: readonly string[],
  choices: readonly string[],
): StoryEventChain {
  const chain = record(value, ["schemaVersion", "entryBeatId", "nodes"]);
  const nodes = array(
    chain.nodes,
    (value) => {
      const keys = [
        "beatId",
        "next",
        "choices",
        ...(value && typeof value === "object" && "media" in value
          ? ["media"]
          : []),
      ];
      const node = record(value, keys);
      const selected = array(
        node.choices,
        (value) => {
          const choice = record(value, ["id", "target"]);
          return { id: text(choice.id, 256), target: text(choice.target, 256) };
        },
        32,
      );
      unique(selected, (c) => c.id);
      let media: StoryEventChain["nodes"][number]["media"];
      if (node.media !== undefined) {
        const m = record(node.media, ["kind", "logicalId", "timeoutMs"]);
        media = {
          kind: literal(m.kind, "image", "audio", "video"),
          logicalId: text(m.logicalId, 1024),
          timeoutMs: integer(m.timeoutMs, 100, 120_000),
        };
      }
      return {
        beatId: text(node.beatId, 256),
        next: node.next === null ? null : text(node.next, 256),
        choices: selected,
        ...(media ? { media } : {}),
      };
    },
    10_000,
  );
  unique(nodes, (node) => node.beatId);
  const entryBeatId = text(chain.entryBeatId, 256);
  const byId = new Map(nodes.map((node) => [node.beatId, node]));
  if (!byId.has(entryBeatId)) invalidChain("/chain/entryBeatId");
  const reverse = new Map<string, string[]>();
  const terminals: string[] = [];
  for (const [index, node] of nodes.entries()) {
    if (
      !beats.includes(node.beatId) ||
      (node.next !== null && node.choices.length)
    )
      invalidChain(`/chain/nodes/${index}/beatId`);
    const targets = [
      ...(node.next ? [node.next] : []),
      ...node.choices.map((c, choiceIndex) => {
        if (!choices.includes(c.id))
          invalidChain(`/chain/nodes/${index}/choices/${choiceIndex}/id`);
        if (!byId.has(c.target))
          invalidChain(`/chain/nodes/${index}/choices/${choiceIndex}/target`);
        return c.target;
      }),
    ];
    if (!targets.length) terminals.push(node.beatId);
    for (const target of targets) {
      if (!byId.has(target)) invalidChain(`/chain/nodes/${index}/next`);
      const predecessors = reverse.get(target) ?? [];
      predecessors.push(node.beatId);
      reverse.set(target, predecessors);
    }
  }
  const reachable = new Set<string>(),
    pending = [entryBeatId];
  for (let i = 0; i < pending.length; i++) {
    const id = pending[i]!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = byId.get(id)!;
    if (node.next) pending.push(node.next);
    pending.push(...node.choices.map((c) => c.target));
  }
  const completing = new Set<string>();
  for (let i = 0; i < terminals.length; i++) {
    const id = terminals[i]!;
    if (completing.has(id)) continue;
    completing.add(id);
    terminals.push(...(reverse.get(id) ?? []));
  }
  if (reachable.size !== nodes.length || completing.size !== nodes.length)
    invalidChain("/chain/nodes");
  return freeze({
    schemaVersion: literal(chain.schemaVersion, 1),
    entryBeatId,
    nodes,
  });
}
