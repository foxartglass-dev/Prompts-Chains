import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertUser = mutation({
  args: {
    authId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();

    if (existing) {
      // Update email if changed
      if (existing.email !== args.email) {
        await ctx.db.patch(existing._id, { email: args.email });
      }
      return existing._id;
    }

    // Create new user
    return await ctx.db.insert("users", {
      authId: args.authId,
      email: args.email,
    });
  },
});

export const getUser = query({
  args: {
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
  },
});
