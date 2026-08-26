import { describe, it, expect } from "vitest";
import { Rng } from "../src/rules/dice.js";
import { SheetSchema } from "../src/rules/sheet.js";
import {
  startCombat,
  advanceTurn,
  consumeEconomy,
  expireConditions,
  applyDeathSave,
  concentrationDc,
} from "../src/rules/combat.js";

function fighter(id: string) {
  return SheetSchema.parse({
    id,
    name: id,
    kind: id === "pc" ? "pc" : "monster",
    level: 2,
    abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    ac: 14,
    maxHp: 12,
    hp: 12,
  });
}

describe("combat state machine", () => {
  it("rolls initiative deterministically and tracks economy", () => {
    const a = startCombat(new Rng(1), [fighter("pc"), fighter("goblin-1")]);
    const b = startCombat(new Rng(1), [fighter("pc"), fighter("goblin-1")]);
    expect(a.order).toEqual(b.order);
    expect(a.round).toBe(1);
    expect(consumeEconomy(a, "pc", "action").ok).toBe(true);
    expect(consumeEconomy(a, "pc", "action").ok).toBe(false);
  });

  it("wraps the round, resets economy, expires conditions", () => {
    const state = startCombat(new Rng(2), [fighter("a"), fighter("b")]);
    consumeEconomy(state, state.order[0].id, "action");
    const first = advanceTurn(state);
    expect(first.wrapped).toBe(false);
    const second = advanceTurn(state);
    expect(second.wrapped).toBe(true);
    expect(state.round).toBe(2);
    expect(state.economy[state.order[0].id].action).toBe(true);

    const sheet = fighter("a");
    sheet.conditions = ["paralyzed"];
    sheet.conditionExpiries = { paralyzed: 2 };
    const report = expireConditions([sheet], 2);
    expect(report[0].expired).toEqual(["paralyzed"]);
    expect(sheet.conditions).toEqual([]);
  });

  it("death saves: 20 wakes, 1 counts two failures, 3 failures kill", () => {
    const sheet = fighter("pc");
    sheet.hp = 0;
    const nat20 = applyDeathSave(sheet, 20, true, false);
    expect(nat20.revived).toBe(true);
    expect(sheet.hp).toBe(1);

    sheet.hp = 0;
    sheet.deathSaves = { successes: 0, failures: 0 };
    applyDeathSave(sheet, 1, false, true);
    applyDeathSave(sheet, 4, false, false);
    expect(sheet.conditions).toContain("dead");
  });

  it("concentration DC is max(10, floor(damage/2))", () => {
    expect(concentrationDc(4)).toBe(10);
    expect(concentrationDc(22)).toBe(11);
  });
});
