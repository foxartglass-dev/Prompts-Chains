/**
 * IMAGE TRACKER - CRAZY DETECTIVE MODE 🔍
 *
 * This module adds INSANE logging to track images through the entire pipeline.
 * Every time an image is touched, transformed, saved, or loaded - WE KNOW ABOUT IT.
 *
 * Call these functions at every step to find where your images are going.
 */

// Bright colors for terminal
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

export function banner(text, color = COLORS.cyan) {
  // Simplified: No ASCII art
  console.log(`${color}[${text}]${COLORS.reset}`);
}

export function section(title, color = COLORS.yellow) {
  // Simplified: No ASCII art
  console.log(`${color}--- ${title} ---${COLORS.reset}`);
}

export function endSection(color = COLORS.yellow) {
  // Simplified: No ASCII art (do nothing)
}

export function log(msg, color = COLORS.white) {
  console.log(`${color}  ${msg}${COLORS.reset}`);
}

export function success(msg) {
  console.log(`${COLORS.green}[OK] ${msg}${COLORS.reset}`);
}

export function warning(msg) {
  console.log(`${COLORS.yellow}[WARN] ${msg}${COLORS.reset}`);
}

export function error(msg) {
  console.log(`${COLORS.red}[ERR] ${msg}${COLORS.reset}`);
}

export function highlight(msg) {
  console.log(`${COLORS.cyan}[*] ${msg}${COLORS.reset}`);
}

function imageInfo(img, index) {
  const hasUrl = !!img?.url;
  const hasWpUrl = !!img?.wpUrl;
  const urlType = img?.url?.startsWith('data:') ? 'BASE64' : img?.url?.startsWith('http') ? 'HTTP' : 'NONE';
  const urlPreview = img?.url ? img.url.substring(0, 50) + '...' : 'NO URL';

  console.log(`${COLORS.magenta}│ [Image #${index}]${COLORS.reset}`);
  console.log(`│   ID: ${img?.id || 'NO ID'}`);
  console.log(`│   Placement: ${img?.placement || 'NO PLACEMENT'}`);
  console.log(`│   URL Type: ${urlType}`);
  console.log(`│   Has URL: ${hasUrl ? COLORS.green + '✓ YES' : COLORS.red + '✗ NO'}${COLORS.reset}`);
  console.log(`│   Has WP URL: ${hasWpUrl ? COLORS.green + '✓ YES' : COLORS.red + '✗ NO'}${COLORS.reset}`);
  console.log(`│   WP Media ID: ${img?.wpMediaId || 'NONE'}`);
  console.log(`│   Pushed to WP: ${img?.pushedToWp ? COLORS.green + '✓ YES' : COLORS.red + '✗ NO'}${COLORS.reset}`);
  console.log(`│   URL Preview: ${urlPreview}`);
}

/**
 * Track when images are GENERATED
 */
export function trackImageGenerated(source, imageData, context = {}) {
  banner(`IMAGE GENERATED [${source}]`, COLORS.green);
  section('Generation Details', COLORS.green);
  log(`Source: ${source}`);
  log(`Timestamp: ${new Date().toISOString()}`);
  if (context.articleId) log(`Article ID: ${context.articleId}`);
  if (context.workflowId) log(`Workflow ID: ${context.workflowId}`);
  if (context.prompt) log(`Prompt: ${context.prompt.substring(0, 80)}...`);
  if (context.model) log(`Model: ${context.model}`);

  section('Image Data', COLORS.green);
  if (imageData) {
    imageInfo(imageData, 0);
  } else {
    error('NO IMAGE DATA RETURNED!');
  }
  endSection(COLORS.green);
}

/**
 * Track when images are SAVED to database
 */
export function trackImagesSaved(location, images, context = {}) {
  banner(`IMAGES SAVED TO DB [${location}]`, COLORS.blue);
  section('Save Operation', COLORS.blue);
  log(`Location: ${location}`);
  log(`Timestamp: ${new Date().toISOString()}`);
  if (context.articleId) log(`Article ID: ${context.articleId}`);
  log(`Number of Images: ${images?.length || 0}`);

  if (!images || images.length === 0) {
    error('NO IMAGES TO SAVE! Array is empty or null!');
    error('This is likely the problem - images never made it to save operation!');
  } else {
    section(`All ${images.length} Images Being Saved`, COLORS.blue);
    images.forEach((img, idx) => {
      imageInfo(img, idx);
      console.log('│');
    });
    success(`${images.length} images prepared for database save`);
  }
  endSection(COLORS.blue);
}

/**
 * Track when images are LOADED from database
 */
export function trackImagesLoaded(location, images, context = {}) {
  banner(`IMAGES LOADED FROM DB [${location}]`, COLORS.magenta);
  section('Load Operation', COLORS.magenta);
  log(`Location: ${location}`);
  log(`Timestamp: ${new Date().toISOString()}`);
  if (context.articleId) log(`Article ID: ${context.articleId}`);
  log(`Number of Images Found: ${images?.length || 0}`);

  if (!images || images.length === 0) {
    warning('NO IMAGES FOUND IN DATABASE!');
    warning('Either they were never saved, or the field name is wrong');
    warning('Check: Is it "generated_images" or "images"?');
  } else {
    section(`All ${images.length} Images Loaded`, COLORS.magenta);
    images.forEach((img, idx) => {
      imageInfo(img, idx);
      console.log('│');
    });
    success(`${images.length} images loaded successfully`);
  }
  endSection(COLORS.magenta);
}

/**
 * Track when images are ATTACHED to chunks
 */
export function trackImagesAttachedToChunks(chunks, source) {
  banner(`IMAGES ATTACHED TO CHUNKS [${source}]`, COLORS.yellow);
  section('Chunk Analysis', COLORS.yellow);

  // Check intro
  if (chunks.intro) {
    log(`INTRO CHUNK:`);
    log(`  - Has imageData: ${chunks.intro.imageData ? COLORS.green + '✓ YES' : COLORS.red + '✗ NO'}${COLORS.reset}`);
    log(`  - Has imagePrompt: ${chunks.intro.imagePrompt ? '✓ YES' : '✗ NO'}`);
    if (chunks.intro.imageData) {
      log(`  - URL exists: ${chunks.intro.imageData.url ? '✓ YES' : '✗ NO'}`);
      log(`  - wpUrl exists: ${chunks.intro.imageData.wpUrl ? '✓ YES' : '✗ NO'}`);
      log(`  - wpMediaId: ${chunks.intro.imageData.wpMediaId || 'NONE'}`);
    }
  } else {
    warning('NO INTRO CHUNK!');
  }

  // Check body chunks
  log(`\nBODY CHUNKS (${chunks.chunks?.length || 0} total):`);
  let chunksWithImages = 0;
  let chunksWithPrompts = 0;

  chunks.chunks?.forEach((chunk, idx) => {
    if (chunk.imageData) chunksWithImages++;
    if (chunk.imagePrompt) chunksWithPrompts++;

    const hasImage = chunk.imageData ? COLORS.green + '✓' : COLORS.red + '✗';
    const hasPrompt = chunk.imagePrompt ? COLORS.green + '✓' : COLORS.red + '✗';
    log(`  [${idx}] "${chunk.heading?.substring(0, 30) || 'No heading'}" - Image:${hasImage}${COLORS.reset} Prompt:${hasPrompt}${COLORS.reset}`);
  });

  section('Summary', COLORS.yellow);
  log(`Total chunks: ${chunks.chunks?.length || 0}`);
  log(`Chunks with imageData: ${chunksWithImages}`);
  log(`Chunks with imagePrompt: ${chunksWithPrompts}`);

  if (chunksWithImages === 0) {
    error('NO CHUNKS HAVE IMAGE DATA!');
    error('Images were never attached to chunks, or were lost somewhere');
  }
  endSection(COLORS.yellow);
}

/**
 * Track API response with images
 */
export function trackApiResponse(endpoint, data, context = {}) {
  banner(`API RESPONSE [${endpoint}]`, COLORS.cyan);
  section('Response Analysis', COLORS.cyan);
  log(`Endpoint: ${endpoint}`);
  log(`Timestamp: ${new Date().toISOString()}`);

  // Check different possible image fields
  const possibleFields = ['images', 'generated_images', 'imageData', 'generatedImages'];

  for (const field of possibleFields) {
    const images = data?.[field] || data?.article?.[field];
    if (images !== undefined) {
      log(`Field "${field}": ${Array.isArray(images) ? images.length + ' images' : typeof images}`);
      if (Array.isArray(images) && images.length > 0) {
        success(`Found images in field: ${field}`);
      }
    }
  }

  // Check nested article object
  if (data?.article) {
    log('\nArticle object fields:');
    const articleKeys = Object.keys(data.article);
    articleKeys.forEach(key => {
      if (key.toLowerCase().includes('image')) {
        const val = data.article[key];
        log(`  - ${key}: ${Array.isArray(val) ? val.length + ' items' : typeof val}`);
      }
    });
  }

  endSection(COLORS.cyan);
}

/**
 * Track database query
 */
export function trackDbQuery(operation, table, data, context = {}) {
  banner(`DATABASE ${operation.toUpperCase()} [${table}]`, COLORS.red);
  section('Query Details', COLORS.red);
  log(`Operation: ${operation}`);
  log(`Table: ${table}`);
  log(`Timestamp: ${new Date().toISOString()}`);
  if (context.id) log(`ID: ${context.id}`);

  // Check for image-related fields
  if (data?.generated_images !== undefined) {
    const images = typeof data.generated_images === 'string'
      ? JSON.parse(data.generated_images)
      : data.generated_images;
    log(`generated_images field: ${Array.isArray(images) ? images.length + ' images' : typeof images}`);
    if (Array.isArray(images) && images.length > 0) {
      success('Images are being saved!');
    } else {
      warning('generated_images is empty or null');
    }
  }

  endSection(COLORS.red);
}

/**
 * MEGA STATUS CHECK - Call this to see EVERYTHING about images for an article
 */
export function megaImageStatus(articleId, articleData) {
  console.log(`[Image Status] Article ${articleId}`);

  const genImages = articleData?.generated_images;
  const images = articleData?.images;
  const hasGenImages = Array.isArray(genImages) && genImages.length > 0;
  const hasImages = Array.isArray(images) && images.length > 0;

  if (hasGenImages || hasImages) {
    const count = hasGenImages ? genImages.length : images.length;
    const field = hasGenImages ? 'generated_images' : 'images';
    console.log(`[Image Status] FOUND ${count} images in ${field}`);
  } else {
    console.log(`[Image Status] NO IMAGES FOUND`);
  }
}

// Note: Functions are already exported with 'export function' syntax above

// Default export for convenience
export default {
  trackImageGenerated,
  trackImagesSaved,
  trackImagesLoaded,
  trackImagesAttachedToChunks,
  trackApiResponse,
  trackDbQuery,
  megaImageStatus,
  banner,
  section,
  endSection,
  log,
  success,
  warning,
  error,
  highlight
};
