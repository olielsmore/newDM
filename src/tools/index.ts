/**
 * The DM agent's toolbox. These are the ONLY ways the model can learn
 * mechanical state or make anything happen. Every execution is appended
 * to the event log, which the grounding validator checks prose against.
 */
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
import { roll } from "../rules/dice.js";
import { Ability, spellSaveDC, spellAttackModifier } from "../rules/sheet.js";

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "roll",
    description:
      "Roll dice for anything not covered by a more specific tool (random tables, damage from hazards, NPC checks without sheets). Never invent dice results — always call this.",
    parameters: {
      type: "object",
      properties: {
        dice: { type: "string", description: "Dice expression, e.g. '2d6+3' or '1d20'" },
        reason: { type: "string", description: "What this roll is for" },
      },
      required: ["dice", "reason"],
    },
  },
  {
    name: "get_character",
    description:
      "Get the full current sheet for a character, NPC, or monster (HP, AC, slots, conditions, inventory). Query this rather than remembering values.",
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "Character id or name. Omit for the player character." } },
      required: [],
    },
  },
  {
    name: "ability_check",
    description:
      "Resolve an ability check or skill check against a DC. The engine computes modifiers and rolls. Use DC 5 trivial / 10 easy / 15 medium / 20 hard / 25 very hard. Only call when the outcome is uncertain AND failure is interesting — trivial actions just succeed.",
    parameters: {
      type: "object",
      properties: {
        characterId: { type: "string", description: "Who is making the check (id or name)" },
        ability: { type: "string", enum: ABILITIES },
        skill: { type: "string", description: "Skill name if applicable, e.g. 'stealth', 'persuasion'" },
        dc: { type: "integer" },
        advantage: { type: "boolean" },
        disadvantage: { type: "boolean" },
        reason: { type: "string", description: "One-line justification for the DC chosen" },
      },
      required: ["characterId", "ability", "dc", "reason"],
    },
  },
  {
    name: "saving_throw",
    description: "Resolve a saving throw for a character or monster against a DC.",
    parameters: {
      type: "object",
      properties: {
        characterId: { type: "string" },
        ability: { type: "string", enum: ABILITIES },
        dc: { type: "integer" },
        advantage: { type: "boolean" },
        disadvantage: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["characterId", "ability", "dc", "reason"],
    },
  },
  {
    name: "attack",
    description:
      "Resolve a weapon or natural attack: to-hit roll vs AC, damage on hit, damage automatically applied to the target's HP. Use for both PC and NPC/monster attacks.",
    parameters: {
      type: "object",
      properties: {
        attackerId: { type: "string" },
        targetId: { type: "string" },
        attackName: { type: "string", description: "Which of the attacker's attacks. Omit to use the first." },
        advantage: { type: "boolean" },
        disadvantage: { type: "boolean" },
      },
      required: ["attackerId", "targetId"],
    },
  },
  {
    name: "apply_effect",
    description:
      "Apply a mechanical effect outside of the attack tool: damage (traps, spells, falls), healing, gaining/losing conditions, spending a spell slot, or a long rest.",
    parameters: {
      type: "object",
      properties: {
        targetId: { type: "string" },
        effect: {
          type: "string",
          enum: ["damage", "heal", "add_condition", "remove_condition", "spend_slot", "long_rest", "add_item", "remove_item"],
        },
        amount: { type: "integer", description: "For damage/heal/spend_slot(level)/item qty" },
        detail: { type: "string", description: "Condition name, item name, or damage type" },
      },
      required: ["targetId", "effect"],
    },
  },
  {
    name: "get_scene",
    description: "Get the current scene: location, who is present, features, time. Query before narrating a place.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "move_scene",
    description:
      "Move the party to a different place (by place id from the current place's exits), or update who is present in the current scene.",
    parameters: {
      type: "object",
      properties: {
        placeId: { type: "string", description: "Destination place id. Omit to stay and only update presence." },
        addPresent: { type: "array", items: { type: "string" }, description: "Character/monster ids arriving" },
        removePresent: { type: "array", items: { type: "string" }, description: "Ids leaving or dead" },
        time: { type: "string", description: "New in-fiction time, if it changed" },
      },
      required: [],
    },
  },
  {
    name: "lookup",
    description: "Look up 5e content: a monster statblock, spell, or item. Use before improvising rules for one.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["monster", "spell", "item"] },
        name: { type: "string" },
      },
      required: ["kind", "name"],
    },
  },
  {
    name: "spawn_monster",
    description:
      "Instantiate a monster from the content database into the scene as a combatant with its own HP (e.g. 'goblin' -> 'goblin-1'). Returns the new combatant id.",
    parameters: {
      type: "object",
      properties: {
        monster: { type: "string", description: "Monster name from content, e.g. 'goblin'" },
        label: { type: "string", description: "Optional distinguishing label, e.g. 'scarred goblin'" },
      },
      required: ["monster"],
    },
  },
  {
    name: "canon_search",
    description:
      "Search established world facts (names, history, promises, prior events). Use whenever you are about to state a fact you are not certain of — never guess.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "canon_write",
    description:
      "Record a new durable fact you just established in narration (a name you coined, a detail, a promise an NPC made). Keeps the world consistent.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Entity the fact is about, e.g. 'Marla Fenwick'" },
        fact: { type: "string", description: "One sentence, e.g. 'Runs the Drowned Rat tavern; missing two fingers on her left hand.'" },
        tags: { type: "string", description: "Comma-separated tags, e.g. 'npc,tavern'" },
      },
      required: ["subject", "fact"],
    },
  },
];

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

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

  private requireCharacter(idOrName: string | undefined, fallbackToPc = true) {
    if (!idOrName && fallbackToPc) return this.db.getPlayerCharacter();
    const sheet = idOrName ? this.db.findCharacter(idOrName) : undefined;
    if (!sheet) throw new Error(`Unknown character: "${idOrName}". Use get_scene to see who is present.`);
    return sheet;
  }

  private dispatch(name: string, args: Record<string, unknown>): unknown {
    const rng = this.db.getRng();
    try {
      switch (name) {
        case "roll": {
          const r = roll(rng, String(args.dice));
          return { ...r, reason: args.reason };
        }

        case "get_character": {
          const sheet = this.requireCharacter(args.id as string | undefined);
          return sheet;
        }

        case "ability_check": {
          const sheet = this.requireCharacter(args.characterId as string, false);
          const res = resolveCheck(rng, sheet, args.ability as Ability, Number(args.dc), {
            skill: args.skill as string | undefined,
            advantage: Boolean(args.advantage),
            disadvantage: Boolean(args.disadvantage),
          });
          return { ...res, reason: args.reason };
        }

        case "saving_throw": {
          const sheet = this.requireCharacter(args.characterId as string, false);
          const res = resolveSave(rng, sheet, args.ability as Ability, Number(args.dc), {
            advantage: Boolean(args.advantage),
            disadvantage: Boolean(args.disadvantage),
          });
          return { ...res, reason: args.reason };
        }

        case "attack": {
          const attacker = this.requireCharacter(args.attackerId as string, false);
          const target = this.requireCharacter(args.targetId as string, false);
          const attackName = args.attackName as string | undefined;
          const attack = attackName
            ? attacker.attacks.find((a) => a.name.toLowerCase() === attackName.toLowerCase()) ?? attacker.attacks[0]
            : attacker.attacks[0];
          if (!attack) throw new Error(`${attacker.name} has no attacks defined`);
          const res = resolveAttack(rng, attacker, target, attack, {
            advantage: Boolean(args.advantage),
            disadvantage: Boolean(args.disadvantage),
          });
          let application;
          if (res.hit && res.damage) {
            application = applyDamage(target, Math.max(1, res.damage.total));
            this.db.saveCharacter(target);
          }
          return { ...res, applied: application };
        }

        case "apply_effect": {
          const target = this.requireCharacter(args.targetId as string, false);
          const effect = String(args.effect);
          const amount = args.amount != null ? Number(args.amount) : undefined;
          const detail = args.detail as string | undefined;
          let result: unknown;
          switch (effect) {
            case "damage":
              result = applyDamage(target, Math.max(0, amount ?? 0));
              break;
            case "heal":
              result = applyHealing(target, Math.max(0, amount ?? 0));
              break;
            case "add_condition":
              if (detail && !target.conditions.includes(detail)) target.conditions.push(detail);
              result = { conditions: target.conditions };
              break;
            case "remove_condition":
              target.conditions = target.conditions.filter((c) => c !== detail);
              result = { conditions: target.conditions };
              break;
            case "spend_slot":
              result = spendSlot(target, amount ?? 1);
              if (!(result as { ok: boolean }).ok)
                return { error: `${target.name} has no level ${amount ?? 1} slots remaining`, ...(result as object) };
              break;
            case "long_rest":
              longRest(target);
              result = { hp: target.hp, maxHp: target.maxHp, slots: target.spellSlots };
              break;
            case "add_item": {
              const existing = target.inventory.find((i) => i.name.toLowerCase() === detail?.toLowerCase());
              if (existing) existing.qty += amount ?? 1;
              else if (detail) target.inventory.push({ name: detail, qty: amount ?? 1 });
              result = { inventory: target.inventory };
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
            const c = this.db.findCharacter(id);
            return c ? { id: c.id, name: c.name, kind: c.kind, hp: c.hp, maxHp: c.maxHp, conditions: c.conditions } : { id };
          });
          const place = this.db.getPlace(scene.placeId);
          return { ...scene, present, exits: place?.exits ?? [] };
        }

        case "move_scene": {
          const scene = this.db.getScene() ?? {
            placeId: "",
            name: "",
            description: "",
            present: [],
            features: [],
            time: "day",
          };
          if (args.placeId) {
            const place = this.db.getPlace(String(args.placeId));
            if (!place) throw new Error(`Unknown place: ${args.placeId}`);
            scene.placeId = place.id;
            scene.name = place.name;
            scene.description = place.description;
            scene.features = place.features;
            // Rotate one sensory detail per visit so revisits don't repeat.
            const visitKey = `visits:${place.id}`;
            const visits = parseInt(this.db.getMeta(visitKey) ?? "0", 10);
            this.db.setMeta(visitKey, String(visits + 1));
            const sensory = place.sensory.length ? place.sensory[visits % place.sensory.length] : undefined;
            if (args.time) scene.time = String(args.time);
            this.db.saveScene(scene);
            return { moved: true, scene, sensoryDetail: sensory, exits: place.exits, visitNumber: visits + 1 };
          }
          for (const id of (args.addPresent as string[]) ?? []) if (!scene.present.includes(id)) scene.present.push(id);
          for (const id of (args.removePresent as string[]) ?? []) scene.present = scene.present.filter((p) => p !== id);
          if (args.time) scene.time = String(args.time);
          this.db.saveScene(scene);
          return { moved: false, scene };
        }

        case "lookup": {
          const data = this.db.getContent(String(args.kind), String(args.name));
          return data ?? { error: `No ${args.kind} named "${args.name}" in content. You may improvise, but write what you decide to canon.` };
        }

        case "spawn_monster": {
          const data = this.db.getContent("monster", String(args.monster)) as
            | { sheet: Record<string, unknown> }
            | undefined;
          if (!data?.sheet) throw new Error(`No monster named "${args.monster}" in content`);
          let n = 1;
          while (this.db.getCharacter(`${String(args.monster).toLowerCase().replace(/\s+/g, "-")}-${n}`)) n++;
          const id = `${String(args.monster).toLowerCase().replace(/\s+/g, "-")}-${n}`;
          const label = (args.label as string) || `${data.sheet.name} ${n}`;
          const sheet = { ...data.sheet, id, name: label, kind: "monster" } as never;
          this.db.saveCharacter(sheet);
          const scene = this.db.getScene();
          if (scene && !scene.present.includes(id)) {
            scene.present.push(id);
            this.db.saveScene(scene);
          }
          return { id, name: label, hp: (sheet as { hp: number }).hp, ac: (sheet as { ac: number }).ac };
        }

        case "canon_search": {
          const facts = this.db.searchCanon(String(args.query));
          return facts.length
            ? facts.map((f) => ({ subject: f.subject, fact: f.fact, turn: f.turn }))
            : { result: "No canon found for that query. If you establish this fact in narration, record it with canon_write." };
        }

        case "canon_write": {
          const id = this.db.writeCanon(
            String(args.subject),
            String(args.fact),
            String(args.tags ?? ""),
            this.turn,
            "dm",
          );
          return { recorded: true, id };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } finally {
      this.db.saveRng(rng);
    }
  }
}

export { spellSaveDC, spellAttackModifier };
