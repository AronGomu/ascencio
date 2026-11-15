/** One readable target-perspective chronology per loss; authoritative logs remain replay evidence. */
import { decodeLog } from "./game-log.ts";
import { digest } from "./session-fixtures.ts";

// The loss-log decoder validates the recursive wire values; event shapes vary by engine message.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const line = (value: unknown) =>
  String(value ?? "unknown").replace(/[\r\n\t]+/g, " ");
const list = (value: unknown): Row[] => (Array.isArray(value) ? value : []);

/** Collapse only a proven mandatory single response, including its visible consequences below. */
function forced(prompt: Row, choices: Row[], chosen: string[]) {
  return (
    choices.length === 1 &&
    prompt.minimum === 1 &&
    prompt.maximum === 1 &&
    prompt.cancelable === false &&
    prompt.ordered === false &&
    prompt.constraints?.required_total == null &&
    prompt.constraints?.sum_mode == null &&
    !list(prompt.constraints?.mandatory_contributions?.contribution).length &&
    choices[0]!.allocation_maximum == null &&
    chosen.length === 1 &&
    chosen[0] === choices[0]!.id
  );
}

export function readableLossReview(
  text: string,
  options: { cardNames?: Readonly<Record<string, string>> } = {},
) {
  const rows = decodeLog(text, "ASCENCIO_LOSS_LOG\t2");
  const game = rows.find((r) => r.tag === "GAME")?.value as Row | undefined;
  const result = rows.find((r) => r.tag === "RESULT")?.value as Row | undefined;
  if (game?.outcome !== "loss" || result?.outcome !== "loss")
    throw Error("Readable review requires a completed target loss");
  const names = options.cardNames ?? {};
  const card = (code: unknown) =>
    code == null || code === "?"
      ? "unknown card"
      : (names[String(code)] ?? `card ${line(code)}`);
  const identities = new Map<string, string>();
  const describe = (value: unknown): string => {
    if (value == null) return "unknown";
    if (Array.isArray(value)) return value.map(describe).join(", ") || "none";
    if (typeof value !== "object") return line(value);
    const v = value as Row;
    if (Object.keys(v).length === 1 && (v.item || v.card || v.change))
      return describe(v.item ?? v.card ?? v.change);
    return Object.entries(v)
      .filter(([k]) => !["duration_ms", "display_order"].includes(k))
      .map(
        ([k, x]) =>
          `${k.replaceAll("_", " ")}: ${["code", "card_code", "source_card"].includes(k) || (k === "card" && typeof x !== "object") ? card(x) : describe(x)}`,
      )
      .join("; ");
  };
  const body: string[] = [],
    decisions: string[] = [];
  const choiceMap: Record<
    string,
    { offered: string[]; chosen: string[]; options: Record<string, string> }
  > = {};
  const omitted = { routineEvents: 0, forcedDecisions: 0 };
  let turn: unknown,
    events = 0;
  for (const row of rows) {
    const e = row.value as Row;
    if (row.tag === "INITIAL") {
      const hand = list(e.own_opening_hand?.card).map((c) => {
        identities.set(c.instance_id, card(c.card_code));
        return `${card(c.card_code)} (${line(c.instance_id)})`;
      });
      body.push(
        `Opening hand: ${hand.join(", ") || "unknown"}.`,
        `Initial public state: ${describe(e.public_state)}.`,
      );
      continue;
    }
    if (row.tag === "SIDEBOARD") {
      const exchanges = list(e.exchanges?.exchange);
      body.push(
        "\n## Sideboarding",
        e.status === "not_applicable"
          ? "Pre-side game: no sideboarding applies."
          : e.carried_forward
            ? `Game 4: configuration carried forward from sideboarding before game ${line(e.applied_before_game)}; no new exchange.`
            : `Game 3: sideboarding applied before game ${line(e.applied_before_game)}.`,
      );
      body.push(
        `Exchanges: ${!e.exchanges || !Array.isArray(e.exchanges.exchange) ? "unavailable in recorded transaction" : exchanges.length ? exchanges.map((x) => `${line(x.quantity ?? x.copies ?? 1)} × ${card(x.card_code ?? x.code)}: ${line(x.from ?? x.from_section)} → ${line(x.to ?? x.to_section)}${x.reason ? ` (${line(x.reason)})` : ""}`).join("; ") : "none"}.`,
      );
      if (e.reason?.explanation)
        body.push(`Rationale: ${line(e.reason.explanation)}`);
      continue;
    }
    if (row.tag !== "EVENT") continue;
    events++;
    if (e.before_initial === true) {
      omitted.routineEvents++;
      continue;
    }
    if (e.kind === "decision") {
      const prompt = e.prompt ?? {},
        choices = list(prompt.choices?.choice),
        chosen = e.selected_choice_ids?.choice_id ?? [];
      decisions.push(e.decision_id);
      choiceMap[e.decision_id] = {
        offered: choices.map((c) => c.id),
        chosen: [...chosen],
        options: Object.fromEntries(choices.map((c, i) => [`O${i + 1}`, c.id])),
      };
      if (forced(prompt, choices, chosen)) {
        omitted.forcedDecisions++;
        continue;
      }
      if (turn !== e.turn) {
        turn = e.turn;
        body.push(turn === 0 ? "\n## Setup" : `\n## Turn ${line(turn)}`);
      }
      const bounds =
        prompt.minimum === 1 && prompt.maximum === 1
          ? ""
          : ` choose ${line(prompt.minimum)}–${line(prompt.maximum)}`;
      const constraints =
        prompt.constraints?.required_total != null ||
        prompt.constraints?.sum_mode != null
          ? `; constraints ${describe(prompt.constraints)}`
          : "";
      const choicesText = choices
        .map(
          (c, i) =>
            `${chosen.includes(c.id) ? "*" : ""}O${i + 1} ${line(c.label ?? c.action ?? "unknown option")}${c.card_instance_id ? ` (${line(c.card_instance_id)})` : ""}${c.allocation_maximum != null ? ` allocation ≤${line(c.allocation_maximum)}` : ""}${c.card?.contribution != null ? ` contribution ${line(c.card.contribution)}/${line(c.card.alternative_contribution)}` : ""}`,
        )
        .join(" | ");
      body.push(
        `- ${line(e.phase)} ${line(e.decision_id)}: ${choicesText || "no offered choices"}${chosen.length ? "" : "; chosen none"}${bounds}${prompt.cancelable ? "; may cancel" : ""}${prompt.ordered ? "; ordered" : ""}${constraints}${prompt.message ? `; ${line(prompt.message)}` : ""}`,
      );
      if (
        e.reason?.explanation &&
        !/^Rank .+ using .+ \(score .+\)\.$/.test(e.reason.explanation)
      )
        body.push(`  Rationale: ${line(e.reason.explanation)}`);
      continue;
    }
    const changes = list(e.changes?.change),
      details = list(e.details?.item);
    const meaningfulChanges: string[] = [];
    for (const c of changes) {
      if (c.instance_id && c.to?.code != null)
        identities.set(c.instance_id, card(c.to.code));
      if (
        c.type === "card_changed" ||
        c.type === "card_entered_observation" ||
        c.type === "card_left_observation"
      ) {
        const to = c.to ?? {},
          from = c.from ?? {};
        const keys = Object.keys(to).filter(
          (k) =>
            ![
              "sequence",
              "display_order",
              "instance_id",
              "code",
              "owner",
              "face_up",
            ].includes(k) &&
            !(
              c.type === "card_entered_observation" &&
              ["counters", "overlay_materials"].includes(k) &&
              !list(to[k]?.item).length
            ),
        );
        if (c.type === "card_changed" && !keys.length) continue;
        meaningfulChanges.push(
          `${identities.get(c.instance_id) ?? "unknown card"} (${line(c.instance_id)}): ${from.location ? `${line(from.controller)} ${line(from.location)} → ` : ""}${c.to === null ? "no longer observed" : describe(Object.fromEntries(keys.map((k) => [k, to[k]])))}`,
        );
      } else if (["life_points", "hand_count", "deck_count"].includes(c.type)) {
        meaningfulChanges.push(
          `${line(c.player)} ${c.type === "life_points" ? "LP" : c.type === "hand_count" ? "hand" : "deck"}=${line(c.value)}`,
        );
      } else if (c.type !== "chain_changed")
        meaningfulChanges.push(describe(c));
      else {
        const chains = list(c.chain?.item).filter(
          (x) => x.phase === "pending" || x.outcome !== "normal",
        );
        if (chains.length)
          meaningfulChanges.push(
            chains
              .map(
                (x) =>
                  `${line(x.controller)} activates ${x.source_identity_visible === false ? "unknown card" : (x.label ?? card(x.source_card))}${x.source_instance_id ? ` (${line(x.source_instance_id)})` : ""}${x.outcome !== "normal" ? `: ${line(x.outcome)}` : ""}${
                    list(x.targets?.item).length
                      ? ` targets ${list(x.targets.item)
                          .map((t) =>
                            t.identity_visible === false
                              ? "unknown card"
                              : `${card(t.card)} (${line(t.instance_id)})`,
                          )
                          .join(", ")}`
                      : ""
                  }`,
              )
              .join("; "),
          );
      }
    }
    const detailText = (d: Row): string => {
      const who =
        d.player === "a"
          ? "target"
          : d.player === "b"
            ? "opponent"
            : line(d.player);
      const ref = (x: Row | null) =>
        !x
          ? "direct attack"
          : `${x.code != null ? card(x.code) : (identities.get(x.instance_id) ?? "unknown card")}${x.instance_id ? ` (${line(x.instance_id)})` : ""}`;
      switch (d.type) {
        case "damage":
          return `${who} takes ${line(d.amount)} damage`;
        case "recover":
          return `${who} recovers ${line(d.amount)} LP`;
        case "life_point_cost":
          return `${who} pays ${line(d.amount)} LP`;
        case "cardDrawn":
          return `${who} draws ${line(d.count)}`;
        case "own_draw":
          return `drawn: ${list(d.cards?.item).map(card).join(", ")}`;
        case "summon":
        case "specialSummon":
        case "set":
          return `${who} ${line(d.type)} ${card(d.card)}`;
        case "effect_resolved":
          return `${card(d.card_code)} resolves: ${line(d.outcome)}`;
        case "combat_participants":
          return `${ref(d.card)} attacks ${ref(d.target)}`;
        case "observed_targets":
          return `targets: ${list(d.cards?.item).map(ref).join(", ")}`;
        case "target_relation":
          return `${ref(d.card)} targets ${ref(d.target)}`;
        case "terminal_result":
          return `${who} wins (engine reason ${line(d.reason)})`;
        default:
          return describe(d);
      }
    };
    const usefulDetails = details.filter(
      (d) =>
        ![
          "hint",
          "phaseChanged",
          "turnStarted",
          "chain_progress",
          "chainChanged",
          "cardMoved",
          "cardsShuffled",
        ].includes(d.type),
    );
    if (!meaningfulChanges.length && !usefulDetails.length) {
      omitted.routineEvents++;
      continue;
    }
    if (turn !== e.turn) {
      turn = e.turn;
      body.push(turn === 0 ? "\n## Setup" : `\n## Turn ${line(turn)}`);
    }
    body.push(
      `- ${line(e.phase)} e${line(e.sequence)} ${line(e.event)}${e.actor ? ` (${line(e.actor)})` : ""}: ${[...meaningfulChanges, ...usefulDetails.map(detailText)].join(" / ")}`,
    );
  }
  const rendered = [
    `# Loss ${line(game.game_id)}`,
    "",
    "Perspective: target a; b is opponent. Unknown identities remain unknown. No inference of hidden cards.",
    `Result: loss after ${line(result.turns)} turns; engine reason ${line(result.engine_reason)}.`,
    `Review projection: ${omitted.forcedDecisions} mandatory single-response prompts and ${omitted.routineEvents} routine notifications collapsed; visible consequences retained. Asterisk marks chosen option; O1/O2 aliases resolve to exact IDs in the companion choice map. Exact decision IDs reference the authoritative loss log; no chronology truncation.`,
    "",
    ...body,
    "",
    `Final outcome: loss (${line(result.engine_reason)}).`,
    "",
  ].join("\n");
  return {
    version: 1 as const,
    text: rendered,
    decisions,
    sourceSha256: digest(text),
    inputBytes: Buffer.byteLength(text),
    renderedBytes: Buffer.byteLength(rendered),
    events,
    omitted,
    choiceMap,
  };
}
