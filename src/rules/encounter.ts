/**
 * DMG encounter-building math. Deterministic: the engine computes the
 * XP budget; the model only picks which candidate composition fits the fiction.
 */

/** XP thresholds by character level: easy / medium / hard / deadly (DMG p.82). */
export const XP_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

export const CR_XP: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "30": 155000,
};

export function crToNumber(cr: string | number): number {
  if (typeof cr === "number") return cr;
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  const n = Number(cr);
  return Number.isFinite(n) ? n : 0;
}

export function xpForCr(cr: string | number): number {
  const key = typeof cr === "number" ? String(cr) : cr;
  return CR_XP[key] ?? 0;
}

/** Encounter multiplier by monster count (DMG p.82). Solo party uses these as-is. */
export function encounterMultiplier(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3;
  return 4;
}

export type EncounterDifficulty = "easy" | "medium" | "hard" | "deadly";

export function partyXpBudget(levels: number[], difficulty: EncounterDifficulty): number {
  return levels.reduce((sum, lvl) => {
    const row = XP_THRESHOLDS[Math.min(20, Math.max(1, lvl))];
    return sum + (row?.[difficulty] ?? 0);
  }, 0);
}

export function adjustedXp(crs: Array<string | number>): number {
  let raw = 0;
  for (const cr of crs) raw += xpForCr(cr);
  return Math.floor(raw * encounterMultiplier(crs.length));
}

export interface MonsterCandidate {
  id: string;
  name: string;
  cr: string;
  xp: number;
  type: string;
  description: string;
}

export interface EncounterComposition {
  label: string;
  members: { id: string; name: string; cr: string; count: number }[];
  adjustedXp: number;
  difficulty: EncounterDifficulty;
}

/**
 * Build up to `max` compositions that land near the budget without exceeding it.
 * Deterministic: sorts candidates by CR descending then id, then greedily packs.
 */
export function composeEncounters(
  candidates: MonsterCandidate[],
  budget: number,
  difficulty: EncounterDifficulty,
  max = 3,
): EncounterComposition[] {
  const usable = [...candidates]
    .filter((c) => c.xp > 0 && c.xp <= budget)
    .sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id));
  if (usable.length === 0) return [];

  const compositions: EncounterComposition[] = [];

  // 1. Single strongest monster that fits.
  const solo = usable[0];
  compositions.push({
    label: `one ${solo.name}`,
    members: [{ id: solo.id, name: solo.name, cr: solo.cr, count: 1 }],
    adjustedXp: adjustedXp([solo.cr]),
    difficulty,
  });

  // 2. A pair of the next-best that still fits after the 1.5x pair multiplier.
  const pairable = usable.filter((c) => adjustedXp([c.cr, c.cr]) <= budget);
  if (pairable.length) {
    const p = pairable[0];
    compositions.push({
      label: `two ${p.name}s`,
      members: [{ id: p.id, name: p.name, cr: p.cr, count: 2 }],
      adjustedXp: adjustedXp([p.cr, p.cr]),
      difficulty,
    });
  }

  // 3. Mixed pack: fill remaining budget with the cheapest remaining type.
  const cheap = [...usable].sort((a, b) => a.xp - b.xp || a.id.localeCompare(b.id))[0];
  if (cheap) {
    let count = 1;
    while (count < 8 && adjustedXp(Array(count + 1).fill(cheap.cr)) <= budget) count += 1;
    if (count >= 3) {
      compositions.push({
        label: `${count} ${cheap.name}s`,
        members: [{ id: cheap.id, name: cheap.name, cr: cheap.cr, count }],
        adjustedXp: adjustedXp(Array(count).fill(cheap.cr)),
        difficulty,
      });
    }
  }

  // Dedupe identical member lists.
  const seen = new Set<string>();
  return compositions
    .filter((c) => {
      const key = c.members.map((m) => `${m.id}x${m.count}`).join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}
