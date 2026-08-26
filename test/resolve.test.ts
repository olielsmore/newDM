import { describe, it, expect } from "vitest";
import { Rng } from "../src/rules/dice.js";
import { SheetSchema, Sheet, abilityMod, proficiencyBonus, checkModifier, spellSaveDC } from "../src/rules/sheet.js";
import { resolveCheck, resolveAttack, applyDamage, applyHealing, spendSlot, longRest } from "../src/rules/resolve.js";

function fighter(overrides: Partial<Sheet> = {}): Sheet {
  return SheetSchema.parse({
    id: "test",
    name: "Test Fighter",
    kind: "pc",
    level: 4,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    proficientSkills: ["athletics"],
    proficientSaves: ["str"],
    ac: 16,
    maxHp: 36,
    hp: 36,
    attacks: [{ name: "Longsword", ability: "str", proficient: true, damage: "1d8", damageType: "slashing" }],
    ...overrides,
  });
}

describe("sheet math", () => {
  it("computes ability modifiers", () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(16)).toBe(3);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(20)).toBe(5);
  });

  it("computes proficiency by level", () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(4)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
  });

  it("adds proficiency only for proficient skills", () => {
    const f = fighter();
    expect(checkModifier(f, "str", "athletics")).toBe(5); // +3 str, +2 prof
    expect(checkModifier(f, "dex", "stealth")).toBe(1); // +1 dex only
  });

  it("computes spell save DC", () => {
    const cleric = fighter({ spellcastingAbility: "wis", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 } });
    expect(spellSaveDC(cleric)).toBe(13); // 8 + 2 + 3
  });
});

describe("resolveCheck", () => {
  it("marks outcomes against the DC", () => {
    const f = fighter();
    for (let seed = 0; seed < 50; seed++) {
      const r = resolveCheck(new Rng(seed), f, "str", 15, { skill: "athletics" });
      if (r.roll.natural20) expect(r.outcome).toBe("critical_success");
      else if (r.roll.natural1) expect(r.outcome).toBe("critical_failure");
      else expect(r.outcome).toBe(r.roll.total >= 15 ? "success" : "failure");
    }
  });
});

describe("resolveAttack", () => {
  it("applies damage math and crit doubling", () => {
    const attacker = fighter();
    const target = fighter({ id: "t2", name: "Target" });
    let sawCrit = false;
    let sawNormalHit = false;
    for (let seed = 0; seed < 300 && !(sawCrit && sawNormalHit); seed++) {
      const r = resolveAttack(new Rng(seed), attacker, target, attacker.attacks[0]);
      if (!r.hit) continue;
      expect(r.damage).toBeDefined();
      // 1d8 (+1d8 on crit) + STR 3
      const diceSum = r.damage!.rolls.reduce((a, b) => a + b, 0);
      expect(r.damage!.total).toBe(diceSum + 3);
      if (r.critical) {
        expect(r.damage!.rolls).toHaveLength(2);
        sawCrit = true;
      } else {
        expect(r.damage!.rolls).toHaveLength(1);
        sawNormalHit = true;
      }
    }
    expect(sawCrit).toBe(true);
    expect(sawNormalHit).toBe(true);
  });
});

describe("damage and healing", () => {
  it("temp HP absorbs first, dropping adds unconscious", () => {
    const f = fighter({ hp: 5, tempHp: 3 });
    const app = applyDamage(f, 10);
    expect(app.absorbedByTemp).toBe(3);
    expect(f.hp).toBe(0);
    expect(app.dropped).toBe(true);
    expect(f.conditions).toContain("unconscious");
  });

  it("damage at 0 HP fails death saves instead of lowering HP (crit fails two)", () => {
    const f = fighter({ hp: 0, conditions: ["unconscious"] });
    const first = applyDamage(f, 5);
    expect(first.deathSaveFailuresAdded).toBe(1);
    expect(f.deathSaves.failures).toBe(1);
    expect(f.hp).toBe(0);
    const second = applyDamage(f, 5, { critical: true });
    expect(second.deathSaveFailuresAdded).toBe(2);
    expect(second.dead).toBe(true);
    expect(f.conditions).toContain("dead");
  });

  it("massive damage at 0 HP kills outright", () => {
    const f = fighter({ hp: 0, conditions: ["unconscious"] });
    const app = applyDamage(f, 36);
    expect(app.instantDeath).toBe(true);
    expect(app.dead).toBe(true);
  });

  it("healing from 0 removes unconscious and caps at max", () => {
    const f = fighter({ hp: 0, conditions: ["unconscious"] });
    applyHealing(f, 100);
    expect(f.hp).toBe(f.maxHp);
    expect(f.conditions).not.toContain("unconscious");
  });
});

describe("slots and rests", () => {
  it("spends slots until empty", () => {
    const c = fighter({ spellSlots: { "1": { max: 2, used: 0 } } });
    expect(spendSlot(c, 1)).toEqual({ ok: true, remaining: 1 });
    expect(spendSlot(c, 1)).toEqual({ ok: true, remaining: 0 });
    expect(spendSlot(c, 1).ok).toBe(false);
  });

  it("long rest restores everything", () => {
    const c = fighter({ hp: 1, spellSlots: { "1": { max: 3, used: 3 } }, conditions: ["poisoned"] });
    longRest(c);
    expect(c.hp).toBe(c.maxHp);
    expect(c.spellSlots["1"].used).toBe(0);
    expect(c.conditions).toEqual([]);
  });
});
