import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveFlow = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    steps: v.array(v.any()),
    placeholders: v.array(v.any()),
    settings: v.any(),
    flowId: v.optional(v.id("flows")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.flowId) {
      // Update existing flow
      await ctx.db.patch(args.flowId, {
        name: args.name,
        steps: args.steps,
        placeholders: args.placeholders,
        settings: args.settings,
        updatedAt: now,
      });
      return args.flowId;
    }

    // Create new flow
    return await ctx.db.insert("flows", {
      projectId: args.projectId,
      name: args.name,
      steps: args.steps,
      placeholders: args.placeholders,
      settings: args.settings,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getFlow = query({
  args: {
    flowId: v.id("flows"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.flowId);
  },
});

export const listFlows = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flows")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
