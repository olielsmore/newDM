import { ToolDef } from "./types.js";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "roll",
    description:
      "Roll dice for anything not covered by a more specific tool. Never invent dice results.",
    parameters: {
      type: "object",
      properties: {
        dice: { type: "string", description: "e.g. '2d6+3' or '1d20'" },
        reason: { type: "string" },
      },
      required: ["dice", "reason"],
    },
  },
  {
    name: "get_character",
    description:
      "Get a live sheet. Pass an exact id from get_scene (e.g. 'sera', 'goblin-1'). Omit id for the player character.",
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "Exact character id. Do not guess or abbreviate." } },
      required: [],
    },
  },
  {
    name: "ability_check",
    description:
      "Resolve an ability or skill check. DC 5/10/15/20/25/30. Only when the outcome is uncertain AND failure is interesting.",
    parameters: {
      type: "object",
      properties: {
        characterId: { type: "string", description: "Exact character id" },
        ability: { type: "string", enum: ABILITIES },
        skill: { type: "string" },
        dc: { type: "integer" },
        advantage: { type: "boolean" },
        disadvantage: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["characterId", "ability", "dc", "reason"],
    },
  },
  {
    name: "saving_throw",
    description: "Resolve a saving throw against a DC.",
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
      "Resolve a weapon or natural attack vs AC and apply damage. Uses exact character ids. Consumes the attacker's action if combat is live.",
    parameters: {
      type: "object",
      properties: {
        attackerId: { type: "string" },
        targetId: { type: "string" },
        attackName: { type: "string" },
        advantage: { type: "boolean" },
        disadvantage: { type: "boolean" },
      },
      required: ["attackerId", "targetId"],
    },
  },
  {
    name: "cast_spell",
    description:
      "Cast a spell from the content database. Spends a slot for leveled spells, resolves structured effects, tracks concentration. Use exact caster/target ids and the spell's exact name or id.",
    parameters: {
      type: "object",
      properties: {
        casterId: { type: "string" },
        spell: { type: "string", description: "Exact spell name or id, e.g. 'Sacred Flame'" },
        targetId: { type: "string" },
      },
      required: ["casterId", "spell"],
    },
  },
  {
    name: "apply_effect",
    description:
      "Apply a mechanical effect outside attack/cast_spell: damage, heal, conditions, slots, rest, items. add_item requires a content item id or a fact already written to canon.",
    parameters: {
      type: "object",
      properties: {
        targetId: { type: "string" },
        effect: {
          type: "string",
          enum: ["damage", "heal", "add_condition", "remove_condition", "spend_slot", "long_rest", "add_item", "remove_item"],
        },
        amount: { type: "integer" },
        detail: { type: "string" },
        expiresInRounds: { type: "integer", description: "For add_condition: expire at current combat round + N" },
      },
      required: ["targetId", "effect"],
    },
  },
  {
    name: "get_scene",
    description: "Current scene: place id, exits (use these exact ids with move_scene), who is present (use these exact ids), combat state if any.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "move_scene",
    description:
      "Move to a destination by EXACT place id from the current scene's exits, or update who is present. A wrong id errors with the legal exits — fix the id and retry. Never guess a place id.",
    parameters: {
      type: "object",
      properties: {
        placeId: { type: "string", description: "Exact destination id from the current exits list" },
        addPresent: { type: "array", items: { type: "string" } },
        removePresent: { type: "array", items: { type: "string" } },
        time: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "lookup",
    description: "Look up one content record by exact id or exact unique name.",
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
    name: "find_monsters",
    description:
      "Search the content database for monster candidates. Filter by CR, type, environment tags, keywords. Returns up to 12. Then spawn by exact id.",
    parameters: {
      type: "object",
      properties: {
        crMin: { type: "number" },
        crMax: { type: "number" },
        type: { type: "string" },
        environment: { type: "string" },
        keywords: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "find_items",
    description: "Search items for loot, shops, or quest rewards. Then grant with apply_effect add_item using the exact item id.",
    parameters: {
      type: "object",
      properties: {
        rarityMax: { type: "string", enum: ["mundane", "common", "uncommon", "rare", "very rare", "legendary"] },
        category: { type: "string" },
        keywords: { type: "string" },
        budgetGp: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "suggest_encounter",
    description:
      "Engine computes a DMG XP budget from the party level and returns 2-3 candidate compositions filtered by this place's environment tags. You pick for fiction fit, then spawn_monster each member by exact id.",
    parameters: {
      type: "object",
      properties: {
        difficulty: { type: "string", enum: ["easy", "medium", "hard", "deadly"] },
      },
      required: ["difficulty"],
    },
  },
  {
    name: "spawn_monster",
    description: "Instantiate a monster from content by exact monster id (from find_monsters / lookup / suggest_encounter).",
    parameters: {
      type: "object",
      properties: {
        monster: { type: "string", description: "Exact content id, e.g. 'goblin'" },
        label: { type: "string" },
      },
      required: ["monster"],
    },
  },
  {
    name: "create_npc",
    description:
      "Mint a NEW named NPC that has no sheet yet (a rescued miner, a passerby, a rival). Creates a simple commoner-grade sheet, adds them to the scene, and writes their existence to canon. NEVER reuse an existing character's id for a different person.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "New unique lowercase id, e.g. 'joren'" },
        name: { type: "string", description: "Display name, e.g. 'Joren'" },
        description: { type: "string", description: "One durable sentence about who they are (written to canon)" },
        hp: { type: "integer", description: "Optional max HP, default 4 (commoner)" },
      },
      required: ["id", "name", "description"],
    },
  },
  {
    name: "start_combat",
    description: "Roll initiative for everyone present plus the PC, start turn order. Call when a fight begins.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "end_combat",
    description: "End combat and clear turn order.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "next_combat_turn",
    description:
      "Advance to the next combatant. At the start of a new round the engine expires timed conditions and resets action economy. Call after you have resolved the current combatant's actions.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "death_save",
    description: "Roll a death saving throw for a PC at 0 HP. The engine tracks successes/failures.",
    parameters: {
      type: "object",
      properties: { characterId: { type: "string" } },
      required: ["characterId"],
    },
  },
  {
    name: "canon_search",
    description: "Search established (non-secret) world facts. Never guess a fact — search first.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "canon_write",
    description: "Record a durable fact you just established. Do not write secrets here — they are seeded hidden.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string" },
        fact: { type: "string" },
        tags: { type: "string" },
      },
      required: ["subject", "fact"],
    },
  },
  {
    name: "reveal_secret",
    description:
      "Un-hide and return a seeded secret about a subject, only when the fiction has earned it (successful check, confession, discovery). Event-logged and auditable.",
    parameters: {
      type: "object",
      properties: { subject: { type: "string", description: "Exact subject, e.g. 'The east gallery'" } },
      required: ["subject"],
    },
  },
];
