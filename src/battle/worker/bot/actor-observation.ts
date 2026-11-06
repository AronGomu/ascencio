import {
  eventDetails,
  observedEventName,
  isPromptMessage,
  type BotObservedEvent,
} from "./observed-events.ts";
import type {
  PlayerIndex,
  PublicDuelState,
  PublicCard,
} from "../../duel/contracts/public-duel-state.ts";
import type { SnapshotId } from "../../duel/contracts/ids.ts";
import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import { DuelStateProjector } from "../projection/DuelStateProjector.ts";
import type {
  EngineMessage,
  EngineCardQuery,
} from "../engine/OcgCoreAdapter.ts";
import type { DuelSession } from "../engine/DuelSession.ts";
import { EngineLocation, EngineQueryFlag } from "../engine/engine-constants.ts";

/** Removes UI-only concealed codes before observations cross the bot boundary. */
export function permittedState(
  state: PublicDuelState,
  actor: PlayerIndex,
): PublicDuelState {
  const result = state;
  function card(value: PublicCard, own: boolean): PublicCard {
    const { code, ...rest } = value;
    return {
      ...rest,
      ...(own || value.faceUp
        ? { ...(code === undefined ? {} : { code }) }
        : {}),
      overlayMaterials: value.overlayMaterials.map((material) => {
        if (own || material.identityVisible) return material;
        const hidden = {
          sequence: material.sequence,
          identityVisible: material.identityVisible,
        };
        return {
          ...hidden,
          instanceId: `concealed-${value.instanceId}-${material.sequence}`,
        };
      }),
    } as PublicCard;
  }
  return {
    ...result,
    chain: result.chain.map((link) => {
      if (link.sourceIdentityVisible) return link;
      const rest = { ...link };
      delete rest.sourceCard;
      delete rest.sourceInstanceId;
      delete rest.description;
      return { ...rest, label: "Concealed effect" };
    }),
    players: result.players.map((player) => ({
      ...player,
      hand:
        player.player === actor ? player.hand.map((c) => card(c, true)) : [],
      deck: player.deck.map((c) => card(c, false)),
      extraDeck: player.extraDeck
        .filter((c) => player.player === actor || c.faceUp)
        .map((c) => card(c, player.player === actor)),
      monsters: player.monsters.map((c) => card(c, player.player === actor)),
      spellsAndTraps: player.spellsAndTraps.map((c) =>
        card(c, player.player === actor),
      ),
      graveyard: player.graveyard.map((c) => card(c, true)),
      banished: player.banished.map((c) => card(c, player.player === actor)),
    })) as unknown as PublicDuelState["players"],
  };
}
export class ActorObservation {
  readonly projector: DuelStateProjector;
  #cachedState: PublicDuelState | undefined;
  #pendingEvents: BotObservedEvent[] = [];
  readonly actor: PlayerIndex;
  readonly session: DuelSession;
  constructor(
    actor: PlayerIndex,
    session: DuelSession,
    dependencies: ActiveDuelDependencies,
    snapshot: SnapshotId,
    counts: readonly [number, number],
    extras: readonly [number, number],
    mr5: boolean,
  ) {
    this.actor = actor;
    this.session = session;
    this.projector = new DuelStateProjector(
      snapshot,
      counts,
      extras,
      { extraMonsterZones: mr5 },
      [session.initialExtraDeckOrder(0), session.initialExtraDeckOrder(1)],
      dependencies,
      actor,
    );
  }
  apply(message: EngineMessage) {
    this.#cachedState = undefined;
    const update = this.projector.apply(message);
    if (update.reconciliationFailure)
      throw new Error(`Projection failed: ${update.reconciliationFailure}`);
    if (!isPromptMessage(message.type)) {
      const state = this.snapshot();
      if (this.#pendingEvents.length >= 100000)
        throw new Error(
          "observation_limit: pending event history exceeds limit",
        );
      this.#pendingEvents.push({
        event: observedEventName(message.type),
        turn: state.turn,
        phase: state.phase,
        details: [
          ...update.events,
          ...eventDetails(message, state, this.actor),
        ],
      });
    }
    return update;
  }
  reconcile(): void {
    this.#cachedState = undefined;
    // Queries are restricted to each perspective's permitted Extra Deck and public material/counter records.
    for (const player of [0, 1] as const) {
      const records = this.session.queryLocation({
        controller: player,
        location: EngineLocation.EXTRA,
        flags: (EngineQueryFlag.CODE |
          EngineQueryFlag.POSITION |
          EngineQueryFlag.OWNER |
          EngineQueryFlag.IS_PUBLIC |
          EngineQueryFlag.IS_HIDDEN) as EngineCardQuery["flags"],
      });
      this.projector.reconcileExtraDeck(
        player,
        records
          .filter((v) => v !== null)
          .map((v) => {
            if (
              v.position === undefined ||
              v.owner !== player ||
              typeof v.isPublic !== "boolean" ||
              typeof v.isHidden !== "boolean"
            )
              throw new Error("Malformed Extra Deck query");
            return {
              ...(v.code === undefined ? {} : { code: v.code }),
              position: v.position ?? 8,
              owner: player,
              isPublic: v.isPublic === true,
              isHidden: v.isHidden,
            };
          }),
      );
    }
    const snapshot = this.projector.snapshot();
    for (const player of snapshot.players)
      for (const card of [...player.monsters, ...player.spellsAndTraps]) {
        const address = {
          controller: player.player,
          location:
            card.location === "monster"
              ? EngineLocation.MONSTER
              : EngineLocation.SPELL_TRAP,
          sequence: card.sequence,
        };
        const queried = this.session.queryCard({
          ...address,
          location: address.location as EngineCardQuery["location"],
          overlaySequence: 0,
          flags: (EngineQueryFlag.OVERLAY_CARD |
            EngineQueryFlag.COUNTERS) as EngineCardQuery["flags"],
        });
        if (
          !queried ||
          !Array.isArray(queried.overlayCards) ||
          queried.counters === undefined
        )
          throw new Error("Malformed field reconciliation query");
        if (card.location === "monster")
          this.projector.reconcileOverlayMaterials(
            address,
            (queried.overlayCards ?? []).map((code) => ({ code })),
          );
        this.projector.reconcileCounters(
          address,
          Object.entries(queried.counters ?? {}).map(([type, count]) => ({
            type: Number(type),
            count,
          })),
        );
      }
  }
  snapshot(): PublicDuelState {
    return (this.#cachedState ??= permittedState(
      this.projector.snapshot(),
      this.actor,
    ));
  }
  takeEvents(): readonly BotObservedEvent[] {
    const events = this.#pendingEvents;
    this.#pendingEvents = [];
    return events;
  }
  checkpoint() {
    return {
      projection: this.projector.checkpoint(),
      events: [...this.#pendingEvents],
    };
  }
  restore(checkpoint: ReturnType<ActorObservation["checkpoint"]>): void {
    this.projector.restore(checkpoint.projection);
    this.#pendingEvents = [...checkpoint.events];
    this.#cachedState = undefined;
  }
}
