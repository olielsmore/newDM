import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seed } from "../src/fixture/seed.js";
import { createApp } from "../src/server/index.js";
import { MockProvider } from "../src/llm/provider.js";
import { DmAgent } from "../src/agent/dm.js";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm-api-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("API", () => {
  it("serves sheet, scene, and canon without parsing prose", async () => {
    const dbPath = path.join(dir, "game.db");
    const db = seed(dbPath);
    const dm = new MockProvider([]);
    const scribe = new MockProvider([]);
    const session = {
      db,
      agent: new DmAgent(db, dm, scribe, { llmGrounding: false }),
      dbPath,
      dm,
      scribe,
    };
    const app = createApp(session);
    const sheet = await app.request("/api/sheet");
    expect((await sheet.json()).id).toBe("sera");
    const scene = await app.request("/api/scene");
    const body = await scene.json();
    expect(body.scene.placeId).toBe("drowned-rat");
    expect(body.present.some((p: { id: string }) => p.id === "marla")).toBe(true);
    const canon = await app.request("/api/canon");
    const facts = await canon.json();
    expect(facts.every((f: { hidden?: number }) => f.hidden !== 1)).toBe(true);
    db.close();
  });

  it("serves the built play UI next to the API when web/dist exists", async () => {
    const dist = path.resolve("web/dist/index.html");
    if (!fs.existsSync(dist)) return;
    const dbPath = path.join(dir, "game.db");
    const db = seed(dbPath);
    const dm = new MockProvider([]);
    const scribe = new MockProvider([]);
    const session = {
      db,
      agent: new DmAgent(db, dm, scribe, { llmGrounding: false }),
      dbPath,
      dm,
      scribe,
    };
    const app = createApp(session);
    const page = await app.request("/");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("The Saltmine Warrens");
    db.close();
  });
});
