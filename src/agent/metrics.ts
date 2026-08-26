import { GameDb } from "../state/db.js";

export interface TurnMetrics {
  turn: number;
  toolCalls: number;
  violations: number;
  corrected: boolean;
  diceTouched: boolean;
  wordCount: number;
  latencyMs: number;
  /** What the first draft was flagged for (empty when it passed clean). */
  draftViolations?: string[];
}

export function recordTurnMetrics(db: GameDb, metrics: TurnMetrics): void {
  db.setMeta(`metrics:${metrics.turn}`, JSON.stringify(metrics));
  const all = listMetrics(db);
  all.push(metrics);
  db.setMeta("metrics:all", JSON.stringify(all.slice(-200)));
}

export function listMetrics(db: GameDb): TurnMetrics[] {
  const raw = db.getMeta("metrics:all");
  return raw ? (JSON.parse(raw) as TurnMetrics[]) : [];
}

export function summarizeMetrics(db: GameDb): {
  turns: number;
  violationRate: number;
  avgToolCalls: number;
  diceTouchRate: number;
  avgWords: number;
} {
  const all = listMetrics(db);
  if (all.length === 0) return { turns: 0, violationRate: 0, avgToolCalls: 0, diceTouchRate: 0, avgWords: 0 };
  return {
    turns: all.length,
    violationRate: all.filter((m) => m.violations > 0).length / all.length,
    avgToolCalls: all.reduce((s, m) => s + m.toolCalls, 0) / all.length,
    diceTouchRate: all.filter((m) => m.diceTouched).length / all.length,
    avgWords: all.reduce((s, m) => s + m.wordCount, 0) / all.length,
  };
}
