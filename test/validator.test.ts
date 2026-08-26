import { describe, it, expect } from "vitest";
import { validateNarration } from "../src/agent/validator.js";
import { GameEvent } from "../src/state/db.js";

const attackEvent = (total: number, dmg: number): GameEvent => ({
  id: 1,
  turn: 1,
  kind: "attack",
  data: {
    args: { attackerId: "sera", targetId: "goblin-1" },
    result: { hit: true, attackRoll: { kept: total - 4, modifier: 4, total }, damage: { total: dmg, type: "bludgeoning" } },
  },
});

describe("validateNarration", () => {
  it("accepts numbers that appear in tool results", () => {
    const prose = "A 17 — just past its guard — and 6 points of bludgeoning damage crumple the goblin.";
    expect(validateNarration(prose, [attackEvent(17, 6)])).toEqual([]);
  });

  it("flags a roll number that never happened", () => {
    const prose = "You rolled a 19! The blow lands hard.";
    const violations = validateNarration(prose, [attackEvent(17, 6)]);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].claim).toContain("19");
  });

  it("flags invented damage", () => {
    const prose = "The trap snaps shut for 12 points of piercing damage.";
    expect(validateNarration(prose, []).length).toBeGreaterThan(0);
  });

  it("flags combat outcomes with no mechanical tool call at all", () => {
    const prose = "Your blade connects and the cultist drops without a sound.";
    const violations = validateNarration(prose, []);
    expect(violations.length).toBeGreaterThan(0);
  });

  it("does not flag pure fiction with no mechanics", () => {
    const prose = "Marla wipes the counter with her three-fingered hand and nods toward the corner table. Three miners used to sit there.";
    expect(validateNarration(prose, [])).toEqual([]);
  });

  it("does not flag word-numbers or non-mechanical counts", () => {
    const prose = "Six brass markers hang on the tally board. The rain has been falling for 3 days.";
    expect(validateNarration(prose, [])).toEqual([]);
  });
});

describe("scene drift detection", () => {
  const scene = {
    currentPlaceId: "warrens-entrance",
    places: [
      { id: "warrens-entrance", name: "The Saltmine Mouth" },
      { id: "warrens-gallery", name: "The First Gallery" },
      { id: "warrens-deep", name: "The Flooded East Gallery" },
    ],
  };

  it("flags narrated arrival at an unmoved place", () => {
    const prose = "You descend into the First Gallery, torch held high.";
    const violations = validateNarration(prose, [], scene);
    expect(violations.length).toBe(1);
    expect(violations[0].problem).toContain("warrens-gallery");
  });

  it("flags 'the gallery opens up' style arrivals", () => {
    const prose = "The first gallery opens up like a cathedral of forgotten labor.";
    expect(validateNarration(prose, [], scene).length).toBe(1);
  });

  it("accepts arrival when move_scene actually happened", () => {
    const moveEvent: GameEvent = {
      id: 1,
      turn: 1,
      kind: "move_scene",
      data: { args: { placeId: "warrens-gallery" }, result: { moved: true, scene: { placeId: "warrens-gallery" } } },
    };
    const prose = "You step into the First Gallery; salt walls drink your lamplight.";
    expect(validateNarration(prose, [moveEvent], scene)).toEqual([]);
  });

  it("does not flag mere mentions without arrival", () => {
    const prose = "Derva warned that the First Gallery was unstable, and pointed back the way you came.";
    expect(validateNarration(prose, [], scene)).toEqual([]);
  });

  it("does not flag the current place", () => {
    const prose = "You step back into the Saltmine Mouth's gray daylight.";
    expect(validateNarration(prose, [], scene)).toEqual([]);
  });
});

describe("leveled spell slot enforcement", () => {
  it("flags casting Guiding Bolt with no slot spent", () => {
    const violations = validateNarration("You cast Guiding Bolt at the darkness.", [], {
      leveledSpells: ["Guiding Bolt", "Cure Wounds"],
    });
    expect(violations.some((v) => v.problem.includes("Guiding Bolt"))).toBe(true);
  });

  it("accepts the same narration when cast_spell ran", () => {
    const events: GameEvent[] = [
      { id: 1, turn: 1, kind: "cast_spell", data: { args: { spell: "Guiding Bolt" }, result: { slotSpent: true } } },
    ];
    expect(
      validateNarration("You cast Guiding Bolt at the darkness.", events, { leveledSpells: ["Guiding Bolt"] }),
    ).toEqual([]);
  });

  it("does not flag a cantrip by name alone when it is not in the leveled list", () => {
    expect(validateNarration("You cast Sacred Flame.", [], { leveledSpells: ["Guiding Bolt"] })).toEqual([]);
  });
});

describe("word budget", () => {
  it("flags narration more than 2x the budget", () => {
    const prose = Array(50).fill("word").join(" ");
    const violations = validateNarration(prose, [], { wordBudget: 20 });
    expect(violations.some((v) => v.problem.includes("budget"))).toBe(true);
  });
});
