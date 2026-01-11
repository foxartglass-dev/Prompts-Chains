/**
 * Pushover Notification Service
 *
 * Simple wrapper for sending push notifications via Pushover.
 * Supports multiple recipients and priority levels.
 */

// Priority levels
export const Priority = {
  LOWEST: -2,    // No notification, just in inbox
  LOW: -1,       // Quiet notification
  NORMAL: 0,     // Normal notification
  HIGH: 1,       // High priority, bypasses quiet hours
  EMERGENCY: 2   // Emergency, requires acknowledgment
};

/**
 * Send a Pushover notification
 *
 * @param {Object} options
 * @param {string} options.message - The notification message (required)
 * @param {string} options.title - Optional title
 * @param {string|string[]} options.userKey - User key(s) to send to
 * @param {string} options.apiToken - App API token (defaults to env var)
 * @param {number} options.priority - Priority level (-2 to 2)
 * @param {string} options.url - Optional URL to include
 * @param {string} options.urlTitle - Title for the URL
 * @param {string} options.sound - Notification sound
 */
export async function sendPushover(options) {
  const {
    message,
    title,
    userKey,
    apiToken = process.env.PUSHOVER_API_TOKEN,
    priority = Priority.NORMAL,
    url,
    urlTitle,
    sound
  } = options;

  if (!message) {
    throw new Error('Message is required');
  }

  if (!apiToken) {
    console.warn('Pushover: No API token configured, skipping notification');
    return { skipped: true, reason: 'No API token' };
  }

  // Handle single user or array of users
  const userKeys = Array.isArray(userKey) ? userKey : [userKey];
  const validUserKeys = userKeys.filter(k => k && k.trim());

  if (validUserKeys.length === 0) {
    console.warn('Pushover: No user keys provided, skipping notification');
    return { skipped: true, reason: 'No user keys' };
  }

  const results = [];

  for (const user of validUserKeys) {
    try {
      const body = new URLSearchParams({
        token: apiToken,
        user: user.trim(),
        message,
        ...(title && { title }),
        ...(priority !== undefined && { priority: priority.toString() }),
        ...(url && { url }),
        ...(urlTitle && { url_title: urlTitle }),
        ...(sound && { sound })
      });

      // Emergency priority requires retry/expire params
      if (priority === Priority.EMERGENCY) {
        body.append('retry', '60');   // Retry every 60 seconds
        body.append('expire', '3600'); // Stop after 1 hour
      }

      const response = await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        body
      });

      const data = await response.json();

      if (data.status === 1) {
        results.push({ user, success: true, request: data.request });
      } else {
        results.push({ user, success: false, errors: data.errors });
      }
    } catch (error) {
      results.push({ user, success: false, error: error.message });
    }
  }

  const allSucceeded = results.every(r => r.success);
  const anySucceeded = results.some(r => r.success);

  return {
    success: allSucceeded,
    partial: !allSucceeded && anySucceeded,
    results
  };
}

/**
 * Send a drip feed notification
 */
export async function notifyDripFeed(type, data, userKeys) {
  const apiToken = process.env.PUSHOVER_API_TOKEN;

  if (!apiToken || !userKeys || userKeys.length === 0) {
    return { skipped: true };
  }

  const notifications = {
    published: {
      title: 'Article Published',
      message: `"${data.keyword}" was published to ${data.website || 'WordPress'}`,
      priority: Priority.NORMAL,
      url: data.url,
      urlTitle: 'View Article'
    },
    failed: {
      title: 'Drip Feed Failed',
      message: `Failed to publish "${data.keyword}": ${data.error || 'Unknown error'}`,
      priority: Priority.HIGH
    },
    no_meta: {
      title: 'Missing Meta Data',
      message: `"${data.keyword}" is scheduled soon but has no meta title/description selected`,
      priority: Priority.HIGH
    },
    daily_summary: {
      title: 'Daily Drip Feed Summary',
      message: `Published: ${data.published} | Failed: ${data.failed} | Pending: ${data.pending}`,
      priority: Priority.LOW
    },
    queue_empty: {
      title: 'Drip Feed Queue Empty',
      message: `The drip feed queue for ${data.website || 'your site'} is empty. Add more articles to continue auto-publishing.`,
      priority: Priority.NORMAL
    }
  };

  const notification = notifications[type];
  if (!notification) {
    console.warn(`Pushover: Unknown notification type "${type}"`);
    return { skipped: true, reason: 'Unknown type' };
  }

  return sendPushover({
    ...notification,
    userKey: userKeys,
    apiToken
  });
}

export default { sendPushover, notifyDripFeed, Priority };
