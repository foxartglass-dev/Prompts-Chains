# Convex Integration Setup Guide

This document explains how to set up and configure Convex for server-side execution of LLM calls, AI detection, and WordPress publishing.

## Prerequisites

- Node.js 18+ installed
- A Convex account (sign up at https://dashboard.convex.dev)

## Step 1: Install Dependencies

```bash
npm install
```

This will install the `convex` package added to `package.json`.

## Step 2: Initialize Convex

Run the Convex development server:

```bash
npx convex dev
```

This command will:
1. Prompt you to log in to your Convex account (or create one)
2. Create a new Convex project (or link to an existing one)
3. Generate a `.convex/` directory with configuration
4. Provide you with a `VITE_CONVEX_URL` to use in your `.env` file
5. Deploy the schema and functions to your Convex backend

**Important**: Follow the prompts carefully and note the `VITE_CONVEX_URL` provided.

## Step 3: Configure Environment Variables

### Frontend (.env.local)

Create a `.env.local` file in the project root:

```bash
VITE_CONVEX_URL=https://your-project.convex.cloud
```

Replace `https://your-project.convex.cloud` with the URL from Step 2.

### Backend (Convex Dashboard)

Go to https://dashboard.convex.dev, select your project, and navigate to **Settings > Environment Variables**.

Add the following secrets:

#### Required:
- `GEMINI_API_KEY` - Your Google Gemini API key (get from https://makersuite.google.com/app/apikey)

#### Optional (for full functionality):
- `ANTHROPIC_API_KEY` - Your Anthropic Claude API key (get from https://console.anthropic.com/)
- `ZEROGPT_API_KEY` - Your ZeroGPT API key for AI detection (get from https://zerogpt.com/api)

#### WordPress Integration (optional):
- `WP_SITE_1_URL` - WordPress site URL (e.g., https://example.com)
- `WP_SITE_1_USER` - WordPress username
- `WP_SITE_1_APP_PASSWORD` - WordPress application password (generate in WP admin under Users > Your Profile > Application Passwords)

**Note**: You can configure multiple WordPress sites by using `WP_SITE_2_URL`, `WP_SITE_3_URL`, etc.

## Step 4: Verify Setup

Start the development server:

```bash
npm run dev
```

The application should load without errors. Check the browser console for any Convex connection issues.

## Schema Overview

The Convex backend includes the following tables:

- **users** - User accounts (authId, email)
- **projects** - Top-level projects
- **flows** - Prompt workflows (steps, placeholders, settings)
- **items** - Workflow items to process
- **runs** - Execution runs with status tracking
- **runLogs** - Detailed logs for each run
- **results** - Generated content per item/step
- **detectorChecks** - AI detection scores
- **wpConnections** - WordPress site configurations
- **wpExports** - WordPress publish status

## Available Convex Functions

### Queries
- `users.getUser` - Get user by authId
- `projects.listProjects` - List user's projects
- `projects.getProject` - Get project details
- `flows.getFlow` - Get flow configuration
- `flows.listFlows` - List project flows

### Mutations
- `users.upsertUser` - Create or update user
- `projects.createProject` - Create new project
- `flows.saveFlow` - Save flow configuration
- `runs.startRun` - Initialize a new run
- `runs.updateRunStatus` - Update run status
- `runs.log` - Add log entry
- `runs.saveResult` - Save step output
- `runs.saveDetectorCheck` - Save AI detection result

### Actions (Server-Side)
- `providers.llmGenerate` - Call LLM providers (Gemini/Claude) with API keys stored server-side
- `detector.score` - Check AI content score via ZeroGPT
- `wp.post` - Publish content to WordPress
- `runs.executeItem` - Execute full workflow for one item

## Security Benefits

With Convex integration:
- ✅ API keys never exposed to the browser
- ✅ LLM calls happen server-side
- ✅ WordPress credentials stored securely
- ✅ Rate limiting and usage tracking possible
- ✅ Audit logs for all operations

## Troubleshooting

### "Convex client not configured" error
- Ensure `VITE_CONVEX_URL` is set in `.env.local`
- Restart the Vite dev server after adding the environment variable

### "Missing API key" errors in Convex logs
- Check that environment variables are set in the Convex Dashboard (Settings > Environment Variables)
- Variable names must match exactly (e.g., `GEMINI_API_KEY`, not `GEMINI_KEY`)

### Schema push failures
- Run `npx convex dev` to automatically sync schema changes
- If you make changes to `convex/schema.ts`, the dev command will detect and deploy them

## Next Steps

Once Convex is configured:
1. The application will automatically use server-side execution for LLM calls
2. No API keys will be sent from the browser
3. All workflow execution will be logged in the Convex dashboard
4. You can view runs, logs, and results in real-time at https://dashboard.convex.dev

## Development Workflow

```bash
# Terminal 1: Run Convex dev server (watches for schema/function changes)
npx convex dev

# Terminal 2: Run Vite dev server (frontend)
npm run dev
```

Both servers support hot-reload and will automatically update when you make changes.
