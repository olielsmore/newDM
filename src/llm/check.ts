/**
 * Verify configured OpenAI models exist and accept a tiny completion + tool call.
 * Run: pnpm models:check
 */
import { resolveApiKey } from "./provider.js";

const DM_MODEL = process.env.DM_MODEL ?? "gpt-4o";
const SCRIBE_MODEL = process.env.SCRIBE_MODEL ?? "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

async function openai(path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
  const key = resolveApiKey();
  if (!key) throw new Error("No OPENAI_API_KEY / OpenAI__ApiKey");
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function smoke(model: string, withTool: boolean): Promise<void> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: "Reply with the single word OK" }],
    max_tokens: 8,
    temperature: 0,
  };
  if (withTool) {
    body.tools = [
      {
        type: "function",
        function: {
          name: "ping",
          description: "A no-op. Do not call this; just say OK.",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
    ];
  }
  const { ok, status, json } = await openai("/chat/completions", body);
  if (!ok) {
    const err = JSON.stringify(json).slice(0, 240);
    throw new Error(`Model ${model} failed smoke test (${status}): ${err}`);
  }
}

export async function checkModels(): Promise<{ dm: string; scribe: string; listed: string[] }> {
  const listed = await openai("/models");
  if (!listed.ok) throw new Error(`GET /models failed (${listed.status})`);
  const ids = new Set(
    ((listed.json as { data?: { id: string }[] }).data ?? []).map((m) => m.id),
  );
  for (const model of [DM_MODEL, SCRIBE_MODEL]) {
    if (ids.size && !ids.has(model)) {
      throw new Error(`Configured model "${model}" is not available on this key. Available sample: ${[...ids].slice(0, 8).join(", ")}`);
    }
    await smoke(model, model === DM_MODEL);
  }
  return { dm: DM_MODEL, scribe: SCRIBE_MODEL, listed: [DM_MODEL, SCRIBE_MODEL] };
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname.endsWith("check.ts");
if (isMain) {
  checkModels()
    .then((r) => {
      console.log(`OK  DM=${r.dm}  SCRIBE=${r.scribe}`);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
