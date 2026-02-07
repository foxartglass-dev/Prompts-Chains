/**
 * Schema / JSON-LD Generation Service (Phase 8)
 *
 * Generates structured data (JSON-LD) for WordPress pages using LLM analysis.
 * Two tracks: Bulk (auto-identify schema types) and Custom (user-specified prompt).
 * Injection via WordPress custom meta field + mu-plugin.
 */

import { sql } from '../db/index.js';

/**
 * Generate schema JSON-LD for a single article using bulk settings.
 * LLM reads the content and identifies which schema types apply from the provided list.
 *
 * @param {number} articleId
 * @param {string[]} schemaTypes - List of schema types to look for
 * @param {string} bulkPrompt - User's guiding prompt
 * @param {string} model - LLM model to use
 * @returns {Promise<{ schemas: object[], identifiedTypes: string[] }>}
 */
export async function generateBulkSchema(articleId, schemaTypes, bulkPrompt, model) {
  // 1. Get article content
  const articles = await sql`
    SELECT id, keyword, final_content, wp_post_url
    FROM articles WHERE id = ${articleId}
  `;

  if (articles.length === 0) {
    throw new Error(`Article ${articleId} not found`);
  }

  const article = articles[0];

  if (!article.final_content || article.final_content.trim().length === 0) {
    throw new Error(`Article "${article.keyword}" has no content to analyze`);
  }

  // Truncate content if very long (keep first ~12000 chars to fit LLM context)
  const content = article.final_content.length > 12000
    ? article.final_content.substring(0, 12000) + '\n\n[Content truncated for analysis]'
    : article.final_content;

  // 2. Build LLM prompt
  const prompt = `You are a Schema.org expert specializing in JSON-LD structured data for SEO.

Analyze the following page content and identify which of these schema types apply:
${schemaTypes.map(t => `- ${t}`).join('\n')}

User instructions for schema generation:
${bulkPrompt || 'Generate appropriate schema based on the page content.'}

Page URL: ${article.wp_post_url || 'Not available'}
Page keyword: ${article.keyword}

PAGE CONTENT:
${content}

INSTRUCTIONS:
1. Identify which schema types from the list above are relevant to this page's content
2. For each relevant type, generate complete, valid JSON-LD
3. Every schema MUST include "@context": "https://schema.org" and "@type"
4. Do NOT include duplicate schema types
5. Return ONLY a valid JSON array of schema objects, no markdown, no explanation

RESPOND WITH ONLY THE JSON ARRAY:`;

  // 3. Call LLM
  const llmResponse = await callLLM(prompt, model);

  // 4. Parse response
  const { schemas, identifiedTypes } = parseSchemaResponse(llmResponse);

  // 5. Store on article
  await sql`
    UPDATE articles
    SET generated_schema = ${JSON.stringify(schemas)},
        updated_at = NOW()
    WHERE id = ${articleId}
  `;

  return { schemas, identifiedTypes };
}

/**
 * Generate schema JSON-LD for a custom-designated page using its specific prompt.
 *
 * @param {number} customPageId - ID from schema_custom_pages table
 * @param {string} customPrompt - The custom prompt for this page
 * @param {string} model - LLM model to use
 * @returns {Promise<{ schemas: object[] }>}
 */
export async function generateCustomSchema(customPageId, customPrompt, model) {
  // 1. Get custom page info
  const pages = await sql`
    SELECT scp.*, a.final_content, a.keyword, a.wp_post_url
    FROM schema_custom_pages scp
    LEFT JOIN articles a ON scp.article_id = a.id
    WHERE scp.id = ${customPageId}
  `;

  if (pages.length === 0) {
    throw new Error(`Custom schema page ${customPageId} not found`);
  }

  const page = pages[0];
  let content = page.final_content || '';
  let pageUrl = page.page_url || page.wp_post_url || '';

  // If no article content and we have wp_post_id, note it for the user
  if (!content && page.wp_post_id && !page.article_id) {
    content = `[Page content not available in database. Page title: "${page.page_title}", URL: ${pageUrl}]`;
  }

  if (!content || content.trim().length === 0) {
    throw new Error(`Custom page "${page.page_title}" has no content to analyze`);
  }

  // Truncate if needed
  const truncatedContent = content.length > 12000
    ? content.substring(0, 12000) + '\n\n[Content truncated for analysis]'
    : content;

  // 2. Build LLM prompt
  const prompt = `You are a Schema.org expert specializing in JSON-LD structured data for SEO.

Generate comprehensive JSON-LD schema for this page following these specific instructions:

${customPrompt}

Page title: ${page.page_title || page.keyword || 'Unknown'}
Page URL: ${pageUrl}

PAGE CONTENT:
${truncatedContent}

INSTRUCTIONS:
1. Follow the custom instructions above carefully
2. Generate complete, valid JSON-LD for each schema type requested
3. Every schema MUST include "@context": "https://schema.org" and "@type"
4. Include all relevant properties with real data from the content and instructions
5. Return ONLY a valid JSON array of schema objects, no markdown, no explanation

RESPOND WITH ONLY THE JSON ARRAY:`;

  // 3. Call LLM
  const llmResponse = await callLLM(prompt, model);

  // 4. Parse response
  const { schemas } = parseSchemaResponse(llmResponse);

  // 5. Store on custom page
  await sql`
    UPDATE schema_custom_pages
    SET generated_schema = ${JSON.stringify(schemas)},
        updated_at = NOW()
    WHERE id = ${customPageId}
  `;

  return { schemas };
}

/**
 * Push JSON-LD schema to a WordPress page via custom meta field.
 * Uses the mu-plugin approach: stores schema in _promptflow_schema_jsonld meta.
 *
 * @param {number} wpPostId - WordPress page ID
 * @param {object[]} schemas - Array of JSON-LD schema objects
 * @param {object} credentials - { wpUrl, username, appPassword }
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function pushSchemaToWordPress(wpPostId, schemas, credentials) {
  const { wpUrl, username, appPassword } = credentials;

  if (!wpUrl || !username || !appPassword) {
    return { success: false, message: 'Missing WordPress credentials' };
  }

  if (!wpPostId) {
    return { success: false, message: 'No WordPress post ID provided' };
  }

  const baseUrl = wpUrl.replace(/\/+$/, '');
  const authHeader = 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');

  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/pages/${wpPostId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        meta: {
          _promptflow_schema_jsonld: JSON.stringify(schemas)
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.message || `HTTP ${response.status}`;

      // Check if the meta field isn't registered (mu-plugin not deployed)
      if (response.status === 400 && errorMsg.includes('meta')) {
        return {
          success: false,
          message: `Meta field not registered. The PromptFlow Schema mu-plugin may not be deployed. Error: ${errorMsg}`
        };
      }

      return {
        success: false,
        message: `WordPress API error: ${errorMsg}`
      };
    }

    return {
      success: true,
      message: `Schema pushed to WordPress page ${wpPostId}`
    };
  } catch (error) {
    console.error('Error pushing schema to WordPress:', error);
    return {
      success: false,
      message: `Network error: ${error.message}`
    };
  }
}

/**
 * Check if the PromptFlow schema mu-plugin is deployed on the WordPress site.
 * Tests by checking if the _promptflow_schema_jsonld meta field is registered.
 *
 * @param {object} credentials - { wpUrl, username, appPassword }
 * @returns {Promise<{ deployed: boolean, testResult: string }>}
 */
export async function checkMuPluginDeployed(credentials) {
  const { wpUrl, username, appPassword } = credentials;

  if (!wpUrl || !username || !appPassword) {
    return { deployed: false, testResult: 'Missing WordPress credentials' };
  }

  const baseUrl = wpUrl.replace(/\/+$/, '');
  const authHeader = 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');

  try {
    // Try to read meta from any published page
    const response = await fetch(
      `${baseUrl}/wp-json/wp/v2/pages?per_page=1&status=publish&_fields=id,meta`,
      {
        headers: { 'Authorization': authHeader }
      }
    );

    if (!response.ok) {
      return {
        deployed: false,
        testResult: `Could not connect to WordPress API (HTTP ${response.status})`
      };
    }

    const pages = await response.json();

    if (pages.length === 0) {
      return {
        deployed: false,
        testResult: 'No published pages found to test against'
      };
    }

    const pageMeta = pages[0].meta || {};

    // Check if our meta field exists in the response
    if ('_promptflow_schema_jsonld' in pageMeta) {
      return {
        deployed: true,
        testResult: 'PromptFlow Schema plugin detected — meta field is registered'
      };
    }

    // Try writing to confirm - the field might exist but be empty
    try {
      const writeTest = await fetch(
        `${baseUrl}/wp-json/wp/v2/pages/${pages[0].id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            meta: { _promptflow_schema_jsonld: '[]' }
          })
        }
      );

      if (writeTest.ok) {
        const result = await writeTest.json();
        if (result.meta && '_promptflow_schema_jsonld' in result.meta) {
          return {
            deployed: true,
            testResult: 'PromptFlow Schema plugin detected — meta field is writable'
          };
        }
      }
    } catch (writeErr) {
      // Write test failed, field not registered
    }

    return {
      deployed: false,
      testResult: 'Meta field _promptflow_schema_jsonld not found. Deploy the mu-plugin to wp-content/mu-plugins/'
    };
  } catch (error) {
    console.error('Error checking mu-plugin deployment:', error);
    return {
      deployed: false,
      testResult: `Connection error: ${error.message}`
    };
  }
}

/**
 * Get the mu-plugin PHP code and deployment instructions
 */
export function getMuPluginCode() {
  const code = `<?php
/**
 * Plugin Name: PromptFlow Schema Injection
 * Description: Renders JSON-LD schema from PromptFlow via custom post meta.
 * Version: 1.0
 * Author: PromptFlow
 */

// Register the meta field for REST API access
add_action('init', function() {
    register_post_meta('page', '_promptflow_schema_jsonld', [
        'show_in_rest' => true,
        'single'       => true,
        'type'         => 'string',
        'auth_callback' => function() {
            return current_user_can('edit_posts');
        }
    ]);
});

// Output schema in <head>
add_action('wp_head', function() {
    if (is_singular()) {
        $schema = get_post_meta(get_the_ID(), '_promptflow_schema_jsonld', true);
        if ($schema) {
            $schemas = json_decode($schema, true);
            if (is_array($schemas)) {
                foreach ($schemas as $s) {
                    echo '<script type="application/ld+json">' .
                         wp_json_encode($s, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) .
                         "</script>\\n";
                }
            }
        }
    }
}, 1);`;

  const instructions = `1. Copy the PHP code above
2. Save as "promptflow-schema.php"
3. Upload to wp-content/mu-plugins/ on your WordPress server
4. If the mu-plugins directory doesn't exist, create it
5. No activation needed — mu-plugins are loaded automatically
6. Click "Check Plugin Status" in PromptFlow to verify`;

  return {
    code,
    filename: 'promptflow-schema.php',
    instructions
  };
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Call the LLM via the internal API
 */
async function callLLM(prompt, model) {
  const detectProvider = (modelId) => {
    if (modelId.startsWith('claude-')) return 'anthropic';
    if (modelId.startsWith('gpt-')) return 'openai';
    if (modelId.startsWith('gemini-')) return 'gemini';
    return 'anthropic';
  };

  const provider = detectProvider(model);

  // Resolve API key from environment
  const envKeys = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY'
  };

  const apiKey = process.env[envKeys[provider]];

  if (!apiKey) {
    throw new Error(`API key not configured for ${provider}. Set ${envKeys[provider]} environment variable.`);
  }

  // Use internal fetch to the LLM router
  try {
    const port = process.env.PORT || 3001;
    const response = await fetch(`http://localhost:${port}/api/llm/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        prompt,
        maxTokens: 8192
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `LLM request failed with status ${response.status}`);
    }

    const result = await response.json();
    return result.content;
  } catch (error) {
    // If localhost fetch fails, try calling the provider directly
    console.error('Internal LLM call failed, trying direct provider call:', error.message);
    throw new Error(`LLM generation failed: ${error.message}`);
  }
}

/**
 * Parse LLM response into validated schema objects
 */
function parseSchemaResponse(responseText) {
  // Try to extract JSON array from the response
  let jsonStr = responseText.trim();

  // Remove markdown code blocks if present
  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  jsonStr = jsonStr.trim();

  let schemas;
  try {
    schemas = JSON.parse(jsonStr);
  } catch (e) {
    // Try to find a JSON array in the response
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        schemas = JSON.parse(arrayMatch[0]);
      } catch (e2) {
        throw new Error(`LLM returned invalid JSON. Response preview: ${jsonStr.substring(0, 200)}`);
      }
    } else {
      throw new Error(`LLM did not return a JSON array. Response preview: ${jsonStr.substring(0, 200)}`);
    }
  }

  // Ensure it's an array
  if (!Array.isArray(schemas)) {
    schemas = [schemas];
  }

  // Validate each schema
  const validSchemas = [];
  const identifiedTypes = [];

  for (const schema of schemas) {
    if (!schema || typeof schema !== 'object') continue;

    // Must have @type
    if (!schema['@type']) {
      console.warn('Schema missing @type, skipping:', JSON.stringify(schema).substring(0, 100));
      continue;
    }

    // Ensure @context
    if (!schema['@context']) {
      schema['@context'] = 'https://schema.org';
    }

    validSchemas.push(schema);
    identifiedTypes.push(schema['@type']);
  }

  if (validSchemas.length === 0) {
    throw new Error('LLM generated no valid schema objects. Each must have at least @type.');
  }

  return { schemas: validSchemas, identifiedTypes };
}

export default {
  generateBulkSchema,
  generateCustomSchema,
  pushSchemaToWordPress,
  checkMuPluginDeployed,
  getMuPluginCode
};
