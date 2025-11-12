import { action } from "./_generated/server";
import { v } from "convex/values";

export const post = action({
  args: {
    title: v.string(),
    content: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("publish"),
      v.literal("private")
    ),
    site: v.string(), // e.g., "SITE_1"
    postType: v.union(v.literal("posts"), v.literal("pages")),
  },
  handler: async (ctx, args) => {
    try {
      // Get credentials from environment variables based on site reference
      const urlKey = `WP_${args.site}_URL`;
      const userKey = `WP_${args.site}_USER`;
      const passwordKey = `WP_${args.site}_APP_PASSWORD`;

      const url = process.env[urlKey];
      const user = process.env[userKey];
      const password = process.env[passwordKey];

      if (!url || !user || !password) {
        throw new Error(
          `WordPress credentials not configured for ${args.site}. ` +
            `Required env vars: ${urlKey}, ${userKey}, ${passwordKey}`
        );
      }

      const endpoint = `${url.replace(/\/$/, "")}/wp-json/wp/v2/${
        args.postType
      }`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${user}:${password}`),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: args.title,
          content: args.content,
          status: args.status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `WordPress API Error: ${errorData.message || response.statusText}`
        );
      }

      const newPage = await response.json();
      return {
        success: true,
        id: String(newPage.id),
        link: newPage.link,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
