/**
 * Local Viking API Service
 *
 * Handles all communication with Local Viking for:
 * - GeoGrid rank tracking (heat maps)
 * - GBP (Google Business Profile) posting
 * - Photo uploads to GBP
 * - Q&A management
 * - "Rinse and Repeat" post automation
 *
 * API Documentation: https://localviking.com/api-documentation
 *
 * Credit costs (as of implementation):
 * - 7x7 GeoGrid scan: 49 credits
 * - 9x9 GeoGrid scan: 81 credits
 * - 11x11 GeoGrid scan: 121 credits
 * - GBP Post: 1 credit
 * - Photo upload: 1 credit
 */

const BASE_URL = 'https://api.localviking.com/v1';

/**
 * Create authorization headers for Local Viking API
 * @param {string} apiKey - Local Viking API key
 * @returns {Object} Headers object
 */
function createHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

/**
 * Make an API request to Local Viking
 * @param {string} apiKey - API key
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {string} method - HTTP method
 * @param {Object} body - Request body (optional)
 * @returns {Promise<Object>} API response
 */
async function makeRequest(apiKey, endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;

  const options = {
    method,
    headers: createHeaders(apiKey)
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local Viking API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Local Viking API request failed: ${endpoint}`, error);
    throw error;
  }
}

// ============================================================================
// ACCOUNT & CREDITS
// ============================================================================

/**
 * Get account info and remaining credits
 * @param {string} apiKey - Local Viking API key
 * @returns {Promise<Object>} Account info with credits
 */
async function getAccountInfo(apiKey) {
  return makeRequest(apiKey, '/account');
}

/**
 * Get credit balance
 * @param {string} apiKey - Local Viking API key
 * @returns {Promise<Object>} Credit balance
 */
async function getCreditBalance(apiKey) {
  const account = await getAccountInfo(apiKey);
  return {
    credits: account.credits || 0,
    plan: account.plan || 'unknown'
  };
}

// ============================================================================
// LOCATIONS (GBP Profiles)
// ============================================================================

/**
 * Get all connected GBP locations
 * @param {string} apiKey - Local Viking API key
 * @returns {Promise<Array>} List of locations
 */
async function getLocations(apiKey) {
  return makeRequest(apiKey, '/locations');
}

/**
 * Get a specific location by ID
 * @param {string} apiKey - Local Viking API key
 * @param {string} locationId - Location ID
 * @returns {Promise<Object>} Location details
 */
async function getLocation(apiKey, locationId) {
  return makeRequest(apiKey, `/locations/${locationId}`);
}

// ============================================================================
// GEOGRID RANK TRACKING
// ============================================================================

/**
 * Create a new GeoGrid rank tracking scan
 * @param {string} apiKey - Local Viking API key
 * @param {Object} options - Scan options
 * @param {string} options.locationId - GBP location ID
 * @param {string} options.keyword - Keyword to track
 * @param {number} options.gridSize - Grid size (7, 9, or 11)
 * @param {number} options.distance - Distance between grid points in miles
 * @param {number} options.lat - Center latitude (optional, uses location if not provided)
 * @param {number} options.lng - Center longitude (optional, uses location if not provided)
 * @returns {Promise<Object>} Scan result or job ID for async processing
 */
async function createGeoGridScan(apiKey, options) {
  const {
    locationId,
    keyword,
    gridSize = 7,
    distance = 1,
    lat,
    lng
  } = options;

  // Credits cost: gridSize * gridSize
  const creditCost = gridSize * gridSize;
  console.log(`GeoGrid scan will use ${creditCost} credits (${gridSize}x${gridSize} grid)`);

  const body = {
    location_id: locationId,
    keyword: keyword,
    grid_size: gridSize,
    distance: distance
  };

  if (lat && lng) {
    body.latitude = lat;
    body.longitude = lng;
  }

  return makeRequest(apiKey, '/geogrid/scan', 'POST', body);
}

/**
 * Get GeoGrid scan results
 * @param {string} apiKey - Local Viking API key
 * @param {string} scanId - Scan ID
 * @returns {Promise<Object>} Scan results with grid data
 */
async function getGeoGridResults(apiKey, scanId) {
  return makeRequest(apiKey, `/geogrid/scans/${scanId}`);
}

/**
 * Get all GeoGrid scans for a location
 * @param {string} apiKey - Local Viking API key
 * @param {string} locationId - Location ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of scans
 */
async function getLocationScans(apiKey, locationId, options = {}) {
  const { limit = 50, keyword } = options;
  let endpoint = `/geogrid/locations/${locationId}/scans?limit=${limit}`;
  if (keyword) {
    endpoint += `&keyword=${encodeURIComponent(keyword)}`;
  }
  return makeRequest(apiKey, endpoint);
}

/**
 * Get historical rank data for trend analysis
 * @param {string} apiKey - Local Viking API key
 * @param {string} locationId - Location ID
 * @param {string} keyword - Keyword to analyze
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Historical scan data
 */
async function getRankHistory(apiKey, locationId, keyword, options = {}) {
  const { days = 30 } = options;
  const scans = await getLocationScans(apiKey, locationId, { limit: days, keyword });

  // Process scans into trend data
  return scans.map(scan => ({
    date: scan.created_at,
    avgRank: scan.average_rank,
    topRank: scan.best_rank,
    inTop3Count: scan.in_top_3_count || 0,
    gridSize: scan.grid_size,
    keyword: scan.keyword
  }));
}

/**
 * Analyze GeoGrid data to identify "sheep" opportunities
 * (Keywords ranking 4-10 that can be pushed to top 3 with supporting content)
 * @param {Object} scanResult - GeoGrid scan result
 * @returns {Object} Analysis with sheep opportunities
 */
function analyzeForSheepOpportunities(scanResult) {
  const gridPoints = scanResult.grid_data || [];

  // Count positions in different rank buckets
  const analysis = {
    total_points: gridPoints.length,
    top_3: 0,
    positions_4_to_10: 0,  // "Sheep" - ready to herd to top 3
    positions_11_to_20: 0, // Potential sheep with more work
    not_ranking: 0,
    average_rank: 0,
    best_rank: 20,
    worst_rank: 0,
    sheep_opportunity_score: 0,
    recommendation: ''
  };

  let rankSum = 0;
  let rankedPoints = 0;

  for (const point of gridPoints) {
    const rank = point.rank || 0;

    if (rank === 0 || rank > 20) {
      analysis.not_ranking++;
    } else {
      rankedPoints++;
      rankSum += rank;

      if (rank <= 3) {
        analysis.top_3++;
      } else if (rank <= 10) {
        analysis.positions_4_to_10++;
      } else {
        analysis.positions_11_to_20++;
      }

      if (rank < analysis.best_rank) analysis.best_rank = rank;
      if (rank > analysis.worst_rank) analysis.worst_rank = rank;
    }
  }

  // Calculate averages and scores
  analysis.average_rank = rankedPoints > 0 ? (rankSum / rankedPoints).toFixed(1) : 0;

  // Sheep opportunity score: higher = more opportunity to push keywords to top 3
  // Formula: (positions 4-10 * 3) + (positions 11-20 * 1) - (not ranking * 0.5)
  analysis.sheep_opportunity_score = (
    (analysis.positions_4_to_10 * 3) +
    (analysis.positions_11_to_20 * 1) -
    (analysis.not_ranking * 0.5)
  ).toFixed(1);

  // Generate recommendation
  if (analysis.positions_4_to_10 > analysis.total_points * 0.3) {
    analysis.recommendation = 'HIGH PRIORITY: Many positions ready to push to top 3. Create supporting content now!';
  } else if (analysis.top_3 > analysis.total_points * 0.5) {
    analysis.recommendation = 'MAINTAIN: Strong positions. Focus on defending top 3 rankings.';
  } else if (analysis.not_ranking > analysis.total_points * 0.5) {
    analysis.recommendation = 'BUILD FOUNDATION: Need more foundational SEO work before sheep herding.';
  } else {
    analysis.recommendation = 'GROW: Moderate opportunity. Steady content creation recommended.';
  }

  return analysis;
}

// ============================================================================
// GBP POSTING (Google Business Profile)
// ============================================================================

/**
 * Create a new GBP post
 * @param {string} apiKey - Local Viking API key
 * @param {Object} options - Post options
 * @param {string} options.locationId - GBP location ID
 * @param {string} options.content - Post text content
 * @param {string} options.callToAction - CTA type (LEARN_MORE, BOOK, ORDER, SHOP, SIGN_UP, CALL)
 * @param {string} options.ctaUrl - URL for the CTA button
 * @param {string} options.imageUrl - URL to image (optional)
 * @param {Buffer} options.imageData - Image data as Buffer (optional, alternative to URL)
 * @returns {Promise<Object>} Created post data
 */
async function createGBPPost(apiKey, options) {
  const {
    locationId,
    content,
    callToAction = 'LEARN_MORE',
    ctaUrl,
    imageUrl,
    imageData
  } = options;

  const body = {
    location_id: locationId,
    summary: content,
    call_to_action: {
      action_type: callToAction
    }
  };

  if (ctaUrl) {
    body.call_to_action.url = ctaUrl;
  }

  if (imageUrl) {
    body.media = {
      source_url: imageUrl,
      media_format: 'PHOTO'
    };
  } else if (imageData) {
    // Convert buffer to base64 for upload
    body.media = {
      data: imageData.toString('base64'),
      media_format: 'PHOTO'
    };
  }

  return makeRequest(apiKey, '/posts', 'POST', body);
}

/**
 * Get all posts for a location
 * @param {string} apiKey - Local Viking API key
 * @param {string} locationId - Location ID
 * @returns {Promise<Array>} List of posts
 */
async function getGBPPosts(apiKey, locationId) {
  return makeRequest(apiKey, `/posts?location_id=${locationId}`);
}

/**
 * Get a specific post
 * @param {string} apiKey - Local Viking API key
 * @param {string} postId - Post ID
 * @returns {Promise<Object>} Post details
 */
async function getGBPPost(apiKey, postId) {
  return makeRequest(apiKey, `/posts/${postId}`);
}

/**
 * Delete a GBP post
 * @param {string} apiKey - Local Viking API key
 * @param {string} postId - Post ID
 * @returns {Promise<Object>} Deletion result
 */
async function deleteGBPPost(apiKey, postId) {
  return makeRequest(apiKey, `/posts/${postId}`, 'DELETE');
}

/**
 * Update a GBP post
 * @param {string} apiKey - Local Viking API key
 * @param {string} postId - Post ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated post
 */
async function updateGBPPost(apiKey, postId, updates) {
  return makeRequest(apiKey, `/posts/${postId}`, 'PATCH', updates);
}

// ============================================================================
// RINSE AND REPEAT AUTOMATION
// ============================================================================

/**
 * Execute the "Rinse and Repeat" strategy for a location
 * This deletes posts older than the threshold and reposts the same content
 * to maintain fresh posts without needing new content
 *
 * @param {string} apiKey - Local Viking API key
 * @param {string} locationId - Location ID
 * @param {Object} options - Automation options
 * @param {number} options.maxAgeDays - Delete posts older than this (default: 7)
 * @param {boolean} options.repostImmediately - Whether to repost deleted content immediately
 * @returns {Promise<Object>} Results of the rinse and repeat cycle
 */
async function executeRinseAndRepeat(apiKey, locationId, options = {}) {
  const {
    maxAgeDays = 7,
    repostImmediately = true
  } = options;

  const results = {
    deleted: [],
    reposted: [],
    errors: [],
    creditsUsed: 0
  };

  try {
    // Get all posts for this location
    const posts = await getGBPPosts(apiKey, locationId);

    const now = new Date();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    for (const post of posts) {
      const postDate = new Date(post.created_at);
      const age = now - postDate;

      if (age > maxAgeMs) {
        // Store post content before deleting
        const postContent = {
          content: post.summary,
          callToAction: post.call_to_action?.action_type,
          ctaUrl: post.call_to_action?.url,
          imageUrl: post.media?.source_url
        };

        try {
          // Delete old post
          await deleteGBPPost(apiKey, post.id);
          results.deleted.push({
            id: post.id,
            content: post.summary?.substring(0, 50) + '...',
            age: Math.floor(age / (24 * 60 * 60 * 1000)) + ' days'
          });

          // Repost if enabled
          if (repostImmediately) {
            const newPost = await createGBPPost(apiKey, {
              locationId,
              ...postContent
            });
            results.reposted.push({
              id: newPost.id,
              content: postContent.content?.substring(0, 50) + '...'
            });
            results.creditsUsed += 1; // 1 credit per post
          }
        } catch (error) {
          results.errors.push({
            postId: post.id,
            error: error.message
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Rinse and repeat execution failed:', error);
    throw error;
  }
}

/**
 * Schedule automated rinse and repeat for multiple locations
 * This returns a schedule that should be executed by a cron job
 *
 * @param {Array} locations - Array of {locationId, postTemplates}
 * @param {Object} options - Scheduling options
 * @returns {Object} Schedule configuration
 */
function createRinseRepeatSchedule(locations, options = {}) {
  const {
    cycleIntervalDays = 7,
    staggerMinutes = 30 // Stagger posts between locations
  } = options;

  const schedule = {
    interval: `${cycleIntervalDays} days`,
    locations: locations.map((loc, index) => ({
      locationId: loc.locationId,
      executeAt: `+${index * staggerMinutes} minutes`, // Stagger execution
      templates: loc.postTemplates || []
    })),
    estimatedCreditsPerCycle: locations.length // 1 credit per location per cycle
  };

  return schedule;
}

// ============================================================================
// GBP PHOTOS
// ============================================================================

/**
 * Upload a photo to GBP
 * @param {string} apiKey - Local Viking API key
 * @param {Object} options - Upload options
 * @param {string} options.locationId - Location ID
 * @param {Buffer|string} options.imageData - Image data (Buffer or base64)
 * @param {string} options.category - Photo category (COVER, PROFILE, LOGO, EXTERIOR, INTERIOR, PRODUCT, AT_WORK, FOOD_AND_DRINK, MENU, COMMON_AREA, ROOMS, TEAMS, ADDITIONAL)
 * @returns {Promise<Object>} Upload result
 */
async function uploadGBPPhoto(apiKey, options) {
  const {
    locationId,
    imageData,
    category = 'ADDITIONAL'
  } = options;

  let base64Data = imageData;
  if (Buffer.isBuffer(imageData)) {
    base64Data = imageData.toString('base64');
  }

  const body = {
    location_id: locationId,
    photo_data: base64Data,
    category: category
  };

  return makeRequest(apiKey, '/photos', 'POST', body);
}

/**
 * Get all photos for a location
 * @param {string} apiKey - Local Viking API key
 * @param {string} locationId - Location ID
 * @returns {Promise<Array>} List of photos
 */
async function getGBPPhotos(apiKey, locationId) {
  return makeRequest(apiKey, `/photos?location_id=${locationId}`);
}

/**
 * Delete a GBP photo
 * @param {string} apiKey - Local Viking API key
 * @param {string} photoId - Photo ID
 * @returns {Promise<Object>} Deletion result
 */
async function deleteGBPPhoto(apiKey, photoId) {
  return makeRequest(apiKey, `/photos/${photoId}`, 'DELETE');
}

// ============================================================================
// Q&A MANAGEMENT
// ============================================================================

/**
 * Get Q&A for a location
 * @param {string} apiKey - Local Viking API key
 * @param {string} locationId - Location ID
 * @returns {Promise<Array>} List of Q&A entries
 */
async function getQandA(apiKey, locationId) {
  return makeRequest(apiKey, `/qanda?location_id=${locationId}`);
}

/**
 * Post an answer to a question
 * @param {string} apiKey - Local Viking API key
 * @param {string} questionId - Question ID
 * @param {string} answer - Answer text
 * @returns {Promise<Object>} Answer result
 */
async function answerQuestion(apiKey, questionId, answer) {
  return makeRequest(apiKey, `/qanda/${questionId}/answer`, 'POST', { answer });
}

/**
 * Post a new question (for Q&A seeding)
 * @param {string} apiKey - Local Viking API key
 * @param {Object} options - Question options
 * @param {string} options.locationId - Location ID
 * @param {string} options.question - Question text
 * @returns {Promise<Object>} Created question
 */
async function postQuestion(apiKey, options) {
  const { locationId, question } = options;
  return makeRequest(apiKey, '/qanda', 'POST', {
    location_id: locationId,
    question: question
  });
}

// ============================================================================
// COMPETITOR ANALYSIS
// ============================================================================

/**
 * Get competitors from GeoGrid scan
 * Extracts which businesses are ranking in grid positions
 * @param {Object} scanResult - GeoGrid scan result
 * @returns {Array} Competitor analysis
 */
function extractCompetitors(scanResult) {
  const competitorMap = new Map();

  for (const point of (scanResult.grid_data || [])) {
    for (let i = 0; i < (point.businesses || []).length; i++) {
      const business = point.businesses[i];
      const rank = i + 1;

      if (!competitorMap.has(business.name)) {
        competitorMap.set(business.name, {
          name: business.name,
          appearances: 0,
          avgRank: 0,
          totalRank: 0,
          bestRank: 20,
          topThreeCount: 0
        });
      }

      const comp = competitorMap.get(business.name);
      comp.appearances++;
      comp.totalRank += rank;
      comp.avgRank = (comp.totalRank / comp.appearances).toFixed(1);
      if (rank < comp.bestRank) comp.bestRank = rank;
      if (rank <= 3) comp.topThreeCount++;
    }
  }

  return Array.from(competitorMap.values())
    .sort((a, b) => a.avgRank - b.avgRank);
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Calculate estimated monthly credit usage
 * @param {Object} config - Usage configuration
 * @returns {Object} Credit estimate
 */
function estimateMonthlyCreditUsage(config) {
  const {
    locationsCount = 1,
    keywordsPerLocation = 5,
    scansPerMonth = 4,        // Weekly scans
    gridSize = 7,
    postsPerWeek = 2,
    photosPerMonth = 4
  } = config;

  const creditsPerScan = gridSize * gridSize;
  const geoGridCredits = locationsCount * keywordsPerLocation * scansPerMonth * creditsPerScan;
  const postCredits = locationsCount * postsPerWeek * 4; // 4 weeks
  const photoCredits = locationsCount * photosPerMonth;

  const total = geoGridCredits + postCredits + photoCredits;

  return {
    breakdown: {
      geoGrid: geoGridCredits,
      posts: postCredits,
      photos: photoCredits
    },
    total,
    estimatedCost: `$${(total * 0.01).toFixed(2)} (at ~$0.01/credit)` // Rough estimate
  };
}

/**
 * Test API connection
 * @param {string} apiKey - Local Viking API key
 * @returns {Promise<Object>} Connection test result
 */
async function testConnection(apiKey) {
  try {
    const account = await getAccountInfo(apiKey);
    return {
      success: true,
      credits: account.credits,
      plan: account.plan,
      email: account.email
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Account
  getAccountInfo,
  getCreditBalance,
  testConnection,

  // Locations
  getLocations,
  getLocation,

  // GeoGrid Rank Tracking
  createGeoGridScan,
  getGeoGridResults,
  getLocationScans,
  getRankHistory,
  analyzeForSheepOpportunities,

  // GBP Posts
  createGBPPost,
  getGBPPosts,
  getGBPPost,
  deleteGBPPost,
  updateGBPPost,

  // Rinse and Repeat
  executeRinseAndRepeat,
  createRinseRepeatSchedule,

  // Photos
  uploadGBPPhoto,
  getGBPPhotos,
  deleteGBPPhoto,

  // Q&A
  getQandA,
  answerQuestion,
  postQuestion,

  // Competitor Analysis
  extractCompetitors,

  // Helpers
  estimateMonthlyCreditUsage
};

export default {
  // Account
  getAccountInfo,
  getCreditBalance,
  testConnection,

  // Locations
  getLocations,
  getLocation,

  // GeoGrid
  createGeoGridScan,
  getGeoGridResults,
  getLocationScans,
  getRankHistory,
  analyzeForSheepOpportunities,

  // Posts
  createGBPPost,
  getGBPPosts,
  getGBPPost,
  deleteGBPPost,
  updateGBPPost,

  // Rinse and Repeat
  executeRinseAndRepeat,
  createRinseRepeatSchedule,

  // Photos
  uploadGBPPhoto,
  getGBPPhotos,
  deleteGBPPhoto,

  // Q&A
  getQandA,
  answerQuestion,
  postQuestion,

  // Competitors
  extractCompetitors,

  // Helpers
  estimateMonthlyCreditUsage
};
