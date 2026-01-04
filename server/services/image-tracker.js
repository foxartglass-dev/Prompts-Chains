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

function banner(text, color = COLORS.cyan) {
  const line = '═'.repeat(70);
  console.log(`\n${color}${COLORS.bright}╔${line}╗${COLORS.reset}`);
  console.log(`${color}${COLORS.bright}║  🔍 ${text.padEnd(65)} ║${COLORS.reset}`);
  console.log(`${color}${COLORS.bright}╚${line}╝${COLORS.reset}\n`);
}

function section(title, color = COLORS.yellow) {
  console.log(`\n${color}${COLORS.bright}┌─── ${title} ${'─'.repeat(60 - title.length)}┐${COLORS.reset}`);
}

function endSection(color = COLORS.yellow) {
  console.log(`${color}${COLORS.bright}└${'─'.repeat(69)}┘${COLORS.reset}\n`);
}

function log(msg, color = COLORS.white) {
  console.log(`${color}│ ${msg}${COLORS.reset}`);
}

function success(msg) {
  console.log(`${COLORS.green}${COLORS.bright}│ ✅ ${msg}${COLORS.reset}`);
}

function warning(msg) {
  console.log(`${COLORS.yellow}${COLORS.bright}│ ⚠️  ${msg}${COLORS.reset}`);
}

function error(msg) {
  console.log(`${COLORS.red}${COLORS.bright}│ ❌ ${msg}${COLORS.reset}`);
}

function highlight(msg) {
  console.log(`${COLORS.cyan}${COLORS.bright}│ 🎯 ${msg}${COLORS.reset}`);
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
  console.log('\n');
  console.log(`${COLORS.bgMagenta}${COLORS.white}${COLORS.bright}`);
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                      ║');
  console.log('║   🔍🔍🔍  MEGA IMAGE STATUS CHECK  🔍🔍🔍                           ║');
  console.log('║                                                                      ║');
  console.log(`║   Article ID: ${String(articleId).padEnd(55)}║`);
  console.log('║                                                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`${COLORS.reset}\n`);

  section('Raw Data Check', COLORS.magenta);
  log(`typeof articleData: ${typeof articleData}`);
  log(`articleData is null: ${articleData === null}`);
  log(`articleData is undefined: ${articleData === undefined}`);

  if (articleData) {
    log('\nAll keys in articleData:');
    Object.keys(articleData).forEach(key => {
      const val = articleData[key];
      const type = Array.isArray(val) ? `Array(${val.length})` : typeof val;
      if (key.toLowerCase().includes('image')) {
        highlight(`${key}: ${type}`);
      } else {
        log(`  ${key}: ${type}`);
      }
    });
  }

  section('Image Fields Check', COLORS.magenta);

  // Check generated_images
  const genImages = articleData?.generated_images;
  log(`generated_images exists: ${genImages !== undefined}`);
  log(`generated_images type: ${typeof genImages}`);
  log(`generated_images is array: ${Array.isArray(genImages)}`);
  if (Array.isArray(genImages)) {
    log(`generated_images length: ${genImages.length}`);
    if (genImages.length > 0) {
      success('FOUND IMAGES IN generated_images!');
      genImages.forEach((img, idx) => imageInfo(img, idx));
    } else {
      error('generated_images is EMPTY ARRAY');
    }
  } else if (typeof genImages === 'string') {
    try {
      const parsed = JSON.parse(genImages);
      log(`Parsed as JSON, length: ${parsed.length}`);
      if (parsed.length > 0) {
        success('FOUND IMAGES after JSON parse!');
      }
    } catch (e) {
      error('Failed to parse generated_images as JSON');
    }
  }

  // Check images (frontend uses this)
  const images = articleData?.images;
  log(`\nimages exists: ${images !== undefined}`);
  log(`images type: ${typeof images}`);
  log(`images is array: ${Array.isArray(images)}`);
  if (Array.isArray(images) && images.length > 0) {
    success('FOUND IMAGES IN images field!');
  }

  // Check image_decision_report
  const report = articleData?.image_decision_report;
  log(`\nimage_decision_report exists: ${report !== undefined}`);
  if (report) {
    log(`report.mode: ${report.mode}`);
    log(`report.images count: ${report.images?.length || 0}`);
  }

  endSection(COLORS.magenta);

  // VERDICT
  console.log('\n');
  console.log(`${COLORS.bgYellow}${COLORS.bright}`);
  console.log('╔══════════════════════════════════════════════════════════════════════╗');

  const hasGenImages = Array.isArray(genImages) && genImages.length > 0;
  const hasImages = Array.isArray(images) && images.length > 0;

  if (hasGenImages || hasImages) {
    console.log('║                     ✅ IMAGES FOUND!                                ║');
    console.log(`║   Location: ${hasGenImages ? 'generated_images' : 'images'}                                          ║`);
    console.log(`║   Count: ${String(hasGenImages ? genImages.length : images.length).padEnd(59)}║`);
  } else {
    console.log('║                     ❌ NO IMAGES FOUND!                             ║');
    console.log('║                                                                      ║');
    console.log('║   Possible causes:                                                   ║');
    console.log('║   1. Images were never generated                                     ║');
    console.log('║   2. Images were generated but not saved to DB                       ║');
    console.log('║   3. Images are in a different field                                 ║');
    console.log('║   4. Database update failed silently                                 ║');
  }

  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`${COLORS.reset}\n`);
}

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
