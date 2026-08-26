# dm-engine

An AI Dungeon Master with a deterministic heart. One LLM agent runs the table; a rules engine, event log, and canon database make sure it cannot lie about the dice or forget the innkeeper's name.

## Architecture

The model never owns state and never rolls dice. Mechanical truth lives in SQLite and is reached only through tools. Every tool call is event-logged. A deterministic validator (and an optional LLM grounding pass) checks narration against that log. A scribe captures invented facts into canon; retrieval injects the relevant cards next turn. Secrets stay hidden until `reveal_secret`. Context stays ~10k tokens whether it is session 1 or session 100.

Exact contracts, no silent guessing: a wrong place or character id is an error listing legal candidates. The model retries through the tool loop.

## Run

```bash
pnpm install
export OPENAI_API_KEY=sk-...
pnpm models:check    # verifies gpt-4o and gpt-4o-mini on this key
pnpm seed            # fixture world (destroys the current save)
pnpm play            # terminal table
pnpm serve           # API on :8787
pnpm --dir web install && pnpm --dir web dev   # UI on :5173
```

Models (env-configurable): `DM_MODEL=gpt-4o`, `SCRIBE_MODEL=gpt-4o-mini`.

Slash commands in the CLI: `/sheet` `/scene` `/canon <query>` `/events` `/quit`.

## Fixture

Emberhollow and the Saltmine Warrens. Sera Valen, level 2 cleric. Six NPCs, hidden secrets, tagged places, structured spells.

## Content at scale

The content table is indexed (CR, type, environment, rarity, spell level). Tools: `find_monsters`, `find_items`, `suggest_encounter` (DMG XP budgets). `pnpm ingest` loads `content/srd/*.json` via `SrdJsonAdapter`. A `PostgresAdapter` stub is the later reseed path from the existing 5e database.

## Tests

```bash
pnpm test
pnpm typecheck
```

## Layout

- `src/rules/` — dice, sheets, resolution, combat, spells, encounter math
- `src/state/` — SQLite
- `src/tools/` — the agent's only access to state and dice
- `src/agent/` — persona, context, validator, grounding, scribe, player model
- `src/content/` — adapters and ingest
- `src/server/` — Hono API, SSE `/api/turn`
- `src/llm/` — OpenAI provider, cassette replay, model probe
- `web/` — React + Vite + Tailwind play surface

Worldgen and questgen are explicitly later: only after this table feels right.
