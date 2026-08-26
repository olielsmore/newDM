import { describe, it, expect } from "vitest";
import { partyXpBudget, adjustedXp, composeEncounters, xpForCr } from "../src/rules/encounter.js";

describe("encounter math", () => {
  it("uses DMG thresholds for a level-2 solo", () => {
    expect(partyXpBudget([2], "medium")).toBe(100);
    expect(partyXpBudget([2], "deadly")).toBe(200);
  });

  it("applies the pair multiplier", () => {
    expect(xpForCr("1/4")).toBe(50);
    expect(adjustedXp(["1/4", "1/4"])).toBe(150);
  });

  it("composes encounters that do not exceed the budget", () => {
    const candidates = [
      { id: "goblin", name: "Goblin", cr: "1/4", xp: 50, type: "humanoid", description: "" },
      { id: "wolf", name: "Wolf", cr: "1/4", xp: 50, type: "beast", description: "" },
      { id: "ghoul", name: "Ghoul", cr: "1", xp: 200, type: "undead", description: "" },
    ];
    const comps = composeEncounters(candidates, 100, "medium");
    expect(comps.length).toBeGreaterThan(0);
    for (const c of comps) expect(c.adjustedXp).toBeLessThanOrEqual(100);
    expect(comps.every((c) => !c.members.some((m) => m.id === "ghoul"))).toBe(true);
  });
});
