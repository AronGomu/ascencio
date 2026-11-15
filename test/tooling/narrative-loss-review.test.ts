import test from "node:test";
import assert from "node:assert/strict";
import { narrativeLossReview } from "../../scripts/bot-improvement/narrative-loss-review.ts";

const source = (body: string) => `# Loss match-1-game-4
Perspective: target a; b is opponent.
Result: loss after 1 turns; engine reason 1.
## Sideboarding
Game 4: configuration carried forward from sideboarding before game 3; no new exchange.
Exchanges: none.
Opening hand: Test (card-1).
Initial public state: life points: a: 8000; b: 8000; turn player: b; opponent hand count: 5.
## Turn 1
${body}
`;

test("keeps optional decisions, aliases, constraints, sideboarding and hidden identity", () => {
  const result = narrativeLossReview(
    source(`- main1 1-decision-1: *O1 Pass; may cancel
- main1 1-decision-2: O1 Chain Test | *O2 Pass; may cancel
- main1 1-decision-3: *O1 Test | *O2 Other | O3 Concealed card choose 2–2; ordered
- main1 e4 move: unknown card (card-2): controller: b; location: monster; position: faceDownDefense`),
  );
  assert.deepEqual(result.decisions, [
    "1-decision-1",
    "1-decision-2",
    "1-decision-3",
  ]);
  assert.equal(result.mergedPasses, 1);
  assert.doesNotMatch(result.text, /Pass-only responses/);
  assert.match(
    result.text,
    /Decision 1 : Pass.\nAlternatives : Play Test.\nConditions : may cancel/,
  );
  assert.match(result.text, /choose 2–2; ordered/);
  assert.doesNotMatch(result.text, /carried forward from sideboarding/);
  assert.match(result.text, /- Field: 1 set monster/);
});

test("deduplicates attack resolution and wins without dropping damage or optional responses", () => {
  const result = narrativeLossReview(
    source(`- battleStart e1 attack: type: attack; player: b; direct: true / Test (card-2) attacks direct attack
- battleStart 1-decision-4: *O1 Chain Test | O2 Pass; may cancel
- battleStart e2 battle: Test (card-2) attacks unknown card
- battleStart e3 damage (a): a LP=0 / target takes 8000 damage
- battleStart e4 win (b): opponent wins (engine reason 1)
- battleStart e5 win (b): opponent wins (engine reason 1)`),
  );
  assert.equal((result.text.match(/attacks/g) ?? []).length, 1);
  assert.equal((result.text.match(/Opponent wins/g) ?? []).length, 1);
  assert.match(result.text, /We take 8000 damage/);
  assert.match(result.text, /Us: 0 LP/);
  assert.match(result.text, /Decision 1/);
});

test("tracks control transfers and departures and retains unrecognized evidence", () => {
  const result = narrativeLossReview(
    source(`- main1 e1 move: Test (card-2): controller: a; location: monster; position: faceUpAttack
- main1 e2 swap: Test (card-2): a monster → controller: b
- main1 e3 future: unrecognized effect: keep exactly
## Turn 2
- main1 e4 move: Test (card-2): b monster → location: graveyard`),
  );
  assert.match(result.text, /- Field: 1 Test \(face-up attack\)/);
  assert.match(result.text, /unrecognized effect: keep exactly/);
  assert.match(result.text, /- Field: Empty/);
  assert.equal(
    result.text,
    narrativeLossReview(
      source(`- main1 e1 move: Test (card-2): controller: a; location: monster; position: faceUpAttack
- main1 e2 swap: Test (card-2): a monster → controller: b
- main1 e3 future: unrecognized effect: keep exactly
## Turn 2
- main1 e4 move: Test (card-2): b monster → location: graveyard`),
    ).text,
  );
});

test("rejects incompatible input", () => {
  assert.throws(
    () => narrativeLossReview("unrecognized log"),
    /Expected target-a/,
  );
});

test("uses compact title and plain styling", () => {
  const result = narrativeLossReview(source(""));
  assert.equal(result.filename, "M1-G4.md");
  assert.match(result.text, /^# M1-G4/);
  assert.doesNotMatch(
    result.text,
    /\*\*|Perspective:|Decisions retain|configuration carried forward/,
  );
});

test("numbers displayed decisions and retains their original references", () => {
  const result = narrativeLossReview(
    source(
      "- draw 1-decision-3: *O1 Pass; may cancel\n- draw 1-decision-5: *O1 Chain Scapegoat | O2 Pass; may cancel",
    ),
    { cardTypes: { Scapegoat: 0x10002 } },
  );
  assert.match(result.text, /Play Scapegoat \(Spell Speed 2\)/);
  assert.equal(result.decisionMap["1"], "1-decision-5");
  assert.doesNotMatch(result.text, /Conditions :[^\n]*Spell Speed/);
  assert.match(result.text, /## Opening Hand\n\n1 Test\./);
});

test("labels our spell/trap placement zones", () => {
  const result = narrativeLossReview(
    source(
      "- draw 1-decision-5: *O1 Opponent spellTrap 1 | O2 Opponent spellTrap 5",
    ),
    { showPlacement: true },
  );
  assert.match(
    result.text,
    /Decision 1 : My S\/T 1.\nAlternatives : My S\/T 5/,
  );
  assert.doesNotMatch(result.text, /Opponent spellTrap/);
});

test("hides placement by default and keeps source references", () => {
  const input = source(
    "- draw 1-decision-5: *O1 Opponent spellTrap 1 | O2 Opponent spellTrap 5",
  );
  const hidden = narrativeLossReview(input);
  assert.doesNotMatch(hidden.text, /My S\/T|Decision 1/);
  assert.deepEqual(hidden.decisions, ["1-decision-5"]);
  assert.match(
    narrativeLossReview(input, { showPlacement: true }).text,
    /My S\/T 1/,
  );
});

test("distinguishes starting a chain from responding", () => {
  const result = narrativeLossReview(
    source(`- draw 1-decision-1: *O1 Chain Scapegoat | O2 Pass; may cancel
- draw e2 chaining (a): a activates Scapegoat (card-1)
- draw 1-decision-2: *O1 Chain Book of Moon | O2 Pass; may cancel`),
  );
  assert.match(result.text, /Decision 1 : Play Scapegoat/);
  assert.match(result.text, /Response to play : Chain Book of Moon/);
});

test("explains the Delinquent Duo discard decision", () => {
  const result = narrativeLossReview(
    source(`- main1 e1 chaining (b): b activates Delinquent Duo (card-2)
- main1 1-decision-5: *O1 Asura Priest | O2 Book of Moon`),
  );
  assert.match(
    result.text,
    /Decision 1 :\nDiscard for Delinquent Duo : Asura Priest/,
  );
});

test("uses supplied counts without inventing unknown counts or positions", () => {
  const result = narrativeLossReview(source(""), {
    inventory: {
      mainCount: 41,
      extraCount: 15,
      knownExtra: [{ name: "Test Fusion", copies: 1 }],
    },
  });
  assert.match(result.text, /Deck: 40 unknown/);
  assert.doesNotMatch(result.text, /Extradeck:/);

  assert.doesNotMatch(result.text, /XX unknown/);
});

test("combines activation movement and specifies set-card origin", () => {
  const result = narrativeLossReview(
    source(`- draw e1 move: Scapegoat (card-2): a hand → location: spellTrap; position: faceUpAttack
- draw e2 chaining (a): a activates Scapegoat (card-2)
- draw e3 position_change (a): Book of Moon (card-3): a spellTrap → position: faceUpAttack
- draw e4 chaining (a): a activates Book of Moon (card-3)`),
  );
  assert.match(result.text, /Activate Scapegoat\./);
  assert.doesNotMatch(result.text, /Scapegoat moves from Us hand/);
  assert.match(result.text, /Activate Book of Moon from S\/T zone/);
});

test("groups consecutive Sheep Token summons", () => {
  const events = Array.from(
    { length: 4 },
    (_, i) =>
      `- draw e${i * 2 + 1} move: Sheep Token (card-${i + 2}): controller: a; location: monster; position: faceUpDefense\n- draw e${i * 2 + 2} special_summoning (a): target specialSummon Sheep Token`,
  ).join("\n");
  assert.match(
    narrativeLossReview(source(events)).text,
    /We Special Summon 4 Sheep Token Face-up Defense/,
  );
});

test("omits normal resolution and only routine spell cleanup", () => {
  const result = narrativeLossReview(
    source(`- draw e1 chain_solved: Scapegoat resolves: normal
- draw e2 move: Scapegoat (card-2): a spellTrap → location: graveyard
- draw e3 move: Book of Moon (card-3): b spellTrap → location: graveyard`),
    { cardTypes: { Scapegoat: 0x10002 } },
  );
  assert.doesNotMatch(result.text, /resolves normally|Scapegoat moves/);
  assert.match(
    result.text,
    /Book of Moon moves from Opponent S\/T to Opponent graveyard/,
  );
});

test("cleanup uses type metadata for arbitrary spells and preserves equip cleanup", () => {
  const input = source(`- draw e1 chain_solved: Arbitrary Spell resolves: normal
- draw e2 move: Arbitrary Spell (card-2): a spellTrap → location: graveyard`);
  assert.doesNotMatch(
    narrativeLossReview(input, { cardTypes: { "Arbitrary Spell": 2 } }).text,
    /Arbitrary Spell moves/,
  );
  assert.match(
    narrativeLossReview(input, { cardTypes: { "Arbitrary Spell": 0x40002 } })
      .text,
    /Arbitrary Spell moves/,
  );
  assert.match(narrativeLossReview(input).text, /Arbitrary Spell moves/);
});

test("omits routine normal/counter trap and ritual cleanup but preserves persistent types", () => {
  const input = (name: string) =>
    source(
      `- draw e1 chain_solved: ${name} resolves: normal\n- draw e2 move: ${name} (card-2): a spellTrap → location: graveyard`,
    );
  for (const type of [2, 0x10002, 0x800002, 4, 0x100004])
    assert.doesNotMatch(
      narrativeLossReview(input("Test"), { cardTypes: { Test: type } }).text,
      /Test moves/,
    );
  for (const type of [0x20002, 0x40002, 0x80002, 0x20004, 1])
    assert.match(
      narrativeLossReview(input("Test"), { cardTypes: { Test: type } }).text,
      /Test moves/,
    );
  assert.match(
    narrativeLossReview(input("Swords of Revealing Light"), {
      cardTypes: { "Swords of Revealing Light": 2 },
    }).text,
    /Swords of Revealing Light moves/,
  );
});
