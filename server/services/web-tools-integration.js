/**
 * Web Tools Integration for AI Chat
 * Provides function calling definitions and execution for web search/fetch
 */

// OpenAI function definitions
export const openaiWebTools = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information. Use this when you need to find current information, research topics, find Reddit discussions, or look up documentation.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Be specific. For Reddit, include "site:reddit.com". For recent info, include the year.'
          },
          count: {
            type: 'integer',
            description: 'Number of results to return (1-20)',
            default: 5
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch the content of a specific URL. Use this to read the full content of a webpage, Reddit thread, product page, or documentation.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch'
          },
          render_js: {
            type: 'boolean',
            description: 'Set to true for JavaScript-heavy sites that need rendering',
            default: false
          }
        },
        required: ['url']
      }
    }
  }
];

// Claude tool definitions (different format)
export const claudeWebTools = [
  {
    name: 'web_search',
    description: 'Search the web for information. Use this when you need to find current information, research topics, find Reddit discussions, or look up documentation.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query. Be specific. For Reddit, include "site:reddit.com". For recent info, include the year.'
        },
        count: {
          type: 'integer',
          description: 'Number of results to return (1-20)',
          default: 5
        }
      },
      required: ['query']
    }
  },
  {
    name: 'web_fetch',
    description: 'Fetch the content of a specific URL. Use this to read the full content of a webpage, Reddit thread, product page, or documentation.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch'
        },
        render_js: {
          type: 'boolean',
          description: 'Set to true for JavaScript-heavy sites that need rendering',
          default: false
        }
      },
      required: ['url']
    }
  }
];

// Gemini tool definitions
export const geminiWebTools = {
  function_declarations: [
    {
      name: 'web_search',
      description: 'Search the web for information. Use this when you need to find current information, research topics, find Reddit discussions, or look up documentation.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Be specific. For Reddit, include "site:reddit.com". For recent info, include the year.'
          },
          count: {
            type: 'integer',
            description: 'Number of results to return (1-20)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'web_fetch',
      description: 'Fetch the content of a specific URL. Use this to read the full content of a webpage, Reddit thread, product page, or documentation.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch'
          },
          render_js: {
            type: 'boolean',
            description: 'Set to true for JavaScript-heavy sites that need rendering'
          }
        },
        required: ['url']
      }
    }
  ]
};

/**
 * Execute a web tool call
 * @param {string} toolName - 'web_search' or 'web_fetch'
 * @param {object} args - Tool arguments
 * @returns {Promise<object>} Tool result
 */
export async function executeWebTool(toolName, args) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

  try {
    if (toolName === 'web_search') {
      const response = await fetch(`${baseUrl}/api/web-tools/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: args.query,
          count: args.count || 5
        })
      });
      return await response.json();
    }

    if (toolName === 'web_fetch') {
      const response = await fetch(`${baseUrl}/api/web-tools/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: args.url,
          render_js: args.render_js || false,
          extract_text: true
        })
      });
      return await response.json();
    }

    return { error: `Unknown tool: ${toolName}` };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Format tool result for OpenAI
 */
export function formatToolResultForOpenAI(toolCallId, result) {
  return {
    role: 'tool',
    tool_call_id: toolCallId,
    content: JSON.stringify(result)
  };
}

/**
 * Format tool result for Claude
 */
export function formatToolResultForClaude(toolUseId, result) {
  return {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: JSON.stringify(result)
  };
}

/**
 * System prompt addition for web tools
 */
export const webToolsSystemPrompt = `

You have access to web tools that allow you to search the internet and fetch webpage content:

1. **web_search**: Search the web for information. Great for:
   - Finding Reddit discussions (use "site:reddit.com" in query)
   - Looking up current documentation
   - Researching products or topics
   - Finding recent news or updates

2. **web_fetch**: Fetch the full content of a URL. Great for:
   - Reading Reddit threads (extracts posts and comments)
   - Getting product page details
   - Reading documentation pages
   - Extracting article content

When the user asks about something that requires current information or external sources, use these tools to provide accurate, up-to-date answers.`;

/**
 * Check if web tools are available
 */
export function areWebToolsAvailable() {
  const hasKey = !!process.env.BRAVE_SEARCH_API_KEY;
  console.log(`[Web Tools] Available: ${hasKey}, Key length: ${process.env.BRAVE_SEARCH_API_KEY?.length || 0}`);
  return hasKey;
}
