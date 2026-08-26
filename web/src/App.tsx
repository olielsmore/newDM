import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  CanonFact,
  GameEvent,
  ScenePayload,
  Sheet,
  TurnRow,
  getJson,
  playTurn,
  resetGame,
} from "./api";

type Tab = "canon" | "events" | "combat" | "metrics";

interface ChatLine {
  role: "player" | "dm" | "system";
  text: string;
}

interface ToolLine {
  name: string;
  args: unknown;
  result: unknown;
}

export function App() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [scene, setScene] = useState<ScenePayload | null>(null);
  const [canon, setCanon] = useState<CanonFact[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [tab, setTab] = useState<Tab>("canon");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [tools, setTools] = useState<ToolLine[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [s, sc, c, e, t, m] = await Promise.all([
      getJson<Sheet>("/api/sheet"),
      getJson<ScenePayload>("/api/scene"),
      getJson<CanonFact[]>("/api/canon"),
      getJson<GameEvent[]>("/api/events"),
      getJson<TurnRow[]>("/api/turns"),
      getJson<Record<string, number>>("/api/metrics"),
    ]);
    setSheet(s);
    setScene(sc);
    setCanon(c);
    setEvents(e);
    setTurns(t);
    setMetrics(m);
    if (t.length && chat.length === 0) {
      setChat(
        t.flatMap((row) => {
          const lines: ChatLine[] = [];
          if (row.player_input) lines.push({ role: "player", text: row.player_input });
          if (row.dm_output) lines.push({ role: "dm", text: row.dm_output });
          return lines;
        }),
      );
    }
  }, [chat.length]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, live]);

  async function submit(ev?: FormEvent) {
    ev?.preventDefault();
    if (busy) return;
    const text = input.trim();
    setInput("");
    setBusy(true);
    setLive("");
    setTools([]);
    if (text) setChat((c) => [...c, { role: "player", text }]);
    let acc = "";
    try {
      await playTurn(text, {
        onText: (d) => {
          acc += d;
          setLive(acc);
        },
        onTool: (name, args, result) => setTools((t) => [...t, { name, args, result }]),
        onCorrection: () => setChat((c) => [...c, { role: "system", text: "Narration corrected against the event log." }]),
        onDone: () => {
          setChat((c) => [...c, { role: "dm", text: acc }]);
          setLive("");
        },
      });
      await refresh();
    } catch (err) {
      setChat((c) => [...c, { role: "system", text: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!confirm("Reseed the fixture and wipe this save?")) return;
    await resetGame();
    setChat([]);
    setTools([]);
    setLive("");
    await refresh();
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[280px_1fr_340px]">
      <aside className="border-r border-rule bg-panel p-4 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Character</p>
          <h1 className="text-xl text-ember">{sheet?.name ?? "…"}</h1>
          <p className="text-sm text-muted">
            Level {sheet?.level} {sheet?.race} {sheet?.className}
          </p>
        </div>
        {sheet && <HpBar hp={sheet.hp} max={sheet.maxHp} ac={sheet.ac} />}
        {sheet && (
          <div className="text-sm space-y-1">
            <p>
              Slots{" "}
              {Object.entries(sheet.spellSlots)
                .map(([lvl, s]) => `L${lvl} ${s.max - s.used}/${s.max}`)
                .join(" · ") || "—"}
            </p>
            {sheet.conditions.length > 0 && (
              <p className="text-blood">Conditions: {sheet.conditions.join(", ")}</p>
            )}
            {sheet.concentrating && <p className="text-ember">Concentrating: {sheet.concentrating.spell}</p>}
            <p className="text-muted leading-snug">
              {sheet.inventory.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(" · ")}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted mb-1">Here</p>
          <p className="font-semibold">{scene?.scene.name}</p>
          <p className="text-sm text-muted">{scene?.scene.time}</p>
          <p className="text-sm mt-2 leading-snug">{scene?.scene.description}</p>
        </div>
        <button onClick={onReset} className="text-xs uppercase tracking-widest text-muted hover:text-parchment">
          Reset fixture
        </button>
      </aside>

      <main className="flex flex-col min-h-screen">
        <header className="border-b border-rule px-6 py-3 flex justify-between items-baseline">
          <h2 className="tracking-wide">The Saltmine Warrens</h2>
          <p className="text-xs text-muted">Sable is listening · ids come from the tools, never from guesswork</p>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {chat.map((line, i) => (
            <article key={i} className={line.role === "player" ? "text-right" : ""}>
              <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
                {line.role === "player" ? "You" : line.role === "dm" ? "Sable" : "Table"}
              </p>
              <div
                className={
                  line.role === "player"
                    ? "inline-block max-w-[36rem] text-left bg-ink border border-rule px-4 py-2"
                    : line.role === "system"
                      ? "text-sm text-ember italic"
                      : "max-w-[40rem] leading-relaxed whitespace-pre-wrap"
                }
              >
                {line.text}
              </div>
            </article>
          ))}
          {live && (
            <article>
              <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Sable</p>
              <div className="max-w-[40rem] leading-relaxed whitespace-pre-wrap">{live}</div>
            </article>
          )}
          <div ref={bottom} />
        </div>
        <form onSubmit={submit} className="border-t border-rule p-4 flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={2}
            placeholder={busy ? "The dice are in the air…" : "What do you do?"}
            disabled={busy}
            className="flex-1 bg-ink border border-rule px-3 py-2 text-parchment outline-none focus:border-ember resize-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 bg-ember text-ink font-semibold uppercase tracking-widest text-sm disabled:opacity-50"
          >
            {busy ? "…" : "Play"}
          </button>
        </form>
      </main>

      <aside className="border-l border-rule bg-panel flex flex-col min-h-screen">
        <nav className="flex border-b border-rule text-xs uppercase tracking-widest">
          {(["canon", "events", "combat", "metrics"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 ${tab === t ? "text-ember border-b-2 border-ember" : "text-muted"}`}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-4 text-sm space-y-3">
          {tab === "canon" &&
            canon.map((f) => (
              <div key={f.id}>
                <p className="text-ember text-xs">{f.subject}</p>
                <p className="text-parchment/90">{f.fact}</p>
              </div>
            ))}
          {tab === "events" && (
            <>
              {tools.length > 0 && (
                <div className="mb-3 pb-3 border-b border-rule">
                  <p className="text-xs uppercase text-muted mb-2">This turn</p>
                  {tools.map((t, i) => (
                    <p key={i} className="text-moss font-mono text-xs leading-relaxed">
                      {t.name} {JSON.stringify(t.args).slice(0, 80)}
                    </p>
                  ))}
                </div>
              )}
              {events
                .slice()
                .reverse()
                .map((e) => (
                  <p key={e.id} className="font-mono text-xs text-muted">
                    t{e.turn} {e.kind}
                  </p>
                ))}
            </>
          )}
          {tab === "combat" && <CombatPanel scene={scene} />}
          {tab === "metrics" && metrics && (
            <dl className="grid grid-cols-2 gap-2">
              {Object.entries(metrics).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted text-xs uppercase">{k}</dt>
                  <dd>{typeof v === "number" ? Number(v.toFixed(2)) : v}</dd>
                </div>
              ))}
              <p className="col-span-2 text-muted text-xs">
                Turns in this save: {turns.length}. Empty opening is turn 1.
              </p>
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}

function HpBar({ hp, max, ac }: { hp: number; max: number; ac: number }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span>
          HP {hp}/{max}
        </span>
        <span>AC {ac}</span>
      </div>
      <div className="h-2 bg-ink border border-rule">
        <div className="h-full bg-blood" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CombatPanel({ scene }: { scene: ScenePayload | null }) {
  const combat = scene?.combat;
  if (!combat?.active) {
    return <p className="text-muted">No combat. When a fight starts, initiative and HP land here from the engine — not from the prose.</p>;
  }
  const current = combat.order?.[combat.currentIndex ?? 0]?.id;
  return (
    <div className="space-y-3">
      <p className="text-ember">Round {combat.round}</p>
      {combat.order?.map((o) => {
        const body = scene?.present.find((p) => p.id === o.id);
        const isCurrent = o.id === current;
        return (
          <div key={o.id} className={`border border-rule p-2 ${isCurrent ? "border-ember" : ""}`}>
            <div className="flex justify-between">
              <span>
                {body?.name ?? o.id} <span className="text-muted">init {o.initiative}</span>
              </span>
              {body && (
                <span>
                  {body.hp}/{body.maxHp}
                </span>
              )}
            </div>
            {body && (
              <div className="h-2 bg-ink border border-rule mt-1">
                <div className="h-full bg-blood" style={{ width: `${Math.max(0, Math.min(100, (body.hp / body.maxHp) * 100))}%` }} />
              </div>
            )}
            {body?.conditions?.length ? <p className="text-blood text-xs mt-1">{body.conditions.join(", ")}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
