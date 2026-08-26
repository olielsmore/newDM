/**
 * All game state lives here. The LLM never holds state — it queries it.
 */
import Database from "better-sqlite3";
import { Sheet, SheetSchema } from "../rules/sheet.js";
import { Rng } from "../rules/dice.js";

export interface CanonFact {
  id: number;
  subject: string;
  fact: string;
  tags: string;
  turn: number;
  source: string;
}

export interface GameEvent {
  id: number;
  turn: number;
  kind: string;
  data: unknown;
}

export interface Scene {
  placeId: string;
  name: string;
  description: string;
  /** ids of NPCs / monsters currently present */
  present: string[];
  /** interactable features the DM can lean on */
  features: string[];
  /** in-fiction time of day, weather, etc. */
  time: string;
}

export interface Place {
  id: string;
  name: string;
  description: string;
  features: string[];
  exits: { to: string; description: string }[];
  /** sensory details, rotated across visits so revisits don't repeat */
  sensory: string[];
}

export class GameDb {
  db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS content (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (kind, id));
      CREATE TABLE IF NOT EXISTS canon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        fact TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '',
        turn INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'dm',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turn INTEGER NOT NULL,
        kind TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS turns (
        id INTEGER PRIMARY KEY,
        player_input TEXT NOT NULL,
        dm_output TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  // --- meta ---

  getMeta(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  getTurn(): number {
    return parseInt(this.getMeta("turn") ?? "0", 10);
  }

  nextTurn(): number {
    const t = this.getTurn() + 1;
    this.setMeta("turn", String(t));
    return t;
  }

  /** RNG whose state persists across process restarts, so replays stay deterministic. */
  getRng(): Rng {
    const state = this.getMeta("rng_state");
    return new Rng(state ? parseInt(state, 10) : parseInt(this.getMeta("seed") ?? "12345", 10));
  }

  saveRng(rng: Rng): void {
    this.setMeta("rng_state", String(rng.getState()));
  }

  // --- characters ---

  getCharacter(id: string): Sheet | undefined {
    const row = this.db.prepare("SELECT data FROM characters WHERE id = ?").get(id) as { data: string } | undefined;
    return row ? SheetSchema.parse(JSON.parse(row.data)) : undefined;
  }

  /** Case-insensitive lookup by id or name, so the LLM can say "the goblin". */
  findCharacter(idOrName: string): Sheet | undefined {
    const direct = this.getCharacter(idOrName);
    if (direct) return direct;
    const rows = this.db.prepare("SELECT data FROM characters").all() as { data: string }[];
    const needle = idOrName.toLowerCase();
    for (const row of rows) {
      const sheet = SheetSchema.parse(JSON.parse(row.data));
      if (sheet.name.toLowerCase() === needle || sheet.id.toLowerCase() === needle) return sheet;
    }
    // Prefix match as a fallback ("goblin" matches "goblin-1").
    for (const row of rows) {
      const sheet = SheetSchema.parse(JSON.parse(row.data));
      if (sheet.id.toLowerCase().startsWith(needle) || sheet.name.toLowerCase().startsWith(needle)) return sheet;
    }
    return undefined;
  }

  saveCharacter(sheet: Sheet): void {
    this.db
      .prepare("INSERT INTO characters (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data")
      .run(sheet.id, JSON.stringify(sheet));
  }

  getPlayerCharacter(): Sheet {
    const id = this.getMeta("pc_id");
    if (!id) throw new Error("No player character configured (meta.pc_id)");
    const sheet = this.getCharacter(id);
    if (!sheet) throw new Error(`Player character ${id} not found`);
    return sheet;
  }

  // --- places & scene ---

  getPlace(id: string): Place | undefined {
    const row = this.db.prepare("SELECT data FROM places WHERE id = ?").get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Place) : undefined;
  }

  /** Fuzzy lookup: exact id, exact name, then best token overlap ("mine-gallery" -> "warrens-gallery"). */
  findPlace(idOrName: string): Place | undefined {
    const direct = this.getPlace(idOrName);
    if (direct) return direct;
    const rows = this.db.prepare("SELECT data FROM places").all() as { data: string }[];
    const places = rows.map((r) => JSON.parse(r.data) as Place);
    const needle = idOrName.toLowerCase();
    const byName = places.find((p) => p.name.toLowerCase() === needle);
    if (byName) return byName;
    const tokens = needle.split(/[^a-z0-9]+/).filter(Boolean);
    let best: { place: Place; score: number } | undefined;
    for (const p of places) {
      const hay = `${p.id} ${p.name}`.toLowerCase();
      // The last token is usually the specific noun ("gallery" in "mine-gallery"), so weight it double.
      const score = tokens.reduce(
        (s, t, i) => s + (hay.includes(t) ? (i === tokens.length - 1 ? 2 : 1) : 0),
        0,
      );
      if (score > 0 && (!best || score > best.score)) best = { place: p, score };
    }
    return best?.place;
  }

  listPlaces(): { id: string; name: string }[] {
    const rows = this.db.prepare("SELECT data FROM places").all() as { data: string }[];
    return rows.map((r) => {
      const p = JSON.parse(r.data) as Place;
      return { id: p.id, name: p.name };
    });
  }

  savePlace(place: Place): void {
    this.db
      .prepare("INSERT INTO places (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data")
      .run(place.id, JSON.stringify(place));
  }

  getScene(): Scene | undefined {
    const raw = this.getMeta("scene");
    return raw ? (JSON.parse(raw) as Scene) : undefined;
  }

  saveScene(scene: Scene): void {
    this.setMeta("scene", JSON.stringify(scene));
  }

  // --- content (monsters, spells, items) ---

  getContent(kind: string, id: string): unknown | undefined {
    const norm = id.toLowerCase().replace(/\s+/g, "-");
    const row = this.db.prepare("SELECT data FROM content WHERE kind = ? AND id = ?").get(kind, norm) as
      | { data: string }
      | undefined;
    if (row) return JSON.parse(row.data);
    const like = this.db
      .prepare("SELECT data FROM content WHERE kind = ? AND id LIKE ? LIMIT 1")
      .get(kind, `%${norm}%`) as { data: string } | undefined;
    return like ? JSON.parse(like.data) : undefined;
  }

  saveContent(kind: string, id: string, data: unknown): void {
    this.db
      .prepare("INSERT INTO content (kind, id, data) VALUES (?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data")
      .run(kind, id.toLowerCase().replace(/\s+/g, "-"), JSON.stringify(data));
  }

  // --- canon ---

  writeCanon(subject: string, fact: string, tags: string, turn: number, source: string): number {
    const res = this.db
      .prepare("INSERT INTO canon (subject, fact, tags, turn, source) VALUES (?, ?, ?, ?, ?)")
      .run(subject, fact, tags, turn, source);
    return Number(res.lastInsertRowid);
  }

  searchCanon(query: string, limit = 12): CanonFact[] {
    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((t) => t.length > 2);
    if (terms.length === 0) return [];
    const rows = this.db.prepare("SELECT * FROM canon ORDER BY id DESC").all() as CanonFact[];
    const scored = rows
      .map((r) => {
        const hay = `${r.subject} ${r.fact} ${r.tags}`.toLowerCase();
        const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return { r, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.r.id - a.r.id);
    return scored.slice(0, limit).map((x) => x.r);
  }

  canonBySubject(subject: string, limit = 8): CanonFact[] {
    return this.db
      .prepare("SELECT * FROM canon WHERE lower(subject) = lower(?) ORDER BY id DESC LIMIT ?")
      .all(subject, limit) as CanonFact[];
  }

  recentCanon(limit = 10): CanonFact[] {
    return this.db.prepare("SELECT * FROM canon ORDER BY id DESC LIMIT ?").all(limit) as CanonFact[];
  }

  // --- events ---

  appendEvent(turn: number, kind: string, data: unknown): void {
    this.db.prepare("INSERT INTO events (turn, kind, data) VALUES (?, ?, ?)").run(turn, kind, JSON.stringify(data));
  }

  eventsForTurn(turn: number): GameEvent[] {
    const rows = this.db.prepare("SELECT * FROM events WHERE turn = ? ORDER BY id").all(turn) as {
      id: number;
      turn: number;
      kind: string;
      data: string;
    }[];
    return rows.map((r) => ({ ...r, data: JSON.parse(r.data) }));
  }

  recentEvents(limit = 20): GameEvent[] {
    const rows = this.db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT ?").all(limit) as {
      id: number;
      turn: number;
      kind: string;
      data: string;
    }[];
    return rows.map((r) => ({ ...r, data: JSON.parse(r.data) })).reverse();
  }

  // --- turns ---

  saveTurn(id: number, playerInput: string, dmOutput: string): void {
    this.db
      .prepare("INSERT INTO turns (id, player_input, dm_output) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET player_input = excluded.player_input, dm_output = excluded.dm_output")
      .run(id, playerInput, dmOutput);
  }

  recentTurns(limit = 8): { id: number; player_input: string; dm_output: string }[] {
    const rows = this.db
      .prepare("SELECT id, player_input, dm_output FROM turns ORDER BY id DESC LIMIT ?")
      .all(limit) as { id: number; player_input: string; dm_output: string }[];
    return rows.reverse();
  }

  close(): void {
    this.db.close();
  }
}
