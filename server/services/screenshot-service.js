/**
 * Screenshot Service
 * Captures WordPress page screenshots using Puppeteer
 * Supports both public pages and authenticated draft pages
 *
 * Railway/Nixpacks: Uses system Chromium via PUPPETEER_EXECUTABLE_PATH
 */

import puppeteer from 'puppeteer';
import { existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Find Chromium executable path
 * Checks environment variable first, then tries to find it dynamically
 */
function getChromiumPath() {
  // First check environment variable
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    console.log('Using PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Try to find chromium using 'which' command
  try {
    const whichResult = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
    if (whichResult && existsSync(whichResult)) {
      console.log('Found Chromium via which:', whichResult);
      return whichResult;
    }
  } catch (e) {
    // which command failed, continue to manual search
  }

  // Common Chromium paths on different systems
  const possiblePaths = [
    // Nixpacks/Railway paths
    '/nix/var/nix/profiles/default/bin/chromium',
    '/root/.nix-profile/bin/chromium',
    // Standard Linux paths
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // Mac paths
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log('Found Chromium at:', path);
      return path;
    }
  }

  // Try to find in Nix store (Railway/Nixpacks)
  try {
    const nixStorePath = '/nix/store';
    if (existsSync(nixStorePath)) {
      const dirs = readdirSync(nixStorePath);
      for (const dir of dirs) {
        if (dir.includes('chromium')) {
          const chromiumPath = `${nixStorePath}/${dir}/bin/chromium`;
          if (existsSync(chromiumPath)) {
            console.log('Found Chromium in Nix store:', chromiumPath);
            return chromiumPath;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error searching Nix store:', e.message);
  }

  console.warn('Chromium not found - Puppeteer will try to use bundled version');
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
 * Robust version with retry logic and proper frame detachment handling
 * @param {string} pageUrl - URL to capture
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Object} options - Screenshot options
 * @returns {Promise<Buffer>} PNG screenshot buffer
 */
async function captureAuthenticatedPage(pageUrl, wpCredentials, options = {}) {
  const { url: wpUrl, user, password } = wpCredentials;
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let browser = null;

    try {
      console.log(`Screenshot attempt ${attempt}/${maxRetries} for: ${pageUrl}`);

      browser = await puppeteer.launch(getLaunchOptions());
      const page = await browser.newPage();

      // Set longer timeout for slow WordPress sites
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);

      await page.setViewport({ width: options.width || 1280, height: options.height || 800 });

      // Step 1: Navigate to WP login page
      const loginUrl = `${wpUrl.replace(/\/$/, '')}/wp-login.php`;
      console.log(`Navigating to login: ${loginUrl}`);

      await page.goto(loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for login form to be ready
      await page.waitForSelector('#user_login', { timeout: 10000 });

      // Step 2: Fill credentials using evaluate (faster and more reliable than type())
      console.log('Filling login credentials...');
      await page.evaluate((u, p) => {
        document.querySelector('#user_login').value = u;
        document.querySelector('#user_pass').value = p;
      }, user, password);

      // Small delay to ensure form is ready
      await new Promise(r => setTimeout(r, 500));

      // Step 3: Submit form and wait for navigation
      console.log('Submitting login form...');

      await Promise.all([
        page.waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: 30000
        }).catch(e => {
          console.log('Navigation wait warning:', e.message);
        }),
        page.click('#wp-submit')
      ]);

      // Give WordPress time to set cookies
      await new Promise(r => setTimeout(r, 2000));

      // Step 4: Verify login succeeded
      const currentUrl = page.url();
      console.log(`After login, URL: ${currentUrl}`);

      const isLoggedIn = currentUrl.includes('wp-admin') ||
                         !currentUrl.includes('wp-login.php') ||
                         currentUrl.includes('reauth=1') === false;

      if (currentUrl.includes('wp-login.php') && !currentUrl.includes('redirect_to')) {
        throw new Error('Login appears to have failed - still on login page');
      }

      // Step 5: Navigate to the target preview page
      console.log(`Navigating to target: ${pageUrl}`);

      // Use a more resilient navigation approach
      try {
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });
      } catch (navError) {
        // Frame detachment is common with WP previews - continue if we can
        if (navError.message.includes('frame was detached') ||
            navError.message.includes('Frame detached')) {
          console.log('Frame detached during navigation - checking if page loaded...');
          await new Promise(r => setTimeout(r, 3000));
        } else {
          throw navError;
        }
      }

      // Step 6: Verify we're on the right page
      const finalUrl = page.url();
      console.log(`Final URL: ${finalUrl}`);

      if (finalUrl.includes('wp-admin') && !pageUrl.includes('wp-admin')) {
        console.log('Warning: Still on wp-admin, retrying navigation...');

        // Try navigation one more time
        await page.goto(pageUrl, {
          waitUntil: 'load',
          timeout: 30000
        }).catch(() => {});

        await new Promise(r => setTimeout(r, 3000));

        const retryUrl = page.url();
        console.log(`After retry, URL: ${retryUrl}`);
      }

      // Step 7: Wait for page content to render
      const renderWait = options.waitFor || 4000;
      console.log(`Waiting ${renderWait}ms for content to render...`);
      await new Promise(r => setTimeout(r, renderWait));

      // Step 8: Take screenshot
      console.log('Taking screenshot...');
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: options.fullPage !== false
      });

      console.log('Screenshot captured successfully!');
      await browser.close();
      return screenshot;

    } catch (error) {
      lastError = error;
      console.error(`Screenshot attempt ${attempt} failed:`, error.message);

      // Close browser if still open
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          // Ignore close errors
        }
      }

      // Don't retry on certain errors
      if (error.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
          error.message.includes('invalid URL')) {
        throw error;
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('Screenshot capture failed after all retries');
}

/**
 * Get element positions from page for overlay mapping
 * This extracts Elementor widget positions so we know where to show click overlays
 * Robust version with proper error handling for frame detachment
 * @param {string} pageUrl - URL to analyze
 * @param {Object} wpCredentials - Optional auth credentials for draft pages
 * @returns {Promise<Array>} Array of element positions with Elementor IDs
 */
async function getElementPositions(pageUrl, wpCredentials = null) {
  let browser = null;

  try {
    browser = await puppeteer.launch(getLaunchOptions());
    const page = await browser.newPage();

    // Set longer timeouts
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);

    await page.setViewport({ width: 1280, height: 800 });

    // If credentials provided, login first
    if (wpCredentials) {
      const loginUrl = `${wpCredentials.url.replace(/\/$/, '')}/wp-login.php`;
      console.log('Element positions: Logging in first...');

      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#user_login', { timeout: 10000 });

      // Use evaluate for faster form fill
      await page.evaluate((u, p) => {
        document.querySelector('#user_login').value = u;
        document.querySelector('#user_pass').value = p;
      }, wpCredentials.user, wpCredentials.password);

      await new Promise(r => setTimeout(r, 500));

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        page.click('#wp-submit')
      ]);

      await new Promise(r => setTimeout(r, 2000));
    }

    // Navigate to target page with frame detachment handling
    console.log('Element positions: Navigating to page...');
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (navError) {
      if (navError.message.includes('frame was detached') ||
          navError.message.includes('Frame detached')) {
        console.log('Frame detached during element navigation - continuing...');
        await new Promise(r => setTimeout(r, 3000));
      } else {
        throw navError;
      }
    }

    await new Promise(r => setTimeout(r, 3000));

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

    console.log(`Element positions: Found ${positions.length} elements`);
    return { elements: positions, pageHeight };

  } catch (error) {
    console.error('Element positions error:', error.message);
    // Return empty result instead of crashing
    return { elements: [], pageHeight: 800, error: error.message };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
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

/**
 * Get Chromium path info for diagnostics
 */
function getChromiumInfo() {
  return getChromiumPath();
}

export {
  captureScreenshot,
  captureAuthenticatedPage,
  getElementPositions,
  checkPuppeteerHealth,
  getChromiumInfo
};

export default {
  captureScreenshot,
  captureAuthenticatedPage,
  getElementPositions,
  checkPuppeteerHealth,
  getChromiumInfo
};
