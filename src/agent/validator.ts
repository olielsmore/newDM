/**
 * Grounding validator: every mechanical claim in prose must trace to a
 * tool result from this turn. Hallucinated mechanics become lint, not vibes.
 */
import { GameEvent } from "../state/db.js";

export interface Violation {
  claim: string;
  problem: string;
}

/** Collect every number that legitimately appeared in this turn's tool results. */
function numbersFromEvents(events: GameEvent[]): Set<number> {
  const nums = new Set<number>();
  const walk = (value: unknown): void => {
    if (typeof value === "number" && Number.isFinite(value)) nums.add(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  for (const e of events) walk(e.data);
  return nums;
}

const MECHANICAL_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(?:rolls?(?:ed)?|rolling)\b[^.!?\n]*?\b(\d{1,2})\b/gi, label: "roll result" },
  { re: /\ba\s+(\d{1,2})\s*[—–-]/g, label: "announced roll" },
  { re: /\b(\d{1,3})\s+(?:points?\s+of\s+)?(?:slashing|piercing|bludgeoning|fire|cold|acid|poison|necrotic|radiant|lightning|thunder|force|psychic)\b/gi, label: "damage amount" },
  { re: /\b(\d{1,3})\s+(?:points?\s+of\s+)?damage\b/gi, label: "damage amount" },
  { re: /\b(?:heals?|regains?|recovers?)\b[^.!?\n]*?\b(\d{1,3})\b[^.!?\n]*?\b(?:hit\s*points?|hp)\b/gi, label: "healing amount" },
  { re: /\bDC\s*(\d{1,2})\b/gi, label: "difficulty class" },
  { re: /\b(\d{1,3})\s*\/\s*(\d{1,3})\s*(?:hit\s*points?|hp)\b/gi, label: "hp fraction" },
  { re: /\b(?:down\s+to|at|leaving\s+(?:you|him|her|it|them)\s+(?:at|with))\s+(\d{1,3})\s+(?:hit\s*points?|hp)\b/gi, label: "hp value" },
  { re: /\bnatural\s+(\d{1,2})\b/gi, label: "natural roll" },
];

const MECHANICAL_EVENT_KINDS = new Set(["roll", "ability_check", "saving_throw", "attack", "apply_effect"]);

export function validateNarration(prose: string, events: GameEvent[]): Violation[] {
  const violations: Violation[] = [];
  const grounded = numbersFromEvents(events);
  const hadMechanicalEvent = events.some((e) => MECHANICAL_EVENT_KINDS.has(e.kind));

  for (const { re, label } of MECHANICAL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(prose)) !== null) {
      for (const captured of m.slice(1)) {
        if (captured == null) continue;
        const n = parseInt(captured, 10);
        if (!grounded.has(n)) {
          violations.push({
            claim: m[0].trim(),
            problem: `${label} "${n}" does not appear in any tool result this turn`,
          });
        }
      }
    }
  }

  // Claiming a hit/miss/kill with zero mechanical tool calls this turn.
  if (!hadMechanicalEvent) {
    const combatClaim = /\b(?:your\s+(?:attack|blow|strike|blade|arrow|spell)\s+(?:hits|lands|connects|misses)|critical\s+hit|you\s+(?:hit|miss)\s+(?:the|him|her|it|them))\b/i.exec(prose);
    if (combatClaim) {
      violations.push({
        claim: combatClaim[0],
        problem: "combat outcome narrated but no attack/check/roll tool was called this turn",
      });
    }
  }

  return violations;
}
