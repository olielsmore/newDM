export interface Sheet {
  id: string;
  name: string;
  level: number;
  className: string;
  race: string;
  hp: number;
  maxHp: number;
  ac: number;
  spellSlots: Record<string, { max: number; used: number }>;
  conditions: string[];
  concentrating: { spell: string } | null;
  inventory: { name: string; qty: number }[];
  spellsKnown: string[];
}

export interface ScenePayload {
  scene: { placeId: string; name: string; description: string; time: string; features: string[]; present: string[] };
  place?: { tags?: string[]; exits: { to: string; description: string }[] };
  present: { id: string; name: string; kind: string; hp: number; maxHp: number; conditions: string[] }[];
  combat: { active?: boolean; round?: number; currentIndex?: number; order?: { id: string; initiative: number }[] };
}

export interface CanonFact {
  id: number;
  subject: string;
  fact: string;
  tags: string;
  turn: number;
  source: string;
}

export interface GameEvent {
  id: number;
  turn: number;
  kind: string;
  data: unknown;
}

export interface TurnRow {
  id: number;
  player_input: string;
  dm_output: string;
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export async function resetGame(): Promise<void> {
  await fetch("/api/reset", { method: "POST" });
}

export interface StreamHandlers {
  onText: (delta: string) => void;
  onTool: (name: string, args: unknown, result: unknown) => void;
  onCorrection: () => void;
  onDone: (result: unknown) => void;
}

export async function playTurn(input: string, handlers: StreamHandlers): Promise<void> {
  const res = await fetch("/api/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok || !res.body) throw new Error(`turn failed ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) {
          const data = JSON.parse(line.slice(5).trim() || "{}");
          if (event === "text") handlers.onText(data.delta ?? "");
          if (event === "tool_call") handlers.onTool(data.name, data.args, data.result);
          if (event === "correction") handlers.onCorrection();
          if (event === "turn_result") handlers.onDone(data);
        }
      }
    }
  }
}
