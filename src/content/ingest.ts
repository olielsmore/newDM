/**
 * pnpm ingest — load a ContentSource into the game database.
 * Default: SrdJsonAdapter reading content/srd/.
 */
import path from "node:path";
import { GameDb } from "../state/db.js";
import { SrdJsonAdapter, PostgresAdapter } from "./srd-json.js";
import { ContentSource } from "./types.js";
import { DEFAULT_DB_PATH } from "../fixture/seed.js";

export async function ingest(db: GameDb, source: ContentSource): Promise<{ loaded: number; byKind: Record<string, number> }> {
  const records = await source.load();
  const byKind: Record<string, number> = {};
  for (const rec of records) {
    db.saveContentRecord(rec);
    byKind[rec.kind] = (byKind[rec.kind] ?? 0) + 1;
  }
  return { loaded: records.length, byKind };
}

function sourceFromEnv(): ContentSource {
  if (process.env.CONTENT_POSTGRES) return new PostgresAdapter(process.env.CONTENT_POSTGRES);
  return new SrdJsonAdapter(process.env.CONTENT_DIR ?? path.join(process.cwd(), "content/srd"));
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname.endsWith("ingest.ts");
if (isMain) {
  const db = new GameDb(process.env.GAME_DB ?? DEFAULT_DB_PATH);
  ingest(db, sourceFromEnv())
    .then((r) => {
      console.log(`Ingested ${r.loaded} records from ${sourceFromEnv().name}:`, r.byKind);
      db.close();
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      db.close();
      process.exit(1);
    });
}
