/**
 * The scribe: after each DM turn, extract durable facts the DM invented
 * and commit them to canon. Invention isn't forbidden — it's captured.
 */
import { GameDb } from "../state/db.js";
import { Provider } from "../llm/provider.js";
import { SCRIBE_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from "./prompts.js";

export async function runScribe(
  db: GameDb,
  provider: Provider,
  turn: number,
  playerInput: string,
  dmOutput: string,
): Promise<number> {
  const known = db
    .recentCanon(30)
    .map((f) => `- [${f.subject}] ${f.fact}`)
    .join("\n");

  const result = await provider.chat({
    messages: [
      { role: "system", content: SCRIBE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Known canon:\n${known || "(none)"}\n\nPlayer: ${playerInput}\n\nDM narration:\n${dmOutput}`,
      },
    ],
    temperature: 0,
    maxTokens: 600,
  });

  let facts: { subject?: string; fact?: string; tags?: string }[] = [];
  try {
    const jsonMatch = result.text.match(/\[[\s\S]*\]/);
    facts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return 0;
  }

  let written = 0;
  for (const f of facts) {
    if (!f.subject || !f.fact) continue;
    db.writeCanon(f.subject, f.fact, f.tags ?? "", turn, "scribe");
    written++;
  }
  return written;
}

const SUMMARY_EVERY = 6;

export async function maybeUpdateSummary(db: GameDb, provider: Provider, turn: number): Promise<void> {
  if (turn % SUMMARY_EVERY !== 0) return;
  const prev = db.getMeta("session_summary") ?? "(session just started)";
  const turns = db
    .recentTurns(SUMMARY_EVERY)
    .map((t) => `Player: ${t.player_input}\nDM: ${t.dm_output}`)
    .join("\n---\n");

  const result = await provider.chat({
    messages: [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: `Previous summary:\n${prev}\n\nNew turns:\n${turns}` },
    ],
    temperature: 0,
    maxTokens: 400,
  });
  if (result.text.trim()) db.setMeta("session_summary", result.text.trim());
}
