// ZeroGPT AI Detection Service
// Uses backend proxy to avoid CORS issues

const API_BASE = '/api/zerogpt';

export interface AiScoreResult {
  score: number;
  wordCount: number;
}

/**
 * Check AI detection score using ZeroGPT API (via backend proxy)
 */
export async function checkAiScore(apiKey: string, text: string): Promise<AiScoreResult> {
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  try {
    const response = await fetch(`${API_BASE}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, apiKey }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('ZeroGPT API error:', data.error);
      return { score: 0, wordCount };
    }

    return {
      score: data.score || 0,
      wordCount: data.wordCount || wordCount,
    };
  } catch (error) {
    console.error('ZeroGPT API error:', error);
    return { score: 0, wordCount };
  }
}
