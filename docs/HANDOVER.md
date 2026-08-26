# Handover for a local agent

You are taking over **dm-engine**, an AI Dungeon Master for D&D 5e. Clone / pull
`https://github.com/olielsmore/newDM.git` (branch `main` or
`cursor/dm-engine-01fb` — they are in sync as of this note). Work from the
repo root. Do not invent a second architecture. The table works; the job now is
to close the gaps in `docs/ROADMAP.md` without violating the invariants below.

---

## Why previous attempts failed (read this first)

Five earlier pipelines let the LLM own both story and mechanics. Result: boring
3–4 sentence exposition, continuity errors, invented HP / loot / places, and
logic bugs. This repo exists because those approaches were rejected.

The standing diagnosis: **the model must never own state and never roll dice.**
Mechanical truth lives in SQLite and is reached only through tools. Every tool
call is event-logged. A deterministic validator (plus an LLM grounding pass)
checks narration against that log. A scribe extracts durable facts into canon.
Secrets stay hidden until `reveal_secret`.

The user was explicit: **never cut corners with heuristics.** A previous
fuzzy-match on place names (weighting the last token as "usually the noun")
is exactly the class of bug that later becomes a continuity error. Wrong id →
error listing legal candidates → the model retries. No silent reinterpretation.

---

## What is proven (do not re-litigate)

A full live playthrough of the fixture arc (tavern → Greely → mine → ghoul fight
→ Derva → public confession → toast) ran against `gpt-5.4`. Transcript:
`docs/playthrough-saltmine-warrens.md`. That session also drove live engine
fixes: fourth-wall leaks, recasting Tam as a survivor, combat-in-prose, death
saves at 0 HP, etc.

Also proven: Hono API + React UI in a real browser (SSE streaming, 🎲 tool
chips, combat tracker with initiative/HP/current turn, reset + auto-start).
77 tests pass, including a golden cassette replay (`test/cassettes/`,
`test/cassette.test.ts`) that runs the full agent loop with no API key.

**Models:** `DM_MODEL=gpt-5.4`, `SCRIBE_MODEL=gpt-5.4-mini`. GPT-4o-era models
are markedly worse at tool discipline here — they narrate fights they never
rolled. Do not switch back without a live playthrough that proves otherwise.
The 5.x family needs `max_completion_tokens`, not `max_tokens`
(`src/llm/provider.ts`).

API key: `OPENAI_API_KEY` or `OpenAI__ApiKey`. GitHub: public repo
`olielsmore/newDM`.

---

## Architecture (map, then read)

```
src/rules/      dice, sheets, resolve, combat, spells, encounter math
src/state/      GameDb (better-sqlite3). Exact-id lookups only.
src/tools/      defs.ts + index.ts — the agent's ONLY access to state/dice
src/agent/      persona (prompts.ts), context, validator, grounding, scribe,
                player model, metrics, dm.ts turn loop
src/content/    ContentRecord types, SrdJsonAdapter, PostgresAdapter stub, ingest
src/server/     Hono, SSE POST /api/turn
src/llm/        OpenAI provider (retries 429s), cassette record/replay, model check
src/fixture/    Emberhollow / Saltmine Warrens seed world
web/            React + Vite + Tailwind play UI (proxies /api → :8787)
docs/           ROADMAP.md, this file, the live playthrough
```

Turn loop (`src/agent/dm.ts`): assemble context → stream DM with tools (up to 12
iterations) → regex validator + optional LLM grounding → up to 2 correction
rounds (strict improvement only; correction is alignment, never escalation) →
save turn → fire-and-forget scribe / summary / player-model.

Context (`src/agent/context.ts`) injects: live sheet, live scene with exact exit
ids, retrieved *visible* canon, **DM-only hidden truths** (never contradict,
reveal via `reveal_secret` first), session summary, opening-phrase avoid list,
private stage directions.

---

## Invariants (break these and the project fails again)

1. **No invented mechanics.** Every number in prose traces to a tool result this
   turn. Leveled spells go through `cast_spell`. Loot that is narrated must be
   granted with `apply_effect add_item` in the same turn (mundane finds:
   `canon_write` then `add_item`).
2. **Exact contracts.** Character, place, monster, spell, item ids are exact.
   `resolveCharacter` / `getContent` / `move_scene` reject guesses. Errors list
   legal candidates. `move_scene` is one hop at a time along current exits.
   Multi-leg travel = one `move_scene` per hop, all before narration.
3. **Combat is engine-owned.** Attacks or damaging spells involving a monster
   require `start_combat`. Incapacitated combatants (`paralyzed`, `stunned`,
   `unconscious`, …) cannot act; helpless targets are hit at advantage. Damage
   at 0 HP fails death saves (1, or 2 on a crit; massive damage ≥ max HP kills
   outright). NPCs entering a live fight join initiative via `addCombatant`
   without shifting whose turn it is. A creature cannot appear, attack, or be
   struck in prose alone.
4. **Never break the fourth wall.** Narration must not mention tools, ids,
   engines, retries, or process. The validator flags this. Tool errors are
   fixed silently; the player never sees the machinery.
5. **Secrets.** Hidden canon is in the DM context under "DM-only truths".
   Foreshadow freely. When play earns a disclosure: `reveal_secret` with the
   exact subject, *then* narrate.
6. **New people / places.** Mint with `create_npc` (and, when you build it,
   `create_place`). Never recast an existing character as someone else.
   Check canon before reusing a name.
7. **Correction is alignment, not escalation.** If a draft narrated mechanics
   with no event, the model either calls the missing tools for what the draft
   implied, or pulls the prose back to the moment before contact. It must not
   spawn a new fight to justify a flagged line.
8. **No fuzzy matching. No silent reinterpretation.** If you are tempted to
   "helpfully" guess what the LLM meant, don't. Return an error.

---

## How to run

```bash
pnpm install
export OPENAI_API_KEY=sk-...          # or OpenAI__ApiKey
pnpm models:check                     # must print OK  DM=gpt-5.4  SCRIBE=gpt-5.4-mini
pnpm test && pnpm typecheck           # 77 tests as of handover
pnpm seed                             # wipes data/game.db, reseeds fixture
pnpm play                             # CLI. Slash: /sheet /scene /canon /events /quit
# or
pnpm serve                            # API :8787
pnpm --dir web install && pnpm ui     # UI :5173, proxies /api
```

Scripted playtests: `pnpm play < test/scripts/full-arc.txt` (or
`showcase.txt`). Re-record the golden cassette after prompt or tool-surface
changes: `pnpm cassette:record` then `pnpm test`.

---

## What to do next

Read `docs/ROADMAP.md` and start **Phase 1 — Content at scale**. It unblocks
everything else.

1. Fetch a public 5e SRD JSON dump into `content/srd/` and extend
   `src/content/srd-json.ts` for richer fields (senses, resistances, immunities,
   speeds, save proficiencies; spell components/duration/range). `pnpm ingest`.
   Spot-check CR→XP across the bestiary.
2. Extend `SpellEffect` in `src/rules/spells.ts` (multi-target, area, slot
   scaling, cantrip scaling, temp HP, bless/bane-style dice riders, durations on
   the combat round). Author the **full cleric list first**, then wizard/druid
   staples. Spells without definitions stay errors that tell the DM to pick an
   implemented one — do not let the model improvise them.
3. Engine-executed monster traits: multiattack, pack tactics (ally in combat ≈
   adjacent), undead fortitude, regeneration on round wrap. Tactics prose stays
   for the DM; mechanics run in `src/rules/` / `src/tools/`.
4. Implement `PostgresAdapter` only when the user is ready to point it at their
   existing 5e database. Reconcile ids with `contentId` so saves survive.

Phase 1 exit: `suggest_encounter` composes sane fights from the full bestiary in
three environments; a live playthrough uses only ingested content.

Then Phase 2 (PC builder, XP/level-up, death epilogue, rests), Phase 3
(`create_place`, quest table, world tick, clock), Phase 4 (`transact`, computed
AC), Phase 5 (canon consolidation), Phase 6 (party seats + polished UI suite),
Phase 7 (more cassettes, adversarial tests, token-cost metrics).

**Every phase ends with:** UI rebuilt to expose the new surface, a scripted live
playthrough, and a cassette locked into `pnpm test`. Do not skip the live
playthrough. Unit tests did not catch the bugs the playthroughs did.

---

## Known sharp edges

- Rate limit is 30k TPM on this org; the provider retries 429s with backoff.
  Scripted playthroughs in a tight loop will still hitch.
- `move_scene` with a character id (e.g. `derva`) is now a clear error: use
  `addPresent`. The DM used to try this and then break the fourth wall
  explaining it — that path is now blocked in prompt + validator.
- Combat is one action per combatant per turn. If the player casts then swings
  in the same sentence, the second action is refused and must be narrated as
  "your opening is spent."
- The scribe writes many small facts (15 rows from one Greely scene). Fine for
  now; Phase 5 consolidates. Don't paper over it with retrieval heuristics.
- Fixture content is tiny on purpose (6 monsters / 7 spells / 7 items). Variety
  is Phase 1, not more hand-authored fixtures.
- Local `data/game.db` is the save. `pnpm seed` destroys it.

---

## Style of work the user expects

- High effort, no shortcuts. If a contract is awkward, fix the contract — do
  not add a matcher.
- Rebuild the UI after each phase so it can be tested; a final polish pass is
  Phase 6, not now.
- Stick to OpenAI. Cost-aware is fine; effectiveness wins (hence gpt-5.4).
- Solo play first; parties later (ids are already plumbed).
- SRD now, Postgres reseed once SRD-backed play is solid.
- Commit with clear messages. Do not commit secrets or API keys.

When in doubt, read the last live transcript and the current `DM_SYSTEM_PROMPT`
before changing either. The voice in that transcript is the bar.
