# Roadmap: from playable to complete

The core loop is proven live: engine-owned mechanics, grounded narration, secrets,
combat, death saves, canon memory, and a working web UI. This plan closes the gaps
between "the fixture arc plays well" and "a full game you can live in."

Ordering principle: each phase ends with the UI rebuilt to expose what that phase
added, a scripted live playthrough exercising it, and a recorded cassette locking it
into `pnpm test`.

---

## Phase 1 — Content at scale (unblocks everything else)

**Goal:** the DM selects from the full SRD instead of 6 monsters, 7 spells, 7 items.

1. **SRD ingestion.** Drop the SRD JSON set into `content/srd/` and run the existing
   `SrdJsonAdapter` through `pnpm ingest`. Extend the adapter's field mapping where
   the SRD schema is richer than the fixture (senses, resistances, immunities,
   speeds, saving-throw proficiencies on monsters; components/duration/range on
   spells). Verify counts and spot-check CR→XP math across the bestiary.
2. **Structured spell effects at scale.** The engine refuses to improvise spell
   mechanics, so every castable spell needs a structured definition. Extend the
   `SpellEffect` union with: multi-target and area effects, slot-level damage
   scaling, cantrip scaling by character level, temp-HP grants, mechanical riders
   (bless/bane style dice modifiers, not just named conditions), and durations tied
   to the combat round counter. Author the full cleric list first (our PC), then
   wizard/druid/fighter subclass staples. Spells without definitions stay castable
   as errors that tell the DM to pick an implemented one.
3. **Monster traits the engine executes.** Add a structured `traits` field
   interpreted at resolve time: multiattack (N attacks per action), pack tactics
   (advantage when an ally is adjacent — approximated by ally-in-combat), undead
   fortitude (save instead of dropping at 0), regeneration ticks on round wrap.
   Tactics prose stays for the DM; mechanics run in the engine.
4. **Postgres reseed.** Implement the `PostgresAdapter` stub against the user's
   existing 5e database and reconcile ids with `contentId` so saves survive the
   switch.

**Exit test:** `suggest_encounter` composes sane fights from the full bestiary in
three different environments; a live playthrough uses only ingested content.

## Phase 2 — Characters: creation, advancement, death

**Goal:** play anyone, not just Sera; survive long enough to grow.

1. **PC builder.** Data-driven race/class/background from ingested SRD content:
   standard array or point buy, class skill picks, starting equipment packs,
   spells known/prepared. Engine-side `create_pc` produces a validated
   `SheetSchema`; the UI gets a creation screen; the CLI gets a wizard.
2. **XP and leveling.** Engine grants XP on monster death (`xpForCr` already
   exists) with milestone mode as an option. Level-up is engine-owned: HP
   (average or roll), slot table per class, proficiency bump, new spells —
   surfaced in the UI as a guided flow, never improvised by the DM.
3. **Death and epilogue.** On a third failed death save: a final epilogue turn with
   its own stage direction, then new-character creation into the same world. Canon
   persists; the world remembers the dead (a `memorial` canon write).
4. **Rests and preparation.** Short rest with hit dice, long rest gated on a safe
   location tag, cleric/wizard spell preparation on long rest.

**Exit test:** a fresh PC built in the UI plays the fixture arc; a deliberate death
produces an epilogue and a second character who hears about the first.

## Phase 3 — The living world

**Goal:** the world continues past the authored arc and moves when you aren't looking.

1. **`create_place` tool.** Same contract shape as `create_npc`: exact new id,
   description, tags, sensory lines, and exits wired both directions into the
   existing graph, written to canon. Scene-drift validation keeps working because
   every place still has an exact id.
2. **Quest layer.** A `quests` table (id, title, state: rumored/active/resolved,
   stakes, hooks) maintained by the director: when active quests resolve, a
   generation pass proposes new hooks grounded in existing canon (Greely's assize,
   the burial workings, Corvin's charm). Stage directions surface open hooks so the
   DM plants them; the UI gets a journal tab fed from this table.
3. **World tick.** Every N turns, an offscreen pass advances NPC agendas from their
   voice cards and writes consequence canon ("Greely petitioned the assize";
   "the chapel started a collection for Harl and Nessa"). The world changes state
   between visits, which is what makes it feel alive.
4. **Time.** An in-game clock advanced by travel, rests, and scene time hints.
   Scheduled events fire when their hour arrives (the morning payout actually
   happens). Light sources burn down against the clock instead of narratively.

**Exit test:** resolve the saltmine arc, keep playing; the world offers grounded new
hooks and offscreen consequences without contradicting canon.

## Phase 4 — Economy and equipment

1. **`transact` tool.** Gold moves as a mechanical operation: pay, be paid, buy and
   sell against `costGp` with cha-check haggling bounded by the engine (no
   politeness discounts). Greely's 50 gold becomes a real transfer.
2. **Equipment slots.** AC computed from worn armor + shield + dex instead of a
   static number; attunement limits enforced for magic items.

## Phase 5 — Memory at campaign length

1. **Canon consolidation.** A periodic scribe job merges near-duplicate facts per
   subject (the Greely confrontation wrote 15 rows in one scene), keeps provenance,
   and demotes superseded facts. Retrieval ranks by relevance + recency +
   importance instead of raw FTS order.
2. **Chapter summaries and recaps.** Session summary already exists; add per-chapter
   rollups and a "previously, in Emberhollow" recap generated at session start.

## Phase 6 — Party play and the final UI suite

1. **Multi-PC support.** `pc_ids` is already plumbed through scenes, combat, and
   encounter math. Add per-seat input attribution in the server (who speaks), and
   turn ownership in combat so the DM prompts the right player.
2. **The polished UI rebuild** (the final full pass): save slots and campaign
   management, a real character sheet page, the journal/quest log, dice log with
   roll history, upgraded combat tracker, canon browser with subject pages, and a
   mobile-usable layout.

## Phase 7 — Hardening and cost

1. **Cassette suite.** Add golden cassettes for combat, secrets, and loot flows,
   not just the social opening; wire all into `pnpm test`.
2. **Adversarial playtests.** Scripted players who lie about their sheets, demand
   treasure, teleport, and metagame — assert the engine refuses each.
3. **Model routing and cost.** Per-role model config already exists; measure
   token spend per turn, consider `gpt-5.4-mini` for corrections, and add a per-turn
   token budget metric to the metrics tab.

---

## Dependency notes

Phase 1 blocks Phase 2 (creation needs classes/spells at scale) and improves
Phase 3 (encounters from a full bestiary). Phases 4 and 5 are independent and can
interleave. Phase 6's party support touches the server/UI only — the engine is
already party-shaped. Every phase keeps the standing invariants: no invented
mechanics, exact-id contracts, error-driven correction, no fuzzy matching.
