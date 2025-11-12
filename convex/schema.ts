import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.string(),
  }).index("by_authId", ["authId"]),

  projects: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  flows: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    steps: v.array(v.any()), // Array of PromptTemplate objects
    placeholders: v.array(v.any()), // Array of Placeholder objects
    settings: v.any(), // FlowSettings object
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  items: defineTable({
    projectId: v.id("projects"),
    payload: v.any(), // WorkflowItem object
    tags: v.array(v.string()),
  }).index("by_project", ["projectId"]),

  runs: defineTable({
    projectId: v.id("projects"),
    flowId: v.id("flows"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("paused")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    settingsSnapshot: v.any(), // Snapshot of settings used for this run
  })
    .index("by_flow", ["flowId"])
    .index("by_project", ["projectId"]),

  runLogs: defineTable({
    runId: v.id("runs"),
    itemId: v.optional(v.number()),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
    ts: v.number(),
  }).index("by_run", ["runId"]),

  results: defineTable({
    runId: v.id("runs"),
    itemId: v.number(),
    outputKey: v.string(),
    content: v.string(),
    meta: v.optional(v.any()),
  })
    .index("by_run", ["runId"])
    .index("by_run_item", ["runId", "itemId"]),

  detectorChecks: defineTable({
    runId: v.id("runs"),
    itemId: v.number(),
    score: v.number(),
    status: v.union(
      v.literal("pass"),
      v.literal("fail"),
      v.literal("redo"),
      v.literal("flagged")
    ),
  }).index("by_run_item", ["runId", "itemId"]),

  wpConnections: defineTable({
    projectId: v.id("projects"),
    label: v.string(),
    siteUrl: v.string(),
    secretKeyRef: v.string(), // Reference to env var like "WP_SITE_1"
  }).index("by_project", ["projectId"]),

  wpExports: defineTable({
    runId: v.id("runs"),
    itemId: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("posted"),
      v.literal("failed")
    ),
    wpPostId: v.optional(v.string()),
    response: v.optional(v.any()),
  }).index("by_run", ["runId"]),
});
