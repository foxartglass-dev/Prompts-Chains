import { action } from "./_generated/server";
import { v } from "convex/values";

export const score = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const wordCount = args.text.split(/\s+/).filter(Boolean).length;

    const apiKey = process.env.ZEROGPT_API_KEY;
    if (!apiKey) {
      console.warn(
        "ZEROGPT_API_KEY not configured. Returning score 0 (skipping AI detection)."
      );
      return { score: 0, wordCount };
    }

    try {
      const formData = new FormData();
      formData.append("input_text", args.text);
      formData.append("api_key", apiKey);

      const response = await fetch(
        "https://api.zerogpt.com/v2/document/detect",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("ZeroGPT API Error:", errorBody);
        // Return high score to flag for manual review on API error
        return { score: 100, wordCount };
      }

      const data = await response.json();

      if (data && data.data && typeof data.data.fake_percentage !== "undefined") {
        const score = Math.round(data.data.fake_percentage);
        return { score, wordCount };
      } else {
        console.error("Unexpected ZeroGPT response format:", data);
        return { score: 100, wordCount };
      }
    } catch (error) {
      console.error("Error calling ZeroGPT API:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(errorMessage);
      // Flag on network or other fetch-related errors
      return { score: 100, wordCount };
    }
  },
});
