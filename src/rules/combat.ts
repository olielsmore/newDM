/**
 * Combat state machine. Initiative, turn order, action economy, and
 * condition expiry are engine-owned. Presence is an id list so parties
 * can slot in later without a schema change.
 */
import { Rng, d20 } from "./dice.js";
import { Sheet, abilityMod } from "./sheet.js";

export interface Economy {
  action: boolean;
  bonus: boolean;
  movement: boolean;
  reaction: boolean;
}

export type EconomySlot = keyof Economy;

export interface CombatantInit {
  id: string;
  initiative: number;
}

export interface CombatState {
  active: boolean;
  round: number;
  order: CombatantInit[];
  currentIndex: number;
  economy: Record<string, Economy>;
}

export function emptyEconomy(): Economy {
  return { action: true, bonus: true, movement: true, reaction: true };
}

export function startCombat(rng: Rng, combatants: Sheet[]): CombatState {
  if (combatants.length === 0) throw new Error("Cannot start combat with no combatants");
  const order = combatants.map((c) => ({
    id: c.id,
    initiative: d20(rng, { modifier: abilityMod(c.abilities.dex) }).total,
  }));
  order.sort((a, b) => b.initiative - a.initiative);
  const economy: Record<string, Economy> = {};
  for (const c of combatants) economy[c.id] = emptyEconomy();
  return { active: true, round: 1, order, currentIndex: 0, economy };
}

export function currentCombatant(state: CombatState): string | undefined {
  return state.order[state.currentIndex]?.id;
}

export function consumeEconomy(state: CombatState, id: string, slot: EconomySlot): { ok: true } | { ok: false; error: string } {
  const eco = state.economy[id];
  if (!eco) return { ok: false, error: `${id} is not in this combat` };
  if (!eco[slot]) return { ok: false, error: `${id} has already used their ${slot} this turn` };
  eco[slot] = false;
  return { ok: true };
}

export function advanceTurn(state: CombatState): { wrapped: boolean; expired: string[] } {
  state.currentIndex += 1;
  let wrapped = false;
  if (state.currentIndex >= state.order.length) {
    state.currentIndex = 0;
    state.round += 1;
    wrapped = true;
    for (const id of Object.keys(state.economy)) state.economy[id] = emptyEconomy();
  }
  return { wrapped, expired: [] };
}

export function removeCombatant(state: CombatState, id: string): void {
  const idx = state.order.findIndex((c) => c.id === id);
  if (idx === -1) return;
  state.order.splice(idx, 1);
  delete state.economy[id];
  if (state.order.length === 0) {
    state.active = false;
    state.currentIndex = 0;
    return;
  }
  if (state.currentIndex > idx) state.currentIndex -= 1;
  if (state.currentIndex >= state.order.length) state.currentIndex = 0;
}

export function expireConditions(sheets: Sheet[], round: number): { id: string; expired: string[] }[] {
  const report: { id: string; expired: string[] }[] = [];
  for (const sheet of sheets) {
    const expired: string[] = [];
    for (const [name, at] of Object.entries(sheet.conditionExpiries)) {
      if (at <= round) {
        expired.push(name);
        delete sheet.conditionExpiries[name];
        sheet.conditions = sheet.conditions.filter((c) => c !== name);
      }
    }
    if (expired.length) report.push({ id: sheet.id, expired });
  }
  return report;
}

/** Concentration DC is max(10, floor(damage / 2)) per PHB. */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

export interface DeathSaveResult {
  roll: number;
  successes: number;
  failures: number;
  stable: boolean;
  dead: boolean;
  revived: boolean;
}

export function applyDeathSave(sheet: Sheet, rollTotal: number, natural20: boolean, natural1: boolean): DeathSaveResult {
  if (natural20) {
    sheet.hp = 1;
    sheet.deathSaves = { successes: 0, failures: 0 };
    sheet.conditions = sheet.conditions.filter((c) => c !== "unconscious");
    return { roll: rollTotal, successes: 0, failures: 0, stable: false, dead: false, revived: true };
  }
  if (natural1) sheet.deathSaves.failures += 2;
  else if (rollTotal >= 10) sheet.deathSaves.successes += 1;
  else sheet.deathSaves.failures += 1;

  const successes = sheet.deathSaves.successes;
  const failures = sheet.deathSaves.failures;
  const stable = successes >= 3;
  const dead = failures >= 3;
  if (stable) {
    sheet.deathSaves = { successes: 3, failures };
    if (!sheet.conditions.includes("stable")) sheet.conditions.push("stable");
  }
  if (dead && !sheet.conditions.includes("dead")) sheet.conditions.push("dead");
  return { roll: rollTotal, successes, failures, stable, dead, revived: false };
}
