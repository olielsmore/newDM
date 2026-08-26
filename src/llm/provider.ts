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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * How long to wait before retrying a rate-limited request. Prefers the
 * Retry-After header, then OpenAI's "Please try again in 1.23s" message,
 * then exponential backoff.
 */
function retryDelayMs(res: Response, errText: string, attempt: number): number {
  const header = res.headers.get("retry-after");
  if (header && Number.isFinite(Number(header))) return Number(header) * 1000;
  const match = errText.match(/try again in ([\d.]+)(ms|s)/i);
  if (match) {
    const raw = Number(match[1]);
    return match[2].toLowerCase() === "ms" ? raw : raw * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 20000);
}

/** OpenAI-compatible chat completions over fetch. Works with OpenAI and most gateways. */
export class OpenAiProvider implements Provider {
  private static MAX_RETRIES = 5;

  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl = "https://api.openai.com/v1",
  ) {}

  async chat(opts: ChatOptions): Promise<ChatResult> {
    // gpt-5.x and o-series reject max_tokens in favor of max_completion_tokens.
    const modern = /^(gpt-5|o\d)/.test(this.model);
    const body: Record<string, unknown> = {
      model: this.model,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.9,
      [modern ? "max_completion_tokens" : "max_tokens"]: opts.maxTokens ?? 1200,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    // Retry 429s and transient 5xxs before any of the stream has been
    // consumed; once streaming starts a failure is surfaced to the caller.
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
      });
      if (res.ok && res.body) break;
      const errText = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= OpenAiProvider.MAX_RETRIES) {
        throw new Error(`LLM request failed (${res.status}): ${errText.slice(0, 500)}`);
      }
      await sleep(retryDelayMs(res, errText, attempt) + 250);
    }

    let text = "";
    const toolCallParts = new Map<number, { id: string; name: string; args: string }>();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      let chunk: { done: boolean; value?: Uint8Array };
      try {
        chunk = await reader.read();
      } catch (err) {
        // Stream dropped mid-response. Tools may already have run, so a
        // partial narration beats losing the turn; an empty one is a failure.
        if (text.trim()) break;
        throw err;
      }
      const { done, value } = chunk;
      if (done || !value) break;
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
  return new OpenAiProvider(key, model ?? process.env.DM_MODEL ?? "gpt-5.4", baseUrl);
}

export function scribeProviderFromEnv(): Provider {
  const key = resolveApiKey();
  if (!key) throw new Error("No LLM API key found for scribe");
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  return new OpenAiProvider(key, process.env.SCRIBE_MODEL ?? "gpt-5.4-mini", baseUrl);
}
