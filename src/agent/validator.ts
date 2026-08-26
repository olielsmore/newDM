/**
 * Deterministic grounding. Every mechanical claim in prose must trace to
 * a tool result from this turn. Spell names, arrivals, and invented loot
 * are the same: lint, not vibes.
 */
import { GameEvent } from "../state/db.js";

export interface Violation {
  claim: string;
  problem: string;
}

export function numbersFromEvents(events: GameEvent[]): Set<number> {
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

const MECHANICAL_EVENT_KINDS = new Set(["roll", "ability_check", "saving_throw", "attack", "apply_effect", "cast_spell", "death_save"]);

export interface SceneInfo {
  currentPlaceId: string;
  places: { id: string; name: string }[];
}

export interface ValidationContext {
  scene?: SceneInfo;
  leveledSpells?: string[];
  wordBudget?: number;
}

const ARRIVAL_VERBS =
  "enter(?:ing|s)?|step(?:s|ping)?\\s+into|reach(?:es|ing)?|arriv(?:e|es|ing)\\s+(?:at|in)|descend(?:s|ing)?\\s+(?:into|to)|climb(?:s|ing)?\\s+(?:into|down\\s+to)|wade(?:s|ing)?\\s+(?:into|through)|emerge(?:s|ing)?\\s+(?:into|in)|open(?:s)?\\s+up|stretches\\s+(?:ahead|before)|swallows\\s+you";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkSceneDrift(prose: string, events: GameEvent[], scene: SceneInfo): Violation[] {
  const movedTo = new Set(
    events
      .filter((e) => e.kind === "move_scene")
      .map((e) => (e.data as { result?: { scene?: { placeId?: string } } }).result?.scene?.placeId)
      .filter(Boolean),
  );
  const violations: Violation[] = [];
  for (const place of scene.places) {
    if (place.id === scene.currentPlaceId || movedTo.has(place.id)) continue;
    const shortName = escapeRegex(place.name.replace(/^the\s+/i, ""));
    const re = new RegExp(
      `(?:${ARRIVAL_VERBS})[^.!?\\n]{0,60}?\\b(?:the\\s+)?${shortName}\\b|\\b(?:the\\s+)?${shortName}\\b[^.!?\\n]{0,30}?(?:${ARRIVAL_VERBS})`,
      "i",
    );
    const m = re.exec(prose);
    if (m) {
      violations.push({
        claim: m[0].trim().slice(0, 80),
        problem: `narrates arriving at "${place.name}" but the scene was never moved there — call move_scene("${place.id}") using an exact exit id`,
      });
    }
  }
  return violations;
}

function checkSpellSlots(prose: string, events: GameEvent[], leveledSpells: string[]): Violation[] {
  const spent = events.some((e) => {
    if (e.kind === "cast_spell") return true;
    if (e.kind !== "apply_effect") return false;
    const effect = (e.data as { args?: { effect?: string } }).args?.effect;
    return effect === "spend_slot";
  });
  const violations: Violation[] = [];
  for (const spell of leveledSpells) {
    const re = new RegExp(`\\bcast(?:s|ing)?\\s+(?:a\\s+|the\\s+)?${escapeRegex(spell)}\\b`, "i");
    const m = re.exec(prose);
    if (m && !spent) {
      violations.push({
        claim: m[0],
        problem: `cast a leveled spell (${spell}) but no cast_spell or spend_slot happened this turn`,
      });
    }
  }
  return violations;
}

function checkWordBudget(prose: string, budget: number): Violation[] {
  const words = prose.trim().split(/\s+/).filter(Boolean).length;
  if (words > budget * 2) {
    return [
      {
        claim: `${words} words`,
        problem: `narration is ${words} words against a ${budget}-word budget — cut it to one strong image and a hook`,
      },
    ];
  }
  return [];
}

export function validateNarration(prose: string, events: GameEvent[], ctx: SceneInfo | ValidationContext = {}): Violation[] {
  const context: ValidationContext =
    ctx && "currentPlaceId" in ctx ? { scene: ctx } : (ctx as ValidationContext);
  const violations: Violation[] = [];
  const grounded = numbersFromEvents(events);
  const hadMechanicalEvent = events.some((e) => MECHANICAL_EVENT_KINDS.has(e.kind));
  if (context.scene) violations.push(...checkSceneDrift(prose, events, context.scene));
  if (context.leveledSpells?.length) violations.push(...checkSpellSlots(prose, events, context.leveledSpells));
  if (context.wordBudget) violations.push(...checkWordBudget(prose, context.wordBudget));

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

  const metaText = /\[[^\]\n]*\b(?:result|rolls?|damage|DC|hit|miss)\b[^\]\n]*\]/i.exec(prose);
  if (metaText) {
    violations.push({
      claim: metaText[0].slice(0, 80),
      problem: "bracketed mechanical meta-text in the prose — weave results into the narration naturally",
    });
  }

  if (!hadMechanicalEvent) {
    const combatClaim =
      /\b(?:your\s+(?:attack|blow|strike|blade|arrow|spell|mace|sword|axe|hammer)\s+(?:hits|lands|connects|meets|catches|crunches|misses)|(?:mace|blade|sword|axe|hammer|weapon|steel|metal)\s+(?:connects|meets|crunches|slams|bites)\b|claws?\s+(?:catch|rake|tear|dig)\b|critical\s+hit|you\s+(?:hit|miss|strike|wound)\s+(?:the|him|her|it|them))\b/i.exec(
        prose,
      );
    if (combatClaim) {
      violations.push({
        claim: combatClaim[0],
        problem:
          "combat contact narrated but no attack/check/roll/cast tool was called this turn — make it real with tools or end on the threat before contact",
      });
    }
  }

  return violations;
}

export function wordBudgetFor(opts: { opening: boolean; combat: boolean }): number {
  if (opts.opening) return 160;
  if (opts.combat) return 80;
  return 120;
}
