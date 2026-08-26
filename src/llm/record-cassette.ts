/**
 * Record the golden cassette: a short live session captured call-for-call so
 * the replay test (test/cassette.test.ts) can run the full agent loop in CI
 * with no API key. Re-run when prompts or the tool surface change:
 *   pnpm cassette:record
 */
import fs from "node:fs";
import path from "node:path";
import { seed } from "../fixture/seed.js";
import { DmAgent } from "../agent/dm.js";
import { providerFromEnv, scribeProviderFromEnv } from "./provider.js";
import { CassetteProvider } from "./cassette.js";

export const CASSETTE_DIR = "test/cassettes";
export const CASSETTE_INPUTS = [
  "", // opening
  "I ask Marla what has been happening in Emberhollow since I left.",
  "I press Greely about the mine and watch his face closely for lies.",
];

async function main(): Promise<void> {
  const dmPath = path.join(CASSETTE_DIR, "dm.json");
  const scribePath = path.join(CASSETTE_DIR, "scribe.json");
  const expectedPath = path.join(CASSETTE_DIR, "expected.json");
  const dbPath = path.join(CASSETTE_DIR, "record.db");
  for (const p of [dmPath, scribePath, expectedPath, dbPath, dbPath + "-wal", dbPath + "-shm"]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const db = seed(dbPath);
  const dm = new CassetteProvider(providerFromEnv(), dmPath, "record");
  const scribe = new CassetteProvider(scribeProviderFromEnv(), scribePath, "record");
  const agent = new DmAgent(db, dm, scribe);

  const expected: { input: string; prose: string; violations: number; toolCalls: number }[] = [];
  for (const input of CASSETTE_INPUTS) {
    const result = await agent.playTurn(input);
    expected.push({ input, prose: result.prose, violations: result.violations.length, toolCalls: result.toolCallCount });
    console.log(`turn ${result.turn}: ${result.toolCallCount} tools, ${result.violations.length} violations, ${result.prose.split(/\s+/).length} words`);
  }

  fs.writeFileSync(expectedPath, JSON.stringify(expected, null, 2));
  db.close();
  for (const p of [dbPath, dbPath + "-wal", dbPath + "-shm"]) if (fs.existsSync(p)) fs.unlinkSync(p);
  console.log(`Recorded ${CASSETTE_INPUTS.length} turns to ${CASSETTE_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
