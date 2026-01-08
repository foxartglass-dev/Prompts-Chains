# GitHub Logging Setup Guide

This guide explains how to set up automatic server log saving to GitHub, allowing direct log access without copy/paste.

## How It Works

1. Server captures all console output (already done)
2. After each batch run, logs are written to `/logs/server-latest.log`
3. Server commits and pushes to GitHub using your token
4. File is overwritten each time (keeps last 500 lines, no bloat)
5. Claude can read the log file directly from the repo

## Setup Steps

### Step 1: Create GitHub Personal Access Token

1. Go to GitHub → **Settings** (click your profile pic, top right)
2. Scroll down to **Developer settings** (bottom of left sidebar)
3. Click **Personal access tokens** → **Tokens (classic)**
4. Click **Generate new token** → **Generate new token (classic)**
5. Give it a name like `promptflow-logs`
6. Set expiration (recommend 90 days or "No expiration")
7. Check these permissions:
   - ✅ `repo` (Full control of private repositories)
8. Click **Generate token**
9. **COPY THE TOKEN NOW** - you won't see it again!

### Step 2: Add Token to Railway

1. Go to your Railway project dashboard
2. Click on your service (the PromptFlow app)
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Name:** `GITHUB_TOKEN`
   - **Value:** (paste the token you copied)
6. Add another variable:
   - **Name:** `GITHUB_REPO`
   - **Value:** `foxartglass-dev/Prompts-Chains`
7. Click **Deploy** to redeploy with new variables

### Step 3: Verify Setup

After redeployment:
1. Run a batch process in PromptFlow
2. Check GitHub repo for `/logs/server-latest.log`
3. The file should contain the last 500 lines of server output

## What Gets Logged

- All console.log, console.error, console.warn output
- Same content you see in Railway logs
- Timestamps for each line
- Automatically overwrites (never grows beyond 500 lines)

## When Logs Are Pushed

Logs are pushed to GitHub:
- After each batch processing run completes
- When you click "Save Logs to GitHub" button (if added)
- NOT continuously (to avoid rate limits)

## File Location

```
/logs/server-latest.log
```

This file is gitignored locally but pushed from Railway, so it won't interfere with local development.

## Troubleshooting

### "Push failed" errors
- Check that GITHUB_TOKEN has `repo` permission
- Verify GITHUB_REPO is correct (owner/repo format)
- Token may have expired - generate a new one

### Logs not appearing
- Check Railway logs for any git-related errors
- Verify the token was added correctly (no extra spaces)
- Make sure a batch run completed (logs push after completion)

### Token security
- Never commit the token to code
- Use Railway environment variables only
- Rotate token periodically (every 90 days recommended)

## Alternative: Direct API Access

If you prefer not to use GitHub logging, you can also:
1. Share your Railway app URL (e.g., `https://promptflow-xxxx.up.railway.app`)
2. Claude can fetch logs directly via `/api/logs/console/copy`
3. No setup required, works immediately

The app URL can be found in Railway under:
**Settings** → **Networking** → **Public Networking** → Your generated domain
