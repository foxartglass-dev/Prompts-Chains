/**
 * Web Tools Routes
 * Provides web search and URL fetching capabilities for AI chat bots
 *
 * Endpoints:
 * - POST /api/web-tools/search - Web search via Brave Search API
 * - POST /api/web-tools/fetch - Fetch URL content (with optional JS rendering)
 */

import express from 'express';
import puppeteer from 'puppeteer';

const router = express.Router();

// Cache for web fetches (15 minute TTL)
const fetchCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of fetchCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      fetchCache.delete(key);
    }
  }
}

// Cleanup cache every 5 minutes
setInterval(cleanupCache, 5 * 60 * 1000);

/**
 * POST /api/web-tools/search
 * Search the web using Brave Search API
 *
 * Body:
 * - query: string (required) - Search query
 * - count: number (optional, default 10) - Number of results
 * - freshness: string (optional) - Filter by freshness: 'day', 'week', 'month', 'year'
 *
 * Returns:
 * - results: Array of { title, url, description, age }
 */
router.post('/search', async (req, res) => {
  try {
    const { query, count = 10, freshness } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Brave Search API key not configured. Add BRAVE_SEARCH_API_KEY to environment variables. Get a free key at https://brave.com/search/api/'
      });
    }

    console.log(`[Web Search] Query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);

    // Build search URL
    const searchParams = new URLSearchParams({
      q: query,
      count: Math.min(count, 20).toString(), // Max 20 results
      text_decorations: 'false',
      search_lang: 'en'
    });

    if (freshness) {
      searchParams.set('freshness', freshness);
    }

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${searchParams}`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Web Search] Brave API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({
        success: false,
        error: `Brave Search API error: ${response.status}`
      });
    }

    const data = await response.json();

    // Extract web results
    const results = (data.web?.results || []).map(result => ({
      title: result.title,
      url: result.url,
      description: result.description,
      age: result.age || null,
      extra_snippets: result.extra_snippets || []
    }));

    console.log(`[Web Search] Found ${results.length} results for "${query.substring(0, 30)}..."`);

    res.json({
      success: true,
      query,
      results,
      total: data.web?.total_results || results.length
    });

  } catch (error) {
    console.error('[Web Search] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed'
    });
  }
});

/**
 * POST /api/web-tools/fetch
 * Fetch content from a URL
 *
 * Body:
 * - url: string (required) - URL to fetch
 * - render_js: boolean (optional, default false) - Use Puppeteer for JS-heavy sites
 * - extract_text: boolean (optional, default true) - Extract readable text
 * - timeout_ms: number (optional, default 30000) - Request timeout
 *
 * Returns:
 * - url: string - Final URL after redirects
 * - status: number - HTTP status code
 * - content_type: string
 * - title: string - Page title
 * - text: string - Extracted text content
 * - html: string - Raw HTML (if extract_text is false)
 */
router.post('/fetch', async (req, res) => {
  let browser = null;

  try {
    const {
      url,
      render_js = false,
      extract_text = true,
      timeout_ms = 30000,
      use_cache = true
    } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Check cache
    const cacheKey = `${url}:${render_js}:${extract_text}`;
    if (use_cache && fetchCache.has(cacheKey)) {
      const cached = fetchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Web Fetch] Cache hit for: ${url.substring(0, 50)}...`);
        return res.json({
          success: true,
          ...cached.data,
          cached: true
        });
      }
    }

    console.log(`[Web Fetch] Fetching: ${url.substring(0, 80)}${url.length > 80 ? '...' : ''} (JS: ${render_js})`);

    let result;

    // Special handling for Reddit - try JSON endpoint first
    if (parsedUrl.hostname.includes('reddit.com') && !url.endsWith('.json')) {
      try {
        const jsonUrl = url.replace(/\/?$/, '.json');
        const redditResult = await fetchRedditJson(jsonUrl, timeout_ms);
        if (redditResult) {
          result = redditResult;
        }
      } catch (e) {
        console.log('[Web Fetch] Reddit JSON failed, falling back to regular fetch');
      }
    }

    if (!result) {
      if (render_js) {
        // Use Puppeteer for JS-heavy pages
        result = await fetchWithPuppeteer(url, timeout_ms, extract_text);
      } else {
        // Simple HTTP fetch
        result = await fetchSimple(url, timeout_ms, extract_text);
      }
    }

    // Cache the result
    if (use_cache) {
      fetchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
    }

    res.json({
      success: true,
      ...result,
      cached: false
    });

  } catch (error) {
    console.error('[Web Fetch] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Fetch failed'
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
});

/**
 * Fetch Reddit thread as JSON (most reliable method)
 */
async function fetchRedditJson(jsonUrl, timeout_ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

  try {
    const response = await fetch(jsonUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();

    // Reddit JSON structure: [post, comments]
    if (!Array.isArray(data) || data.length < 2) return null;

    const post = data[0]?.data?.children?.[0]?.data;
    const comments = data[1]?.data?.children || [];

    if (!post) return null;

    // Extract post info
    const postText = `# ${post.title}\n\n${post.selftext || ''}`;

    // Extract top comments (flatten tree)
    const commentTexts = [];
    function extractComments(children, depth = 0) {
      for (const child of children) {
        if (child.kind === 't1' && child.data?.body) {
          const indent = '  '.repeat(depth);
          const score = child.data.score || 0;
          commentTexts.push(`${indent}[${score} points] ${child.data.body}`);

          // Recurse into replies
          if (child.data.replies?.data?.children) {
            extractComments(child.data.replies.data.children, depth + 1);
          }
        }
      }
    }
    extractComments(comments);

    const text = postText + '\n\n## Comments:\n\n' + commentTexts.slice(0, 50).join('\n\n');

    return {
      url: jsonUrl.replace('.json', ''),
      final_url: jsonUrl.replace('.json', ''),
      status: 200,
      content_type: 'application/json',
      title: post.title,
      subreddit: post.subreddit,
      text: text,
      post: {
        title: post.title,
        selftext: post.selftext,
        score: post.score,
        created_utc: post.created_utc,
        author: post.author
      },
      comment_count: commentTexts.length
    };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Simple HTTP fetch (no JS rendering)
 */
async function fetchSimple(url, timeout_ms, extract_text) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    const html = await response.text();
    const contentType = response.headers.get('content-type') || 'text/html';

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    let text = html;
    if (extract_text) {
      text = extractTextFromHtml(html);
    }

    return {
      url,
      final_url: response.url,
      status: response.status,
      content_type: contentType,
      title,
      text: text.substring(0, 50000) // Limit text size
    };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Fetch with Puppeteer (for JS-heavy sites)
 */
async function fetchWithPuppeteer(url, timeout_ms, extract_text) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeout_ms
    });

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get page info
    const finalUrl = page.url();
    const title = await page.title();
    const html = await page.content();

    let text = html;
    if (extract_text) {
      // Use page.evaluate for better text extraction
      text = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript, nav, footer, header');
        scripts.forEach(el => el.remove());

        // Get main content if available
        const main = document.querySelector('main, article, [role="main"], .content, #content');
        if (main) {
          return main.innerText;
        }
        return document.body.innerText;
      });
    }

    return {
      url,
      final_url: finalUrl,
      status: 200,
      content_type: 'text/html',
      title,
      text: text.substring(0, 50000), // Limit text size
      rendered: true
    };
  } finally {
    await browser.close();
  }
}

/**
 * Extract readable text from HTML (simple version)
 */
function extractTextFromHtml(html) {
  // Remove script and style content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  return text;
}

/**
 * GET /api/web-tools/status
 * Check if web tools are properly configured
 */
router.get('/status', (req, res) => {
  const braveKeyConfigured = !!process.env.BRAVE_SEARCH_API_KEY;

  res.json({
    success: true,
    services: {
      web_search: {
        enabled: braveKeyConfigured,
        provider: 'Brave Search API',
        message: braveKeyConfigured
          ? 'Web search is configured'
          : 'Add BRAVE_SEARCH_API_KEY to enable web search. Get a free key at https://brave.com/search/api/'
      },
      web_fetch: {
        enabled: true,
        provider: 'Built-in (Puppeteer available)',
        message: 'URL fetching is available'
      }
    }
  });
});

export default router;
