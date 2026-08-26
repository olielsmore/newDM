/**
 * Resolution: pure functions that take sheets + RNG and produce structured
 * outcomes. No I/O, no LLM. This is the authority on what happened.
 */
import { Rng, d20, roll, D20Result, DiceResult } from "./dice.js";
import {
  Sheet,
  Ability,
  Attack,
  checkModifier,
  saveModifier,
  attackModifier,
  abilityMod,
} from "./sheet.js";

export type Outcome = "critical_success" | "success" | "failure" | "critical_failure";

export interface CheckResult {
  kind: "check";
  character: string;
  ability: Ability;
  skill?: string;
  dc: number;
  roll: D20Result;
  outcome: Outcome;
}

export function resolveCheck(
  rng: Rng,
  sheet: Sheet,
  ability: Ability,
  dc: number,
  opts: { skill?: string; advantage?: boolean; disadvantage?: boolean } = {},
): CheckResult {
  const modifier = checkModifier(sheet, ability, opts.skill);
  const r = d20(rng, { modifier, advantage: opts.advantage, disadvantage: opts.disadvantage });
  const outcome: Outcome = r.natural20
    ? "critical_success"
    : r.natural1
      ? "critical_failure"
      : r.total >= dc
        ? "success"
        : "failure";
  return { kind: "check", character: sheet.name, ability, skill: opts.skill, dc, roll: r, outcome };
}

export interface SaveResult {
  kind: "save";
  character: string;
  ability: Ability;
  dc: number;
  roll: D20Result;
  success: boolean;
}

export function resolveSave(
  rng: Rng,
  sheet: Sheet,
  ability: Ability,
  dc: number,
  opts: { advantage?: boolean; disadvantage?: boolean } = {},
): SaveResult {
  const modifier = saveModifier(sheet, ability);
  const r = d20(rng, { modifier, advantage: opts.advantage, disadvantage: opts.disadvantage });
  return { kind: "save", character: sheet.name, ability, dc, roll: r, success: r.natural20 || (!r.natural1 && r.total >= dc) };
}

export interface AttackResult {
  kind: "attack";
  attacker: string;
  target: string;
  attackName: string;
  attackRoll: D20Result;
  targetAc: number;
  hit: boolean;
  critical: boolean;
  damage?: DiceResult & { type: string };
}

export function resolveAttack(
  rng: Rng,
  attacker: Sheet,
  target: Sheet,
  attack: Attack,
  opts: { advantage?: boolean; disadvantage?: boolean } = {},
): AttackResult {
  const modifier = attackModifier(attacker, attack);
  const attackRoll = d20(rng, { modifier, advantage: opts.advantage, disadvantage: opts.disadvantage });
  const critical = attackRoll.natural20;
  const hit = critical || (!attackRoll.natural1 && attackRoll.total >= target.ac);

  let damage: (DiceResult & { type: string }) | undefined;
  if (hit) {
    const dmgMod = abilityMod(attacker.abilities[attack.ability]);
    let d = roll(rng, attack.damage);
    if (critical) {
      // Crit: roll the dice a second time (5e RAW), modifier applies once.
      const extra = roll(rng, attack.damage.replace(/[+-]\s*\d+\s*$/, ""));
      d = { ...d, rolls: [...d.rolls, ...extra.rolls], total: d.total + extra.rolls.reduce((a, b) => a + b, 0) };
    }
    damage = { ...d, modifier: d.modifier + dmgMod, total: d.total + dmgMod, type: attack.damageType };
  }

  return {
    kind: "attack",
    attacker: attacker.name,
    target: target.name,
    attackName: attack.name,
    attackRoll,
    targetAc: target.ac,
    hit,
    critical,
    damage,
  };
}

export interface DamageApplication {
  target: string;
  amount: number;
  absorbedByTemp: number;
  hpBefore: number;
  hpAfter: number;
  dropped: boolean;
  /** Death-save failures added because the target was already at 0 HP (PHB: 1, or 2 on a crit). */
  deathSaveFailuresAdded?: number;
  deathSaveFailures?: number;
  dead?: boolean;
  /** Damage at 0 HP that meets the hp maximum kills outright (PHB massive damage). */
  instantDeath?: boolean;
}

/** Mutates the sheet. Returns what happened for the event log. */
export function applyDamage(sheet: Sheet, amount: number, opts: { critical?: boolean } = {}): DamageApplication {
  const hpBefore = sheet.hp;

  // Damage while already dying does not lower HP further; it fails death saves.
  if (hpBefore === 0 && sheet.kind === "pc" && !sheet.conditions.includes("dead")) {
    const instantDeath = amount >= sheet.maxHp;
    const added = instantDeath ? 3 : opts.critical ? 2 : 1;
    sheet.deathSaves.failures += added;
    sheet.conditions = sheet.conditions.filter((c) => c !== "stable");
    const dead = sheet.deathSaves.failures >= 3;
    if (dead && !sheet.conditions.includes("dead")) sheet.conditions.push("dead");
    return {
      target: sheet.name,
      amount,
      absorbedByTemp: 0,
      hpBefore,
      hpAfter: 0,
      dropped: false,
      deathSaveFailuresAdded: added,
      deathSaveFailures: sheet.deathSaves.failures,
      dead,
      ...(instantDeath ? { instantDeath } : {}),
    };
  }

  const absorbedByTemp = Math.min(sheet.tempHp, amount);
  sheet.tempHp -= absorbedByTemp;
  const remaining = amount - absorbedByTemp;
  sheet.hp = Math.max(0, sheet.hp - remaining);
  const dropped = hpBefore > 0 && sheet.hp === 0;
  if (dropped && !sheet.conditions.includes("unconscious")) sheet.conditions.push("unconscious");
  return { target: sheet.name, amount, absorbedByTemp, hpBefore, hpAfter: sheet.hp, dropped };
}

export interface HealApplication {
  target: string;
  amount: number;
  hpBefore: number;
  hpAfter: number;
}

export function applyHealing(sheet: Sheet, amount: number): HealApplication {
  const hpBefore = sheet.hp;
  sheet.hp = Math.min(sheet.maxHp, sheet.hp + amount);
  if (hpBefore === 0 && sheet.hp > 0) {
    sheet.conditions = sheet.conditions.filter((c) => c !== "unconscious");
    sheet.deathSaves = { successes: 0, failures: 0 };
  }
  return { target: sheet.name, amount, hpBefore, hpAfter: sheet.hp };
}

export function spendSlot(sheet: Sheet, level: number): { ok: boolean; remaining: number } {
  const slot = sheet.spellSlots[String(level)];
  if (!slot || slot.used >= slot.max) return { ok: false, remaining: slot ? slot.max - slot.used : 0 };
  slot.used += 1;
  return { ok: true, remaining: slot.max - slot.used };
}

export function longRest(sheet: Sheet): void {
  sheet.hp = sheet.maxHp;
  sheet.tempHp = 0;
  sheet.conditions = sheet.conditions.filter((c) => c === "cursed"); // curses survive rests
  sheet.deathSaves = { successes: 0, failures: 0 };
  for (const slot of Object.values(sheet.spellSlots)) slot.used = 0;
}
