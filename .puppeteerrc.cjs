/**
 * Puppeteer configuration for Railway deployment
 * Uses system Chromium instead of downloading
 */
const { join } = require('path');

module.exports = {
  // Skip downloading Chrome - use system Chromium on Railway
  skipDownload: true,

  // Default args for headless operation
  defaultArgs: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
};
