export type GameOutcome = "win" | "loss" | "draw" | "failed" | "skipped";
export interface MatchObservation {
  id: string;
  slot: string;
  games: GameOutcome[] | null;
  sideboarding?: string;
  unavailable?: string;
}
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const ratio = (n: number, d: number) => (d ? n / d : null);
const complete = (m: MatchObservation) =>
  m.games?.length === 4 &&
  m.games.every((g) => ["win", "loss", "draw"].includes(g));
const wins = (games: GameOutcome[]) => games.filter((g) => g === "win").length;
const score = (games: GameOutcome[]) =>
  wins(games) + games.filter((g) => g === "draw").length / 2;

/** Paired sample means; one independent observation per four-game match. */
export function pairedEstimate(differences: number[]) {
  const n = differences.length;
  const estimate = ratio(sum(differences), n);
  const standardError =
    n < 2
      ? null
      : Math.sqrt(
          sum(differences.map((d) => (d - estimate!) ** 2)) / (n * (n - 1)),
        );
  return {
    clusters: n,
    estimate,
    standardError,
    interval95:
      standardError === null
        ? null
        : [estimate! - 1.96 * standardError, estimate! + 1.96 * standardError],
  };
}
function metrics(rows: MatchObservation[]) {
  const games = rows.flatMap((m) => m.games ?? []);
  const count = (outcome: GameOutcome) =>
    games.filter((g) => g === outcome).length;
  const completedGames = count("win") + count("loss") + count("draw");
  const matches = rows.filter(complete);
  const matchWins = matches.filter(
    (m) => wins(m.games!) > m.games!.filter((g) => g === "loss").length,
  ).length;
  const matchLosses = matches.filter(
    (m) => wins(m.games!) < m.games!.filter((g) => g === "loss").length,
  ).length;
  return {
    expectedMatches: rows.length,
    expectedGames: rows.length * 4,
    finalizedMatches: rows.filter((m) => m.games !== null).length,
    completeMatches: matches.length,
    incompleteMatches: rows.length - matches.length,
    unavailableMatches: rows.filter((m) => m.games === null).length,
    unavailableGames: rows.filter((m) => m.games === null).length * 4,
    completedGames,
    wins: count("win"),
    losses: count("loss"),
    draws: count("draw"),
    failedGames: count("failed"),
    skippedGames: count("skipped"),
    sideboardingFailures: rows.filter((m) => m.sideboarding === "failed")
      .length,
    gameWinRate: ratio(count("win"), completedGames),
    gameScoreRate: ratio(count("win") + count("draw") / 2, completedGames),
    matchWins,
    matchLosses,
    matchTies: matches.length - matchWins - matchLosses,
    matchWinRate: ratio(matchWins, matches.length),
  };
}
export function aggregateStatistics(
  control: MatchObservation[],
  candidate: MatchObservation[],
) {
  const a = [...control].sort((a, b) => a.id.localeCompare(b.id));
  const b = [...candidate].sort((a, b) => a.id.localeCompare(b.id));
  if (
    new Set(a.map((m) => m.id)).size !== a.length ||
    a.length !== b.length ||
    a.some((m, i) => m.id !== b[i]!.id || m.slot !== b[i]!.slot) ||
    new Set(b.map((m) => m.id)).size !== b.length ||
    [...a, ...b].some(
      (m) =>
        m.games !== null &&
        (m.games.length !== 4 ||
          m.games.some(
            (g) => !["win", "loss", "draw", "failed", "skipped"].includes(g),
          )),
    )
  )
    throw new Error(
      "Comparison observations must have identical unique match/slot schedules and four outcomes",
    );
  const paired = a.flatMap((m, i) =>
    complete(m) && complete(b[i]!)
      ? [
          {
            id: m.id,
            winDifference: (wins(b[i]!.games!) - wins(m.games!)) / 4,
            scoreDifference: (score(b[i]!.games!) - score(m.games!)) / 4,
          },
        ]
      : [],
  );
  return {
    control: metrics(a),
    candidate: metrics(b),
    paired: {
      expectedMatches: a.length,
      includedMatches: paired.map((m) => m.id),
      excludedMatches: a
        .filter((m) => !paired.some((p) => p.id === m.id))
        .map((m) => m.id),
      winRateDifference: pairedEstimate(paired.map((m) => m.winDifference)),
      scoreRateDifference: pairedEstimate(paired.map((m) => m.scoreDifference)),
    },
  };
}
