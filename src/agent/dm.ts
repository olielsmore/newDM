/**
 * The DM turn loop: one mind, whole conversation, tools for everything
 * mechanical, validated before it's accepted, scribed after it speaks.
 */
import { GameDb } from "../state/db.js";
import { TOOL_DEFS, ToolExecutor } from "../tools/index.js";
import { Provider, ChatMessage } from "../llm/provider.js";
import { DM_SYSTEM_PROMPT, OPENING_INSTRUCTION } from "./prompts.js";
import { buildContextBlock } from "./context.js";
import { validateNarration, Violation } from "./validator.js";
import { runScribe, maybeUpdateSummary } from "./scribe.js";

const MAX_TOOL_ITERATIONS = 10;
const RECENT_TURNS_VERBATIM = 8;

export interface TurnResult {
  turn: number;
  prose: string;
  toolCallCount: number;
  violations: Violation[];
  corrected: boolean;
  factsWritten: number;
}

export interface TurnHooks {
  onText?: (delta: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onCorrection?: () => void;
}

export class DmAgent {
  constructor(
    private db: GameDb,
    private dmProvider: Provider,
    private scribeProvider: Provider,
  ) {}

  async playTurn(playerInput: string, hooks: TurnHooks = {}): Promise<TurnResult> {
    const turn = this.db.nextTurn();
    const executor = new ToolExecutor(this.db, turn);
    const isOpening = turn === 1 && playerInput === "";

    const messages: ChatMessage[] = [
      { role: "system", content: DM_SYSTEM_PROMPT },
      { role: "system", content: buildContextBlock(this.db, playerInput) },
    ];
    for (const t of this.db.recentTurns(RECENT_TURNS_VERBATIM)) {
      if (t.player_input) messages.push({ role: "user", content: t.player_input });
      messages.push({ role: "assistant", content: t.dm_output });
    }
    messages.push({ role: "user", content: isOpening ? OPENING_INSTRUCTION : playerInput });

    let prose = "";
    let toolCallCount = 0;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await this.dmProvider.chat({
        messages,
        tools: TOOL_DEFS,
        onText: (d) => {
          prose += d;
          hooks.onText?.(d);
        },
      });

      if (result.toolCalls.length === 0) break;

      messages.push({
        role: "assistant",
        content: result.text ?? "",
        tool_calls: result.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      });

      for (const tc of result.toolCalls) {
        toolCallCount++;
        hooks.onToolCall?.(tc.name, tc.args);
        let toolResult: unknown;
        try {
          toolResult = executor.execute(tc.name, tc.args);
        } catch (err) {
          toolResult = { error: err instanceof Error ? err.message : String(err) };
        }
        messages.push({ role: "tool", content: JSON.stringify(toolResult), tool_call_id: tc.id });
      }
    }

    // Grounding check: every mechanical claim must trace to a tool result this turn.
    let violations = validateNarration(prose, this.db.eventsForTurn(turn));
    let corrected = false;
    if (violations.length > 0) {
      hooks.onCorrection?.();
      messages.push({ role: "assistant", content: prose });
      messages.push({
        role: "user",
        content:
          `[SYSTEM CHECK — the player did not see this] Your narration contains ungrounded mechanics:\n` +
          violations.map((v) => `- "${v.claim}": ${v.problem}`).join("\n") +
          `\nRewrite the narration using ONLY numbers and outcomes from this turn's actual tool results (or no numbers at all). Same events, same voice. Respond with the corrected narration only.`,
      });
      let correctedProse = "";
      const retry = await this.dmProvider.chat({
        messages,
        onText: (d) => (correctedProse += d),
      });
      correctedProse = correctedProse || retry.text;
      const retryViolations = validateNarration(correctedProse, this.db.eventsForTurn(turn));
      if (correctedProse.trim() && retryViolations.length <= violations.length) {
        prose = correctedProse;
        violations = retryViolations;
        corrected = true;
      }
    }

    this.db.saveTurn(turn, playerInput, prose);

    let factsWritten = 0;
    try {
      factsWritten = await runScribe(this.db, this.scribeProvider, turn, playerInput, prose);
      await maybeUpdateSummary(this.db, this.scribeProvider, turn);
    } catch {
      // The scribe failing should never break play; canon just misses a beat.
    }

    return { turn, prose, toolCallCount, violations, corrected, factsWritten };
  }
}
