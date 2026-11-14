/** Native v2 evidence compatible with the existing Rust writer and replay reader. */
import { encodeLogRecord, parseGameLog, parseMatchLog } from "./game-log.ts";
import { digest } from "./session-fixtures.ts";
import type { Job, Frame } from "./typescript-match-worker.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
type Obj = Record<string, unknown>;
export function canonicalTree(v: unknown, evidence = false): unknown {
  if (Array.isArray(v)) return v.map((x) => canonicalTree(x, evidence));
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .filter((k) => {
          const x = (v as Obj)[k];
          return (
            !(Array.isArray(x) && !x.length) &&
            !(
              evidence &&
              (k.endsWith("_sha256") ||
                k.endsWith("_path") ||
                [
                  "bug_id",
                  "duration_ms",
                  "engine_time_ms",
                  "bot_time_ms",
                  "bridge_time_ms",
                  "captured_at",
                  "created_at",
                  "updated_at",
                  "path",
                ].includes(k))
            )
          );
        })
        .map((k) => [k, canonicalTree((v as Obj)[k], evidence)]),
    );
  return v === null ? null : String(v);
}
export const nativeIdentity = (v: unknown) =>
  digest(JSON.stringify(canonicalTree(v)));
export function gameEvidenceHash(
  id: unknown,
  configurations: unknown[],
  records: unknown[],
  failure: unknown = null,
) {
  return digest(
    JSON.stringify({
      encoding_version: "1",
      evidence: canonicalTree(
        { configurations, failure_category: failure, game_id: id, records },
        true,
      ),
    }),
  );
}
export function deckDocument(deck: ParsedDeck) {
  return Object.fromEntries(
    (["main", "extra", "side"] as const).map((section) => {
      const counts = new Map<string, number>();
      for (const code of deck[section])
        counts.set(String(code), (counts.get(String(code)) ?? 0) + 1);
      return [
        section,
        {
          card: [...counts]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([card_code, copies]) => ({ card_code, copies })),
        },
      ];
    }),
  );
}
export function compactLog(text: string) {
  const [header, ...lines] = text.trimEnd().split("\n"),
    fields: string[] = [],
    ids = new Map<string, number>();
  for (const line of lines)
    for (const field of line.split("\t").slice(1)) {
      const key = field.slice(0, field.indexOf("="));
      if (!ids.has(key)) {
        ids.set(key, fields.length);
        fields.push(key);
      }
    }
  return (
    header +
    "\n" +
    encodeLogRecord("FIELDS", fields) +
    lines
      .map((line) => {
        const [tag, ...values] = line.split("\t");
        return [
          tag,
          ...values.map((v) => {
            const i = v.indexOf("=");
            return `#${ids.get(v.slice(0, i))}=${v.slice(i + 1)}`;
          }),
        ].join("\t");
      })
      .join("\n") +
    "\n"
  );
}
export class NativeMatchEvidence {
  games: Obj[] = [];
  records: Obj[][] = [];
  sideboarding: Obj[] = [];
  readonly job: Job;
  readonly item: Job["matches"][number];
  readonly runtime: string;
  constructor(
    job: Job,
    item: Job["matches"][number],
    runtime = "typescript-native/v1",
  ) {
    this.runtime = runtime;
    this.job = job;
    this.item = item;
  }
  sideboard(frame: Frame) {
    const decisions = frame.decisions as {
      exchanges: {
        from: string;
        to: string;
        cardCode: number;
        copies: number;
        reason: { code: string; explanation: string };
      }[];
      reason: unknown;
    }[];
    const configurations = frame.configurations as unknown[],
      durations = frame.durations as number[];
    this.sideboarding = decisions.map((d, i) => ({
      status: "completed",
      observed_game_ids: {
        game_id: [1, 2].map((n) => `${this.item.match.id}-game-${n}`),
      },
      legal_constraints: {
        preserve_section_sizes: true,
        preserve_total_multiset: true,
      },
      exchanges: {
        exchange: d.exchanges.map((e) => ({
          from_section: e.from,
          to_section: e.to,
          card_code: e.cardCode,
          copies: e.copies,
          reason_code: e.reason.code,
          explanation: e.reason.explanation,
        })),
      },
      reason: d.reason,
      resulting_configuration: configurations[i],
      resulting_configuration_sha256: nativeIdentity(configurations[i]),
      duration_ms: durations[i],
      bug_id: null,
    }));
  }
  game(input: {
    index: number;
    initial: Obj[];
    events: Obj[][];
    terminal: Frame;
    decks: [ParsedDeck, ParsedDeck];
  }) {
    const { index, initial, events, terminal, decks } = input,
      n = index + 1,
      id = `${this.item.match.id}-game-${n}`,
      starter = index % 2 ? "b" : "a",
      stage = index < 2 ? "pre_side" : "post_side";
    const winner =
      terminal.winner === null
        ? null
        : (index % 2 ? ["b", "a"] : ["a", "b"])[terminal.winner];
    const configurations = decks.map((d) => nativeIdentity(deckDocument(d)));
    const records = [0, 1].map((i) => ({
      configuration_sha256: configurations[i],
      game_id: id,
      stage,
      starting_player: starter,
      status: "completed",
      initial: initial[i],
      timeline: { entry: events[i] },
      result: {
        outcome:
          winner === null
            ? "draw"
            : winner === (i === 0 ? "a" : "b")
              ? "win"
              : "loss",
        engine_reason: terminal.engine_reason,
        turns: terminal.turns,
        duration_ms: terminal.duration_ms ?? 0,
        engine_time_ms: terminal.engine_time_ms ?? 0,
        bot_time_ms: terminal.bot_time_ms ?? 0,
        evidence_sha256: null as string | null,
        bug_id: null,
      },
    }));
    const hash = gameEvidenceHash(id, configurations, records);
    for (const r of records) r.result.evidence_sha256 = hash;
    const game = {
      game_id: id,
      number: n,
      stage,
      starter,
      status: "completed",
      winner,
      draw: winner === null,
      evidence_sha256: hash,
      bug_id: null,
      cleanup: { handles_created: 1, handles_destroyed: 1 },
    };
    this.games.push(game);
    this.records.push(records);
    return this.serializeGame(index);
  }
  failure(
    index: number,
    decks: [ParsedDeck, ParsedDeck],
    category: string,
    message: string,
    partial?: { initial?: Obj[]; events?: Obj[][] },
    skipped = false,
  ) {
    const id = `${this.item.match.id}-game-${index + 1}`,
      stage = index < 2 ? "pre_side" : "post_side",
      starter = index % 2 ? "b" : "a",
      bug = skipped ? null : `${id}-${category}`;
    const records = [0, 1].map((i) => ({
      configuration_sha256: nativeIdentity(deckDocument(decks[i]!)),
      game_id: id,
      stage,
      starting_player: starter,
      status: skipped ? "skipped" : "failed",
      initial: partial?.initial?.[i] ?? null,
      timeline: { entry: partial?.events?.[i] ?? [] },
      result: skipped
        ? {}
        : {
            outcome: "failed",
            engine_reason: null,
            turns: 0,
            duration_ms: 0,
            evidence_sha256: null as string | null,
            bug_id: bug,
          },
    }));
    const hash = skipped
      ? null
      : gameEvidenceHash(
          id,
          records.map((r) => r.configuration_sha256),
          records,
          category,
        );
    if (!skipped) for (const r of records) r.result.evidence_sha256 = hash;
    this.games.push({
      game_id: id,
      number: index + 1,
      stage,
      starter,
      status: skipped ? "skipped" : "failed",
      winner: null,
      draw: null,
      evidence_sha256: hash,
      bug_id: bug,
      ...(skipped
        ? { skip_reason: category }
        : {
            failure_category: category,
            failure_message: message,
            cleanup: {
              handles_created: 0,
              handles_destroyed: 0,
              released_by_host_termination: true,
            },
          }),
    });
    this.records.push(records);
    return this.serializeGame(index);
  }
  serializeGame(index: number) {
    const game = this.games[index]!,
      records = this.records[index]! as {
        initial: unknown;
        timeline: { entry: unknown[] };
        result: unknown;
        [key: string]: unknown;
      }[];
    const id = String(game.game_id);
    let text = "ASCENCIO_GAME_LOG\t2\n" + encodeLogRecord("GAME", game);
    for (const [i, actor] of ["a", "b"].entries()) {
      const { initial: own, timeline, result, ...header } = records[i]!;
      const side =
        index < 2
          ? {
              status: "not_applicable",
              applies_now: false,
              carried_forward: false,
              exchanges: { exchange: [] },
            }
          : {
              ...(this.sideboarding[i] ?? {
                status: "skipped",
                skip_reason: "earlier_execution_failed",
              }),
              applies_now: index === 2,
              carried_forward: index === 3,
              applied_before_game: 3,
            };
      text +=
        encodeLogRecord("ACTOR", actor) +
        encodeLogRecord("RECORD", header) +
        encodeLogRecord("SIDEBOARD", side) +
        encodeLogRecord("INITIAL", own);
      for (const event of timeline.entry!)
        text += encodeLogRecord("EVENT", event);
      text +=
        encodeLogRecord("RESULT", result) + encodeLogRecord("END_ACTOR", actor);
    }
    text += encodeLogRecord("END_GAME", id);
    return compactLog(text);
  }
  match() {
    const { job, item } = this,
      id = item.match.id;
    const wins = (actor: string) =>
      this.games.filter((g) => g.winner === actor).length;
    const side = {
      status: this.sideboarding.length
        ? String(this.sideboarding[0]!.status)
        : "skipped",
      a_configuration_sha256:
        this.sideboarding[0]?.resulting_configuration_sha256 ?? null,
      b_configuration_sha256:
        this.sideboarding[1]?.resulting_configuration_sha256 ?? null,
      bug_id: null,
    };
    const record = {
      run_id: job.identity,
      match_id: id,
      status: this.games.every((g) => g.status === "completed")
        ? "completed"
        : "incomplete",
      sideboarding: side,
      result: {
        a_wins: wins("a"),
        b_wins: wins("b"),
        draws: this.games.filter((g) => g.draw).length,
        outcome: !this.games.every((g) => g.status === "completed")
          ? null
          : wins("a") > wins("b")
            ? "a"
            : wins("b") > wins("a")
              ? "b"
              : "tie",
      },
    };
    const manifest = {
      run_id: job.identity,
      created_at: new Date().toISOString(),
      application_revision: "typescript-native/v1",
      runtime_sha256: this.runtime,
      runtime: {},
      engine: { sha256: job.engineHash },
      content: { sha256: job.fixtureIdentity },
      rules: { profile: job.profile },
      deck: deckDocument(item.decks[0]!),
      bots: {
        a: { artifact_sha256: item.identities[0] },
        b: { artifact_sha256: item.identities[1] },
      },
      configuration: { batch: { matches: 1 } },
      identity_sha256: nativeIdentity([job.identity, item, this.runtime]),
    };
    let text =
      "ASCENCIO_MATCH_LOG\t2\n" +
      encodeLogRecord("MATCH", record) +
      encodeLogRecord("MANIFEST", manifest) +
      encodeLogRecord("FIXTURE", item);
    for (const [i, a] of ["a", "b"].entries())
      text += encodeLogRecord(`REPORT_${a.toUpperCase()}`, {
        run_id: job.identity,
        match_id: id,
        perspective: a,
        bot_artifact_sha256: item.identities[i],
        sideboarding: this.sideboarding[i] ?? {
          status: "skipped",
          skip_reason: "pre_side_not_completed",
        },
      });
    for (const [i, g] of this.games.entries())
      text += encodeLogRecord("GAME_REF", {
        number: i + 1,
        path: `games/game-${i + 1}/game.log`,
        id: g.game_id,
        status: g.status,
        winner: g.winner,
        draw: g.draw,
        checkpoint_game: g,
      });
    return compactLog(text + encodeLogRecord("END_MATCH", id));
  }
}
export function verifyNativeGame(text: string) {
  const g = parseGameLog(text),
    configs = g.actors.map((a) => a.configuration_sha256);
  const status = g.neutral.status;
  if (!["completed", "failed", "skipped"].includes(status))
    throw Error("Invalid native game status");
  for (const [i, a] of g.actors.entries()) {
    const outcome =
      status === "failed"
        ? "failed"
        : g.neutral.winner === null
          ? "draw"
          : g.neutral.winner === (i === 0 ? "a" : "b")
            ? "win"
            : "loss";
    if (
      a.game_id !== g.neutral.game_id ||
      a.status !== status ||
      a.stage !== g.neutral.stage ||
      a.starting_player !== g.neutral.starter ||
      (status !== "skipped" &&
        (a.result?.outcome !== outcome ||
          a.result?.evidence_sha256 !== g.neutral.evidence_sha256))
    )
      throw Error("Native perspective/result mismatch");
  }
  if (
    status === "skipped"
      ? g.neutral.evidence_sha256 !== null
      : g.neutral.evidence_sha256 !==
        gameEvidenceHash(
          g.neutral.game_id,
          configs,
          g.actors,
          g.neutral.failure_category ?? null,
        )
  )
    throw Error("Native game evidence hash mismatch");
  return g;
}
export function verifyNativeMatch(
  text: string,
  job: Job,
  item: Job["matches"][number],
) {
  const m = parseMatchLog(text);
  if (
    m.match.match_id !== item.match.id ||
    m.match.run_id !== job.identity ||
    JSON.stringify(canonicalTree(m.fixture)) !==
      JSON.stringify(canonicalTree(item)) ||
    m.refs.length !== 4
  )
    throw Error("Native match inputs changed");
  return m;
}
