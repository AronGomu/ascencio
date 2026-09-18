import { describe, expect, it } from "vitest";
import { mapSnapshotToBoard } from "../../src/battle/field/board-view-model.ts";
import {
  concealedStateCard,
  publicStateCard,
  RICH_PUBLIC_DUEL_STATE,
} from "../fixtures/board-public-states.ts";

describe("board stack top visibility", () => {
  it("does not present a lower public banished card as the concealed top card", () => {
    const snapshot = {
      ...RICH_PUBLIC_DUEL_STATE,
      players: [
        RICH_PUBLIC_DUEL_STATE.players[0],
        {
          ...RICH_PUBLIC_DUEL_STATE.players[1],
          banished: [
            publicStateCard("public-lower-banished", 5053103, 1, "banished", 0),
            concealedStateCard("concealed-top-banished", 1, "banished", 1),
          ],
        },
      ],
    } as const;

    const result = mapSnapshotToBoard(snapshot);
    if (!result.ok) throw new Error("Fixture failed to map");
    const banished = result.value.stacks.find(({ id }) => id === "p1:banished");

    expect(banished).toMatchObject({ count: 2, publicCount: 1 });
    expect(banished?.topCardCode).toBeUndefined();
    expect(banished?.topCardLabel).toBeUndefined();
    expect(banished?.accessibleLabel).not.toContain("top card");
  });
});
