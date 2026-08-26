/**
 * All game state lives here. The LLM never holds state — it queries it.
 *
 * Resolution contracts are exact: a wrong id is an error listing legal
 * candidates, never a silent reinterpretation of what the caller meant.
 */
import Database from "better-sqlite3";
import { Sheet, SheetSchema } from "../rules/sheet.js";
import { Rng } from "../rules/dice.js";
import { CombatState } from "../rules/combat.js";
import { ContentRecord, contentId, RARITY_RANK } from "../content/types.js";
import { indexRecord } from "./content-index.js";

export interface CanonFact {
  id: number;
  subject: string;
  fact: string;
  tags: string;
  turn: number;
  source: string;
  hidden: number;
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
  present: string[];
  features: string[];
  time: string;
}

export interface Place {
  id: string;
  name: string;
  description: string;
  features: string[];
  exits: { to: string; description: string }[];
  sensory: string[];
  tags: string[];
}

export interface NpcVoice {
  id: string;
  diction: string;
  tics: string;
  agenda: string;
  neverSay: string;
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
      CREATE TABLE IF NOT EXISTS content (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        name TEXT,
        cr REAL,
        type TEXT,
        environments TEXT,
        size TEXT,
        rarity TEXT,
        rarity_rank INTEGER,
        category TEXT,
        attunement INTEGER,
        spell_level INTEGER,
        school TEXT,
        classes TEXT,
        keywords TEXT,
        PRIMARY KEY (kind, id)
      );
      CREATE TABLE IF NOT EXISTS canon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        fact TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '',
        turn INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'dm',
        hidden INTEGER NOT NULL DEFAULT 0,
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
      CREATE TABLE IF NOT EXISTS player_model (
        turn INTEGER PRIMARY KEY,
        pillar TEXT NOT NULL,
        input_length INTEGER NOT NULL,
        output_length INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS npc_voices (
        id TEXT PRIMARY KEY,
        diction TEXT NOT NULL,
        tics TEXT NOT NULL,
        agenda TEXT NOT NULL,
        never_say TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    this.ensureColumn("canon", "hidden", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("content", "name", "TEXT");
    this.ensureColumn("content", "cr", "REAL");
    this.ensureColumn("content", "type", "TEXT");
    this.ensureColumn("content", "environments", "TEXT");
    this.ensureColumn("content", "size", "TEXT");
    this.ensureColumn("content", "rarity", "TEXT");
    this.ensureColumn("content", "rarity_rank", "INTEGER");
    this.ensureColumn("content", "category", "TEXT");
    this.ensureColumn("content", "attunement", "INTEGER");
    this.ensureColumn("content", "spell_level", "INTEGER");
    this.ensureColumn("content", "school", "TEXT");
    this.ensureColumn("content", "classes", "TEXT");
    this.ensureColumn("content", "keywords", "TEXT");
  }

  private ensureColumn(table: string, column: string, ddl: string): void {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
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

  getRng(): Rng {
    const state = this.getMeta("rng_state");
    return new Rng(state ? parseInt(state, 10) : parseInt(this.getMeta("seed") ?? "12345", 10));
  }

  saveRng(rng: Rng): void {
    this.setMeta("rng_state", String(rng.getState()));
  }

  getCombat(): CombatState | undefined {
    const raw = this.getMeta("combat");
    return raw ? (JSON.parse(raw) as CombatState) : undefined;
  }

  saveCombat(state: CombatState | undefined): void {
    if (!state) this.db.prepare("DELETE FROM meta WHERE key = ?").run("combat");
    else this.setMeta("combat", JSON.stringify(state));
  }

  // --- characters ---

  listCharacters(): Sheet[] {
    const rows = this.db.prepare("SELECT data FROM characters").all() as { data: string }[];
    return rows.map((r) => SheetSchema.parse(JSON.parse(r.data)));
  }

  getCharacter(id: string): Sheet | undefined {
    const row = this.db.prepare("SELECT data FROM characters WHERE id = ?").get(id) as { data: string } | undefined;
    return row ? SheetSchema.parse(JSON.parse(row.data)) : undefined;
  }

  /**
   * Exact id, or exact case-insensitive unique name. Never prefix-matches.
   * Ambiguity and misses are errors listing legal candidates from the scene.
   */
  resolveCharacter(idOrName: string): Sheet {
    const byId = this.getCharacter(idOrName);
    if (byId) return byId;
    const needle = idOrName.toLowerCase();
    const matches = this.listCharacters().filter(
      (s) => s.id.toLowerCase() === needle || s.name.toLowerCase() === needle,
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous character "${idOrName}". Candidates: ${matches.map((s) => `${s.id} ("${s.name}")`).join(", ")}`,
      );
    }
    const scene = this.getScene();
    const present = (scene?.present ?? [])
      .map((id) => {
        const c = this.getCharacter(id);
        return c ? `${c.id} ("${c.name}")` : id;
      })
      .join(", ");
    const pc = this.getMeta("pc_id");
    throw new Error(
      `Unknown character: "${idOrName}". Use an exact id from get_scene (present: ${present || "none"}; pc: ${pc ?? "?"}).`,
    );
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

  getPlayerIds(): string[] {
    const raw = this.getMeta("pc_ids");
    if (raw) return JSON.parse(raw) as string[];
    const id = this.getMeta("pc_id");
    return id ? [id] : [];
  }

  // --- places & scene ---

  getPlace(id: string): Place | undefined {
    const row = this.db.prepare("SELECT data FROM places WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) return undefined;
    const place = JSON.parse(row.data) as Place;
    if (!place.tags) place.tags = [];
    return place;
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

  // --- content ---

  getContent(kind: string, idOrName: string): ContentRecord | undefined {
    const byId = this.db.prepare("SELECT data FROM content WHERE kind = ? AND id = ?").get(kind, idOrName) as
      | { data: string }
      | undefined;
    if (byId) return JSON.parse(byId.data) as ContentRecord;
    const kebab = contentId(idOrName);
    if (kebab !== idOrName) {
      const byKebab = this.db.prepare("SELECT data FROM content WHERE kind = ? AND id = ?").get(kind, kebab) as
        | { data: string }
        | undefined;
      if (byKebab) return JSON.parse(byKebab.data) as ContentRecord;
    }
    const rows = this.db.prepare("SELECT id, data FROM content WHERE kind = ?").all(kind) as { id: string; data: string }[];
    const needle = idOrName.toLowerCase();
    const matches = rows.filter((r) => {
      const rec = JSON.parse(r.data) as { name?: string };
      return rec.name?.toLowerCase() === needle;
    });
    if (matches.length === 1) return JSON.parse(matches[0].data) as ContentRecord;
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous ${kind} "${idOrName}". Candidates: ${matches.map((m) => m.id).join(", ")}`,
      );
    }
    return undefined;
  }

  saveContentRecord(record: ContentRecord): void {
    const row = indexRecord(record);
    this.db
      .prepare(
        `INSERT INTO content (kind, id, data, name, cr, type, environments, size, rarity, rarity_rank, category, attunement, spell_level, school, classes, keywords)
         VALUES (@kind, @id, @data, @name, @cr, @type, @environments, @size, @rarity, @rarityRank, @category, @attunement, @spellLevel, @school, @classes, @keywords)
         ON CONFLICT(kind, id) DO UPDATE SET
           data = excluded.data, name = excluded.name, cr = excluded.cr, type = excluded.type,
           environments = excluded.environments, size = excluded.size, rarity = excluded.rarity,
           rarity_rank = excluded.rarity_rank, category = excluded.category, attunement = excluded.attunement,
           spell_level = excluded.spell_level, school = excluded.school, classes = excluded.classes, keywords = excluded.keywords`,
      )
      .run(row);
  }

  findMonsters(opts: { crMin?: number; crMax?: number; environment?: string; type?: string; keywords?: string; limit?: number }): ContentRecord[] {
    let sql = "SELECT data FROM content WHERE kind = 'monster'";
    const params: unknown[] = [];
    if (opts.crMin != null) {
      sql += " AND cr >= ?";
      params.push(opts.crMin);
    }
    if (opts.crMax != null) {
      sql += " AND cr <= ?";
      params.push(opts.crMax);
    }
    if (opts.type) {
      sql += " AND lower(type) = lower(?)";
      params.push(opts.type);
    }
    if (opts.environment) {
      sql += " AND lower(environments) LIKE ?";
      params.push(`%${opts.environment.toLowerCase()}%`);
    }
    if (opts.keywords) {
      for (const term of opts.keywords.toLowerCase().split(/\s+/).filter(Boolean)) {
        sql += " AND keywords LIKE ?";
        params.push(`%${term}%`);
      }
    }
    sql += " ORDER BY cr ASC, id ASC LIMIT ?";
    params.push(opts.limit ?? 12);
    return (this.db.prepare(sql).all(...params) as { data: string }[]).map((r) => JSON.parse(r.data) as ContentRecord);
  }

  findItems(opts: { rarityMax?: string; category?: string; keywords?: string; budgetGp?: number; limit?: number }): ContentRecord[] {
    let sql = "SELECT data FROM content WHERE kind = 'item'";
    const params: unknown[] = [];
    if (opts.rarityMax) {
      const rank = RARITY_RANK[opts.rarityMax.toLowerCase()];
      if (rank != null) {
        sql += " AND rarity_rank <= ?";
        params.push(rank);
      }
    }
    if (opts.category) {
      sql += " AND lower(category) = lower(?)";
      params.push(opts.category);
    }
    if (opts.keywords) {
      for (const term of opts.keywords.toLowerCase().split(/\s+/).filter(Boolean)) {
        sql += " AND keywords LIKE ?";
        params.push(`%${term}%`);
      }
    }
    sql += " ORDER BY rarity_rank ASC, id ASC LIMIT ?";
    params.push(opts.limit ?? 12);
    const rows = (this.db.prepare(sql).all(...params) as { data: string }[]).map((r) => JSON.parse(r.data) as Extract<ContentRecord, { kind: "item" }>);
    if (opts.budgetGp != null) return rows.filter((i) => i.costGp == null || i.costGp <= opts.budgetGp!);
    return rows;
  }

  listLeveledSpellNames(): string[] {
    return (
      this.db.prepare("SELECT name FROM content WHERE kind = 'spell' AND spell_level >= 1").all() as { name: string }[]
    )
      .map((r) => r.name)
      .filter(Boolean);
  }

  // --- canon ---

  writeCanon(subject: string, fact: string, tags: string, turn: number, source: string, hidden = false): number {
    const res = this.db
      .prepare("INSERT INTO canon (subject, fact, tags, turn, source, hidden) VALUES (?, ?, ?, ?, ?, ?)")
      .run(subject, fact, tags, turn, source, hidden ? 1 : 0);
    return Number(res.lastInsertRowid);
  }

  searchCanon(query: string, limit = 12, opts: { includeHidden?: boolean } = {}): CanonFact[] {
    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((t) => t.length > 2);
    if (terms.length === 0) return [];
    const rows = this.db
      .prepare(opts.includeHidden ? "SELECT * FROM canon ORDER BY id DESC" : "SELECT * FROM canon WHERE hidden = 0 ORDER BY id DESC")
      .all() as CanonFact[];
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

  canonBySubject(subject: string, limit = 8, opts: { includeHidden?: boolean } = {}): CanonFact[] {
    return this.db
      .prepare(
        opts.includeHidden
          ? "SELECT * FROM canon WHERE lower(subject) = lower(?) ORDER BY id DESC LIMIT ?"
          : "SELECT * FROM canon WHERE lower(subject) = lower(?) AND hidden = 0 ORDER BY id DESC LIMIT ?",
      )
      .all(subject, limit) as CanonFact[];
  }

  recentCanon(limit = 10): CanonFact[] {
    return this.db.prepare("SELECT * FROM canon WHERE hidden = 0 ORDER BY id DESC LIMIT ?").all(limit) as CanonFact[];
  }

  hiddenCanonBySubject(subject: string): CanonFact[] {
    return this.db
      .prepare("SELECT * FROM canon WHERE hidden = 1 AND lower(subject) = lower(?) ORDER BY id")
      .all(subject) as CanonFact[];
  }

  allHiddenCanon(): CanonFact[] {
    return this.db.prepare("SELECT * FROM canon WHERE hidden = 1 ORDER BY id").all() as CanonFact[];
  }

  revealCanon(id: number): CanonFact | undefined {
    this.db.prepare("UPDATE canon SET hidden = 0 WHERE id = ?").run(id);
    return this.db.prepare("SELECT * FROM canon WHERE id = ?").get(id) as CanonFact | undefined;
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
      .prepare(
        "INSERT INTO turns (id, player_input, dm_output) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET player_input = excluded.player_input, dm_output = excluded.dm_output",
      )
      .run(id, playerInput, dmOutput);
  }

  recentTurns(limit = 8): { id: number; player_input: string; dm_output: string }[] {
    const rows = this.db
      .prepare("SELECT id, player_input, dm_output FROM turns ORDER BY id DESC LIMIT ?")
      .all(limit) as { id: number; player_input: string; dm_output: string }[];
    return rows.reverse();
  }

  allTurns(): { id: number; player_input: string; dm_output: string }[] {
    return this.db.prepare("SELECT id, player_input, dm_output FROM turns ORDER BY id").all() as {
      id: number;
      player_input: string;
      dm_output: string;
    }[];
  }

  // --- player model ---

  recordPlayerModel(turn: number, pillar: string, inputLength: number, outputLength: number): void {
    this.db
      .prepare("INSERT INTO player_model (turn, pillar, input_length, output_length) VALUES (?, ?, ?, ?) ON CONFLICT(turn) DO UPDATE SET pillar = excluded.pillar, input_length = excluded.input_length, output_length = excluded.output_length")
      .run(turn, pillar, inputLength, outputLength);
  }

  playerModelSummary(): { lastPillars: string[]; avgInput: number; avgOutput: number } {
    const rows = this.db.prepare("SELECT pillar, input_length, output_length FROM player_model ORDER BY turn DESC LIMIT 12").all() as {
      pillar: string;
      input_length: number;
      output_length: number;
    }[];
    if (rows.length === 0) return { lastPillars: [], avgInput: 0, avgOutput: 0 };
    return {
      lastPillars: rows.map((r) => r.pillar),
      avgInput: Math.round(rows.reduce((s, r) => s + r.input_length, 0) / rows.length),
      avgOutput: Math.round(rows.reduce((s, r) => s + r.output_length, 0) / rows.length),
    };
  }

  // --- voices ---

  saveVoice(voice: NpcVoice): void {
    this.db
      .prepare("INSERT INTO npc_voices (id, diction, tics, agenda, never_say) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET diction = excluded.diction, tics = excluded.tics, agenda = excluded.agenda, never_say = excluded.never_say")
      .run(voice.id, voice.diction, voice.tics, voice.agenda, voice.neverSay);
  }

  getVoice(id: string): NpcVoice | undefined {
    const row = this.db.prepare("SELECT id, diction, tics, agenda, never_say FROM npc_voices WHERE id = ?").get(id) as
      | { id: string; diction: string; tics: string; agenda: string; never_say: string }
      | undefined;
    return row ? { id: row.id, diction: row.diction, tics: row.tics, agenda: row.agenda, neverSay: row.never_say } : undefined;
  }

  close(): void {
    this.db.close();
  }
}
