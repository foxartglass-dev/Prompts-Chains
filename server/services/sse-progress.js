/**
 * SSE Progress Utility
 * Shared Server-Sent Events setup for streaming progress to clients.
 * Extracted from articles.js bulk-generate-images pattern.
 *
 * Usage:
 *   const { sendProgress, sendComplete, sendError } = setupSSE(res);
 *   sendProgress({ current: 1, total: 10, keyword: 'test' });
 *   sendComplete({ succeeded: 9, failed: 1 });
 */

/**
 * Sets up SSE headers and returns helper functions for streaming progress.
 * @param {import('express').Response} res - Express response object
 * @returns {{ sendProgress: Function, sendComplete: Function, sendError: Function }}
 */
function setupSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  return {
    sendProgress: (data) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', ...data })}\n\n`);
    },
    sendComplete: (data) => {
      res.write(`data: ${JSON.stringify({ type: 'complete', ...data })}\n\n`);
      res.end();
    },
    sendError: (error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || error })}\n\n`);
      res.end();
    },
  };
}

export { setupSSE };
export default setupSSE;
