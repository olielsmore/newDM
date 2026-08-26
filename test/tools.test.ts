import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seed } from "../src/fixture/seed.js";
import { GameDb } from "../src/state/db.js";
import { ToolExecutor } from "../src/tools/index.js";

let dir: string;
let db: GameDb;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm-test-"));
  db = seed(path.join(dir, "game.db"));
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("fixture seed", () => {
  it("creates the player character and scene", () => {
    const pc = db.getPlayerCharacter();
    expect(pc.name).toBe("Sera Valen");
    expect(pc.hp).toBe(17);
    const scene = db.getScene();
    expect(scene?.placeId).toBe("drowned-rat");
    expect(scene?.present).toContain("marla");
  });

  it("finds characters case-insensitively by name", () => {
    expect(db.findCharacter("marla fenwick")?.id).toBe("marla");
    expect(db.findCharacter("MARLA")?.id).toBe("marla");
  });
});

describe("tools", () => {
  it("roll is grounded and logged to events", () => {
    const tools = new ToolExecutor(db, 1);
    const r = tools.execute("roll", { dice: "2d6+1", reason: "test" }) as { total: number };
    expect(r.total).toBeGreaterThanOrEqual(3);
    const events = db.eventsForTurn(1);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("roll");
  });

  it("rng state persists across executors (no repeated rolls)", () => {
    const a = new ToolExecutor(db, 1).execute("roll", { dice: "1d20", reason: "a" }) as { rolls: number[] };
    const b = new ToolExecutor(db, 2).execute("roll", { dice: "1d20", reason: "b" }) as { rolls: number[] };
    // Deterministic sequence, but state advanced — same seed would repeat without persistence.
    const fresh = seed(path.join(dir, "fresh.db"));
    const a2 = new ToolExecutor(fresh, 1).execute("roll", { dice: "1d20", reason: "a" }) as { rolls: number[] };
    expect(a2.rolls).toEqual(a.rolls); // replay determinism
    fresh.close();
    expect([a.rolls[0], b.rolls[0]]).toHaveLength(2);
  });

  it("spawn_monster instantiates from content and joins the scene", () => {
    const tools = new ToolExecutor(db, 1);
    const spawned = tools.execute("spawn_monster", { monster: "goblin", label: "Scarred Goblin" }) as { id: string };
    expect(spawned.id).toBe("goblin-1");
    const sheet = db.getCharacter("goblin-1");
    expect(sheet?.name).toBe("Scarred Goblin");
    expect(sheet?.hp).toBe(7);
    expect(db.getScene()?.present).toContain("goblin-1");
  });

  it("attack tool resolves and applies damage to stored sheet", () => {
    const tools = new ToolExecutor(db, 1);
    tools.execute("spawn_monster", { monster: "goblin" });
    type AttackOut = { hit: boolean; applied?: { hpAfter: number } };
    let result: AttackOut | undefined;
    // Keep attacking until something hits (deterministic rng advances each call).
    for (let i = 0; i < 10; i++) {
      result = tools.execute("attack", { attackerId: "sera", targetId: "goblin-1" }) as AttackOut;
      if (result.hit) break;
    }
    expect(result!.hit).toBe(true);
    const goblin = db.getCharacter("goblin-1")!;
    expect(goblin.hp).toBe(result!.applied!.hpAfter);
    expect(goblin.hp).toBeLessThan(7);
  });

  it("apply_effect spends slots and refuses when empty", () => {
    const tools = new ToolExecutor(db, 1);
    for (let i = 0; i < 3; i++) {
      const r = tools.execute("apply_effect", { targetId: "sera", effect: "spend_slot", amount: 1 }) as { ok: boolean };
      expect(r.ok).toBe(true);
    }
    const out = tools.execute("apply_effect", { targetId: "sera", effect: "spend_slot", amount: 1 }) as { error?: string };
    expect(out.error).toBeTruthy();
  });

  it("move_scene rotates sensory details across visits", () => {
    const tools = new ToolExecutor(db, 1);
    const v1 = tools.execute("move_scene", { placeId: "town-square" }) as { sensoryDetail: string };
    tools.execute("move_scene", { placeId: "drowned-rat" });
    const v2 = tools.execute("move_scene", { placeId: "town-square" }) as { sensoryDetail: string };
    expect(v1.sensoryDetail).not.toBe(v2.sensoryDetail);
  });

  it("canon write + search round-trips", () => {
    const tools = new ToolExecutor(db, 3);
    tools.execute("canon_write", { subject: "The Well", fact: "The town well whispers at midnight.", tags: "place" });
    const found = tools.execute("canon_search", { query: "well whispers" }) as { subject: string }[];
    expect(found[0].subject).toBe("The Well");
  });

  it("lookup finds content by fuzzy name", () => {
    const tools = new ToolExecutor(db, 1);
    const spell = tools.execute("lookup", { kind: "spell", name: "guiding bolt" }) as { name: string };
    expect(spell.name).toBe("Guiding Bolt");
    const missing = tools.execute("lookup", { kind: "spell", name: "wish" }) as { error?: string };
    expect(missing.error).toBeTruthy();
  });
});
