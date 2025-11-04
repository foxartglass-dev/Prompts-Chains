
export async function checkAiScore(apiKey: string, text: string): Promise<{ score: number; wordCount: number }> {
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (!apiKey) {
    console.warn("ZeroGPT API key is not set. Skipping AI detection and returning score 0.");
    return { score: 0, wordCount };
  }
  
  const API_URL = "https://api.zerogpt.com/v2/document/detect";
  
  try {
    const formData = new FormData();
    formData.append('input_text', text);
    formData.append('api_key', apiKey);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("ZeroGPT API Error:", errorBody);
      // Return a high score to flag the content for manual review on API error
      return { score: 100, wordCount }; 
    }

    const data = await response.json();

    if (data && data.data && typeof data.data.fake_percentage !== 'undefined') {
      const score = Math.round(data.data.fake_percentage);
      return { score, wordCount };
    } else {
      console.error("Unexpected response format from ZeroGPT:", data);
      return { score: 100, wordCount }; // Flag on unexpected format
    }
  } catch (error) {
    console.error("Error calling ZeroGPT API:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
     // Flag on network or other fetch-related errors
    return { score: 100, wordCount };
  }
}