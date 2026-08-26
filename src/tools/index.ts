import { GameDb } from "../state/db.js";
import {
  resolveCheck,
  resolveSave,
  resolveAttack,
  applyDamage,
  applyHealing,
  spendSlot,
  longRest,
} from "../rules/resolve.js";
import { roll, d20 } from "../rules/dice.js";
import { Ability, spellSaveDC } from "../rules/sheet.js";
import {
  startCombat,
  advanceTurn,
  consumeEconomy,
  currentCombatant,
  addCombatant,
  removeCombatant,
  expireConditions,
  concentrationDc,
  applyDeathSave,
  EconomySlot,
} from "../rules/combat.js";
import { castSpell, parseSpellDefinition } from "../rules/spells.js";
import { composeEncounters, EncounterDifficulty, partyXpBudget, xpForCr } from "../rules/encounter.js";
import { MonsterRecord, ItemRecord, SpellRecord } from "../content/types.js";
import { TOOL_DEFS } from "./defs.js";

export { TOOL_DEFS };
export type { ToolDef, ToolCallRecord } from "./types.js";

export class ToolExecutor {
  constructor(
    private db: GameDb,
    private turn: number,
  ) {}

  execute(name: string, args: Record<string, unknown>): unknown {
    const result = this.dispatch(name, args);
    this.db.appendEvent(this.turn, name, { args, result });
    return result;
  }

  private character(idOrName: string | undefined, fallbackToPc = true) {
    if (!idOrName && fallbackToPc) return this.db.getPlayerCharacter();
    if (!idOrName) throw new Error("character id is required");
    return this.db.resolveCharacter(idOrName);
  }

  private afterDamage(targetId: string, amount: number) {
    const target = this.db.getCharacter(targetId);
    if (!target) return {};
    const extras: Record<string, unknown> = {};
    if (target.concentrating) {
      const rng = this.db.getRng();
      const dc = concentrationDc(amount);
      const save = resolveSave(rng, target, "con", dc);
      this.db.saveRng(rng);
      extras.concentration = { spell: target.concentrating.spell, concentrationDc: dc, save };
      if (!save.success) {
        target.concentrating = null;
        extras.concentrationDropped = true;
      }
      this.db.saveCharacter(target);
    }
    if (target.hp <= 0 && target.kind === "monster") {
      extras.died = true;
      const scene = this.db.getScene();
      if (scene) {
        scene.present = scene.present.filter((id) => id !== target.id);
        this.db.saveScene(scene);
      }
      const combat = this.db.getCombat();
      if (combat?.active) {
        removeCombatant(combat, target.id);
        this.db.saveCombat(combat);
      }
    }
    return extras;
  }

  /**
   * Fights run on the combat state machine, not ad-hoc swings. Any attack or
   * damaging spell where a monster is involved requires active combat so
   * initiative, action economy, and monster turns actually happen.
   */
  private requireCombatForHostility(...kinds: string[]) {
    if (!kinds.includes("monster")) return;
    const combat = this.db.getCombat();
    if (combat?.active) return;
    throw new Error(
      "Combat has not started. Call start_combat first (it rolls initiative for everyone present), then act on the current combatant's turn.",
    );
  }

  private static INCAPACITATING = ["paralyzed", "stunned", "unconscious", "incapacitated", "petrified"];

  private requireCanAct(actor: { id: string; name: string; conditions: string[] }) {
    const blocking = actor.conditions.find((c) =>
      ToolExecutor.INCAPACITATING.includes(c.toLowerCase()),
    );
    if (blocking) {
      throw new Error(`${actor.name} is ${blocking} and cannot take actions. Narrate the helplessness; do not resolve an action for them.`);
    }
  }

  private consumeIfCombat(id: string, slot: EconomySlot) {
    const combat = this.db.getCombat();
    if (!combat?.active) return;
    const current = currentCombatant(combat);
    if (slot !== "reaction" && current !== id) {
      throw new Error(`It is ${current}'s turn, not ${id}'s. Resolve the current combatant or call next_combat_turn.`);
    }
    const used = consumeEconomy(combat, id, slot);
    if (!used.ok) throw new Error(used.error);
    this.db.saveCombat(combat);
  }

  private dispatch(name: string, args: Record<string, unknown>): unknown {
    const rng = this.db.getRng();
    try {
      switch (name) {
        case "roll":
          return { ...roll(rng, String(args.dice)), reason: args.reason };

        case "get_character":
          return this.character(args.id as string | undefined);

        case "ability_check": {
          const sheet = this.character(args.characterId as string, false);
          return {
            ...resolveCheck(rng, sheet, args.ability as Ability, Number(args.dc), {
              skill: args.skill as string | undefined,
              advantage: Boolean(args.advantage),
              disadvantage: Boolean(args.disadvantage),
            }),
            reason: args.reason,
          };
        }

        case "saving_throw": {
          const sheet = this.character(args.characterId as string, false);
          return {
            ...resolveSave(rng, sheet, args.ability as Ability, Number(args.dc), {
              advantage: Boolean(args.advantage),
              disadvantage: Boolean(args.disadvantage),
            }),
            reason: args.reason,
          };
        }

        case "attack": {
          const attacker = this.character(args.attackerId as string, false);
          const target = this.character(args.targetId as string, false);
          this.requireCombatForHostility(attacker.kind, target.kind);
          this.requireCanAct(attacker);
          this.consumeIfCombat(attacker.id, "action");
          // A paralyzed or unconscious defender cannot dodge (assume melee range).
          const targetHelpless = target.conditions.some((c) =>
            ToolExecutor.INCAPACITATING.includes(c.toLowerCase()),
          );
          const attackName = args.attackName as string | undefined;
          const attack = attackName
            ? attacker.attacks.find((a) => a.name.toLowerCase() === attackName.toLowerCase())
            : attacker.attacks[0];
          if (!attack) {
            const names = attacker.attacks.map((a) => a.name).join(", ") || "(none)";
            throw new Error(
              attackName
                ? `${attacker.name} has no attack named "${attackName}". Known: ${names}`
                : `${attacker.name} has no attacks defined`,
            );
          }
          const res = resolveAttack(rng, attacker, target, attack, {
            advantage: Boolean(args.advantage) || targetHelpless,
            disadvantage: Boolean(args.disadvantage),
          });
          let application;
          let extras = {};
          if (res.hit && res.damage) {
            application = applyDamage(target, Math.max(1, res.damage.total), { critical: res.critical });
            this.db.saveCharacter(target);
            extras = this.afterDamage(target.id, application.amount);
          }
          return { ...res, ...(targetHelpless ? { targetHelpless: true, advantage: true } : {}), applied: application, ...extras };
        }

        case "cast_spell": {
          const caster = this.character(args.casterId as string, false);
          const rec = this.db.getContent("spell", String(args.spell)) as SpellRecord | undefined;
          if (!rec) throw new Error(`No spell "${args.spell}" in content. Use lookup or the caster's spellsKnown.`);
          const definition = rec.definition ? parseSpellDefinition(rec.definition) : null;
          if (!definition) throw new Error(`Spell "${rec.name}" has no structured definition yet — do not improvise its mechanics.`);
          const targetId = args.targetId ? String(args.targetId) : undefined;
          const target = targetId
            ? this.character(targetId, false).id === caster.id
              ? caster
              : this.character(targetId, false)
            : undefined;
          const dealsDamage = definition.effects.some((e) => e.kind === "damage" || e.kind === "attack" || e.kind === "save");
          if (dealsDamage && target && target.id !== caster.id) {
            this.requireCombatForHostility(caster.kind, target.kind);
          }
          this.requireCanAct(caster);
          this.consumeIfCombat(caster.id, definition.economy);
          const combat = this.db.getCombat();
          const result = castSpell(rng, caster, target, definition, combat?.round);
          this.db.saveCharacter(caster);
          if (target) {
            this.db.saveCharacter(target);
            const dmg = JSON.stringify(result.applied).match(/"amount":(\d+)/);
            if (dmg) Object.assign(result, this.afterDamage(target.id, Number(dmg[1])));
          }
          return { ...result, spellSaveDC: spellSaveDC(caster) };
        }

        case "apply_effect": {
          const target = this.character(args.targetId as string, false);
          const effect = String(args.effect);
          const amount = args.amount != null ? Number(args.amount) : undefined;
          const detail = args.detail as string | undefined;
          let result: unknown;
          switch (effect) {
            case "damage":
              result = applyDamage(target, Math.max(0, amount ?? 0));
              this.db.saveCharacter(target);
              return { target: target.name, effect, ...(result as object), ...this.afterDamage(target.id, amount ?? 0) };
            case "heal":
              result = applyHealing(target, Math.max(0, amount ?? 0));
              break;
            case "add_condition": {
              if (!detail) throw new Error("add_condition requires detail (condition name)");
              if (!target.conditions.includes(detail)) target.conditions.push(detail);
              const combat = this.db.getCombat();
              if (args.expiresInRounds != null && combat?.active) {
                target.conditionExpiries[detail] = combat.round + Number(args.expiresInRounds);
              }
              result = { conditions: target.conditions, expiresAtRound: target.conditionExpiries[detail] };
              break;
            }
            case "remove_condition":
              target.conditions = target.conditions.filter((c) => c !== detail);
              if (detail) delete target.conditionExpiries[detail];
              result = { conditions: target.conditions };
              break;
            case "spend_slot":
              result = spendSlot(target, amount ?? 1);
              if (!(result as { ok: boolean }).ok)
                return { error: `${target.name} has no level ${amount ?? 1} slots remaining`, ...(result as object) };
              break;
            case "long_rest":
              longRest(target);
              target.concentrating = null;
              target.conditionExpiries = {};
              result = { hp: target.hp, maxHp: target.maxHp, slots: target.spellSlots };
              break;
            case "add_item": {
              if (!detail) throw new Error("add_item requires detail (item id or exact name)");
              const known = this.db.getContent("item", detail) as ItemRecord | undefined;
              const canon = this.db.searchCanon(detail, 5);
              const customOk = canon.some((c) => c.fact.toLowerCase().includes(detail.toLowerCase()) || c.subject.toLowerCase() === detail.toLowerCase());
              if (!known && !customOk) {
                throw new Error(
                  `Unknown item "${detail}". Grant only content items (find_items / lookup) or an item you have already written to canon.`,
                );
              }
              const itemName = known?.name ?? detail;
              const existing = target.inventory.find((i) => i.name.toLowerCase() === itemName.toLowerCase());
              if (existing) existing.qty += amount ?? 1;
              else target.inventory.push({ name: itemName, qty: amount ?? 1 });
              result = { inventory: target.inventory, fromContent: Boolean(known) };
              break;
            }
            case "remove_item": {
              const item = target.inventory.find((i) => i.name.toLowerCase() === detail?.toLowerCase());
              if (!item) return { error: `${target.name} does not have "${detail}"` };
              item.qty -= amount ?? 1;
              if (item.qty <= 0) target.inventory = target.inventory.filter((i) => i !== item);
              result = { inventory: target.inventory };
              break;
            }
            default:
              throw new Error(`Unknown effect: ${effect}`);
          }
          this.db.saveCharacter(target);
          return { target: target.name, effect, ...(typeof result === "object" ? result : { result }) };
        }

        case "get_scene": {
          const scene = this.db.getScene();
          if (!scene) return { error: "No scene set" };
          const present = scene.present.map((id) => {
            const c = this.db.getCharacter(id);
            return c
              ? { id: c.id, name: c.name, kind: c.kind, hp: c.hp, maxHp: c.maxHp, conditions: c.conditions, concentrating: c.concentrating }
              : { id };
          });
          const place = this.db.getPlace(scene.placeId);
          const combat = this.db.getCombat();
          return {
            ...scene,
            tags: place?.tags ?? [],
            present,
            exits: place?.exits ?? [],
            combat: combat?.active
              ? {
                  round: combat.round,
                  currentId: currentCombatant(combat),
                  order: combat.order,
                  economy: combat.economy,
                }
              : { active: false },
          };
        }

        case "move_scene": {
          const scene = this.db.getScene();
          if (!scene) throw new Error("No scene set");
          if (args.placeId) {
            const wanted = String(args.placeId);
            const current = this.db.getPlace(scene.placeId);
            const legal = current?.exits ?? [];
            if (wanted !== scene.placeId && !legal.some((e) => e.to === wanted)) {
              const listed = legal.map((e) => `${e.to} (${e.description})`).join("; ") || "(none)";
              throw new Error(
                `Cannot move to "${wanted}" from ${scene.placeId}. Legal exits: ${listed}. Use an exact id from this list.`,
              );
            }
            const place = this.db.getPlace(wanted);
            if (!place) throw new Error(`No place with exact id "${wanted}".`);
            scene.placeId = place.id;
            scene.name = place.name;
            scene.description = place.description;
            scene.features = place.features;
            // Occupants of the new place start as the party. NPCs do not
            // silently follow; add them with addPresent if they come along.
            scene.present = this.db.getPlayerIds();
            const visitKey = `visits:${place.id}`;
            const visits = parseInt(this.db.getMeta(visitKey) ?? "0", 10);
            this.db.setMeta(visitKey, String(visits + 1));
            const sensory = place.sensory.length ? place.sensory[visits % place.sensory.length] : undefined;
            if (args.time) scene.time = String(args.time);
            this.db.saveScene(scene);
            return { moved: true, scene, sensoryDetail: sensory, exits: place.exits, tags: place.tags, visitNumber: visits + 1 };
          }
          const joined: { id: string; initiative: number }[] = [];
          for (const id of (args.addPresent as string[]) ?? []) {
            const sheet = this.db.resolveCharacter(id);
            if (!scene.present.includes(sheet.id)) scene.present.push(sheet.id);
            // Anyone entering a live fight rolls initiative and joins it.
            const combat = this.db.getCombat();
            if (combat?.active && !combat.order.some((o) => o.id === sheet.id)) {
              const init = d20(rng, { modifier: Math.floor((sheet.abilities.dex - 10) / 2) }).total;
              addCombatant(combat, sheet.id, init);
              this.db.saveCombat(combat);
              joined.push({ id: sheet.id, initiative: init });
            }
          }
          for (const id of (args.removePresent as string[]) ?? []) scene.present = scene.present.filter((p) => p !== id);
          if (args.time) scene.time = String(args.time);
          this.db.saveScene(scene);
          return { moved: false, scene, ...(joined.length ? { joinedCombat: joined } : {}) };
        }

        case "lookup": {
          const data = this.db.getContent(String(args.kind), String(args.name));
          return data ?? { error: `No ${args.kind} with exact id or unique name "${args.name}". Use find_monsters / find_items.` };
        }

        case "find_monsters": {
          const rows = this.db.findMonsters({
            crMin: args.crMin != null ? Number(args.crMin) : undefined,
            crMax: args.crMax != null ? Number(args.crMax) : undefined,
            type: args.type as string | undefined,
            environment: args.environment as string | undefined,
            keywords: args.keywords as string | undefined,
          });
          return rows.map((r) => {
            const m = r as MonsterRecord;
            return { id: m.id, name: m.name, cr: m.cr, type: m.type, environments: m.environments, description: m.description };
          });
        }

        case "find_items": {
          const rows = this.db.findItems({
            rarityMax: args.rarityMax as string | undefined,
            category: args.category as string | undefined,
            keywords: args.keywords as string | undefined,
            budgetGp: args.budgetGp != null ? Number(args.budgetGp) : undefined,
          });
          return rows.map((r) => {
            const i = r as ItemRecord;
            return { id: i.id, name: i.name, rarity: i.rarity, category: i.category, costGp: i.costGp, mechanics: i.mechanics };
          });
        }

        case "suggest_encounter": {
          const difficulty = args.difficulty as EncounterDifficulty;
          const levels = this.db.getPlayerIds().map((id) => this.db.getCharacter(id)?.level ?? 1);
          const budget = partyXpBudget(levels, difficulty);
          const scene = this.db.getScene();
          const place = scene ? this.db.getPlace(scene.placeId) : undefined;
          const env = place?.tags?.[0];
          let monsters = this.db.findMonsters({ environment: env, limit: 40 }) as MonsterRecord[];
          if (monsters.length === 0) monsters = this.db.findMonsters({ limit: 40 }) as MonsterRecord[];
          const candidates = monsters.map((m) => ({
            id: m.id,
            name: m.name,
            cr: m.cr,
            xp: xpForCr(m.cr),
            type: m.type,
            description: m.description,
          }));
          return {
            partyLevels: levels,
            difficulty,
            xpBudget: budget,
            environmentTags: place?.tags ?? [],
            compositions: composeEncounters(candidates, budget, difficulty),
          };
        }

        case "spawn_monster": {
          const data = this.db.getContent("monster", String(args.monster)) as MonsterRecord | undefined;
          if (!data?.sheet) throw new Error(`No monster with exact id "${args.monster}". Use find_monsters first.`);
          let n = 1;
          const base = data.id;
          while (this.db.getCharacter(`${base}-${n}`)) n++;
          const id = `${base}-${n}`;
          const label = (args.label as string) || `${data.name} ${n}`;
          const sheet = { ...data.sheet, id, name: label, kind: "monster" as const };
          this.db.saveCharacter(sheet);
          const scene = this.db.getScene();
          if (scene && !scene.present.includes(id)) {
            scene.present.push(id);
            this.db.saveScene(scene);
          }
          const combat = this.db.getCombat();
          if (combat?.active) {
            const init = d20(rng, { modifier: Math.floor((sheet.abilities.dex - 10) / 2) }).total;
            addCombatant(combat, id, init);
            this.db.saveCombat(combat);
          }
          return { id, name: label, hp: sheet.hp, ac: sheet.ac };
        }

        case "start_combat": {
          const scene = this.db.getScene();
          if (!scene) throw new Error("No scene set");
          const ids = [...new Set([...this.db.getPlayerIds(), ...scene.present])];
          const combatants = ids.map((id) => {
            const s = this.db.getCharacter(id);
            if (!s) throw new Error(`Present id "${id}" has no sheet`);
            return s;
          });
          const state = startCombat(rng, combatants);
          this.db.saveCombat(state);
          return {
            round: state.round,
            currentId: currentCombatant(state),
            order: state.order,
          };
        }

        case "end_combat": {
          this.db.saveCombat(undefined);
          return { ended: true };
        }

        case "next_combat_turn": {
          const combat = this.db.getCombat();
          if (!combat?.active) throw new Error("Combat is not active");
          const { wrapped } = advanceTurn(combat);
          let expired: { id: string; expired: string[] }[] = [];
          if (wrapped) {
            const sheets = combat.order.map((c) => this.db.getCharacter(c.id)).filter(Boolean);
            expired = expireConditions(sheets as NonNullable<(typeof sheets)[number]>[], combat.round);
            for (const s of sheets) if (s) this.db.saveCharacter(s);
          }
          this.db.saveCombat(combat);
          return {
            round: combat.round,
            currentId: currentCombatant(combat),
            wrapped,
            expired,
            economy: combat.economy[currentCombatant(combat) ?? ""],
          };
        }

        case "death_save": {
          const sheet = this.character(args.characterId as string, false);
          if (sheet.hp > 0) throw new Error(`${sheet.name} is not at 0 HP`);
          if (sheet.kind !== "pc") throw new Error("Death saves are for player characters; monsters die at 0 HP");
          const r = d20(rng);
          const result = applyDeathSave(sheet, r.kept, r.natural20, r.natural1);
          this.db.saveCharacter(sheet);
          return { ...result, d20: r };
        }

        case "canon_search": {
          const facts = this.db.searchCanon(String(args.query));
          return facts.length
            ? facts.map((f) => ({ subject: f.subject, fact: f.fact, turn: f.turn }))
            : { result: "No canon found. If you establish this fact, record it with canon_write." };
        }

        case "canon_write": {
          const id = this.db.writeCanon(String(args.subject), String(args.fact), String(args.tags ?? ""), this.turn, "dm", false);
          return { recorded: true, id };
        }

        case "reveal_secret": {
          const hidden = this.db.hiddenCanonBySubject(String(args.subject));
          if (hidden.length === 0) {
            return { error: `No hidden secret for subject "${args.subject}". Subjects are exact (e.g. "The east gallery").` };
          }
          const revealed = hidden.map((f) => this.db.revealCanon(f.id)).filter(Boolean);
          return { revealed: revealed.map((f) => ({ subject: f!.subject, fact: f!.fact })) };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } finally {
      this.db.saveRng(rng);
    }
  }
}

export { spellSaveDC };
