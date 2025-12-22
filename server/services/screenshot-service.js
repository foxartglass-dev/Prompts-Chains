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
  console.log('Searching for Chromium...');

  // First check environment variable
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log('PUPPETEER_EXECUTABLE_PATH is set to:', process.env.PUPPETEER_EXECUTABLE_PATH);
    if (existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      console.log('✓ Using PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      console.warn('✗ PUPPETEER_EXECUTABLE_PATH set but file does not exist');
    }
  }

  // Try to find chromium using 'which' command
  try {
    const whichResult = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
    if (whichResult && existsSync(whichResult)) {
      console.log('✓ Found Chromium via which:', whichResult);
      return whichResult;
    }
  } catch (e) {
    // which command failed, continue to manual search
  }

  // Common Chromium paths on different systems
  const possiblePaths = [
    // Nixpacks/Railway paths (multiple possible locations)
    '/root/.nix-profile/bin/chromium',
    '/nix/var/nix/profiles/default/bin/chromium',
    '/home/nixuser/.nix-profile/bin/chromium',
    // Standard Linux paths
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // Snap path (Ubuntu)
    '/snap/bin/chromium',
    // Mac paths
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];

  console.log('Checking common paths...');
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log('✓ Found Chromium at:', path);
      return path;
    }
  }

  // Try to find in Nix store (Railway/Nixpacks) - search more thoroughly
  try {
    const nixStorePath = '/nix/store';
    if (existsSync(nixStorePath)) {
      console.log('Searching Nix store...');
      const dirs = readdirSync(nixStorePath);
      // Look for chromium directories
      const chromiumDirs = dirs.filter(dir => dir.includes('chromium') && !dir.includes('unwrapped'));

      for (const dir of chromiumDirs) {
        // Try multiple possible binary locations within the package
        const binPaths = [
          `${nixStorePath}/${dir}/bin/chromium`,
          `${nixStorePath}/${dir}/bin/chromium-browser`,
          `${nixStorePath}/${dir}/bin/chrome`
        ];

        for (const binPath of binPaths) {
          if (existsSync(binPath)) {
            console.log('✓ Found Chromium in Nix store:', binPath);
            return binPath;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error searching Nix store:', e.message);
  }

  // Last resort: try to find any chromium binary
  try {
    const findResult = execSync('find /nix -name "chromium" -type f -executable 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
    if (findResult && existsSync(findResult)) {
      console.log('✓ Found Chromium via find:', findResult);
      return findResult;
    }
  } catch (e) {
    // find command failed
  }

  console.warn('✗ Chromium not found - Puppeteer will try to use bundled version');
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

  console.log('Starting authenticated screenshot capture...');
  console.log('Target page:', pageUrl);
  console.log('WP URL:', wpUrl);
  console.log('WP User:', user);

  const browser = await puppeteer.launch(getLaunchOptions());

  try {
    let page = await browser.newPage();

    // Set a realistic user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: options.width || 1280, height: options.height || 800 });

    // Navigate to WP login
    const loginUrl = `${wpUrl.replace(/\/$/, '')}/wp-login.php`;
    console.log('Navigating to login page:', loginUrl);

    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Check if we're on the login page
    const isLoginPage = await page.$('#user_login');
    if (!isLoginPage) {
      // Maybe already logged in, or redirected
      console.log('Not on login page, checking current URL...');
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);

      // If redirected to wp-admin, we're already logged in
      if (!currentUrl.includes('wp-admin')) {
        throw new Error(`Unexpected page state. Current URL: ${currentUrl}`);
      }
      console.log('Already logged in, proceeding to target page');
    } else {
      console.log('On login page, filling credentials...');

      // Fill login form using direct value setting
      await page.evaluate((username, pass) => {
        const userInput = document.querySelector('#user_login');
        const passInput = document.querySelector('#user_pass');

        if (userInput) {
          userInput.value = '';
          userInput.value = username;
          userInput.dispatchEvent(new Event('input', { bubbles: true }));
          userInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (passInput) {
          passInput.value = '';
          passInput.value = pass;
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, user, password);

      console.log('Credentials filled via evaluate()');

      // Check the "Remember Me" box if it exists
      const rememberMe = await page.$('#rememberme');
      if (rememberMe) {
        await rememberMe.click();
      }

      console.log('Submitting login form...');
      await page.click('#wp-submit');

      // Wait for navigation after login
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      } catch (navError) {
        console.log('Navigation timeout, checking page state...');
      }

      // Check for login errors
      const loginError = await page.$('#login_error');
      if (loginError) {
        const errorText = await page.$eval('#login_error', el => el.textContent);
        throw new Error(`WordPress login failed: ${errorText.trim()}`);
      }

      // Verify we're logged in
      const currentUrl = page.url();
      console.log('After login, current URL:', currentUrl);

      if (currentUrl.includes('wp-login.php') && !currentUrl.includes('redirect_to')) {
        throw new Error('Login appears to have failed - still on login page');
      }
    }

    // Get cookies from logged-in session
    console.log('Extracting auth cookies...');
    const cookies = await page.cookies();
    console.log(`Got ${cookies.length} cookies`);

    // Close old page and create fresh one with cookies
    await page.close();
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: options.width || 1280, height: options.height || 800 });
    await page.setCookie(...cookies);

    // Navigate directly to target page
    console.log('Navigating to target page:', pageUrl);

    try {
      // Try direct navigation first
      await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 45000 });
    } catch (navError) {
      console.log('Navigation issue:', navError.message);
      // If it fails, still try to continue - page may have loaded
    }

    // Extra wait for Elementor content
    console.log('Waiting for content to render...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('Taking screenshot...');
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: options.fullPage !== false
    });

    console.log('Screenshot captured successfully!');
    return screenshot;
  } catch (error) {
    console.error('Authenticated screenshot error:', error.message);
    throw error;
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

      // Use direct value setting (page.type gets interrupted by WP's JS)
      await page.evaluate((username, pass) => {
        const userInput = document.querySelector('#user_login');
        const passInput = document.querySelector('#user_pass');

        if (userInput) {
          userInput.value = username;
          userInput.dispatchEvent(new Event('input', { bubbles: true }));
          userInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (passInput) {
          passInput.value = pass;
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, wpCredentials.user, wpCredentials.password);

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
