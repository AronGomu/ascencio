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
  PublicPlayerState,
} from "../../duel/contracts/public-duel-state.ts";
import type { SnapshotId } from "../../duel/contracts/ids.ts";
import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import {
  DuelStateProjector,
  type ProjectionReconciliationRequest,
} from "../projection/DuelStateProjector.ts";
import type {
  EngineMessage,
  EngineCardQuery,
} from "../engine/OcgCoreAdapter.ts";
import type { DuelSession } from "../engine/DuelSession.ts";
import { EngineLocation, EngineQueryFlag } from "../engine/engine-constants.ts";

const permittedPlayers = new WeakMap<
  PublicPlayerState,
  Map<PlayerIndex, PublicPlayerState>
>();
const permittedActors = new WeakMap<PublicDuelState, PlayerIndex>();

/** Removes UI-only concealed codes before observations cross the bot boundary. */
export function permittedState(
  state: PublicDuelState,
  actor: PlayerIndex,
): PublicDuelState {
  if (permittedActors.get(state) === actor) return state;
  const result = state;
  function card(value: PublicCard, own: boolean): PublicCard {
    if (
      own ||
      ((value.code === undefined || value.faceUp) &&
        value.overlayMaterials.every((m) => m.identityVisible))
    )
      return value;
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
  const permitted: PublicDuelState = {
    ...result,
    chain: result.chain.map((link) => {
      if (link.sourceIdentityVisible) return link;
      const rest = { ...link };
      delete rest.sourceCard;
      delete rest.sourceInstanceId;
      delete rest.description;
      return { ...rest, label: "Concealed effect" };
    }),
    players: result.players.map((player) => {
      const cached = permittedPlayers.get(player)?.get(actor);
      if (cached) return cached;
      const filtered = {
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
      };
      const cache =
        permittedPlayers.get(player) ??
        new Map<PlayerIndex, PublicPlayerState>();
      cache.set(actor, filtered);
      permittedPlayers.set(player, cache);
      return Object.freeze(filtered);
    }) as unknown as PublicDuelState["players"],
  };
  permittedActors.set(permitted, actor);
  return Object.freeze(permitted);
}
export class ActorObservation {
  readonly projector: DuelStateProjector;
  #cachedState: PublicDuelState | undefined;
  #pendingEvents: BotObservedEvent[] = [];
  #reconciliations = new Map<string, ProjectionReconciliationRequest>();
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
    for (const request of update.reconciliationRequests) {
      const key =
        request.type === "extraDeck"
          ? `extra:${request.player}`
          : `${request.type}:${request.controller}:${request.location}:${request.sequence}`;
      this.#reconciliations.set(key, request);
    }
    if (update.reconciliationFailure)
      throw new Error(`Projection failed: ${update.reconciliationFailure}`);
    let observed: BotObservedEvent | undefined;
    if (!isPromptMessage(message.type)) {
      const state = this.snapshot();
      if (this.#pendingEvents.length >= 100000)
        throw new Error(
          "observation_limit: pending event history exceeds limit",
        );
      observed = {
        event: observedEventName(message.type),
        turn: state.turn,
        phase: state.phase,
        details: [
          ...update.events,
          ...eventDetails(message, state, this.actor),
        ],
      };
      this.#pendingEvents.push(observed);
    }
    return { ...update, observed };
  }
  reconcile(): void {
    // The same authoritative reconciliation requests drive the actual runtime
    // and evaluation. Unchanged zones do not need to be queried or rebuilt.
    if (this.#reconciliations.size === 0) return;
    this.#cachedState = undefined;
    for (const request of this.#reconciliations.values()) {
      if (request.type === "extraDeck") {
        const player = request.player;
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
                position: v.position,
                owner: player,
                isPublic: v.isPublic,
                isHidden: v.isHidden,
              };
            }),
        );
      } else {
        const state = this.projector.snapshot();
        const player = state.players[request.controller];
        const cards =
          request.location === EngineLocation.MONSTER
            ? player.monsters
            : player.spellsAndTraps;
        if (!cards.some((c) => c.sequence === request.sequence)) continue;
        const materials = request.type === "overlayMaterials";
        const queried = this.session.queryCard({
          controller: request.controller,
          location: request.location as EngineCardQuery["location"],
          sequence: request.sequence,
          overlaySequence: 0,
          flags: materials
            ? EngineQueryFlag.OVERLAY_CARD
            : EngineQueryFlag.COUNTERS,
        });
        if (
          !queried ||
          (materials
            ? !Array.isArray(queried.overlayCards)
            : queried.counters === undefined)
        )
          throw new Error("Malformed field reconciliation query");
        if (materials)
          this.projector.reconcileOverlayMaterials(
            request,
            queried.overlayCards!.map((code) => ({ code })),
          );
        else
          this.projector.reconcileCounters(
            request,
            Object.entries(queried.counters!).map(([type, count]) => ({
              type: Number(type),
              count,
            })),
          );
      }
    }
    this.#reconciliations.clear();
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
      reconciliations: [...this.#reconciliations],
    };
  }
  restore(checkpoint: ReturnType<ActorObservation["checkpoint"]>): void {
    this.projector.restore(checkpoint.projection);
    this.#pendingEvents = [...checkpoint.events];
    this.#reconciliations = new Map(checkpoint.reconciliations);
    this.#cachedState = undefined;
  }
}
