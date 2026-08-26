/**
 * Terminal play loop. Run with: pnpm play
 * Slash commands: /sheet /scene /canon <query> /events /help /quit
 */
import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { GameDb } from "./state/db.js";
import { DmAgent } from "./agent/dm.js";
import { providerFromEnv, scribeProviderFromEnv } from "./llm/provider.js";
import { seed, DEFAULT_DB_PATH } from "./fixture/seed.js";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function printSheet(db: GameDb): void {
  const pc = db.getPlayerCharacter();
  const slots = Object.entries(pc.spellSlots)
    .map(([lvl, s]) => `L${lvl} ${s.max - s.used}/${s.max}`)
    .join(" ");
  console.log(bold(`\n${pc.name} — level ${pc.level} ${pc.race} ${pc.className}`));
  console.log(`HP ${pc.hp}/${pc.maxHp}  AC ${pc.ac}  ${slots ? `Slots ${slots}` : ""}`);
  if (pc.conditions.length) console.log(`Conditions: ${pc.conditions.join(", ")}`);
  console.log(`Inventory: ${pc.inventory.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", ")}\n`);
}

function printScene(db: GameDb): void {
  const scene = db.getScene();
  if (!scene) return void console.log("No scene.");
  console.log(bold(`\n${scene.name}`) + dim(` (${scene.time})`));
  console.log(scene.description);
  const present = scene.present
    .map((id) => {
      const c = db.findCharacter(id);
      return c ? `${c.name} (${c.hp}/${c.maxHp})` : id;
    })
    .join(", ");
  console.log(`Present: ${present || "no one"}\n`);
}

async function main(): Promise<void> {
  const dbPath = DEFAULT_DB_PATH;
  let db: GameDb;
  if (!fs.existsSync(dbPath)) {
    console.log(dim(`No save found — seeding fixture world at ${dbPath}...`));
    db = seed(dbPath);
  } else {
    db = new GameDb(dbPath);
  }

  const agent = new DmAgent(db, providerFromEnv(), scribeProviderFromEnv());

  // Interactive: readline. Piped (scripted playtests): consume stdin up front,
  // since readline drops lines that arrive while a turn is streaming.
  let ask: (prompt: string) => Promise<string | undefined>;
  let cleanup = () => {};
  if (stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    ask = (prompt) => rl.question(prompt).catch(() => undefined);
    cleanup = () => rl.close();
  } else {
    const raw = fs.readFileSync(0, "utf8");
    const queue = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    ask = async (prompt) => {
      const next = queue.shift();
      if (next !== undefined) stdout.write(prompt + next + "\n");
      return next;
    };
  }

  const hooks = {
    onText: (d: string) => stdout.write(d),
    onToolCall: (name: string, args: Record<string, unknown>) => {
      const summary =
        name === "roll"
          ? `${args.dice} (${args.reason})`
          : name === "ability_check"
            ? `${args.characterId}: ${args.ability}${args.skill ? `/${args.skill}` : ""} vs DC ${args.dc}`
            : name === "attack"
              ? `${args.attackerId} -> ${args.targetId}`
              : Object.values(args).slice(0, 3).join(", ");
      stdout.write(dim(`\n  · ${name} ${summary}\n`));
    },
    onCorrection: () => stdout.write(dim(`\n  · re-checking narration against the dice...\n`)),
  };

  console.log(bold("\n=== The Saltmine Warrens — an Emberhollow story ===\n"));
  console.log(dim("You are Sera Valen, cleric of the Dawnfather, home after two years away."));
  console.log(dim("Type what you do. Commands: /sheet /scene /canon <query> /events /quit\n"));

  if (db.getTurn() === 0) {
    stdout.write(bold("DM: "));
    const result = await agent.playTurn("", hooks);
    stdout.write("\n");
    if (result.violations.length) console.log(dim(`  [validator: ${result.violations.length} unresolved]`));
  }

  for (;;) {
    const answer = await ask(bold("\n> "));
    if (answer === undefined) break;
    const input = answer.trim();
    if (!input) continue;

    if (input === "/quit" || input === "/exit") break;
    if (input === "/sheet") {
      printSheet(db);
      continue;
    }
    if (input === "/scene") {
      printScene(db);
      continue;
    }
    if (input.startsWith("/canon")) {
      const q = input.slice(6).trim();
      const facts = q ? db.searchCanon(q, 15) : db.recentCanon(15);
      for (const f of facts) console.log(`  [${f.subject}] ${f.fact} ${dim(`(t${f.turn}, ${f.source})`)}`);
      continue;
    }
    if (input === "/events") {
      for (const e of db.recentEvents(15)) console.log(`  t${e.turn} ${e.kind}: ${JSON.stringify(e.data).slice(0, 140)}`);
      continue;
    }
    if (input === "/help") {
      console.log(dim("  /sheet /scene /canon <query> /events /quit — everything else is play."));
      continue;
    }

    stdout.write(bold("\nDM: "));
    try {
      const result = await agent.playTurn(input, hooks);
      stdout.write("\n");
      if (result.corrected) console.log(dim(`  [narration was corrected against the event log]`));
      if (result.violations.length)
        console.log(dim(`  [validator: ${result.violations.length} unresolved: ${result.violations.map((v) => v.claim).join("; ")}]`));
    } catch (err) {
      console.error(`\n[error] ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  cleanup();
  db.close();
  console.log(dim("\nThe table is packed up. The save lives in " + dbPath + "\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
