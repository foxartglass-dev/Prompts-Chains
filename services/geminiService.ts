import { GoogleGenAI } from "@google/genai";

export type LlmProvider = 'gemini' | 'claude';

async function generateWithGemini(prompt: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating content with Gemini:", error);
    if (error instanceof Error) {
      return `Error: Gemini API call failed. ${error.message}`;
    }
    return "Error: An unknown error occurred with the Gemini API.";
  }
}

async function generateWithClaude(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) {
    return "Error: Anthropic API key is not provided.";
  }

  const API_URL = "http://localhost:3001/api/claude";
  const MODEL_NAME = "claude-sonnet-4-5";

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        max_tokens: 4096,
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

export async function generateLlmContent(
  prompt: string,
  provider: LlmProvider,
  apiKeys: { claude: string }
): Promise<string> {
  switch (provider) {
    case 'gemini':
      return generateWithGemini(prompt);
    case 'claude':
      return generateWithClaude(prompt, apiKeys.claude);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}