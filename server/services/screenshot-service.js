/**
 * Screenshot Service
 * Captures WordPress page screenshots using Puppeteer
 * Supports both public pages and authenticated draft pages
 *
 * Railway/Nixpacks: Uses system Chromium via PUPPETEER_EXECUTABLE_PATH
 */

import puppeteer from 'puppeteer';
import { existsSync } from 'fs';

/**
 * Find Chromium executable path
 * Checks environment variable first, then common system locations
 */
function getChromiumPath() {
  // First check environment variable
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Common Chromium paths on different systems
  const possiblePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // Nixpacks/Railway paths
    '/nix/var/nix/profiles/default/bin/chromium',
    // Mac paths
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Return null to let Puppeteer use its bundled Chromium
  return null;
}

/**
 * Get Puppeteer launch options
 */
function getLaunchOptions() {
  const executablePath = getChromiumPath();

  const options = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-extensions'
    ]
  };

  if (executablePath) {
    options.executablePath = executablePath;
    console.log(`Using Chromium at: ${executablePath}`);
  }

  return options;
}

/**
 * Capture a public page screenshot
 * @param {string} pageUrl - Full URL to capture
 * @param {Object} options - Screenshot options
 * @returns {Promise<Buffer>} PNG screenshot buffer
 */
async function captureScreenshot(pageUrl, options = {}) {
  const {
    width = 1280,
    height = 800,
    fullPage = true,
    waitFor = 2000  // Wait for page to render
  } = options;

  const browser = await puppeteer.launch(getLaunchOptions());

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait additional time for JS rendering (Elementor, etc.)
    await new Promise(r => setTimeout(r, waitFor));

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

/**
 * Capture a draft/private page (requires WP authentication)
 * @param {string} pageUrl - URL to capture
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Object} options - Screenshot options
 * @returns {Promise<Buffer>} PNG screenshot buffer
 */
async function captureAuthenticatedPage(pageUrl, wpCredentials, options = {}) {
  const { url: wpUrl, user, password } = wpCredentials;

  const browser = await puppeteer.launch(getLaunchOptions());

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: options.width || 1280, height: options.height || 800 });

    // Navigate to WP login
    const loginUrl = `${wpUrl.replace(/\/$/, '')}/wp-login.php`;
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    // Fill login form
    await page.type('#user_login', user);
    await page.type('#user_pass', password);
    await page.click('#wp-submit');

    // Wait for redirect after login
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Now navigate to the actual page
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, options.waitFor || 2000));

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: options.fullPage !== false
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

/**
 * Get element positions from page for overlay mapping
 * This extracts Elementor widget positions so we know where to show click overlays
 * @param {string} pageUrl - URL to analyze
 * @param {Object} wpCredentials - Optional auth credentials for draft pages
 * @returns {Promise<Array>} Array of element positions with Elementor IDs
 */
async function getElementPositions(pageUrl, wpCredentials = null) {
  const browser = await puppeteer.launch(getLaunchOptions());

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // If credentials provided, login first
    if (wpCredentials) {
      const loginUrl = `${wpCredentials.url.replace(/\/$/, '')}/wp-login.php`;
      await page.goto(loginUrl, { waitUntil: 'networkidle2' });
      await page.type('#user_login', wpCredentials.user);
      await page.type('#user_pass', wpCredentials.password);
      await page.click('#wp-submit');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }

    await page.goto(pageUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Extract Elementor widget positions from the rendered page
    const positions = await page.evaluate(() => {
      const elements = [];

      // Find all Elementor widgets with data-id attribute
      document.querySelectorAll('[data-id]').forEach(el => {
        const rect = el.getBoundingClientRect();
        const widgetType = el.dataset.widget_type || el.dataset.element_type;

        // Only include visible elements
        if (rect.width > 0 && rect.height > 0) {
          elements.push({
            id: el.dataset.id,
            type: widgetType,
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height,
            isImage: el.querySelector('img') !== null,
            isText: el.querySelector('.elementor-text-editor, .elementor-heading-title') !== null,
            hasBackground: window.getComputedStyle(el).backgroundImage !== 'none'
          });
        }
      });

      return elements;
    });

    // Also get full page height for screenshot sizing
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    return { elements: positions, pageHeight };
  } finally {
    await browser.close();
  }
}

/**
 * Check if Puppeteer is available and working
 * Useful for health checks
 * @returns {Promise<boolean>}
 */
async function checkPuppeteerHealth() {
  try {
    const browser = await puppeteer.launch(getLaunchOptions());
    await browser.close();
    return true;
  } catch (error) {
    console.error('Puppeteer health check failed:', error.message);
    return false;
  }
}

export {
  captureScreenshot,
  captureAuthenticatedPage,
  getElementPositions,
  checkPuppeteerHealth
};

export default {
  captureScreenshot,
  captureAuthenticatedPage,
  getElementPositions,
  checkPuppeteerHealth
};
