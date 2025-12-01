export type LlmProvider = 'claude-sonnet-4-5';

const PROXY_URL = "/api/claude";
const MODEL_ID = "claude-sonnet-4-5-20250929";

export async function generateLlmContent(
  prompt: string,
  model: string,
  apiKeys: { claude: string }
): Promise<string> {
  if (!apiKeys.claude) {
    return "Error: Anthropic API key is not provided.";
  }

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKeys.claude,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Anthropic API Error:", errorBody);
      return `Error: Anthropic API call failed. ${errorBody.error?.message || response.statusText}`;
    }

    const data = await response.json();
    if (data.content && data.content.length > 0 && data.content[0].text) {
      return data.content[0].text;
    } else {
      return "Error: Received an unexpected response format from Anthropic API.";
    }
  } catch (error) {
    console.error("Error generating content with Claude:", error);
    if (error instanceof Error) {
      return `Error: Claude API call failed. ${error.message}`;
    }
    return "Error: An unknown error occurred with the Claude API.";
  }
}
