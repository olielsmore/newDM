/**
 * Structured spell effects. The engine executes these; the LLM never
 * "reads the spell text and decides."
 */
import { z } from "zod";
import { Rng, roll } from "./dice.js";
import { Sheet, Ability, spellSaveDC, abilityMod, Attack } from "./sheet.js";
import { resolveSave, resolveAttack, applyDamage, applyHealing, spendSlot } from "./resolve.js";

export type SpellEffect =
  | { kind: "damage"; dice: string; type: string; addAbilityMod?: boolean }
  | { kind: "heal"; dice: string; addAbilityMod?: boolean }
  | { kind: "condition"; name: string; expiresInRounds?: number }
  | { kind: "save"; ability: Ability; onFail: SpellEffect[]; onSuccess?: SpellEffect[] }
  | { kind: "attack"; damage: string; damageType: string; onHit?: SpellEffect[] };

export const SpellDefinitionSchema = z.object({
  name: z.string(),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  duration: z.string(),
  concentration: z.boolean().default(false),
  economy: z.enum(["action", "bonus", "reaction"]).default("action"),
  effects: z.array(z.record(z.string(), z.unknown())),
});

export type SpellDefinition = Omit<z.infer<typeof SpellDefinitionSchema>, "effects"> & {
  effects: SpellEffect[];
};

export function parseSpellDefinition(raw: unknown): SpellDefinition {
  const parsed = SpellDefinitionSchema.parse(raw);
  return { ...parsed, effects: parsed.effects as SpellEffect[] };
}

export interface CastResult {
  spell: string;
  level: number;
  slotSpent: boolean;
  remainingSlots?: number;
  applied: unknown[];
}

function applySimple(
  rng: Rng,
  caster: Sheet,
  target: Sheet,
  effect: Extract<SpellEffect, { kind: "damage" | "heal" | "condition" }>,
  combatRound?: number,
): unknown {
  if (effect.kind === "damage") {
    const r = roll(rng, effect.dice);
    const extra = effect.addAbilityMod && caster.spellcastingAbility ? abilityMod(caster.abilities[caster.spellcastingAbility]) : 0;
    const amount = Math.max(1, r.total + extra);
    return { effect: "damage", dice: r, extra, ...applyDamage(target, amount), type: effect.type };
  }
  if (effect.kind === "heal") {
    const r = roll(rng, effect.dice);
    const extra = (effect.addAbilityMod ?? true) && caster.spellcastingAbility ? abilityMod(caster.abilities[caster.spellcastingAbility]) : 0;
    const amount = Math.max(1, r.total + extra);
    return { effect: "heal", dice: r, extra, ...applyHealing(target, amount) };
  }
  if (!target.conditions.includes(effect.name)) target.conditions.push(effect.name);
  if (effect.expiresInRounds != null && combatRound != null) {
    target.conditionExpiries[effect.name] = combatRound + effect.expiresInRounds;
  }
  return { effect: "condition", name: effect.name, expiresAtRound: target.conditionExpiries[effect.name] };
}

export function resolveEffects(
  rng: Rng,
  caster: Sheet,
  target: Sheet,
  effects: SpellEffect[],
  combatRound?: number,
): unknown[] {
  const applied: unknown[] = [];
  for (const effect of effects) {
    if (effect.kind === "save") {
      const dc = spellSaveDC(caster);
      const save = resolveSave(rng, target, effect.ability, dc);
      const follow = save.success ? (effect.onSuccess ?? []) : effect.onFail;
      applied.push({ effect: "save", ...save, then: resolveEffects(rng, caster, target, follow, combatRound) });
    } else if (effect.kind === "attack") {
      const attack: Attack = {
        name: "spell attack",
        ability: caster.spellcastingAbility ?? "int",
        proficient: true,
        damage: effect.damage,
        damageType: effect.damageType,
        range: "ranged",
      };
      const res = resolveAttack(rng, caster, target, attack);
      let onHit: unknown[] = [];
      if (res.hit && res.damage) {
        applyDamage(target, Math.max(1, res.damage.total));
        onHit = resolveEffects(rng, caster, target, effect.onHit ?? [], combatRound);
      }
      applied.push({ effect: "attack", ...res, onHit });
    } else {
      applied.push(applySimple(rng, caster, target, effect, combatRound));
    }
  }
  return applied;
}

export function castSpell(
  rng: Rng,
  caster: Sheet,
  target: Sheet | undefined,
  spell: SpellDefinition,
  combatRound?: number,
): CastResult {
  if (spell.level > 0) {
    const spent = spendSlot(caster, spell.level);
    if (!spent.ok) throw new Error(`${caster.name} has no level ${spell.level} slots remaining`);
    if (spell.concentration) caster.concentrating = { spell: spell.name };
    return {
      spell: spell.name,
      level: spell.level,
      slotSpent: true,
      remainingSlots: spent.remaining,
      applied: target ? resolveEffects(rng, caster, target, spell.effects, combatRound) : [],
    };
  }
  if (spell.concentration) caster.concentrating = { spell: spell.name };
  return {
    spell: spell.name,
    level: 0,
    slotSpent: false,
    applied: target ? resolveEffects(rng, caster, target, spell.effects, combatRound) : [],
  };
}

export const FIXTURE_SPELLS: SpellDefinition[] = [
  {
    name: "Cure Wounds",
    level: 1,
    school: "evocation",
    castingTime: "1 action",
    range: "touch",
    duration: "instantaneous",
    concentration: false,
    economy: "action",
    effects: [{ kind: "heal", dice: "1d8", addAbilityMod: true }],
  },
  {
    name: "Healing Word",
    level: 1,
    school: "evocation",
    castingTime: "1 bonus action",
    range: "60 feet",
    duration: "instantaneous",
    concentration: false,
    economy: "bonus",
    effects: [{ kind: "heal", dice: "1d4", addAbilityMod: true }],
  },
  {
    name: "Bless",
    level: 1,
    school: "enchantment",
    castingTime: "1 action",
    range: "30 feet",
    duration: "concentration, up to 1 minute",
    concentration: true,
    economy: "action",
    effects: [{ kind: "condition", name: "blessed", expiresInRounds: 10 }],
  },
  {
    name: "Guiding Bolt",
    level: 1,
    school: "evocation",
    castingTime: "1 action",
    range: "120 feet",
    duration: "1 round",
    concentration: false,
    economy: "action",
    effects: [
      {
        kind: "attack",
        damage: "4d6",
        damageType: "radiant",
        onHit: [{ kind: "condition", name: "guiding-bolt-marked", expiresInRounds: 1 }],
      },
    ],
  },
  {
    name: "Sacred Flame",
    level: 0,
    school: "evocation",
    castingTime: "1 action",
    range: "60 feet",
    duration: "instantaneous",
    concentration: false,
    economy: "action",
    effects: [
      {
        kind: "save",
        ability: "dex",
        onFail: [{ kind: "damage", dice: "1d8", type: "radiant", addAbilityMod: false }],
        onSuccess: [],
      },
    ],
  },
  {
    name: "Shield of Faith",
    level: 1,
    school: "abjuration",
    castingTime: "1 bonus action",
    range: "60 feet",
    duration: "concentration, up to 10 minutes",
    concentration: true,
    economy: "bonus",
    effects: [{ kind: "condition", name: "shield-of-faith", expiresInRounds: 100 }],
  },
  {
    name: "Light",
    level: 0,
    school: "evocation",
    castingTime: "1 action",
    range: "touch",
    duration: "1 hour",
    concentration: false,
    economy: "action",
    effects: [{ kind: "condition", name: "lit" }],
  },
];
