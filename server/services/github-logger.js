/**
 * GitHub Logger Service
 *
 * Pushes server logs to GitHub repo for easy access by Claude.
 * Uses GitHub API to commit logs to /logs/server-latest.log
 * Keeps only last 500 lines to prevent bloat.
 */

import consoleCapture from './console-capture.js';

const GITHUB_API_BASE = 'https://api.github.com';
const LOG_FILE_PATH = 'logs/server-latest.log';
const MAX_LINES = 500;

/**
 * Get environment variables for GitHub
 */
function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'foxartglass-dev/Prompts-Chains';

  if (!token) {
    return { configured: false, error: 'GITHUB_TOKEN not set' };
  }

  return {
    configured: true,
    token,
    repo,
    owner: repo.split('/')[0],
    repoName: repo.split('/')[1]
  };
}

/**
 * Get file SHA from GitHub (needed for updates)
 */
async function getFileSha(config) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${config.repo}/contents/${LOG_FILE_PATH}`,
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.sha;
    }

    // File doesn't exist yet, that's okay
    return null;
  } catch (error) {
    console.log('[GitHub Logger] File not found, will create new');
    return null;
  }
}

/**
 * Push logs to GitHub repository
 * @param {string} context - Optional context for the log push (e.g., "batch-complete", "manual")
 * @returns {Promise<{success: boolean, message: string, url?: string}>}
 */
export async function pushLogsToGitHub(context = 'auto') {
  const config = getGitHubConfig();

  if (!config.configured) {
    console.log('[GitHub Logger] Skipping push:', config.error);
    return { success: false, message: config.error };
  }

  try {
    // Get last 500 logs
    const logs = consoleCapture.getLastLogs(MAX_LINES);
    const formattedLogs = consoleCapture.formatLogsForCopy(logs);

    // Add header with timestamp and context
    const header = [
      '# PromptFlow Server Logs',
      `# Generated: ${new Date().toISOString()}`,
      `# Context: ${context}`,
      `# Lines: ${logs.length}`,
      '# ---',
      ''
    ].join('\n');

    const content = header + formattedLogs;

    // Encode content to base64
    const encodedContent = Buffer.from(content).toString('base64');

    // Get existing file SHA (needed for updates)
    const sha = await getFileSha(config);

    // Prepare commit
    const commitMessage = `logs: Update server logs (${context}) - ${new Date().toISOString().substring(0, 19)}`;

    const body = {
      message: commitMessage,
      content: encodedContent,
      branch: 'main'
    };

    // Include SHA if file exists (required for updates)
    if (sha) {
      body.sha = sha;
    }

    // Push to GitHub
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${config.repo}/contents/${LOG_FILE_PATH}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[GitHub Logger] Push failed:', error.message);
      return { success: false, message: error.message };
    }

    const result = await response.json();
    console.log('[GitHub Logger] Logs pushed successfully');

    return {
      success: true,
      message: 'Logs pushed to GitHub',
      url: result.content.html_url,
      sha: result.content.sha
    };

  } catch (error) {
    console.error('[GitHub Logger] Error pushing logs:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Check if GitHub logging is configured
 */
export function isConfigured() {
  return getGitHubConfig().configured;
}

/**
 * Get configuration status (for debugging)
 */
export function getStatus() {
  const config = getGitHubConfig();
  return {
    configured: config.configured,
    repo: config.repo || null,
    tokenSet: !!process.env.GITHUB_TOKEN,
    logFilePath: LOG_FILE_PATH,
    maxLines: MAX_LINES
  };
}

export default {
  pushLogsToGitHub,
  isConfigured,
  getStatus
};
