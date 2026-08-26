import { ToolDef } from "../tools/index.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface ChatResult {
  text: string;
  toolCalls: { id: string; name: string; args: Record<string, unknown> }[];
}

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  /** Called with text deltas as they stream. */
  onText?: (delta: string) => void;
}

export interface Provider {
  chat(opts: ChatOptions): Promise<ChatResult>;
}

/** OpenAI-compatible chat completions over fetch. Works with OpenAI and most gateways. */
export class OpenAiProvider implements Provider {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl = "https://api.openai.com/v1",
  ) {}

  async chat(opts: ChatOptions): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.9,
      max_tokens: opts.maxTokens ?? 1200,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`LLM request failed (${res.status}): ${errText.slice(0, 500)}`);
    }

    let text = "";
    const toolCallParts = new Map<number, { id: string; name: string; args: string }>();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        let parsed: {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
            };
          }[];
        };
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          text += delta.content;
          opts.onText?.(delta.content);
        }
        for (const tc of delta.tool_calls ?? []) {
          const existing = toolCallParts.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          toolCallParts.set(tc.index, existing);
        }
      }
    }

    const toolCalls = [...toolCallParts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => {
        let args: Record<string, unknown> = {};
        try {
          args = p.args ? JSON.parse(p.args) : {};
        } catch {
          args = { _malformed: p.args };
        }
        return { id: p.id || `call_${Math.random().toString(36).slice(2, 10)}`, name: p.name, args };
      });

    return { text, toolCalls };
  }
}

/** Scripted provider for tests: pops responses off a queue. */
export class MockProvider implements Provider {
  public calls: ChatOptions[] = [];
  private queue: ChatResult[];

  constructor(responses: ChatResult[]) {
    this.queue = [...responses];
  }

  async chat(opts: ChatOptions): Promise<ChatResult> {
    this.calls.push(opts);
    const next = this.queue.shift();
    if (!next) throw new Error("MockProvider: no more scripted responses");
    if (next.text) opts.onText?.(next.text);
    return next;
  }
}

export function resolveApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY ?? process.env.OpenAI__ApiKey;
}

export function providerFromEnv(model?: string): Provider {
  const key = resolveApiKey();
  if (!key) {
    throw new Error(
      "No LLM API key found. Set OPENAI_API_KEY (or the OpenAI__ApiKey secret). " +
        "An OPENAI_BASE_URL can point at any OpenAI-compatible gateway.",
    );
  }
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  return new OpenAiProvider(key, model ?? process.env.DM_MODEL ?? "gpt-4o", baseUrl);
}

export function scribeProviderFromEnv(): Provider {
  const key = resolveApiKey();
  if (!key) throw new Error("No LLM API key found for scribe");
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  return new OpenAiProvider(key, process.env.SCRIBE_MODEL ?? "gpt-4o-mini", baseUrl);
}
