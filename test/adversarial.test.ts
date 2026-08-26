/**
 * Scripted adversarial player: fishing for retries, invented items,
 * claimed advantage, rules-lawyering. The engine must refuse or force
 * a tool — never silently agree.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seed } from "../src/fixture/seed.js";
import { GameDb } from "../src/state/db.js";
import { ToolExecutor } from "../src/tools/index.js";
import { validateNarration } from "../src/agent/validator.js";

let dir: string;
let db: GameDb;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm-adv-"));
  db = seed(path.join(dir, "game.db"));
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("adversarial player", () => {
  it("cannot skip a hop by inventing a place id", () => {
    const tools = new ToolExecutor(db, 1);
    expect(() => tools.execute("move_scene", { placeId: "warrens-deep" })).toThrow(/Legal exits/);
    expect(db.getScene()?.placeId).toBe("drowned-rat");
  });

  it("cannot grant a dreamed-up magic item", () => {
    const tools = new ToolExecutor(db, 1);
    expect(() =>
      tools.execute("apply_effect", { targetId: "sera", effect: "add_item", detail: "Staff of the Magi" }),
    ).toThrow(/Unknown item/);
    expect(db.getPlayerCharacter().inventory.find((i) => /staff/i.test(i.name))).toBeUndefined();
  });

  it("cannot prefix-match a monster instance", () => {
    const tools = new ToolExecutor(db, 1);
    tools.execute("spawn_monster", { monster: "goblin" });
    expect(() => db.resolveCharacter("gob")).toThrow(/Unknown character/);
    expect(db.resolveCharacter("goblin-1").id).toBe("goblin-1");
  });

  it("cannot narrate a hit without a mechanical tool", () => {
    const v = validateNarration("Your blade connects and the cultist drops.", []);
    expect(v.length).toBeGreaterThan(0);
  });

  it("cannot spend more slots than exist", () => {
    const tools = new ToolExecutor(db, 1);
    for (let i = 0; i < 3; i++) {
      expect(
        (tools.execute("apply_effect", { targetId: "sera", effect: "spend_slot", amount: 1 }) as { ok: boolean }).ok,
      ).toBe(true);
    }
    const fourth = tools.execute("apply_effect", { targetId: "sera", effect: "spend_slot", amount: 1 }) as { error?: string };
    expect(fourth.error).toBeTruthy();
    expect(db.getPlayerCharacter().spellSlots["1"].used).toBe(3);
  });

  it("cannot act on someone else's combat turn", () => {
    const tools = new ToolExecutor(db, 1);
    tools.execute("spawn_monster", { monster: "goblin" });
    tools.execute("start_combat", {});
    const combat = db.getCombat()!;
    combat.currentIndex = combat.order.findIndex((o) => o.id === "goblin-1");
    db.saveCombat(combat);
    expect(() => tools.execute("attack", { attackerId: "sera", targetId: "goblin-1" })).toThrow(/goblin-1's turn/);
  });
});
