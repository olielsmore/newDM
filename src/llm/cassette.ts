/**
 * Record/replay LLM calls so golden transcripts run in CI without keys.
 */
import fs from "node:fs";
import path from "node:path";
import { ChatOptions, ChatResult, Provider } from "./provider.js";

interface CassetteEntry {
  request: { roles: string[]; lastUser: string; toolNames: string[] };
  response: ChatResult;
}

export class CassetteProvider implements Provider {
  private entries: CassetteEntry[];
  private cursor = 0;
  private readonly record: boolean;

  constructor(
    private inner: Provider | undefined,
    private filePath: string,
    mode: "record" | "replay",
  ) {
    this.record = mode === "record";
    this.entries = fs.existsSync(filePath) ? (JSON.parse(fs.readFileSync(filePath, "utf8")) as CassetteEntry[]) : [];
  }

  async chat(opts: ChatOptions): Promise<ChatResult> {
    const request = {
      roles: opts.messages.map((m) => m.role),
      lastUser: [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "",
      toolNames: (opts.tools ?? []).map((t) => t.name),
    };
    if (!this.record) {
      const entry = this.entries[this.cursor++];
      if (!entry) throw new Error(`Cassette exhausted at call ${this.cursor} (${this.filePath})`);
      if (entry.response.text) opts.onText?.(entry.response.text);
      return entry.response;
    }
    if (!this.inner) throw new Error("Cassette record mode requires an inner provider");
    const response = await this.inner.chat(opts);
    this.entries.push({ request, response: { text: response.text, toolCalls: response.toolCalls } });
    this.flush();
    return response;
  }

  private flush(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
  }
}
