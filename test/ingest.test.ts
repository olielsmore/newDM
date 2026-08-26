import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GameDb } from "../src/state/db.js";
import { ingest } from "../src/content/ingest.js";
import { SrdJsonAdapter, PostgresAdapter } from "../src/content/srd-json.js";
import { contentId } from "../src/content/types.js";
import { SheetSchema } from "../src/rules/sheet.js";

describe("content ingest", () => {
  it("loads a local SRD JSON dump into indexed columns", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srd-"));
    const monsters = [
      {
        kind: "monster",
        id: contentId("Orc"),
        name: "Orc",
        cr: "1/2",
        type: "humanoid",
        size: "medium",
        environments: ["hill"],
        description: "A brutal raider.",
        tactics: "Charges.",
        sheet: SheetSchema.parse({
          id: "orc",
          name: "Orc",
          kind: "monster",
          abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
          ac: 13,
          maxHp: 15,
          hp: 15,
        }),
      },
    ];
    fs.writeFileSync(path.join(dir, "monsters.json"), JSON.stringify(monsters));
    const dbPath = path.join(dir, "game.db");
    const db = new GameDb(dbPath);
    const result = await ingest(db, new SrdJsonAdapter(dir));
    expect(result.loaded).toBe(1);
    expect(result.byKind.monster).toBe(1);
    const found = db.findMonsters({ type: "humanoid", crMax: 0.5 });
    expect(found[0].name).toBe("Orc");
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("PostgresAdapter is an explicit stub, not a silent no-op", async () => {
    await expect(new PostgresAdapter("postgres://x").load()).rejects.toThrow(/not implemented/);
  });
});
