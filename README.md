# dm-engine

An AI Dungeon Master with a deterministic heart. One LLM agent runs the table like a human DM; a rules engine, event log, and canon database make sure it can never lie about the dice or forget the innkeeper's name.

## Architecture in one paragraph

The model never owns state and never rolls dice. All mechanical truth (HP, spell slots, rolls, conditions, scenes) lives in SQLite and is reached only through tools (`roll`, `attack`, `ability_check`, `apply_effect`, ...), every execution of which is appended to an event log. A grounding validator checks each narration against that log — any number the model didn't get from a tool this turn triggers a rewrite. World facts flow the other way: a scribe model extracts anything durable the DM invents (names, promises, details) into a canon table, and retrieval injects the relevant canon back into context each turn. Context stays ~10k tokens flat forever: persona + live scene + sheet snapshot + retrieved canon + rolling summary + a one-line stage direction. Invention is captured, not forbidden; the only law is "never invent mechanics, never contradict canon."

## Run it

```bash
pnpm install
export OPENAI_API_KEY=sk-...   # or any OpenAI-compatible gateway via OPENAI_BASE_URL
pnpm seed    # builds the fixture world (destroys any existing save)
pnpm play    # sit down at the table
```

Optional env: `DM_MODEL` (default `gpt-4o`), `SCRIBE_MODEL` (default `gpt-4o-mini`), `GAME_DB` (default `data/game.db`), `GAME_SEED`.

In play, everything you type is an action. Slash commands: `/sheet`, `/scene`, `/canon <query>`, `/events`, `/quit`.

## The fixture

One town (Emberhollow), one dungeon (the Saltmine Warrens), six NPCs, one quest, and a pre-made PC: Sera Valen, level 2 cleric, home after two years away. Six miners are missing under the hill, and the boy who got out won't stop talking about pale folk with wet mouths.

## Layout

- `src/rules/` — pure 5e math: seeded dice, sheets, checks, attacks, damage, slots. No I/O, no LLM.
- `src/state/` — SQLite: characters, places, scene, content, canon, events, turns.
- `src/tools/` — the agent's only way to touch state or dice; every call is event-logged.
- `src/llm/` — OpenAI-compatible provider (streaming + tool calls) and a mock for tests.
- `src/agent/` — persona prompt, context assembly, the turn loop, grounding validator, scribe.
- `src/fixture/` — the seed world and vendored SRD content subset.

## Tests

```bash
pnpm test        # 39 tests: dice determinism, rules math, tools, validator, agent loop
pnpm typecheck
```

## Deliberately out of scope (for now)

Worldgen, quest generation, multiplayer, grid combat (the engine narrates position, zones come later), and the full spell list. The point of this milestone is a table that feels right; everything else layers on top.
