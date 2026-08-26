import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seed } from "../src/fixture/seed.js";
import { GameDb } from "../src/state/db.js";
import { DmAgent } from "../src/agent/dm.js";
import { MockProvider } from "../src/llm/provider.js";

let dir: string;
let db: GameDb;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm-agent-test-"));
  db = seed(path.join(dir, "game.db"));
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("DmAgent turn loop", () => {
  it("executes tool calls, then narrates, then scribes", async () => {
    const dmProvider = new MockProvider([
      // First response: call a tool.
      {
        text: "",
        toolCalls: [{ id: "c1", name: "ability_check", args: { characterId: "sera", ability: "wis", skill: "insight", dc: 12, reason: "reading Greely" } }],
      },
      // Second response: narrate (no numbers, so no violations regardless of roll).
      { text: "Greely's smile does not reach his eyes. He is hiding something about the east gallery.", toolCalls: [] },
    ]);
    const scribeProvider = new MockProvider([
      { text: '[{"subject": "Alderman Hobb Greely", "fact": "Sera sensed he is hiding something about the east gallery.", "tags": "npc,insight"}]', toolCalls: [] },
    ]);

    const agent = new DmAgent(db, dmProvider, scribeProvider);
    const result = await agent.playTurn("I study Greely's face while he talks. Is he lying?");

    expect(result.toolCallCount).toBe(1);
    expect(result.violations).toEqual([]);
    expect(result.factsWritten).toBe(1);
    expect(db.eventsForTurn(result.turn)).toHaveLength(1);
    expect(db.recentTurns(1)[0].dm_output).toContain("east gallery");
    expect(db.searchCanon("hiding east gallery")[0].source).toBe("scribe");

    // The DM's second call must include the tool result in messages.
    const secondCall = dmProvider.calls[1];
    const toolMsg = secondCall.messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg!.content).toContain("outcome");
  });

  it("retries narration when the validator finds ungrounded mechanics", async () => {
    const dmProvider = new MockProvider([
      // Narrates an invented roll with no tool call at all.
      { text: "You rolled a 19 and take 12 points of piercing damage from the trap!", toolCalls: [] },
      // Correction attempt: clean narration.
      { text: "The trap's teeth snap shut a hair from your boot. Too close.", toolCalls: [] },
    ]);
    const scribeProvider = new MockProvider([{ text: "[]", toolCalls: [] }]);

    const agent = new DmAgent(db, dmProvider, scribeProvider);
    const result = await agent.playTurn("I step into the corridor.");

    expect(result.corrected).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.prose).toContain("hair from your boot");
    // The correction request must spell out the violation.
    const correctionCall = dmProvider.calls[1];
    const lastMsg = correctionCall.messages[correctionCall.messages.length - 1];
    expect(lastMsg.content).toContain("does not appear in any tool result");
  });

  it("a failing scribe never breaks the turn", async () => {
    const dmProvider = new MockProvider([{ text: "Rain keeps falling.", toolCalls: [] }]);
    const scribeProvider = new MockProvider([]); // will throw: no scripted responses
    const agent = new DmAgent(db, dmProvider, scribeProvider);
    const result = await agent.playTurn("I wait.");
    expect(result.prose).toBe("Rain keeps falling.");
    expect(result.factsWritten).toBe(0);
  });
});
