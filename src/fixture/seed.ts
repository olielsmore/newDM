/**
 * Seed the fixture world: wipes the database and rebuilds it.
 * Run with: pnpm seed
 */
import fs from "node:fs";
import path from "node:path";
import { GameDb } from "../state/db.js";
import { SheetSchema } from "../rules/sheet.js";
import { MONSTERS, SPELLS, ITEMS, PLAYER_CHARACTER, NPCS, PLACES, SEED_CANON } from "./content.js";

export const DEFAULT_DB_PATH = process.env.GAME_DB ?? "data/game.db";

export function seed(dbPath = DEFAULT_DB_PATH): GameDb {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
  }

  const db = new GameDb(dbPath);

  for (const m of MONSTERS) db.saveContent("monster", m.name, m);
  for (const s of SPELLS) db.saveContent("spell", s.name, s);
  for (const i of ITEMS) db.saveContent("item", i.name, i);

  db.saveCharacter(SheetSchema.parse(PLAYER_CHARACTER));
  for (const npc of NPCS) db.saveCharacter(SheetSchema.parse(npc));
  for (const place of PLACES) db.savePlace(place);
  for (const c of SEED_CANON) db.writeCanon(c.subject, c.fact, c.tags, 0, "seed");

  db.setMeta("pc_id", "sera");
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
