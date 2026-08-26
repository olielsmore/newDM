/**
 * Golden replay: the full agent loop (context assembly, tool dispatch,
 * validation, scribe) runs against a recorded cassette with no API key.
 * If prompts or tool wiring drift in a way that changes the call sequence,
 * this test fails loudly. Re-record with: pnpm cassette:record
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { seed } from "../src/fixture/seed.js";
import { DmAgent } from "../src/agent/dm.js";
import { CassetteProvider } from "../src/llm/cassette.js";

const CASSETTE_DIR = path.join(__dirname, "cassettes");
const hasCassette = fs.existsSync(path.join(CASSETTE_DIR, "dm.json"));

describe.skipIf(!hasCassette)("golden cassette replay", () => {
  it("replays the recorded session identically, with zero unresolved violations", async () => {
    const expected = JSON.parse(fs.readFileSync(path.join(CASSETTE_DIR, "expected.json"), "utf8")) as {
      input: string;
      prose: string;
      violations: number;
      toolCalls: number;
    }[];

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cassette-replay-"));
    const db = seed(path.join(dir, "replay.db"));
    const dm = new CassetteProvider(undefined, path.join(CASSETTE_DIR, "dm.json"), "replay");
    const scribe = new CassetteProvider(undefined, path.join(CASSETTE_DIR, "scribe.json"), "replay");
    const agent = new DmAgent(db, dm, scribe);

    for (const turn of expected) {
      const result = await agent.playTurn(turn.input);
      expect(result.prose).toBe(turn.prose);
      expect(result.toolCallCount).toBe(turn.toolCalls);
      expect(result.violations.length).toBe(turn.violations);
    }

    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
