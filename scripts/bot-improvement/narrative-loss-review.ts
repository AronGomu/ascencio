import { reviewCardMetadata } from "./review-card-names.ts";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const phaseName = (phase: string) =>
  ({
    draw: "Draw",
    standby: "Standby",
    main1: "Main 1",
    main2: "Main 2",
    battleStart: "Battle",
    battle: "Battle",
    end: "End",
  })[phase] ?? phase;
const prose = (value: string): string =>
  value
    .replace(/\btarget\b/g, "Us")
    .replace(/\bopponent\b/g, "Opponent")
    .replace(
      /\ba (?=activates|LP|hand|deck|monster|spellTrap|graveyard)/g,
      "Us ",
    )
    .replace(
      /\bb (?=activates|LP|hand|deck|monster|spellTrap|graveyard)/g,
      "Opponent ",
    )
    .replace(/spellTrap/g, "spell/trap zone")
    .replace(/faceUpAttack/g, "face-up attack")
    .replace(/faceDownAttack/g, "face-down")
    .replace(/faceUpDefense/g, "face-up defense")
    .replace(/faceDownDefense/g, "face-down defense")
    .replace(/specialSummon/g, "special summons")
    .replace(/\bset\b(?= unknown card| [A-Z])/g, "sets")
    .replace(/\bsummon\b/g, "summons")
    .replace(/attacks direct attack/g, "attacks directly")
    .replace(/Us draws/g, "We draw")
    .replace(/Us activates/g, "We activate")
    .replace(/Us sets/g, "We set")
    .replace(/Us special summons/g, "We special summon")
    .replace(/Us summons/g, "We summon")
    .replace(/Us takes/g, "We take")
    .replace(/Us pays/g, "We pay")
    .replace(/^targets:/, "Targets:")
    .replace(/resolves: normal/g, "resolves normally");
const who = (value: string) => (value === "a" ? "Us" : "Opponent");

/** Reformat a readable v1 Markdown loss. Never infer hidden identities or causality. */
export function narrativeLossReview(
  input: string,
  settings: {
    showPlacement?: boolean;
    cardTypes?: Readonly<Record<string, number>>;
    inventory?: {
      mainCount: number;
      extraCount: number;
      opponentExtraCount?: number;
      knownExtra?: {
        name: string;
        copies: number;
        positionFromBottom?: number;
      }[];
    };
  } = {},
) {
  if (
    !/^# Loss [^\n]+\n/.test(input) ||
    !input.includes("Perspective: target a; b is opponent.")
  )
    throw new Error("Expected target-a readable loss Markdown");
  const lines = input.split(/\r?\n/);
  const match = lines[0]!.match(/^# Loss match-(\d+)-game-(\d+)$/);
  const title = match ? `M${match[1]}-G${match[2]}` : lines[0]!.slice(7);
  const output = [`# ${title}`, ""];
  const decisions: string[] = [];
  let pendingChainLinks = 0;
  const chainCards: string[] = [];
  const decisionContexts = new Map<string, string>();
  let paragraphs: string[] = [],
    passes: string[] = [],
    phase = "",
    lastAttack = "",
    won = false;
  const board = new Map<
    string,
    { name: string; controller: string; location: string; position: string }
  >();
  const zones = new Map<
    string,
    { name: string; player: string; location: string }
  >();
  const decks: Record<string, string> = {};
  if (settings.inventory) decks.a = String(settings.inventory.mainCount);
  const counts = (names: string[]) => {
    const grouped = new Map<string, number>();
    for (const name of names) grouped.set(name, (grouped.get(name) ?? 0) + 1);
    return (
      [...grouped].map(([name, n]) => `${n} ${name}`).join(", ") || "Empty"
    );
  };
  let mergedPasses = 0,
    duplicateEvents = 0;
  const lp: Record<string, string> = {},
    hands: Record<string, string> = {};
  const flush = () => {
    if (paragraphs.length) output.push(paragraphs.join(" "), "");
    paragraphs = [];
  };
  const state = () =>
    ["a", "b"]
      .map(
        (p) =>
          `${who(p)}: ${lp[p] ?? "unknown"} LP${hands[p] ? `, ${hands[p]} cards in hand` : ""}`,
      )
      .join("; ");
  const endTurn = () => {
    flush();
    passes = [];
    output.push("### AOT Game State", "");
    for (const player of ["b", "a"]) {
      const cards = [...zones.values()].filter((c) => c.player === player);
      const field = [...board.values()].filter((c) => c.controller === player);
      const knownHand = cards
        .filter((c) => c.location === "hand")
        .map((c) => c.name);
      const handCount = Number(hands[player]);
      const hand =
        player === "a"
          ? counts(knownHand)
          : handCount === 0
            ? "Empty"
            : `${hands[player] ?? "XX"} unknown`;
      output.push(
        `${player === "a" ? "Me" : "Opponent"} ${lp[player] ?? "XX"} LP:`,
        `- Hand: ${hand}`,
        `- Field: ${counts(field.map((c) => (c.name === "unknown card" ? (c.location === "monster" ? "set monster" : "unknown set S/T") : `${c.name}${c.position ? ` (${prose(c.position)})` : ""}`)))}`,
        `- Grave: ${counts(cards.filter((c) => c.location === "graveyard").map((c) => c.name))}`,
        `- Banished: ${counts(cards.filter((c) => ["banished", "removed"].includes(c.location)).map((c) => c.name))}`,
        `- Deck: ${decks[player] != null ? `${decks[player]} unknown` : "count unavailable"}`,

        "",
      );
    }
  };
  const sentence = (value: string) => {
    const text = prose(value).trim();
    if (!text) return;
    if (paragraphs.at(-1) === `${text}.`) {
      duplicateEvents++;
      return;
    }
    paragraphs.push(/[.!?]$/.test(text) ? text : `${text}.`);
  };
  for (const line of lines.slice(1)) {
    if (
      !line.trim() ||
      /^Game \d+: configuration carried forward from sideboarding/.test(line) ||
      /^(Perspective:|Result:|Review projection:|Final outcome:)/.test(line)
    )
      continue;
    if (line.startsWith("## Turn ")) {
      if (phase) endTurn();
      else flush();
      output.push(line, "");
      phase = "start";
      lastAttack = "";
      continue;
    }
    if (line.startsWith("Initial public state:")) {
      for (const p of ["a", "b"]) {
        const value = line.match(new RegExp(`\\b${p}: (\\d+)`))?.[1];
        if (value) lp[p] = value;
      }
      const count = line.match(/opponent hand count: (\d+)/)?.[1];
      if (count) hands.b = count;
      const deck = line.match(/opponent deck count: (\d+)/)?.[1];
      if (deck) decks.b = deck;
      continue;
    }
    if (line.startsWith("Opening hand:")) {
      hands.a = String((line.match(/\(card-\d+\)/g) ?? []).length);
      if (settings.inventory)
        decks.a = String(settings.inventory.mainCount - Number(hands.a));
      for (const card of line.matchAll(/([^,:]+) \((card-\d+)\)/g))
        zones.set(card[2]!, {
          name: card[1]!.trim(),
          player: "a",
          location: "hand",
        });
      output.push(
        "",
        "## Opening Hand",
        "",
        counts(
          [...zones.values()]
            .filter((c) => c.player === "a" && c.location === "hand")
            .map((c) => c.name),
        ) + ".",
        "",
      );
      continue;
    }
    const decision = line.match(/^- (\S+) (\S+-decision-\d+): (.*)$/);
    if (decision) {
      const [, at, id, content] = decision as [string, string, string, string];
      decisions.push(id);
      if (
        chainCards.at(-1) === "Delinquent Duo" &&
        !content.includes("Chain ") &&
        !content.includes("Pass")
      )
        decisionContexts.set(id, "discard for Delinquent Duo");
      if (content === "*O1 Pass; may cancel") {
        passes.push(id);
        mergedPasses++;
        continue;
      }
      const placementOptions = content.split(" | ");
      if (
        !settings.showPlacement &&
        placementOptions.every((option) =>
          /^\*?O\d+ (?:Opponent|My|Own|Your) (?:spellTrap|monster) [1-5](?:;.*)?$/.test(
            option,
          ),
        )
      )
        continue;
      if (at !== phase) {
        flush();
        output.push(`${phaseName(at)}. `, "");
        phase = at;
      }
      flush();
      const split = content.search(/;| choose \d/);
      const options = (split < 0 ? content : content.slice(0, split))
        .split(" | ")
        .map((option) =>
          pendingChainLinks === 0
            ? option.replace(/^(\*?O\d+ )Chain /, "$1Play ")
            : option,
        );
      const suffix =
        split < 0 ? "" : content.slice(split).replace(/^; ?/, "").trim();
      const chosen = options
        .filter((o) => o.startsWith("*"))
        .map((o) => o.slice(1));
      const alternatives = options.filter((o) => !o.startsWith("*"));
      output.push(
        `**${phaseName(at)} — decision ${id}**`,
        `Chosen: ${chosen.join("; ") || "none"}. Alternatives: ${alternatives.join("; ") || "none listed"}.${suffix ? ` Conditions: ${suffix}.` : ""}`,
        "",
      );
      continue;
    }
    const event = line.match(/^- (\S+) e\d+ (\S+?)(?: \([ab]\))?: (.*)$/);
    if (!event) {
      flush();
      output.push(line);
      continue;
    }
    const [, at, kind, content] = event as [string, string, string, string];
    if (kind === "chaining") {
      pendingChainLinks++;
      chainCards.push(
        content.match(/activates (.*?) \(card-/)?.[1] ?? "unknown effect",
      );
    }
    if (kind === "chain_solved") {
      pendingChainLinks = Math.max(0, pendingChainLinks - 1);
      chainCards.pop();
    }
    if (at !== phase) {
      flush();
      paragraphs.push(`**${phaseName(at)}.**`);
      phase = at;
    }
    for (const m of content.matchAll(/\b([ab]) (LP|hand)=(\d+)/g))
      (m[2] === "LP" ? lp : hands)[m[1]!] = m[3]!;
    for (const m of content.matchAll(/\b([ab]) deck=(\d+)/g))
      decks[m[1]!] = m[2]!;
    const pieces = content.split(" / ");
    if (kind === "win") {
      if (!won) sentence("Opponent wins");
      else duplicateEvents++;
      won = true;
      continue;
    }
    if (kind === "attack" || kind === "battle") {
      const attack = pieces.find((p) => p.includes(" attacks "));
      if (attack) {
        if (
          kind === "battle" &&
          lastAttack &&
          (attack === lastAttack ||
            attack === lastAttack.replace("direct attack", "unknown card"))
        ) {
          duplicateEvents++;
          continue;
        }
        sentence(attack);
        lastAttack = attack;
        continue;
      }
    }
    if (["damage", "pay_life_points", "recover"].includes(kind)) {
      sentence(`${pieces.at(-1)} (${state()})`);
      continue;
    }
    if (kind === "draw") {
      const drawn = pieces.find((p) => p.startsWith("drawn: "));
      const count = pieces.find((p) => / draws \d+/.test(p));
      if (count) {
        sentence(`${count}${drawn ? `: ${drawn.slice(7)}` : ""}`);
        continue;
      }
    }
    for (const piece of pieces) {
      if (/^[ab] (hand|deck)=/.test(piece)) continue;
      // Retain unknown event details verbatim rather than silently dropping evidence.
      const move = piece.match(/^(.*?) \((card-\d+)\): (.*)$/);
      if (move) {
        const [, name, id, change] = move as [string, string, string, string];
        const from = change.match(/^([ab]) (\w+) →/);
        const controller = change.match(/controller: ([ab])/)?.[1] ?? from?.[1];
        const destination = change.match(/location: (\w+)/)?.[1];
        const position = change.match(/position: (\w+)/)?.[1];
        const priorZone = zones.get(id);
        if (destination)
          zones.set(id, {
            name,
            player: controller ?? priorZone?.player ?? "unknown",
            location: destination,
          });
        else if (from && !position && !change.includes("controller:"))
          zones.delete(id);
        const previous = board.get(id);
        const location = destination ?? from?.[2] ?? previous?.location;
        if (location === "monster" || location === "spellTrap") {
          if (
            from &&
            !destination &&
            !position &&
            !change.includes("controller:")
          )
            board.delete(id);
          else
            board.set(id, {
              name,
              controller: controller ?? previous?.controller ?? "unknown",
              location,
              position: position ?? previous?.position ?? "",
            });
        } else if (destination) board.delete(id);
        const rest = change
          .replace(/^[ab] \w+ →\s*/, "")
          .replace(/(?:controller: [ab]|location: \w+|position: \w+);?\s*/g, "")
          .trim();
        let action: string;
        if (destination)
          action = `${from ? `moves from ${who(from[1]!)} ${from[2]} to` : "is now in"} ${controller ? who(controller) + " " : ""}${destination}${position ? ` (${position})` : ""}`;
        else if (position) action = `changes to ${position}`;
        else if (change.includes("controller:"))
          action = `changes control to ${who(controller!)}`;
        else if (from && !rest)
          action = `leaves ${who(from[1]!)} ${from[2]} (destination not recorded)`;
        else action = change;
        sentence(
          `${name} (${id}) ${action}${rest && action !== change ? `; ${rest}` : ""}`,
        );
      } else if (
        ["set", "summoning", "special_summoning"].includes(kind) &&
        paragraphs.at(-1)?.includes("(card-") &&
        (paragraphs.at(-1)?.includes(" is now in ") ||
          paragraphs.at(-1)?.includes(" moves from "))
      ) {
        const previous = paragraphs.at(-1)!;
        const name = piece.replace(
          /^(target|opponent) (set|summon|specialSummon) /,
          "",
        );
        if (previous.startsWith(`${name} (`)) {
          const ref = previous.match(/^(.*? \(card-\d+\))/)?.[1];
          const actor = piece.startsWith("target ") ? "We" : "Opponent";
          const verb =
            kind === "set"
              ? "set"
              : kind === "summoning"
                ? "summon"
                : "special summon";
          const zone = previous.match(/(?:in|to) (?:Us|Opponent) (.*)\.$/)?.[1];
          paragraphs[paragraphs.length - 1] =
            `${actor} ${verb}${actor === "Opponent" ? "s" : ""} ${ref}${zone ? ` in the ${zone}` : ""}.`;
          duplicateEvents++;
        } else sentence(piece);
      } else if (
        /^type: positionChanged;/.test(piece) &&
        pieces.some((part) => /\(card-\d+\):.*position:/.test(part))
      ) {
        duplicateEvents++;
      } else sentence(piece);
    }
  }
  endTurn();
  let text = output.join("\n").replaceAll("**", "").trim() + "\n";
  // Only combine the fully observed, uninterrupted Duo sequence. Keep its
  // decision note after the action so alternatives and exact IDs remain available.
  text = text.replace(
    /Opponent activates Delinquent Duo \(card-\d+\). Opponent pays (\d+) LP \([^\n]*?\). Targets: ([^\n]+?) \(card-\d+\). \2 \(card-\d+\) moves from Us hand to Us graveyard \(face-up attack\).\n\n([^\n]+decision [^\n]+)\n(Chosen: O\d+ ([^\n]+?) \(card-\d+\)\. Alternatives: [^\n]+)\n\n\5 \(card-\d+\) moves from Us hand to Us graveyard \(face-up attack\). Delinquent Duo resolves normally. Delinquent Duo \(card-\d+\) moves from Opponent spell\/trap zone to Opponent graveyard\./g,
    (_all, cost, discarded, decision, choices, chosen) =>
      `Opponent pays ${cost} LP to activate Delinquent Duo. ${discarded} is discarded from my hand. I discard ${chosen}.\n\n${decision}\n${choices}\n\n`,
  );
  // Group consecutive concealed sets only; intervening choices/actions break a group.
  text = text.replace(
    /(?:Opponent sets unknown card \(card-\d+\) in the (?:monster \(face-down defense\)|spell\/trap zone \(face-down\))\.\s*)+/g,
    (sets) => {
      const monsters = (sets.match(/in the monster/g) ?? []).length;
      const backrow = (sets.match(/in the spell\/trap zone/g) ?? []).length;
      return (
        [
          monsters
            ? `Opponent sets ${monsters} monster${monsters === 1 ? "" : "s"}.`
            : "",
          backrow
            ? `Opponent sets ${backrow} S/T card${backrow === 1 ? "" : "s"}.`
            : "",
        ]
          .filter(Boolean)
          .join("\n- ") + "\n\n"
      );
    },
  );
  text = text.replace(
    /^(Draw|Standby|Main 1|Main 2|Battle|End)\. /gm,
    "$1:\n- ",
  );
  text = text.replace(
    /Delinquent Duo \(card-\d+\) is now in Opponent spell\/trap zone \(face-up attack\). (?=Opponent pays \d+ LP to activate Delinquent Duo)/g,
    "",
  );
  text = text.replace(/^ +(?=Opponent sets)/gm, "- ");
  let displayedDecision = 0;
  const decisionMap: Record<string, string> = {};
  text = text.replace(
    /(?:Main 1|Main 2|Draw|Standby|Battle|End) — decision \S+-decision-(\d+)\nChosen: ([^\n]+)/g,
    (_all, number, choices: string) => {
      const parts = choices.replace(/\bO\d+ /g, "").split(". Alternatives: ");
      displayedDecision++;
      const exact = decisions.find((id) => id.endsWith(`-decision-${number}`));
      if (exact) decisionMap[String(displayedDecision)] = exact;
      const chained = parts[0]
        ?.match(/^(?:Chain|Play) ([^(]+?)(?: \(|$)/)?.[1]
        ?.trim();
      const cardType = chained ? settings.cardTypes?.[chained] : undefined;
      const speed =
        cardType == null
          ? undefined
          : (cardType & 0x4) !== 0
            ? (cardType & 0x100000) !== 0
              ? 3
              : 2
            : (cardType & 0x2) !== 0
              ? (cardType & 0x10000) !== 0
                ? 2
                : 1
              : undefined;
      const tail = parts.slice(1).join(". Alternatives: ");
      const [alternatives = "none listed", conditions] =
        tail.split(". Conditions: ");
      const context = exact ? decisionContexts.get(exact) : undefined;
      const prompt =
        (context ? context[0]!.toUpperCase() + context.slice(1) : undefined) ??
        (parts[0]?.startsWith("Chain ")
          ? "Response to play"
          : "Action to play");
      const conditionText =
        [conditions?.replace(/\.$/, "")].filter(Boolean).join("; ") || "None";
      return `Decision ${displayedDecision} :\n${prompt} : ${parts[0]}${speed ? ` (Spell Speed ${speed})` : ""}.\nAlternatives : ${alternatives.replace(/\.$/, "").replace(/; /g, ", ")}.\nConditions : ${conditionText}.`;
    },
  );
  text = text
    .replace(/ \(card-\d+\)/g, "")
    .replace(/(\b(?:We draw|Opponent draws) \d+): /g, "$1 ");
  text = text.replace(/Opponent spellTrap ([1-5])/g, "My S/T $1");
  text = text.replace(
    /^(Draw|Standby|Main 1|Main 2|Battle|End)(?::|\. )\n/gm,
    "### $1\n\n",
  );
  // Gameplay paragraphs are separated into plays; state lists retain bullets.
  text = text
    .split(/(?=^### AOT Game State)/m)
    .map((section, index) => {
      const nextTurn = section.indexOf("\n## Turn ");
      const start = index === 0 ? 0 : nextTurn < 0 ? section.length : nextTurn;
      return (
        section.slice(0, start) +
        section
          .slice(start)
          .replace(/^- /gm, "\n")
          .split("\n")
          .map((line) =>
            /^(Decision |Alternatives :|Conditions :|.* : )/.test(line) ||
            !line.includes(". ")
              ? line
              : line.replace(/\. (?=[A-Z])/g, ".\n\n"),
          )
          .join("\n")
      );
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n");
  text = text.replace(/(Decision \d+ :)\nAction to play : /g, "$1 ");
  text = text.replace(
    /([^\n]+?) moves from Us hand to Us spell\/trap zone \(face-up attack\)\.\n\nWe activate \1\./g,
    "Activate $1.",
  );
  text = text.replace(
    /([^\n]+?) changes to face-up attack\.\n\nWe activate \1\./g,
    "Activate $1 from S/T zone.",
  );
  text = text.replace(/We activate /g, "Activate ");
  text = text.replace(
    /(?:We special summon Sheep Token in the monster \(face-up defense\)\.\s*)+/g,
    (summons) => {
      const count = (summons.match(/We special summon/g) ?? []).length;
      return `We Special Summon ${count} Sheep Token Face-up Defense.\n\n`;
    },
  );
  const persistentExceptions = new Set(["Swords of Revealing Light"]);
  const transientCard = (name: string) => {
    const type = settings.cardTypes?.[name];
    // Spell/Trap, excluding Continuous, Equip and Field subtypes.
    // Some Normal cards persist through their effect rather than their subtype.
    return (
      type != null &&
      (type & (0x2 | 0x4)) !== 0 &&
      (type & (0x20000 | 0x40000 | 0x80000)) === 0 &&
      !persistentExceptions.has(name)
    );
  };
  text = text.replace(
    /^([^\n]+) resolves normally\.\n\n\1 moves from (Us|Opponent) spell\/trap zone to \2 graveyard\.\n*/gm,
    (all, card: string) => (transientCard(card) ? "" : all),
  );
  text = text.replace(/^[^\n]+ resolves normally\.\n*/gm, "");
  text = text.replaceAll("spell/trap zone", "S/T");
  return {
    text,
    filename: `${title}.md`,
    decisionMap,
    decisions,
    mergedPasses,
    duplicateEvents,
    inputBytes: Buffer.byteLength(input),
    outputBytes: Buffer.byteLength(text),
    sourceSha256: createHash("sha256").update(input).digest("hex"),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath)
    throw new Error(
      "Usage: node scripts/bot-improvement/narrative-loss-review.ts INPUT.md OUTPUT.md [--show-placement] [--inventory FILE.json] [--fixture DIRECTORY]",
    );
  if (path.resolve(inputPath) === path.resolve(outputPath))
    throw new Error("Output must differ from input");
  const start = performance.now();
  const input = await readFile(inputPath, "utf8");
  const loaded = performance.now();
  const result = narrativeLossReview(input, {
    showPlacement: process.argv.includes("--show-placement"),
    ...(process.argv.includes("--fixture")
      ? {
          cardTypes: (
            await reviewCardMetadata(
              process.argv[process.argv.indexOf("--fixture") + 1]!,
            )
          ).typesByName,
        }
      : {}),
    ...(process.argv.includes("--inventory")
      ? {
          inventory: JSON.parse(
            await readFile(
              process.argv[process.argv.indexOf("--inventory") + 1]!,
              "utf8",
            ),
          ),
        }
      : {}),
  });
  const rendered = performance.now();
  await writeFile(outputPath, result.text, { flag: "wx" });
  const written = performance.now();
  const metrics = { ...result, text: undefined };
  console.log(
    JSON.stringify(
      {
        input: inputPath,
        output: outputPath,
        ...metrics,
        timingsMs: {
          read: loaded - start,
          render: rendered - loaded,
          write: written - rendered,
          total: written - start,
        },
      },
      null,
      2,
    ),
  );
}
