/** Reproducible two-deck operational example; no competitive-strength claim. */
import { mkdir, writeFile, realpath } from "node:fs/promises";
import { resolve, join, dirname, delimiter } from "node:path";
import { build } from "esbuild";
const [destination, snapshot, roundsText = "2", matchesText = "10"] =
  process.argv.slice(2);
if (!destination || !snapshot)
  throw new Error(
    "Usage: prepare-freeplay.ts DESTINATION SNAPSHOT [ROUNDS=2] [MATCHES=10]",
  );
const root = resolve(destination);
const rounds = Number(roundsText),
  matches = Number(matchesText);
if (
  !Number.isInteger(rounds) ||
  rounds < 1 ||
  !Number.isInteger(matches) ||
  matches < 1
)
  throw new Error("Positive integer rounds and matches required");
await mkdir(root, { recursive: true });
const strategy = join(root, "initial.mjs");
await build({
  stdin: {
    contents: `import {baselineStrategy} from './src/battle/worker/bot/generalist-strategy.ts';
export function createStrategy(dependencies, config) {
 const baseline=baselineStrategy(dependencies);
 return (input,choice)=>{
  const result=baseline(input,choice);
  const card=choice.card?.code===undefined?undefined:dependencies.cards.get(choice.card.code);
  if(config.avoidNormalSpellSet && choice.action==='setSpellTrap' && card && (Number(card.type)&2)!==0 && (Number(card.type)&(0x10000|0x20000|0x40000|0x80000))===0)
   return {...result,score:-50,code:'keep_normal_spell_available',explanation:'Prefer holding non-reactive spells for activation rather than setting them.'};
  return result;
 };
}`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: strategy,
});
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const evaluation = join(root, "evaluation.xml");
await writeFile(
  evaluation,
  `<evaluation schema_version="1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><deck><path>${escape(resolve("content/freeplay/decks/player.ydk"))}</path></deck><bots><a><module>builtin:generalist</module><config/></a><b><module>builtin:generalist</module><config/></b></bots><batch><matches>1</matches><execution>sequential</execution></batch><rules><profile>mr5</profile><banlist>${escape(resolve("tests/fixtures/bot-evaluation/three-copy-rules.json"))}</banlist></rules><content><snapshot>${escape(resolve(snapshot))}</snapshot></content><starting_orders><mode>normal</mode><fixture_path xsi:nil="true"/></starting_orders><limits><game_wall_time_ms>30000</game_wall_time_ms><decision_wall_time_ms>1000</decision_wall_time_ms><sideboarding_wall_time_ms>1000</sideboarding_wall_time_ms><max_turns_per_game>200</max_turns_per_game><max_decisions_per_game>100000</max_decisions_per_game></limits><output><directory>${escape(root)}/unused</directory></output></evaluation>`,
);
let cli: string | undefined;
for (const directory of (process.env.PATH ?? "").split(delimiter)) {
  try {
    cli = await realpath(resolve(directory, "codex"));
    break;
  } catch {
    /* next PATH entry */
  }
}
if (!cli) throw new Error("Installed codex executable required");
const adapter = resolve("scripts/bot-campaign/codex-agent.ts");
const config = {
  evaluation,
  output: join(root, "campaign"),
  decks: [
    {
      id: "freeplay-player",
      deck: resolve("content/freeplay/decks/player.ydk"),
      strategy,
      config: { avoidNormalSpellSet: false },
    },
    {
      id: "freeplay-opponent",
      deck: resolve("content/freeplay/decks/opponent.ydk"),
      strategy,
      config: { avoidNormalSpellSet: true },
    },
  ],
  agent: [process.execPath, adapter, "gpt-6.1-sol", "low"],
  bug_agent: [process.execPath, adapter, "gpt-6.1-sol", "high"],
  checks: [
    [
      process.execPath,
      "--experimental-vm-modules",
      resolve("scripts/bot-improvement/check-strategy.ts"),
    ],
  ],
  recovery_checks: [
    [
      process.execPath,
      resolve("scripts/run-tests.ts"),
      "--tests",
      "tests/bot-evaluation-acceptance.test.ts",
      "tests/unit/bot-contract.test.ts",
      "tests/unit/generalist-bot.test.ts",
    ],
  ],
  command_inputs: [
    dirname(cli),
    resolve("scripts/bot-improvement"),
    adapter,
    resolve("tests/bot-evaluation-acceptance.test.ts"),
    resolve("tests/unit/bot-contract.test.ts"),
    resolve("tests/unit/generalist-bot.test.ts"),
  ],
  rounds,
  matches,
  max_games: rounds === 100 ? 400000 : 2000,
  max_wall_ms: rounds === 100 ? 172800000 : 3600000,
  max_bytes: rounds === 100 ? 100000000000 : 2000000000,
  agent_timeout_ms: 300000,
  evaluation_timeout_ms: 1800000,
  check_timeout_ms: 180000,
  recovery_timeout_ms: 900000,
  max_retries: 2,
  max_fixes: 10,
};
await writeFile(join(root, "campaign.json"), JSON.stringify(config, null, 2));
console.log(join(root, "campaign.json"));
