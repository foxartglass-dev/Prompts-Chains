 // services/claudeService.ts
//------------------------------------------------------
// CLAUDE-ONLY SERVICE — CLEAN, CORRECT, FINAL VERSION
//------------------------------------------------------

export type LlmProvider = 'claude-sonnet-4-5';

const PROXY_URL = "/api/claude";          // ← Frontend hits Vite proxy
const MODEL_ID  = "claude-sonnet-4-5-20250514"; // ← Latest Claude Sonnet 4.5 model

export async function generateLlmContent(
  prompt: string,
  model: string,
  apiKeys: { claude: string }
): Promise<string> {

  if (!apiKeys.claude || apiKeys.claude.trim() === "") {
    return "Error: Anthropic API key is not provided.";
  }

  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKeys.claude,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: 8000,
        messages: [
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Anthropic API Error:", errorBody);
      return `Error: Anthropic API call failed. ${errorBody.error?.message || response.statusText}`;
    }

    const data = await response.json();

    // Claude returns: { content: [ { text: "..." } ] }
    if (data?.content?.[0]?.text) {
      return data.content[0].text;
    }

    return "Error: Unexpected Claude API response format.";
  }

  catch (error) {
    console.error("Claude fetch error:", error);
    if (error instanceof Error) {
      return `Error: Claude API call failed. ${error.message}`;
    }
    return "Error: Unknown Claude API failure.";
  }
}
