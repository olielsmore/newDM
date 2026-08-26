/**
 * Seeded, deterministic dice. Every roll in the game flows through here —
 * the LLM never generates a random number.
 */

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** mulberry32 — small, fast, good enough for dice. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}

export interface DiceResult {
  expr: string;
  rolls: number[];
  modifier: number;
  total: number;
}

const DICE_RE = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;

export function parseDice(expr: string): { count: number; sides: number; modifier: number } {
  const m = DICE_RE.exec(expr);
  if (!m) throw new Error(`Invalid dice expression: "${expr}" (expected NdM or NdM+K)`);
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? (m[3] === "-" ? -1 : 1) * parseInt(m[4], 10) : 0;
  if (count < 1 || count > 100) throw new Error(`Dice count out of range: ${count}`);
  if (![2, 4, 6, 8, 10, 12, 20, 100].includes(sides)) throw new Error(`Unsupported die: d${sides}`);
  return { count, sides, modifier };
}

export function roll(rng: Rng, expr: string): DiceResult {
  const { count, sides, modifier } = parseDice(expr);
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rng.int(1, sides));
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { expr, rolls, modifier, total };
}

export interface D20Result {
  rolls: number[];
  kept: number;
  modifier: number;
  total: number;
  natural20: boolean;
  natural1: boolean;
}

export function d20(
  rng: Rng,
  opts: { modifier?: number; advantage?: boolean; disadvantage?: boolean } = {},
): D20Result {
  const { modifier = 0, advantage = false, disadvantage = false } = opts;
  // Advantage and disadvantage cancel per 5e rules.
  const both = advantage && disadvantage;
  const rolls = [rng.int(1, 20)];
  if ((advantage || disadvantage) && !both) rolls.push(rng.int(1, 20));
  const kept = rolls.length === 1 ? rolls[0] : advantage ? Math.max(...rolls) : Math.min(...rolls);
  return {
    rolls,
    kept,
    modifier,
    total: kept + modifier,
    natural20: kept === 20,
    natural1: kept === 1,
  };
}
