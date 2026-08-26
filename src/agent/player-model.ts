import { Provider } from "../llm/provider.js";

export const PILLAR_PROMPT = `Classify the player's latest action into exactly one pillar of D&D play: combat, social, or exploration.
Respond with only that one word.`;

export async function classifyPillar(provider: Provider, playerInput: string): Promise<"combat" | "social" | "exploration"> {
  try {
    const result = await provider.chat({
      messages: [
        { role: "system", content: PILLAR_PROMPT },
        { role: "user", content: playerInput || "(session opening)" },
      ],
      temperature: 0,
      maxTokens: 8,
    });
    const word = result.text.trim().toLowerCase();
    if (word.includes("combat")) return "combat";
    if (word.includes("social")) return "social";
    return "exploration";
  } catch {
    return "exploration";
  }
}
