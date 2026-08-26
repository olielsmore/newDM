/**
 * Working-set assembly: the ~10k tokens the DM needs THIS turn.
 * Scene + sheet snapshot + retrieved canon + summary + stage direction.
 * Context is a cache over the database, not a transcript dump.
 */
import { GameDb } from "../state/db.js";
import { contextBlock } from "./prompts.js";

function sheetSnapshot(db: GameDb): string {
  const pc = db.getPlayerCharacter();
  const slots = Object.entries(pc.spellSlots)
    .map(([lvl, s]) => `L${lvl}: ${s.max - s.used}/${s.max}`)
    .join(", ");
  return [
    `${pc.name} — level ${pc.level} ${pc.race} ${pc.className}`,
    `HP ${pc.hp}/${pc.maxHp}${pc.tempHp ? ` (+${pc.tempHp} temp)` : ""}, AC ${pc.ac}`,
    slots ? `Spell slots: ${slots}` : "",
    pc.conditions.length ? `Conditions: ${pc.conditions.join(", ")}` : "",
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
      const c = db.findCharacter(id);
      return c ? `${c.name} (${c.kind}, ${c.hp}/${c.maxHp} hp${c.conditions.length ? `, ${c.conditions.join("/")}` : ""})` : id;
    })
    .join("; ");
  const place = db.getPlace(scene.placeId);
  const exits = place?.exits.map((e) => `${e.to} (${e.description})`).join("; ") ?? "";
  return [
    `Location: ${scene.name} — ${scene.description}`,
    `Time: ${scene.time}`,
    present ? `Present: ${present}` : "Present: no one but the player",
    scene.features.length ? `Features: ${scene.features.join("; ")}` : "",
    exits ? `Exits: ${exits}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Pull canon relevant to this turn: entities in the input, scene, and recent facts. */
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
      const c = db.findCharacter(id);
      if (c) add(db.canonBySubject(c.name, 3));
    }
  }
  add(db.recentCanon(6) as never);

  return facts
    .slice(0, 20)
    .map((f) => `- [${f.subject}] ${f.fact}`)
    .join("\n");
}

/**
 * The director's whisper: one or two lines of private stage direction
 * computed from simple signals. Not a controller — prep notes.
 */
export function stageDirection(db: GameDb): string {
  const notes: string[] = [];
  const recent = db.recentTurns(4);

  if (recent.length >= 2) {
    const avgWords =
      recent.reduce((s, t) => s + t.dm_output.split(/\s+/).length, 0) / recent.length;
    if (avgWords > 130) notes.push("Your last few beats ran long — tighten up, one strong image and out.");
  }

  const recentEvents = db.recentEvents(30);
  const turnsSinceRoll = (() => {
    const turn = db.getTurn();
    const rollTurns = recentEvents
      .filter((e) => ["ability_check", "attack", "saving_throw", "roll"].includes(e.kind))
      .map((e) => e.turn);
    return rollTurns.length ? turn - Math.max(...rollTurns) : 99;
  })();
  if (turnsSinceRoll >= 3)
    notes.push(
      "You have not touched the dice in several beats. If the player attempts anything uncertain — reading people, persuading, sneaking, searching — adjudicate it with a real check, and let NPCs resist.",
    );
  if (turnsSinceRoll >= 6) notes.push("It has been a while since anything was at stake — introduce pressure or consequence soon.");

  const scene = db.getScene();
  const monsters = scene?.present.filter((id) => db.findCharacter(id)?.kind === "monster") ?? [];
  if (monsters.length > 0) notes.push("Combat is live: keep beats short and kinetic, resolve monster turns promptly.");

  return notes.join(" ");
}

export function buildContextBlock(db: GameDb, playerInput: string): string {
  const summary = db.getMeta("session_summary") ?? "";
  const direction = stageDirection(db);
  return contextBlock([
    { title: "Player character (live from the database)", body: sheetSnapshot(db) },
    { title: "Current scene (live from the database)", body: sceneSnapshot(db) },
    { title: "Known canon (do not contradict; you may build on it)", body: retrievedCanon(db, playerInput) },
    { title: "Session so far", body: summary },
    { title: "Stage direction (private, never mention)", body: direction },
  ]);
}
