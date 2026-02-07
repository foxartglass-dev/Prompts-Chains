/**
 * Link Pool Routes (Phase 7 - SEO Link Management)
 *
 * Endpoints:
 *   GET    /api/links/pool/:websiteId       - Get all links for a website
 *   POST   /api/links/pool                  - Add single link
 *   PUT    /api/links/pool/:linkId          - Update a link
 *   DELETE /api/links/pool/:linkId          - Delete a link
 *   POST   /api/links/pool/bulk             - Add multiple links
 *   PUT    /api/links/pool/bulk-approve     - Approve multiple links
 *   POST   /api/links/distribute            - Auto-distribute links to articles
 *   POST   /api/links/discover              - AI link discovery
 *   GET    /api/links/settings/:websiteId   - Get link discovery settings
 *   PUT    /api/links/settings/:websiteId   - Update link discovery settings
 *   GET    /api/links/article/:articleId    - Get links for specific article
 *   POST   /api/links/inject-preview        - Preview link injection
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { injectLinks, findAnchorText, distributeLinksToArticles, getParentPageLink, getAssignedLinks } from '../services/link-injector.js';

const router = express.Router();

const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// ============================================
// LINK POOL CRUD
// ============================================

/**
 * GET /api/links/pool/:websiteId
 * Get all links in the pool for a website. Filterable by status, assignment.
 */
router.get('/pool/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { status, assignedArticleId, discoveryRun, limit = 500, offset = 0 } = req.query;

    let links;

    if (status) {
      links = await sql`
        SELECT lp.*,
               a1.keyword as assigned_keyword,
               a2.keyword as used_on_keyword
        FROM link_pool lp
        LEFT JOIN articles a1 ON lp.assigned_article_id = a1.id
        LEFT JOIN articles a2 ON lp.used_on_article_id = a2.id
        WHERE lp.website_id = ${parseInt(websiteId)}
          AND lp.status = ${status}
        ORDER BY lp.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else {
      links = await sql`
        SELECT lp.*,
               a1.keyword as assigned_keyword,
               a2.keyword as used_on_keyword
        FROM link_pool lp
        LEFT JOIN articles a1 ON lp.assigned_article_id = a1.id
        LEFT JOIN articles a2 ON lp.used_on_article_id = a2.id
        WHERE lp.website_id = ${parseInt(websiteId)}
        ORDER BY lp.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    }

    // Get counts by status
    const counts = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
        COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
        COUNT(*) FILTER (WHERE used_on_article_id IS NOT NULL)::int as used,
        COUNT(*)::int as total
      FROM link_pool
      WHERE website_id = ${parseInt(websiteId)}
    `;

    res.json({
      links,
      counts: counts[0] || { approved: 0, pending: 0, rejected: 0, used: 0, total: 0 }
    });
  } catch (error) {
    console.error('[Links] Error fetching pool:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/links/pool
 * Add a link to the pool manually.
 */
router.post('/pool', requireDb, async (req, res) => {
  try {
    const { websiteId, url, anchorText, description, linkType = 'outbound', relAttribute = 'noopener', target = '_blank' } = req.body;

    if (!websiteId || !url) {
      return res.status(400).json({ error: 'websiteId and url are required' });
    }

    const [link] = await sql`
      INSERT INTO link_pool (website_id, url, anchor_text, description, link_type, rel_attribute, target, status)
      VALUES (${websiteId}, ${url}, ${anchorText || null}, ${description || null}, ${linkType}, ${relAttribute}, ${target}, 'pending')
      RETURNING *
    `;

    res.json({ success: true, link });
  } catch (error) {
    console.error('[Links] Error adding link:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/links/pool/:linkId
 * Update a link (approve, reject, assign to article, change anchor text).
 */
router.put('/pool/:linkId', requireDb, async (req, res) => {
  try {
    const { linkId } = req.params;
    const { status, anchorText, description, assignedArticleId, relAttribute, target, url } = req.body;

    const updateFields = [];
    const values = {};

    // Build dynamic update - only update fields that are provided
    const [updated] = await sql`
      UPDATE link_pool
      SET
        status = COALESCE(${status || null}, status),
        anchor_text = COALESCE(${anchorText !== undefined ? anchorText : null}, anchor_text),
        description = COALESCE(${description !== undefined ? description : null}, description),
        assigned_article_id = ${assignedArticleId !== undefined ? (assignedArticleId || null) : null},
        rel_attribute = COALESCE(${relAttribute || null}, rel_attribute),
        target = COALESCE(${target || null}, target),
        url = COALESCE(${url || null}, url)
      WHERE id = ${parseInt(linkId)}
      RETURNING *
    `;

    if (!updated) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true, link: updated });
  } catch (error) {
    console.error('[Links] Error updating link:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/links/pool/:linkId
 * Remove a link from the pool.
 */
router.delete('/pool/:linkId', requireDb, async (req, res) => {
  try {
    const { linkId } = req.params;

    const result = await sql`
      DELETE FROM link_pool WHERE id = ${parseInt(linkId)} RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true, deleted: parseInt(linkId) });
  } catch (error) {
    console.error('[Links] Error deleting link:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/links/pool/bulk
 * Add multiple links at once (from AI discovery or manual batch entry).
 */
router.post('/pool/bulk', requireDb, async (req, res) => {
  try {
    const { websiteId, links } = req.body;

    if (!websiteId || !links || !Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'websiteId and links array are required' });
    }

    // Get current discovery run count
    const [website] = await sql`SELECT link_discovery_runs FROM websites WHERE id = ${websiteId}`;
    const discoveryRun = (website?.link_discovery_runs || 0) + 1;

    const added = [];
    const skipped = [];

    for (const link of links) {
      if (!link.url) {
        skipped.push({ url: link.url, reason: 'Missing URL' });
        continue;
      }

      // Check for duplicate URL in this website's pool
      const [existing] = await sql`
        SELECT id FROM link_pool WHERE website_id = ${websiteId} AND url = ${link.url}
      `;

      if (existing) {
        skipped.push({ url: link.url, reason: 'Already in pool' });
        continue;
      }

      try {
        const [inserted] = await sql`
          INSERT INTO link_pool (website_id, url, anchor_text, description, link_type, status, rel_attribute, target, discovery_run)
          VALUES (${websiteId}, ${link.url}, ${link.anchorText || null}, ${link.description || null}, ${link.linkType || 'outbound'}, ${link.status || 'pending'}, ${link.relAttribute || 'noopener'}, ${link.target || '_blank'}, ${discoveryRun})
          RETURNING *
        `;
        added.push(inserted);
      } catch (err) {
        skipped.push({ url: link.url, reason: err.message });
      }
    }

    res.json({
      success: true,
      added: added.length,
      skipped: skipped.length,
      discoveryRun,
      links: added,
      skippedDetails: skipped
    });
  } catch (error) {
    console.error('[Links] Error bulk adding:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/links/pool/bulk-approve
 * Approve multiple links at once.
 */
router.put('/pool/bulk-approve', requireDb, async (req, res) => {
  try {
    const { linkIds } = req.body;

    if (!linkIds || !Array.isArray(linkIds) || linkIds.length === 0) {
      return res.status(400).json({ error: 'linkIds array is required' });
    }

    const result = await sql`
      UPDATE link_pool
      SET status = 'approved'
      WHERE id = ANY(${linkIds})
      RETURNING id
    `;

    res.json({ success: true, approved: result.length });
  } catch (error) {
    console.error('[Links] Error bulk approving:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DISTRIBUTION
// ============================================

/**
 * POST /api/links/distribute
 * Auto-distribute unassigned approved links to articles.
 */
router.post('/distribute', requireDb, async (req, res) => {
  try {
    const { websiteId, workflowId } = req.body;

    if (!websiteId) {
      return res.status(400).json({ error: 'websiteId is required' });
    }

    const result = await distributeLinksToArticles(websiteId, workflowId || null);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Links] Error distributing:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI LINK DISCOVERY
// ============================================

/**
 * POST /api/links/discover
 * AI link discovery - uses LLM to find relevant outbound links.
 */
router.post('/discover', requireDb, async (req, res) => {
  try {
    const {
      websiteId,
      businessType,
      location,
      count = 70,
      categories = ['local_org', 'industry_authority', 'government', 'educational'],
      prompt: customPrompt,
      model = 'claude-sonnet-4-5-20250929'
    } = req.body;

    if (!websiteId) {
      return res.status(400).json({ error: 'websiteId is required' });
    }

    // Build the discovery prompt
    const defaultPrompt = `Find ${count} high-quality, relevant outbound links for a ${businessType || 'business'} website${location ? ` located in ${location}` : ''}.
Focus on these categories: ${categories.join(', ')}.

For each link, provide:
1. The URL
2. Suggested anchor text (2-5 words, natural sounding)
3. A brief description of why this link is relevant
4. The category it belongs to

IMPORTANT:
- Only suggest real, well-known websites and organizations
- Avoid competitor websites
- Prioritize .gov, .edu, and well-established .org domains when possible
- Each link should add authority and relevance to the page it appears on
- Focus on local resources, industry authorities, and educational content

Return the results as a JSON array with this structure:
[
  {
    "url": "https://example.com",
    "anchorText": "suggested anchor text",
    "description": "Why this link is relevant",
    "category": "local_org"
  }
]

Return ONLY the JSON array, no other text.`;

    const discoveryPrompt = customPrompt
      ? `${customPrompt}\n\nFind ${count} links. Return as JSON array:\n[{"url":"...","anchorText":"...","description":"...","category":"..."}]\n\nReturn ONLY the JSON array.`
      : defaultPrompt;

    // Auto-detect provider from model ID
    let provider = 'anthropic';
    if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) {
      provider = 'openai';
    } else if (model.startsWith('gemini')) {
      provider = 'google';
    }

    // Call LLM via internal API
    const llmPort = process.env.PORT || 3001;
    const llmResponse = await fetch(`http://localhost:${llmPort}/api/llm/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        prompt: discoveryPrompt,
        maxTokens: 8192
      })
    });

    if (!llmResponse.ok) {
      const errorBody = await llmResponse.json().catch(() => ({}));
      return res.status(500).json({
        error: `LLM request failed: ${errorBody.error || llmResponse.statusText}`,
        hint: 'Check that the API key for the selected model is configured'
      });
    }

    const llmResult = await llmResponse.json();

    // Parse the LLM response
    let candidates = [];
    try {
      const content = llmResult.content || '';
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        candidates = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('[Links] Failed to parse LLM response:', parseErr.message);
      return res.status(500).json({
        error: 'Failed to parse AI response',
        rawContent: llmResult.content?.substring(0, 500)
      });
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'AI returned no link candidates', rawContent: llmResult.content?.substring(0, 500) });
    }

    // Get current discovery run count
    const [website] = await sql`SELECT link_discovery_runs FROM websites WHERE id = ${websiteId}`;
    const discoveryRun = (website?.link_discovery_runs || 0) + 1;

    // Save candidates to link_pool
    const added = [];
    const skipped = [];

    for (const candidate of candidates) {
      if (!candidate.url) {
        skipped.push({ url: null, reason: 'Missing URL' });
        continue;
      }

      // Check for duplicates
      const [existing] = await sql`
        SELECT id FROM link_pool WHERE website_id = ${websiteId} AND url = ${candidate.url}
      `;

      if (existing) {
        skipped.push({ url: candidate.url, reason: 'Already in pool' });
        continue;
      }

      try {
        const [inserted] = await sql`
          INSERT INTO link_pool (website_id, url, anchor_text, description, link_type, status, discovery_run)
          VALUES (${websiteId}, ${candidate.url}, ${candidate.anchorText || null}, ${candidate.description || null}, 'outbound', 'pending', ${discoveryRun})
          RETURNING *
        `;
        added.push(inserted);
      } catch (err) {
        skipped.push({ url: candidate.url, reason: err.message });
      }
    }

    // Update discovery run count
    await sql`
      UPDATE websites
      SET link_discovery_runs = ${discoveryRun}
      WHERE id = ${websiteId}
    `;

    res.json({
      success: true,
      discoveryRun,
      totalCandidates: candidates.length,
      added: added.length,
      skipped: skipped.length,
      links: added,
      skippedDetails: skipped
    });
  } catch (error) {
    console.error('[Links] Error in discovery:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SETTINGS
// ============================================

/**
 * GET /api/links/settings/:websiteId
 * Get link discovery settings for a website.
 */
router.get('/settings/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    const [settings] = await sql`
      SELECT
        link_discovery_prompt,
        link_discovery_model,
        link_discovery_count,
        links_per_page,
        link_discovery_runs
      FROM websites
      WHERE id = ${parseInt(websiteId)}
    `;

    if (!settings) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({ settings });
  } catch (error) {
    console.error('[Links] Error fetching settings:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/links/settings/:websiteId
 * Update link discovery settings for a website.
 */
router.put('/settings/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { discoveryPrompt, discoveryModel, discoveryCount, linksPerPage } = req.body;

    const [updated] = await sql`
      UPDATE websites
      SET
        link_discovery_prompt = COALESCE(${discoveryPrompt !== undefined ? discoveryPrompt : null}, link_discovery_prompt),
        link_discovery_model = COALESCE(${discoveryModel || null}, link_discovery_model),
        link_discovery_count = COALESCE(${discoveryCount || null}, link_discovery_count),
        links_per_page = COALESCE(${linksPerPage || null}, links_per_page)
      WHERE id = ${parseInt(websiteId)}
      RETURNING
        link_discovery_prompt,
        link_discovery_model,
        link_discovery_count,
        links_per_page,
        link_discovery_runs
    `;

    if (!updated) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error('[Links] Error updating settings:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ARTICLE-LEVEL QUERIES
// ============================================

/**
 * GET /api/links/article/:articleId
 * Get links assigned/used on a specific article.
 */
router.get('/article/:articleId', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;

    // Get outbound links
    const outboundLinks = await sql`
      SELECT * FROM link_pool
      WHERE (assigned_article_id = ${parseInt(articleId)} OR used_on_article_id = ${parseInt(articleId)})
        AND status = 'approved'
      ORDER BY created_at ASC
    `;

    // Get parent page link
    const parentLink = await getParentPageLink(parseInt(articleId));

    res.json({
      outboundLinks,
      parentLink,
      totalLinks: outboundLinks.length + (parentLink ? 1 : 0)
    });
  } catch (error) {
    console.error('[Links] Error fetching article links:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LINK INJECTION PREVIEW
// ============================================

/**
 * POST /api/links/inject-preview
 * Preview what the content would look like with links injected.
 */
router.post('/inject-preview', requireDb, async (req, res) => {
  try {
    const { articleId, content, links } = req.body;

    if (!content && !articleId) {
      return res.status(400).json({ error: 'Either content or articleId is required' });
    }

    // Get content from article if not provided
    let htmlContent = content;
    if (!htmlContent && articleId) {
      const [article] = await sql`
        SELECT final_content FROM articles WHERE id = ${articleId}
      `;
      htmlContent = article?.final_content;
    }

    if (!htmlContent) {
      return res.status(400).json({ error: 'No content available' });
    }

    // Build link objects
    let linksToInject = links || [];

    // If no explicit links, look up from pool/hierarchy
    if (linksToInject.length === 0 && articleId) {
      const parentLink = await getParentPageLink(parseInt(articleId));
      if (parentLink) {
        const anchorText = findAnchorText(htmlContent, { parentTitle: parentLink.parentTitle });
        linksToInject.push({
          url: parentLink.url,
          anchorText: anchorText || parentLink.parentTitle,
          type: 'internal',
          rel: '',
          target: '_self'
        });
      }

      const outboundLinks = await getAssignedLinks(parseInt(articleId));
      for (const link of outboundLinks) {
        const anchorText = link.anchor_text || findAnchorText(htmlContent, { linkDescription: link.description });
        linksToInject.push({
          url: link.url,
          anchorText: anchorText || link.description || link.url,
          type: 'outbound',
          rel: link.rel_attribute || 'noopener',
          target: link.target || '_blank'
        });
      }
    }

    // Inject links
    const previewHtml = injectLinks(htmlContent, linksToInject);

    res.json({
      success: true,
      previewHtml,
      injectedLinks: linksToInject,
      linksCount: linksToInject.length
    });
  } catch (error) {
    console.error('[Links] Error in inject preview:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
