/**
 * Seed the fixture world: wipes the database and rebuilds it.
 * Run with: pnpm seed
 */
import fs from "node:fs";
import path from "node:path";
import { GameDb, Place } from "../state/db.js";
import { SheetSchema } from "../rules/sheet.js";
import { FIXTURE_SPELLS } from "../rules/spells.js";
import { contentId, MonsterRecord, SpellRecord, ItemRecord } from "../content/types.js";
import { MONSTERS, SPELLS, ITEMS, PLAYER_CHARACTER, NPCS, PLACES, SEED_CANON } from "./content.js";
import { NPC_VOICES } from "./voices.js";

export const DEFAULT_DB_PATH = process.env.GAME_DB ?? "data/game.db";

const PLACE_TAGS: Record<string, string[]> = {
  "drowned-rat": ["urban", "settlement"],
  "town-square": ["urban", "settlement"],
  chapel: ["urban", "settlement"],
  "mine-road": ["wilderness", "hill"],
  "warrens-entrance": ["underground", "mine"],
  "warrens-gallery": ["underground", "mine", "undead-haunted"],
  "warrens-deep": ["underground", "mine", "undead-haunted"],
};

const MONSTER_ENV: Record<string, { type: string; size: string; environments: string[] }> = {
  Goblin: { type: "humanoid", size: "small", environments: ["forest", "hill", "underdark"] },
  Wolf: { type: "beast", size: "medium", environments: ["forest", "hill", "arctic"] },
  "Giant Rat": { type: "beast", size: "small", environments: ["urban", "underdark", "underground"] },
  Skeleton: { type: "undead", size: "medium", environments: ["underground", "mine", "undead-haunted"] },
  Cultist: { type: "humanoid", size: "medium", environments: ["urban", "underground"] },
  Ghoul: { type: "undead", size: "medium", environments: ["underground", "mine", "undead-haunted"] },
};

function monsterRecords(): MonsterRecord[] {
  return MONSTERS.map((m) => {
    const meta = MONSTER_ENV[m.name] ?? { type: "humanoid", size: "medium", environments: [] };
    return {
      kind: "monster" as const,
      id: contentId(m.name),
      name: m.name,
      cr: m.cr,
      type: meta.type,
      size: meta.size,
      environments: meta.environments,
      description: m.description,
      tactics: m.tactics,
      sheet: SheetSchema.parse(m.sheet),
    };
  });
}

function spellRecords(): SpellRecord[] {
  return SPELLS.map((s) => {
    const definition = FIXTURE_SPELLS.find((d) => d.name === s.name);
    if (!definition) throw new Error(`Fixture spell "${s.name}" has no structured definition`);
    return {
      kind: "spell" as const,
      id: contentId(s.name),
      name: s.name,
      level: s.level,
      school: s.school,
      classes: ["cleric"],
      definition,
      mechanics: s.mechanics,
    };
  });
}

function itemRecords(): ItemRecord[] {
  const categories: Record<string, string> = {
    "Potion of Healing": "potion",
    Mace: "weapon",
    Shield: "armor",
    "Chain Shirt": "armor",
    Torch: "gear",
    "Hempen Rope (50 ft)": "gear",
    "Miner's Salt-Charm": "wondrous",
  };
  const costs: Record<string, number> = {
    "Potion of Healing": 50,
    Mace: 5,
    Shield: 10,
    "Chain Shirt": 50,
    Torch: 0.01,
    "Hempen Rope (50 ft)": 1,
    "Miner's Salt-Charm": 2,
  };
  return ITEMS.map((i) => ({
    kind: "item" as const,
    id: contentId(i.name),
    name: i.name,
    rarity: i.rarity,
    category: categories[i.name] ?? "gear",
    attunement: false,
    costGp: costs[i.name],
    mechanics: i.mechanics,
  }));
}

export function seed(dbPath = DEFAULT_DB_PATH): GameDb {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
  }

  const db = new GameDb(dbPath);

  for (const m of monsterRecords()) db.saveContentRecord(m);
  for (const s of spellRecords()) db.saveContentRecord(s);
  for (const i of itemRecords()) db.saveContentRecord(i);

  db.saveCharacter(SheetSchema.parse(PLAYER_CHARACTER));
  for (const npc of NPCS) db.saveCharacter(SheetSchema.parse(npc));
  for (const place of PLACES) {
    const tagged: Place = { ...place, tags: PLACE_TAGS[place.id] ?? [] };
    db.savePlace(tagged);
  }
  for (const voice of NPC_VOICES) db.saveVoice(voice);

  for (const c of SEED_CANON) {
    const hidden = c.tags.split(",").map((t) => t.trim()).includes("secret");
    const fact = hidden ? c.fact.replace(/^SECRET\s*\([^)]*\):\s*/i, "") : c.fact;
    db.writeCanon(c.subject, fact, c.tags, 0, "seed", hidden);
  }

  db.setMeta("pc_id", "sera");
  db.setMeta("pc_ids", JSON.stringify(["sera"]));
  db.setMeta("seed", String(process.env.GAME_SEED ?? 20260825));
  db.setMeta("turn", "0");
  db.saveScene({
    placeId: "drowned-rat",
    name: "The Drowned Rat",
    description: PLACES.find((p) => p.id === "drowned-rat")!.description,
    present: ["marla", "tam", "greely"],
    features: PLACES.find((p) => p.id === "drowned-rat")!.features,
    time: "evening, rain setting in",
  });

  return db;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const db = seed();
  console.log(`Seeded fixture world at ${DEFAULT_DB_PATH}`);
  console.log(`  PC: Sera Valen (level 2 cleric) | Start: The Drowned Rat, Emberhollow`);
  console.log(`  ${MONSTERS.length} monsters, ${SPELLS.length} spells, ${ITEMS.length} items, ${NPCS.length} NPCs, ${PLACES.length} places, ${SEED_CANON.length} canon facts`);
  db.close();
}
