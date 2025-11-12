import { mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const startRun = mutation({
  args: {
    projectId: v.id("projects"),
    flowId: v.id("flows"),
    settingsSnapshot: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runs", {
      projectId: args.projectId,
      flowId: args.flowId,
      status: "queued",
      startedAt: Date.now(),
      settingsSnapshot: args.settingsSnapshot,
    });
  },
});

export const updateRunStatus = mutation({
  args: {
    runId: v.id("runs"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("paused")
    ),
    finishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      ...(args.finishedAt && { finishedAt: args.finishedAt }),
    });
  },
});

export const log = mutation({
  args: {
    runId: v.id("runs"),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
    itemId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("runLogs", {
      runId: args.runId,
      level: args.level,
      message: args.message,
      itemId: args.itemId,
      ts: Date.now(),
    });
  },
});

export const saveResult = mutation({
  args: {
    runId: v.id("runs"),
    itemId: v.number(),
    outputKey: v.string(),
    content: v.string(),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("results", {
      runId: args.runId,
      itemId: args.itemId,
      outputKey: args.outputKey,
      content: args.content,
      meta: args.meta,
    });
  },
});

export const saveDetectorCheck = mutation({
  args: {
    runId: v.id("runs"),
    itemId: v.number(),
    score: v.number(),
    status: v.union(
      v.literal("pass"),
      v.literal("fail"),
      v.literal("redo"),
      v.literal("flagged")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("detectorChecks", {
      runId: args.runId,
      itemId: args.itemId,
      score: args.score,
      status: args.status,
    });
  },
});

export const executeItem = action({
  args: {
    runId: v.id("runs"),
    itemId: v.number(),
    itemName: v.string(),
    itemTag: v.optional(v.string()),
    steps: v.array(v.any()),
    placeholders: v.array(v.any()),
    taggedSnippets: v.array(v.any()),
    providerPref: v.union(v.literal("gemini"), v.literal("claude")),
    modelPref: v.string(),
    checkDetector: v.boolean(),
  },
  handler: async (ctx, args) => {
    try {
      // Log start
      await ctx.runMutation(api.runs.log, {
        runId: args.runId,
        level: "info",
        message: `[${args.itemName}] Starting process...`,
        itemId: args.itemId,
      });

      const promptOutputs: Record<string, string> = {};

      // Execute each step
      for (const step of args.steps) {
        await ctx.runMutation(api.runs.log, {
          runId: args.runId,
          level: "info",
          message: `[${args.itemName}] Running prompt: "${step.name}"...`,
          itemId: args.itemId,
        });

        // Fill prompt with placeholders and previous outputs
        const filledPrompt = fillPrompt(
          step.template,
          args.itemName,
          args.itemTag,
          args.placeholders,
          args.taggedSnippets,
          promptOutputs
        );

        // Call LLM provider
        const output = await ctx.runAction(api.providers.llmGenerate, {
          provider: args.providerPref,
          model: args.modelPref,
          prompt: filledPrompt,
        });

        if (output.startsWith("Error:")) {
          throw new Error(output);
        }

        promptOutputs[step.outputKey] = output;

        // Save result
        await ctx.runMutation(api.runs.saveResult, {
          runId: args.runId,
          itemId: args.itemId,
          outputKey: step.outputKey,
          content: output,
        });
      }

      // Run detector check if enabled
      let aiScore = 0;
      if (args.checkDetector) {
        // Combine outputs marked for final
        const finalSteps = args.steps.filter(
          (s: any) => s.outputAction === "addToFinal"
        );
        const finalKeys =
          finalSteps.length > 0
            ? finalSteps.map((s: any) => s.outputKey)
            : [args.steps[args.steps.length - 1]?.outputKey].filter(Boolean);
        const combinedOutput = finalKeys
          .map((key: string) => promptOutputs[key])
          .join("\n\n---\n\n");

        await ctx.runMutation(api.runs.log, {
          runId: args.runId,
          level: "info",
          message: `[${args.itemName}] Checking AI score...`,
          itemId: args.itemId,
        });

        const detectorResult = await ctx.runAction(api.detector.score, {
          text: combinedOutput,
        });
        aiScore = detectorResult.score;

        await ctx.runMutation(api.runs.log, {
          runId: args.runId,
          level: "info",
          message: `[${args.itemName}] AI score: ${aiScore}%, Word count: ${detectorResult.wordCount}`,
          itemId: args.itemId,
        });

        // Save detector check
        const detectorStatus = aiScore >= 40 ? "flagged" : "pass"; // Using hardcoded 40 threshold for now
        await ctx.runMutation(api.runs.saveDetectorCheck, {
          runId: args.runId,
          itemId: args.itemId,
          score: aiScore,
          status: detectorStatus,
        });
      }

      await ctx.runMutation(api.runs.log, {
        runId: args.runId,
        level: "info",
        message: `[${args.itemName}] Process finished successfully.`,
        itemId: args.itemId,
      });

      return {
        ok: true,
        outputs: promptOutputs,
        aiScore,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(api.runs.log, {
        runId: args.runId,
        level: "error",
        message: `[${args.itemName}] Failed: ${errorMessage}`,
        itemId: args.itemId,
      });
      return {
        ok: false,
        error: errorMessage,
      };
    }
  },
});

// Helper function to fill prompt template
function fillPrompt(
  template: string,
  itemName: string,
  itemTag: string | undefined,
  placeholders: any[],
  taggedSnippets: any[],
  dynamicVars: Record<string, string>
): string {
  let filledTemplate = template;

  const universalPlaceholders = placeholders.filter((p) => !p.tag);
  const taggedPlaceholders = placeholders.filter((p) => p.tag === itemTag);

  // Replace dynamic variables from previous outputs [outputKey]
  filledTemplate = filledTemplate.replace(/\[([^\]]+)\]/g, (_, key) => {
    return dynamicVars[key.trim()] || `[${key.trim()}]`;
  });

  // Replace tagged snippets {{{key}}}
  if (itemTag) {
    taggedSnippets.forEach((s) => {
      const snippetValue = s.values[itemTag] || "";
      filledTemplate = filledTemplate.replace(
        new RegExp(`{{{${s.key}}}}`, "g"),
        snippetValue
      );
    });
  }

  // Replace tagged placeholders {key{tag}}
  taggedPlaceholders.forEach((p) => {
    filledTemplate = filledTemplate.replace(
      new RegExp(`{${p.key}{${p.tag}}}`, "g"),
      p.value
    );
  });

  // Replace universal placeholders {key}
  universalPlaceholders.forEach((p) => {
    filledTemplate = filledTemplate.replace(
      new RegExp(`{${p.key}}`, "g"),
      p.value
    );
  });

  // Replace {item_name}
  filledTemplate = filledTemplate.replace(/{item_name}/g, itemName);

  return filledTemplate;
}
