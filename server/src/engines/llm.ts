// Optional LLM layer. Activates only when ANTHROPIC_API_KEY or OPENAI_API_KEY
// is present; the platform is fully functional without it (deterministic
// engines). Never fabricates data: the model only narrates provided context.

export function llmProvider(): "anthropic" | "openai" | null {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

const SYSTEM = `You are a senior macro strategist writing for professional investors.
Rules:
- Use ONLY the data provided in the user message. Never invent numbers, events, or sources.
- Separate FACT (from provided data), INFERENCE (your interpretation), and FORECAST (probabilistic) explicitly.
- Be concise, institutional in tone, and concrete about transmission channels and what to watch next.
- Probabilities are estimates; never present forecasts as certainties.`;

export async function llmComplete(prompt: string, maxTokens = 900): Promise<string | null> {
  const provider = llmProvider();
  if (!provider) return null;
  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
          max_tokens: maxTokens,
          system: SYSTEM,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
      const data = (await res.json()) as { content: { type: string; text?: string }[] };
      return data.content.find((c) => c.type === "text")?.text ?? null;
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message.content ?? null;
  } catch {
    return null;
  }
}
