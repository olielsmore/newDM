/**
 * Thin API over the engine. The UI never parses prose for data.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { GameDb } from "../state/db.js";
import { DmAgent } from "../agent/dm.js";
import { Provider, providerFromEnv, scribeProviderFromEnv } from "../llm/provider.js";
import { seed, DEFAULT_DB_PATH } from "../fixture/seed.js";
import { summarizeMetrics } from "../agent/metrics.js";
import { checkModels } from "../llm/check.js";
import fs from "node:fs";

export interface Session {
  db: GameDb;
  agent: DmAgent;
  dbPath: string;
  dm: Provider;
  scribe: Provider;
}

export function createSession(dbPath = DEFAULT_DB_PATH, dm?: Provider, scribe?: Provider): Session {
  const db = fs.existsSync(dbPath) ? new GameDb(dbPath) : seed(dbPath);
  const dmP = dm ?? providerFromEnv();
  const scribeP = scribe ?? scribeProviderFromEnv();
  return { db, agent: new DmAgent(db, dmP, scribeP), dbPath, dm: dmP, scribe: scribeP };
}

export function resetSession(session: Session): void {
  session.db.close();
  session.db = seed(session.dbPath);
  session.agent = new DmAgent(session.db, session.dm, session.scribe);
}

export function createApp(session: Session): Hono {
  const app = new Hono();
  app.use("/*", cors());

  const db = () => session.db;

  app.get("/api/health", (c) => c.json({ ok: true, turn: db().getTurn() }));
  app.get("/api/sheet", (c) => c.json(db().getPlayerCharacter()));

  app.get("/api/scene", (c) => {
    const scene = db().getScene();
    const place = scene ? db().getPlace(scene.placeId) : undefined;
    const present = (scene?.present ?? []).map((id) => {
      const ch = db().getCharacter(id);
      return ch ? { id: ch.id, name: ch.name, kind: ch.kind, hp: ch.hp, maxHp: ch.maxHp, conditions: ch.conditions } : { id };
    });
    return c.json({ scene, place, present, combat: db().getCombat() ?? { active: false } });
  });

  app.get("/api/canon", (c) => {
    const q = c.req.query("q");
    const facts = q ? db().searchCanon(q, 30) : db().recentCanon(30);
    return c.json(facts);
  });

  app.get("/api/events", (c) => {
    const turn = c.req.query("turn");
    const events = turn ? db().eventsForTurn(Number(turn)) : db().recentEvents(40);
    return c.json(events);
  });

  app.get("/api/turns", (c) => c.json(db().allTurns()));
  app.get("/api/metrics", (c) => c.json(summarizeMetrics(db())));
  app.get("/api/summary", (c) => c.json({ summary: db().getMeta("session_summary") ?? "" }));

  app.post("/api/reset", (c) => {
    resetSession(session);
    return c.json({ ok: true });
  });

  app.post("/api/turn", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { input?: string };
    const input = body.input ?? "";
    return streamSSE(c, async (stream) => {
      const result = await session.agent.playTurn(input, {
        onText: (delta) => {
          void stream.writeSSE({ event: "text", data: JSON.stringify({ delta }) });
        },
        onToolCall: (name, args, result) => {
          void stream.writeSSE({ event: "tool_call", data: JSON.stringify({ name, args, result }) });
        },
        onCorrection: () => {
          void stream.writeSSE({ event: "correction", data: "{}" });
        },
      });
      await stream.writeSSE({ event: "turn_result", data: JSON.stringify(result) });
    });
  });

  return app;
}

export async function startServer(opts: { port?: number; skipModelCheck?: boolean; session?: Session } = {}): Promise<{ port: number; session: Session }> {
  if (!opts.skipModelCheck) await checkModels();
  const session = opts.session ?? createSession();
  const app = createApp(session);
  const port = opts.port ?? Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port });
  return { port, session };
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname.endsWith("index.ts");
if (isMain) {
  startServer()
    .then(({ port }) => {
      console.log(`DM engine listening on http://localhost:${port}`);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
