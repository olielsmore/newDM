/**
 * Loads SRD content from local JSON files already in the internal
 * ContentRecord shape. This is the first adapter; PostgresAdapter
 * will map the user's 5e database into the same records later.
 */
import fs from "node:fs";
import path from "node:path";
import { ContentRecord, ContentSource, MonsterRecordSchema, SpellRecordSchema, ItemRecordSchema } from "./types.js";

export class SrdJsonAdapter implements ContentSource {
  readonly name = "srd-json";

  constructor(private dir: string) {}

  async load(): Promise<ContentRecord[]> {
    const records: ContentRecord[] = [];
    const files = [
      { file: "monsters.json", schema: MonsterRecordSchema },
      { file: "spells.json", schema: SpellRecordSchema },
      { file: "items.json", schema: ItemRecordSchema },
    ];
    for (const { file, schema } of files) {
      const full = path.join(this.dir, file);
      if (!fs.existsSync(full)) continue;
      const raw = JSON.parse(fs.readFileSync(full, "utf8")) as unknown;
      if (!Array.isArray(raw)) throw new Error(`${full} must be a JSON array`);
      raw.forEach((row, i) => {
        const parsed = schema.safeParse(row);
        if (!parsed.success) {
          throw new Error(`${file}[${i}]: ${parsed.error.message}`);
        }
        records.push(parsed.data);
      });
    }
    return records;
  }
}

/** Placeholder for the later reseed from the user's 5e Postgres. */
export class PostgresAdapter implements ContentSource {
  readonly name = "postgres";
  constructor(private _connectionString: string) {}
  async load(): Promise<ContentRecord[]> {
    throw new Error(
      "PostgresAdapter is not implemented yet. Once the engine is proven, add a mapper from the existing 5e Postgres schema into ContentRecord and this adapter becomes the reseed path.",
    );
  }
}
