// ZeroGPT AI Detection Service

const ZEROGPT_API_URL = 'https://api.zerogpt.com/api/detect/detectText';

export interface AiScoreResult {
  score: number;
  wordCount: number;
}

/**
 * Check AI detection score using ZeroGPT API
 */
export async function checkAiScore(apiKey: string, text: string): Promise<AiScoreResult> {
  if (!apiKey) {
    // Return default values if no API key
    return { score: 0, wordCount: text.split(/\s+/).length };
  }

  try {
    const response = await fetch(ZEROGPT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': apiKey,
      },
      body: JSON.stringify({ input_text: text }),
    });

    if (!response.ok) {
      console.error('ZeroGPT API error:', response.status);
      return { score: 0, wordCount: text.split(/\s+/).length };
    }

    const data = await response.json();

    return {
      score: data.data?.is_gpt_generated_probability || 0,
      wordCount: data.data?.word_count || text.split(/\s+/).length,
    };
  } catch (error) {
    console.error('ZeroGPT API error:', error);
    return { score: 0, wordCount: text.split(/\s+/).length };
  }
}
