/**
 * Link Injection Service (Phase 7)
 *
 * Handles injecting links into article HTML content.
 * Works at the HTML level — finding appropriate anchor text and wrapping with <a> tags.
 *
 * Key functions:
 *   injectLinks(htmlContent, links) - Main injection function
 *   buildAnchorTag(link) - Builds <a> tag from link config
 *   safeInjectLink(html, anchorText, anchorHtml) - Injects without nesting <a> tags
 *   findAnchorText(content, context) - Finds appropriate anchor text in content
 *   distributeLinksToArticles(websiteId, workflowId) - Auto-distributes links from pool
 *   getParentPageLink(articleId) - Gets parent page URL for internal linking
 *   getAssignedLink(articleId, websiteId) - Gets outbound link for an article
 */

import { sql, isDatabaseEnabled } from '../db/index.js';

/**
 * Injects links into HTML content by finding anchor text and wrapping with <a> tags.
 * Does NOT modify HTML structure — only adds <a> tags around existing text.
 *
 * @param {string} htmlContent - The HTML content (from text widget or article)
 * @param {Array} links - Array of { url, anchorText, type, rel, target }
 * @returns {string} Modified HTML with links injected
 */
export function injectLinks(htmlContent, links) {
  if (!htmlContent || !links || links.length === 0) return htmlContent;

  let modified = htmlContent;

  for (const link of links) {
    if (!link.url || !link.anchorText) continue;

    const anchorHtml = buildAnchorTag(link);
    modified = safeInjectLink(modified, link.anchorText, anchorHtml);
  }

  return modified;
}

/**
 * Builds an <a> tag from link config.
 * @param {Object} link - { url, anchorText, target, rel }
 * @returns {string} HTML anchor tag
 */
export function buildAnchorTag(link) {
  const attrs = [`href="${escapeHtml(link.url)}"`];
  if (link.target === '_blank') attrs.push('target="_blank"');
  if (link.rel) attrs.push(`rel="${escapeHtml(link.rel)}"`);
  return `<a ${attrs.join(' ')}>${escapeHtml(link.anchorText)}</a>`;
}

/**
 * Safely injects a link without nesting inside existing <a> tags.
 * Splits HTML by existing <a>...</a> tags and only replaces in non-link portions.
 * Only replaces the first occurrence to avoid double-linking.
 *
 * @param {string} html - The HTML content
 * @param {string} anchorText - Text to find and wrap
 * @param {string} anchorHtml - The full <a> tag to replace with
 * @returns {string} Modified HTML
 */
export function safeInjectLink(html, anchorText, anchorHtml) {
  if (!html || !anchorText) return html;

  // Split HTML into segments: non-link parts and <a>...</a> parts
  // This regex matches opening <a ...> through closing </a>
  const linkRegex = /<a\s[^>]*>[\s\S]*?<\/a>/gi;

  // Also avoid injecting inside heading tags
  const headingRegex = /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi;

  // Collect positions of existing links and headings to skip
  const skipRanges = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    skipRanges.push({ start: match.index, end: match.index + match[0].length });
  }
  while ((match = headingRegex.exec(html)) !== null) {
    skipRanges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Sort skip ranges by start position
  skipRanges.sort((a, b) => a.start - b.start);

  // Try exact match first, then case-insensitive
  const searchStrategies = [
    anchorText,                                    // exact
    new RegExp(escapeRegex(anchorText), 'i'),       // case-insensitive
  ];

  for (const search of searchStrategies) {
    let idx;
    if (typeof search === 'string') {
      idx = html.indexOf(search);
    } else {
      const regexMatch = search.exec(html);
      idx = regexMatch ? regexMatch.index : -1;
      if (regexMatch) {
        // Use the actual matched text length
        anchorHtml = anchorHtml.replace(
          `>${escapeHtml(anchorText)}</a>`,
          `>${escapeHtml(regexMatch[0])}</a>`
        );
      }
    }

    if (idx === -1) continue;

    const matchEnd = idx + (typeof search === 'string' ? search.length : anchorText.length);

    // Check if this position is inside an existing link or heading
    const isInSkipRange = skipRanges.some(r => idx >= r.start && idx < r.end);
    if (isInSkipRange) {
      // Try to find the next occurrence outside skip ranges
      let searchStart = idx + 1;
      let found = false;
      while (searchStart < html.length) {
        let nextIdx;
        if (typeof search === 'string') {
          nextIdx = html.indexOf(search, searchStart);
        } else {
          search.lastIndex = searchStart;
          const nextMatch = search.exec(html);
          nextIdx = nextMatch ? nextMatch.index : -1;
        }
        if (nextIdx === -1) break;

        const nextEnd = nextIdx + anchorText.length;
        const isInSkip = skipRanges.some(r => nextIdx >= r.start && nextIdx < r.end);
        if (!isInSkip) {
          // Found a valid position - inject here
          return html.substring(0, nextIdx) + anchorHtml + html.substring(nextIdx + anchorText.length);
        }
        searchStart = nextIdx + 1;
      }
      continue; // Try next search strategy
    }

    // Inject at this position
    const matchLength = typeof search === 'string' ? search.length : anchorText.length;
    return html.substring(0, idx) + anchorHtml + html.substring(idx + matchLength);
  }

  // No match found - return unmodified
  return html;
}

/**
 * Finds appropriate anchor text in content for a given link.
 * Uses keyword matching to find natural-sounding phrases to link.
 *
 * @param {string} content - The article/page text content
 * @param {Object} context - { parentTitle, linkDescription }
 * @returns {string|null} Suggested anchor text, or null if no good match
 */
export function findAnchorText(content, context = {}) {
  if (!content) return null;

  // Strip HTML tags for text analysis
  const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const searchTerm = context.parentTitle || context.linkDescription || '';
  if (!searchTerm) return null;

  // Extract meaningful words from the search term (skip common words)
  const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'our', 'your', 'my', 'we', 'they', 'it', 'this', 'that']);
  const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  if (searchWords.length === 0) return null;

  // Strategy 1: Find a phrase containing multiple search words
  const sentences = textContent.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

  let bestMatch = null;
  let bestScore = 0;

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;
    let matchStart = sentence.length;
    let matchEnd = 0;

    for (const word of searchWords) {
      const wordIdx = lowerSentence.indexOf(word);
      if (wordIdx !== -1) {
        score++;
        matchStart = Math.min(matchStart, wordIdx);
        matchEnd = Math.max(matchEnd, wordIdx + word.length);
      }
    }

    if (score > bestScore && score >= Math.min(2, searchWords.length)) {
      bestScore = score;
      // Extract a phrase around the matched words (3-7 words)
      const phrase = extractPhrase(sentence, matchStart, matchEnd);
      if (phrase && phrase.length >= 5 && phrase.length <= 80) {
        bestMatch = phrase;
      }
    }
  }

  if (bestMatch) return bestMatch;

  // Strategy 2: Find a single important keyword match
  for (const word of searchWords) {
    const wordRegex = new RegExp(`\\b${escapeRegex(word)}\\w*\\b`, 'i');
    for (const sentence of sentences) {
      const match = wordRegex.exec(sentence);
      if (match) {
        const phrase = extractPhrase(sentence, match.index, match.index + match[0].length);
        if (phrase && phrase.length >= 5 && phrase.length <= 80) {
          return phrase;
        }
      }
    }
  }

  return null;
}

/**
 * Extracts a natural-sounding phrase around a match position.
 * @param {string} sentence - Full sentence
 * @param {number} matchStart - Start index of match
 * @param {number} matchEnd - End index of match
 * @returns {string} Extracted phrase (3-7 words)
 */
function extractPhrase(sentence, matchStart, matchEnd) {
  const words = sentence.split(/\s+/);
  let charCount = 0;
  let startWordIdx = 0;
  let endWordIdx = words.length - 1;

  // Find the word indices that contain our match
  for (let i = 0; i < words.length; i++) {
    if (charCount + words[i].length >= matchStart && startWordIdx === 0) {
      startWordIdx = i;
    }
    if (charCount >= matchEnd) {
      endWordIdx = i;
      break;
    }
    charCount += words[i].length + 1; // +1 for space
  }

  // Expand to 3-7 words centered on the match
  const matchWordCount = endWordIdx - startWordIdx + 1;
  const wordsToAdd = Math.max(0, 3 - matchWordCount);
  const expandBefore = Math.floor(wordsToAdd / 2);
  const expandAfter = Math.ceil(wordsToAdd / 2);

  const phraseStart = Math.max(0, startWordIdx - expandBefore);
  const phraseEnd = Math.min(words.length - 1, endWordIdx + expandAfter);

  // Cap at 7 words
  const finalEnd = Math.min(phraseEnd, phraseStart + 6);

  return words.slice(phraseStart, finalEnd + 1).join(' ');
}

/**
 * Distributes unassigned approved links from the pool to articles.
 * Each article gets up to N outbound links (N = websites.links_per_page).
 *
 * @param {number} websiteId
 * @param {number} workflowId - optional, to scope to a workflow
 * @returns {Object} { distributed, skipped, linksPerPage, articlesServed, articlesPending, errors }
 */
export async function distributeLinksToArticles(websiteId, workflowId = null) {
  if (!isDatabaseEnabled()) {
    return { distributed: 0, skipped: 0, linksPerPage: 1, articlesServed: 0, articlesPending: 0, errors: ['Database not configured'] };
  }

  try {
    // 1. Get links_per_page setting
    const [website] = await sql`
      SELECT links_per_page FROM websites WHERE id = ${websiteId}
    `;
    const linksPerPage = website?.links_per_page || 1;

    // 2. Get all approved, unassigned links for this website
    const availableLinks = await sql`
      SELECT id, url, anchor_text, description, rel_attribute, target
      FROM link_pool
      WHERE website_id = ${websiteId}
        AND status = 'approved'
        AND assigned_article_id IS NULL
        AND used_on_article_id IS NULL
      ORDER BY created_at ASC
    `;

    if (availableLinks.length === 0) {
      return { distributed: 0, skipped: 0, linksPerPage, articlesServed: 0, articlesPending: 0, errors: [], message: 'No available links to distribute' };
    }

    // 3. Get articles and count how many outbound links each already has
    let articlesQuery;
    if (workflowId) {
      articlesQuery = await sql`
        SELECT a.id, a.keyword,
               COUNT(lp.id)::int as link_count
        FROM articles a
        LEFT JOIN link_pool lp ON lp.used_on_article_id = a.id AND lp.link_type = 'outbound'
        WHERE a.workflow_id = ${workflowId}
          AND a.wp_post_id IS NOT NULL
        GROUP BY a.id, a.keyword
        HAVING COUNT(lp.id) < ${linksPerPage}
        ORDER BY a.id
      `;
    } else {
      articlesQuery = await sql`
        SELECT a.id, a.keyword,
               COUNT(lp.id)::int as link_count
        FROM articles a
        JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN link_pool lp ON lp.used_on_article_id = a.id AND lp.link_type = 'outbound'
        WHERE w.website_id = ${websiteId}
          AND a.wp_post_id IS NOT NULL
        GROUP BY a.id, a.keyword
        HAVING COUNT(lp.id) < ${linksPerPage}
        ORDER BY a.id
      `;
    }

    if (articlesQuery.length === 0) {
      return { distributed: 0, skipped: availableLinks.length, linksPerPage, articlesServed: 0, articlesPending: 0, errors: [], message: 'All articles already have enough links' };
    }

    // 4. Shuffle available links for random distribution
    const shuffled = [...availableLinks].sort(() => Math.random() - 0.5);

    // 5. Assign links to articles
    let linkIdx = 0;
    let distributed = 0;
    const errors = [];

    for (const article of articlesQuery) {
      const linksNeeded = linksPerPage - article.link_count;
      for (let i = 0; i < linksNeeded && linkIdx < shuffled.length; i++) {
        const link = shuffled[linkIdx++];
        try {
          await sql`
            UPDATE link_pool
            SET used_on_article_id = ${article.id},
                used_at = NOW()
            WHERE id = ${link.id}
          `;
          distributed++;
        } catch (err) {
          errors.push(`Failed to assign link ${link.id} to article ${article.id}: ${err.message}`);
        }
      }
    }

    // 6. Count articles still needing links
    const articlesPending = articlesQuery.length - Math.min(articlesQuery.length, Math.floor(distributed / linksPerPage));

    return {
      distributed,
      skipped: shuffled.length - linkIdx,
      linksPerPage,
      articlesServed: Math.min(articlesQuery.length, distributed),
      articlesPending: Math.max(0, articlesPending),
      errors
    };
  } catch (error) {
    return { distributed: 0, skipped: 0, linksPerPage: 1, articlesServed: 0, articlesPending: 0, errors: [error.message] };
  }
}

/**
 * Gets the parent page URL and suggests anchor text for an internal link.
 * Uses wp_page_hierarchy to find the parent.
 *
 * @param {number} articleId
 * @returns {Object|null} { url, suggestedAnchorText, parentTitle }
 */
export async function getParentPageLink(articleId) {
  if (!isDatabaseEnabled()) return null;

  try {
    // 1. Get article's wp_post_id and website info
    const [article] = await sql`
      SELECT a.wp_post_id, a.keyword, w.website_id, ws.wp_url
      FROM articles a
      JOIN workflows w ON a.workflow_id = w.id
      JOIN websites ws ON w.website_id = ws.id
      WHERE a.id = ${articleId}
    `;

    if (!article?.wp_post_id) return null;

    // 2. Look up wp_page_hierarchy for this page's wp_parent_id
    const [hierarchy] = await sql`
      SELECT wp_parent_id
      FROM wp_page_hierarchy
      WHERE website_id = ${article.website_id}
        AND wp_page_id = ${article.wp_post_id}
    `;

    if (!hierarchy || hierarchy.wp_parent_id === 0) return null;

    // 3. Get parent page info
    const [parent] = await sql`
      SELECT title, slug
      FROM wp_page_hierarchy
      WHERE website_id = ${article.website_id}
        AND wp_page_id = ${hierarchy.wp_parent_id}
    `;

    if (!parent) return null;

    // 4. Construct parent URL
    const baseUrl = (article.wp_url || '').replace(/\/$/, '');
    const parentUrl = parent.slug ? `${baseUrl}/${parent.slug}/` : null;

    if (!parentUrl) return null;

    return {
      url: parentUrl,
      suggestedAnchorText: parent.title || parent.slug,
      parentTitle: parent.title || parent.slug
    };
  } catch (error) {
    console.error('[LinkInjector] Error getting parent page link:', error.message);
    return null;
  }
}

/**
 * Gets an outbound link assigned to a specific article from the link pool.
 * Returns the assigned or auto-distributed link.
 *
 * @param {number} articleId
 * @param {number} websiteId
 * @returns {Object|null} Link pool entry or null
 */
export async function getAssignedLink(articleId, websiteId) {
  if (!isDatabaseEnabled()) return null;

  try {
    // Check for manually assigned link first
    const [assigned] = await sql`
      SELECT * FROM link_pool
      WHERE assigned_article_id = ${articleId}
        AND status = 'approved'
      LIMIT 1
    `;

    if (assigned) return assigned;

    // Check for auto-distributed link
    const [distributed] = await sql`
      SELECT * FROM link_pool
      WHERE used_on_article_id = ${articleId}
        AND status = 'approved'
      LIMIT 1
    `;

    return distributed || null;
  } catch (error) {
    console.error('[LinkInjector] Error getting assigned link:', error.message);
    return null;
  }
}

/**
 * Gets all outbound links assigned to a specific article.
 * Returns array of links (for links_per_page > 1).
 *
 * @param {number} articleId
 * @param {number} websiteId
 * @returns {Array} Array of link pool entries
 */
export async function getAssignedLinks(articleId, websiteId) {
  if (!isDatabaseEnabled()) return [];

  try {
    const links = await sql`
      SELECT * FROM link_pool
      WHERE (assigned_article_id = ${articleId} OR used_on_article_id = ${articleId})
        AND status = 'approved'
      ORDER BY assigned_article_id IS NOT NULL DESC, created_at ASC
    `;

    return links || [];
  } catch (error) {
    console.error('[LinkInjector] Error getting assigned links:', error.message);
    return [];
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  injectLinks,
  buildAnchorTag,
  safeInjectLink,
  findAnchorText,
  distributeLinksToArticles,
  getParentPageLink,
  getAssignedLink,
  getAssignedLinks
};
