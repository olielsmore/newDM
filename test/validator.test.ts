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
