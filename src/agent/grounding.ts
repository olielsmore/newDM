/**
 * LLM grounding pass. Catches contradictions the regexes cannot:
 * inverted outcomes, wrong names, fiction that moved without tools.
 */
import { Provider } from "../llm/provider.js";
import { GameEvent } from "../state/db.js";
import { Violation } from "./validator.js";

export const GROUNDING_SYSTEM_PROMPT = `You check a Dungeon Master's narration against the structured event log and scene state.

Flag only clear contradictions:
- A named mechanical outcome (hit/miss, success/failure, death, damage) that DISAGREES with the event log
- Physical combat contact — a creature attacking, being struck, wounded, or killed — narrated when the event log has NO attack, cast_spell, spawn_monster, or start_combat events at all
- Arriving at or describing a place that is not the current scene and was not moved to this turn
- Using a proper name or secret that is not in the known-canon list or this turn's events
- A mechanical number that appears NOWHERE in the event log
- A fourth-wall break: narration that mentions tools, ids, engines, the system, retries, or the DM's own process instead of staying in the fiction

Rules of restraint — these matter as much as the checks:
- Any number that appears anywhere in the event log is grounded. Do not flag it.
- Narrating a miss when the log says hit=false is CORRECT. Narrating a hit when hit=true is CORRECT.
- Do NOT flag style, pacing, invented sensory texture, or NPC dialogue that doesn't change facts.
- When unsure, do not flag. A false alarm costs a full rewrite.

Respond with a JSON array of {"claim": "short quote", "problem": "one sentence"}. Empty array if grounded.
ONLY the JSON array.`;

/**
 * Raw event JSON is deep and noisy; the checker misreads it. Give it one
 * compact line per event instead.
 */
export function eventDigest(events: GameEvent[]): string {
  return events
    .map((e) => {
      const { args, result } = e.data as { args?: unknown; result?: unknown };
      const argsStr = JSON.stringify(args ?? {});
      const resultStr = JSON.stringify(result ?? null);
      return `${e.kind} args=${argsStr.slice(0, 200)} result=${resultStr.slice(0, 400)}`;
    })
    .join("\n");
}

export async function llmGrounding(
  provider: Provider,
  prose: string,
  events: GameEvent[],
  sceneSummary: string,
  knownCanon: string,
): Promise<Violation[]> {
  const result = await provider.chat({
    messages: [
      { role: "system", content: GROUNDING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Scene:\n${sceneSummary}\n\nKnown canon:\n${knownCanon || "(none)"}\n\nEvent log (this turn):\n${eventDigest(events) || "(no events)"}\n\nNarration:\n${prose}`,
      },
    ],
    temperature: 0,
    maxTokens: 400,
  });
  try {
    const match = result.text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { claim?: string; problem?: string }[];
    return parsed
      .filter((v) => v.claim && v.problem)
      .map((v) => ({ claim: v.claim!, problem: v.problem! }));
  } catch {
    return [];
  }
}
