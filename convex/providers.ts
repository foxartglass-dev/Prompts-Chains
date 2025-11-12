import { action } from "./_generated/server";
import { v } from "convex/values";

export const llmGenerate = action({
  args: {
    provider: v.union(v.literal("gemini"), v.literal("claude")),
    model: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      if (args.provider === "gemini") {
        return await generateWithGemini(ctx, args.model, args.prompt);
      } else if (args.provider === "claude") {
        return await generateWithClaude(ctx, args.model, args.prompt);
      }
      throw new Error(`Unsupported provider: ${args.provider}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return `Error: ${errorMessage}`;
    }
  },
});

async function generateWithGemini(
  ctx: any,
  model: string,
  prompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured in Convex environment");
  }

  // Using Google's Generative AI REST API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gemini API error: ${response.statusText} - ${errorData}`);
  }

  const data = await response.json();
  if (
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0]
  ) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error("Unexpected Gemini API response format");
}

async function generateWithClaude(
  ctx: any,
  model: string,
  prompt: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured in Convex environment");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Claude API error: ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  if (data.content && data.content.length > 0 && data.content[0].text) {
    return data.content[0].text;
  }

  throw new Error("Unexpected Claude API response format");
}
