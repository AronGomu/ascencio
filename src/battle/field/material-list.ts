import type { BoardCardView } from "./board-view-model.ts";
import type { ZoneListEntry } from "./zone-list.ts";

const EMPTY: readonly ZoneListEntry[] = Object.freeze([]);

/**
 * The materials of one host card as browse entries, top-of-stack first (array
 * order of `host.materials`). Empty for a card without materials.
 *
 * A material has no zone of its own — it rides on the host's monster zone —
 * so the entry borrows the host's controller and location and keeps the
 * material's own engine sequence. That is enough for the list dialog, which
 * only ever browses these: they carry no choices.
 */
export function materialListEntries(
  host: BoardCardView,
): readonly ZoneListEntry[] {
  if (host.materials.length === 0) return EMPTY;
  return Object.freeze(
    host.materials.map((material, index) =>
      Object.freeze({
        id: `${host.id}:material:${material.id}`,
        position: index + 1,
        controller: host.player,
        location: "monster" as const,
        sequence: material.sequence,
        identityVisible: material.identityVisible,
        ...(material.identityVisible && material.code !== undefined
          ? { code: material.code }
          : {}),
        label: material.label,
      }),
    ),
  );
}
