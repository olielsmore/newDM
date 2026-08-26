import { z } from "zod";

export const Ability = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export type Ability = z.infer<typeof Ability>;

export const SKILL_ABILITY: Record<string, Ability> = {
  athletics: "str",
  acrobatics: "dex",
  "sleight of hand": "dex",
  stealth: "dex",
  arcana: "int",
  history: "int",
  investigation: "int",
  nature: "int",
  religion: "int",
  "animal handling": "wis",
  insight: "wis",
  medicine: "wis",
  perception: "wis",
  survival: "wis",
  deception: "cha",
  intimidation: "cha",
  performance: "cha",
  persuasion: "cha",
};

export const AttackSchema = z.object({
  name: z.string(),
  ability: Ability,
  proficient: z.boolean().default(true),
  /** e.g. "1d8" — ability modifier is added by the engine, never hand-written in. */
  damage: z.string(),
  damageType: z.string(),
  range: z.string().default("melee"),
});

export const SheetSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["pc", "npc", "monster"]).default("pc"),
  level: z.number().int().min(1).max(20).default(1),
  className: z.string().default(""),
  race: z.string().default(""),
  abilities: z.object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  }),
  proficientSkills: z.array(z.string()).default([]),
  proficientSaves: z.array(Ability).default([]),
  ac: z.number().int(),
  maxHp: z.number().int(),
  hp: z.number().int(),
  tempHp: z.number().int().default(0),
  speed: z.number().int().default(30),
  attacks: z.array(AttackSchema).default([]),
  /** slot level -> { max, used } */
  spellSlots: z.record(z.string(), z.object({ max: z.number().int(), used: z.number().int() })).default({}),
  spellcastingAbility: Ability.optional(),
  spellsKnown: z.array(z.string()).default([]),
  inventory: z.array(z.object({ name: z.string(), qty: z.number().int().default(1) })).default([]),
  conditions: z.array(z.string()).default([]),
  deathSaves: z.object({ successes: z.number().int(), failures: z.number().int() }).default({ successes: 0, failures: 0 }),
  notes: z.string().default(""),
});

export type Sheet = z.infer<typeof SheetSchema>;
export type Attack = z.infer<typeof AttackSchema>;

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

export function checkModifier(sheet: Sheet, ability: Ability, skill?: string): number {
  let mod = abilityMod(sheet.abilities[ability]);
  if (skill && sheet.proficientSkills.map((s) => s.toLowerCase()).includes(skill.toLowerCase())) {
    mod += proficiencyBonus(sheet.level);
  }
  return mod;
}

export function saveModifier(sheet: Sheet, ability: Ability): number {
  let mod = abilityMod(sheet.abilities[ability]);
  if (sheet.proficientSaves.includes(ability)) mod += proficiencyBonus(sheet.level);
  return mod;
}

export function attackModifier(sheet: Sheet, attack: Attack): number {
  let mod = abilityMod(sheet.abilities[attack.ability]);
  if (attack.proficient) mod += proficiencyBonus(sheet.level);
  return mod;
}

export function spellSaveDC(sheet: Sheet): number {
  if (!sheet.spellcastingAbility) return 10;
  return 8 + proficiencyBonus(sheet.level) + abilityMod(sheet.abilities[sheet.spellcastingAbility]);
}

export function spellAttackModifier(sheet: Sheet): number {
  if (!sheet.spellcastingAbility) return 0;
  return proficiencyBonus(sheet.level) + abilityMod(sheet.abilities[sheet.spellcastingAbility]);
}
