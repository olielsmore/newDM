/**
 * Working-set assembly: the ~10k tokens the DM needs THIS turn.
 */
import { GameDb } from "../state/db.js";
import { currentCombatant } from "../rules/combat.js";
import { contextBlock } from "./prompts.js";
import { wordBudgetFor } from "./validator.js";

function sheetSnapshot(db: GameDb): string {
  const pc = db.getPlayerCharacter();
  const slots = Object.entries(pc.spellSlots)
    .map(([lvl, s]) => `L${lvl}: ${s.max - s.used}/${s.max}`)
    .join(", ");
  return [
    `${pc.name} (id: ${pc.id}) — level ${pc.level} ${pc.race} ${pc.className}`,
    `HP ${pc.hp}/${pc.maxHp}${pc.tempHp ? ` (+${pc.tempHp} temp)` : ""}, AC ${pc.ac}`,
    slots ? `Spell slots: ${slots}` : "",
    pc.conditions.length ? `Conditions: ${pc.conditions.join(", ")}` : "",
    pc.concentrating ? `Concentrating: ${pc.concentrating.spell}` : "",
    `Spells known: ${pc.spellsKnown.join(", ")}`,
    `Inventory: ${pc.inventory.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function sceneSnapshot(db: GameDb): string {
  const scene = db.getScene();
  if (!scene) return "";
  const present = scene.present
    .map((id) => {
      const c = db.getCharacter(id);
      return c
        ? `${c.name} (id: ${c.id}, ${c.kind}, ${c.hp}/${c.maxHp} hp${c.conditions.length ? `, ${c.conditions.join("/")}` : ""})`
        : id;
    })
    .join("; ");
  const place = db.getPlace(scene.placeId);
  const exits = place?.exits.map((e) => `${e.to} — ${e.description}`).join("; ") ?? "";
  const voices = scene.present
    .map((id) => {
      const v = db.getVoice(id);
      const c = db.getCharacter(id);
      return v && c
        ? `${c.name}: diction=${v.diction} tics=${v.tics} agenda=${v.agenda} never="${v.neverSay}"`
        : null;
    })
    .filter(Boolean)
    .join("\n");
  const combat = db.getCombat();
  const combatLine = combat?.active
    ? `Combat round ${combat.round}. Current turn: ${currentCombatant(combat)}. Order: ${combat.order.map((o) => `${o.id} (init ${o.initiative})`).join(", ")}.`
    : "";
  return [
    `Location: ${scene.name} (place id: ${scene.placeId}) — ${scene.description}`,
    place?.tags?.length ? `Environment tags: ${place.tags.join(", ")}` : "",
    `Time: ${scene.time}`,
    present ? `Present: ${present}` : "Present: no one but the player",
    scene.features.length ? `Features: ${scene.features.join("; ")}` : "",
    exits ? `Exits (use these EXACT ids with move_scene): ${exits}` : "",
    combatLine,
    voices ? `NPC voice cards:\n${voices}` : "",
    `The party is HERE until you call move_scene with an exact exit id. Narrating an arrival elsewhere without moving is a continuity error.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function retrievedCanon(db: GameDb, playerInput: string): string {
  const scene = db.getScene();
  const seen = new Set<number>();
  const facts: { subject: string; fact: string }[] = [];

  const add = (rows: { id: number; subject: string; fact: string }[]) => {
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      facts.push({ subject: r.subject, fact: r.fact });
    }
  };

  add(db.searchCanon(playerInput, 8));
  if (scene) {
    add(db.searchCanon(scene.name, 4));
    for (const id of scene.present) {
      const c = db.getCharacter(id);
      if (c) add(db.canonBySubject(c.name, 3));
    }
  }
  add(db.recentCanon(6));

  return facts
    .slice(0, 20)
    .map((f) => `- [${f.subject}] ${f.fact}`)
    .join("\n");
}

function openingPhrases(db: GameDb): string {
  return db
    .recentTurns(3)
    .map((t) => t.dm_output.trim().split(/[.!?]/)[0]?.trim())
    .filter(Boolean)
    .map((s) => `- "${s}"`)
    .join("\n");
}

export function stageDirection(db: GameDb): string {
  const notes: string[] = [];
  const recent = db.recentTurns(4);

  if (recent.length >= 2) {
    const avgWords = recent.reduce((s, t) => s + t.dm_output.split(/\s+/).length, 0) / recent.length;
    if (avgWords > 130) notes.push("Your last few beats ran long — tighten up, one strong image and out.");
  }

  const recentEvents = db.recentEvents(30);
  const turn = db.getTurn();
  const rollTurns = recentEvents
    .filter((e) => ["ability_check", "attack", "saving_throw", "roll", "cast_spell"].includes(e.kind))
    .map((e) => e.turn);
  const turnsSinceRoll = rollTurns.length ? turn - Math.max(...rollTurns) : 99;
  if (turnsSinceRoll >= 3) {
    notes.push(
      "You have not touched the dice in several beats. If the player attempts anything uncertain — reading people, persuading, sneaking, searching — adjudicate it with a real check, and let NPCs resist.",
    );
  }
  if (turnsSinceRoll >= 6) notes.push("It has been a while since anything was at stake — introduce pressure or consequence soon.");

  const combat = db.getCombat();
  if (combat?.active) {
    const current = currentCombatant(combat);
    const sheet = current ? db.getCharacter(current) : undefined;
    notes.push(
      `Combat is live, round ${combat.round}, current turn ${current ?? "?"}. Resolve the current combatant's actions (monster turns promptly), then call next_combat_turn. Keep beats short and kinetic.`,
    );
    if (sheet?.kind === "monster") notes.push("It is a monster's turn — act for them, do not wait for the player.");
  }

  const model = db.playerModelSummary();
  if (model.lastPillars.length >= 3) {
    const last = model.lastPillars.slice(0, 3);
    if (last.every((p) => p === last[0])) {
      notes.push(`The player has leaned ${last[0]} for three beats — vary the pressure, don't only serve that pillar.`);
    }
  }

  const combatActive = Boolean(combat?.active);
  const budget = wordBudgetFor({ opening: turn === 0, combat: combatActive });
  notes.push(`Word budget this beat: ${budget}.`);
  return notes.join(" ");
}

export function buildContextBlock(db: GameDb, playerInput: string): string {
  const summary = db.getMeta("session_summary") ?? "";
  const direction = stageDirection(db);
  const avoided = openingPhrases(db);
  return contextBlock([
    { title: "Player character (live from the database)", body: sheetSnapshot(db) },
    { title: "Current scene (live from the database)", body: sceneSnapshot(db) },
    { title: "Known canon (do not contradict; you may build on it). Secrets are NOT listed here.", body: retrievedCanon(db, playerInput) },
    { title: "Session so far", body: summary },
    { title: "Do not open like these recent lines", body: avoided },
    { title: "Stage direction (private, never mention)", body: direction },
  ]);
}
