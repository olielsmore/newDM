/**
 * The DM turn loop: one mind, tools for everything mechanical,
 * validated (regex + LLM grounding) before it's accepted,
 * scribed after it speaks.
 */
import { GameDb } from "../state/db.js";
import { TOOL_DEFS, ToolExecutor } from "../tools/index.js";
import { Provider, ChatMessage } from "../llm/provider.js";
import { DM_SYSTEM_PROMPT, OPENING_INSTRUCTION } from "./prompts.js";
import { buildContextBlock } from "./context.js";
import { validateNarration, wordBudgetFor, Violation } from "./validator.js";
import { llmGrounding } from "./grounding.js";
import { runScribe, maybeUpdateSummary } from "./scribe.js";
import { classifyPillar } from "./player-model.js";
import { recordTurnMetrics, TurnMetrics } from "./metrics.js";

const MAX_TOOL_ITERATIONS = 12;
const RECENT_TURNS_VERBATIM = 8;

export interface TurnResult {
  turn: number;
  prose: string;
  toolCallCount: number;
  violations: Violation[];
  corrected: boolean;
  factsWritten: number;
  metrics: TurnMetrics;
}

export interface TurnHooks {
  onText?: (delta: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>, result?: unknown) => void;
  onCorrection?: () => void;
}

export interface DmAgentOptions {
  /** LLM grounding pass. Default true. Tests that script the scribe should turn this off. */
  llmGrounding?: boolean;
}

export class DmAgent {
  private readonly llmGroundingEnabled: boolean;

  constructor(
    private db: GameDb,
    private dmProvider: Provider,
    private scribeProvider: Provider,
    opts: DmAgentOptions = {},
  ) {
    this.llmGroundingEnabled = opts.llmGrounding ?? true;
  }

  async playTurn(playerInput: string, hooks: TurnHooks = {}): Promise<TurnResult> {
    const turn = this.db.nextTurn();
    const executor = new ToolExecutor(this.db, turn);
    const isOpening = turn === 1 && playerInput === "";
    const started = Date.now();

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
    let diceTouched = false;

    const runTools = async (toolCalls: { id: string; name: string; args: Record<string, unknown> }[]) => {
      messages.push({
        role: "assistant",
        content: "",
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      });
      for (const tc of toolCalls) {
        toolCallCount++;
        if (["roll", "ability_check", "saving_throw", "attack", "cast_spell", "death_save"].includes(tc.name)) {
          diceTouched = true;
        }
        let toolResult: unknown;
        try {
          toolResult = executor.execute(tc.name, tc.args);
        } catch (err) {
          toolResult = { error: err instanceof Error ? err.message : String(err) };
        }
        hooks.onToolCall?.(tc.name, tc.args, toolResult);
        messages.push({ role: "tool", content: JSON.stringify(toolResult), tool_call_id: tc.id });
      }
    };

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
      prose = "";
      await runTools(result.toolCalls);
    }

    const sceneInfo = () => {
      const scene = this.db.getScene();
      return scene ? { currentPlaceId: scene.placeId, places: this.db.listPlaces() } : undefined;
    };
    const validationCtx = () => ({
      scene: sceneInfo(),
      leveledSpells: this.db.listLeveledSpellNames(),
      wordBudget: wordBudgetFor({ opening: isOpening, combat: Boolean(this.db.getCombat()?.active) }),
    });

    const collectViolations = async (text: string): Promise<Violation[]> => {
      const deterministic = validateNarration(text, this.db.eventsForTurn(turn), validationCtx());
      let grounded: Violation[] = [];
      try {
        if (!this.llmGroundingEnabled) return deterministic;
        const scene = this.db.getScene();
        grounded = await llmGrounding(
          this.scribeProvider,
          text,
          this.db.eventsForTurn(turn),
          scene ? `${scene.name} (${scene.placeId}) present=${scene.present.join(",")}` : "(no scene)",
          this.db
            .recentCanon(12)
            .map((f) => `[${f.subject}] ${f.fact}`)
            .join("\n"),
        );
      } catch {
        grounded = [];
      }
      const seen = new Set(deterministic.map((v) => v.claim + v.problem));
      return [...deterministic, ...grounded.filter((v) => !seen.has(v.claim + v.problem))];
    };

    let violations = await collectViolations(prose);
    let corrected = false;
    if (violations.length > 0) {
      hooks.onCorrection?.();
      messages.push({ role: "assistant", content: prose });
      messages.push({
        role: "user",
        content:
          `[SYSTEM CHECK — the player did not see this] Your narration has problems:\n` +
          violations.map((v) => `- "${v.claim}": ${v.problem}`).join("\n") +
          `\nFix them: call any tools you skipped, then rewrite the narration grounded in the actual tool results. Same events, same voice.`,
      });
      let correctedProse = "";
      for (let i = 0; i < 4; i++) {
        const retry = await this.dmProvider.chat({
          messages,
          tools: TOOL_DEFS,
          onText: (d) => (correctedProse += d),
        });
        if (retry.toolCalls.length === 0) break;
        correctedProse = "";
        await runTools(retry.toolCalls);
      }
      const retryViolations = await collectViolations(correctedProse);
      if (correctedProse.trim() && retryViolations.length <= violations.length) {
        prose = correctedProse;
        violations = retryViolations;
        corrected = true;
      }
    }

    this.db.saveTurn(turn, playerInput, prose);

    const metrics: TurnMetrics = {
      turn,
      toolCalls: toolCallCount,
      violations: violations.length,
      corrected,
      diceTouched,
      wordCount: prose.trim().split(/\s+/).filter(Boolean).length,
      latencyMs: Date.now() - started,
    };
    recordTurnMetrics(this.db, metrics);

    // Scribe, summary, and player-model are fire-and-forget so first-token
    // feel is not blocked on utility calls. Tests can still await via the
    // returned promise's factsWritten if the scribe finishes first; we also
    // expose waitForSideEffects for tests.
    this.sideEffects = this.runSideEffects(turn, playerInput, prose);
    const factsWritten = await this.sideEffects.catch(() => 0);

    return { turn, prose, toolCallCount, violations, corrected, factsWritten, metrics };
  }

  private sideEffects: Promise<number> = Promise.resolve(0);

  async waitForSideEffects(): Promise<number> {
    return this.sideEffects;
  }

  private async runSideEffects(turn: number, playerInput: string, prose: string): Promise<number> {
    let written = 0;
    try {
      written = await runScribe(this.db, this.scribeProvider, turn, playerInput, prose);
    } catch {
      written = 0;
    }
    try {
      await maybeUpdateSummary(this.db, this.scribeProvider, turn);
    } catch {
      /* ignore */
    }
    try {
      const pillar = await classifyPillar(this.scribeProvider, playerInput);
      this.db.recordPlayerModel(turn, pillar, playerInput.split(/\s+/).length, prose.split(/\s+/).length);
    } catch {
      /* ignore */
    }
    return written;
  }
}
