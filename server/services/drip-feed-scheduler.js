/**
 * Drip Feed Scheduler Service
 * Handles automated publishing of scheduled articles using node-cron
 *
 * This service:
 * 1. Runs every 5 minutes to check for due articles
 * 2. Publishes articles to WordPress (Images → Page → Meta)
 * 3. Creates notifications for errors and first-day monitoring
 * 4. Catches up on missed articles after server restart
 */

import cron from 'node-cron';
import { sql, isDatabaseEnabled } from '../db/index.js';

let isRunning = false;
let lastRun = null;
let schedulerEnabled = true;

// Helper function to get current date and time in a specific timezone
const getCurrentTimeInTimezone = (timezone = 'America/Chicago') => {
  const now = new Date();

  // Get date parts in the specified timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const currentDate = dateFormatter.format(now); // YYYY-MM-DD format

  // Get time parts in the specified timezone
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const timeParts = timeFormatter.formatToParts(now);
  const hour = timeParts.find(p => p.type === 'hour')?.value || '00';
  const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
  const currentTime = `${hour}:${minute}`;

  return { currentDate, currentTime };
};

/**
 * Initialize the drip feed scheduler
 * Call this when the server starts
 */
export function initDripFeedScheduler() {
  if (!isDatabaseEnabled()) {
    console.log('[Drip Feed Scheduler] Database not enabled, skipping initialization');
    return;
  }

  console.log('[Drip Feed Scheduler] Initializing...');

  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    if (!schedulerEnabled) {
      console.log('[Drip Feed Scheduler] Scheduler disabled, skipping');
      return;
    }

    if (isRunning) {
      console.log('[Drip Feed Scheduler] Already running, skipping this tick');
      return;
    }

    await runDripFeedCycle();
  });

  // Also check for notifications every minute
  cron.schedule('* * * * *', async () => {
    if (!schedulerEnabled) return;
    await checkPendingNotifications();
  });

  // Run immediately on startup to catch any missed articles
  setTimeout(async () => {
    console.log('[Drip Feed Scheduler] Running startup catch-up...');
    await runDripFeedCycle();
  }, 5000); // Wait 5 seconds for server to fully initialize

  console.log('[Drip Feed Scheduler] ✅ Initialized - checking every 5 minutes');
}

/**
 * Main drip feed processing cycle
 */
async function runDripFeedCycle() {
  if (!isDatabaseEnabled()) return;

  isRunning = true;
  lastRun = new Date();

  try {
    console.log(`[Drip Feed Scheduler] Running cycle...`);

    // Get all pending articles with their timezone settings
    const pendingArticles = await sql`
      SELECT s.*, a.keyword, a.final_content, a.selected_meta_title,
             a.selected_meta_description, a.generated_images,
             w.wp_url, w.wp_user, w.wp_app_password, w.seo_plugin,
             w.id as website_id,
             ds.is_enabled, ds.first_day_monitor,
             COALESCE(ds.timezone, 'America/Chicago') as timezone
      FROM drip_feed_schedules s
      JOIN articles a ON s.article_id = a.id
      JOIN websites w ON s.website_id = w.id
      LEFT JOIN drip_feed_settings ds ON s.website_id = ds.website_id
      WHERE s.status = 'pending'
        AND (ds.is_enabled = true OR ds.is_enabled IS NULL)
      ORDER BY s.scheduled_date, s.scheduled_time
      LIMIT 50
    `;

    // Filter to find articles that are due based on their website's timezone
    const dueArticles = pendingArticles.filter(article => {
      const { currentDate, currentTime } = getCurrentTimeInTimezone(article.timezone);
      return article.scheduled_date < currentDate ||
             (article.scheduled_date === currentDate && article.scheduled_time <= currentTime);
    }).slice(0, 5); // Limit to 5 for processing

    if (dueArticles.length === 0) {
      console.log('[Drip Feed Scheduler] No articles due for publishing');
      isRunning = false;
      return;
    }

    console.log(`[Drip Feed Scheduler] Found ${dueArticles.length} articles due for publishing`);

    for (const article of dueArticles) {
      await publishArticle(article);
    }

  } catch (error) {
    console.error('[Drip Feed Scheduler] Error in cycle:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Publish a single article to WordPress
 * Follows the critical order: Images → Page → Meta
 */
async function publishArticle(article) {
  const scheduleId = article.id;
  const articleId = article.article_id;

  try {
    // Mark as publishing
    await sql`
      UPDATE drip_feed_schedules
      SET status = 'publishing', last_attempt_at = NOW(), attempts = attempts + 1
      WHERE id = ${scheduleId}
    `;

    // Check if meta is selected - this is required
    if (!article.selected_meta_title) {
      // Create notification for missing meta
      await createNotification({
        websiteId: article.website_id,
        scheduleId,
        articleId,
        type: 'meta_not_chosen',
        title: `Meta Required: ${article.keyword}`,
        message: 'This article is due for publishing but has no meta title selected.'
      });

      // Reset to pending so it gets picked up again
      await sql`
        UPDATE drip_feed_schedules
        SET status = 'pending', error_message = 'Waiting for meta selection'
        WHERE id = ${scheduleId}
      `;

      console.log(`[Drip Feed Scheduler] ⏸️ Waiting for meta: ${article.keyword}`);
      return { success: false, waiting: true, reason: 'meta_not_selected' };
    }

    console.log(`[Drip Feed Scheduler] 📤 Publishing: ${article.keyword}`);

    // Dynamic import of node-fetch
    const { default: fetch } = await import('node-fetch');
    const PORT = process.env.PORT || 3001;
    const baseUrl = `http://localhost:${PORT}`;

    // Step 1: Upload images to WordPress Media Library FIRST
    const hasImages = article.generated_images && article.generated_images.length > 0;
    if (hasImages) {
      console.log(`[Drip Feed Scheduler] Step 1: Uploading ${article.generated_images.length} images...`);
      try {
        const imagesRes = await fetch(`${baseUrl}/api/articles/${articleId}/push-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpUrl: article.wp_url,
            wpUser: article.wp_user,
            wpPassword: article.wp_app_password
          })
        });
        const imagesData = await imagesRes.json();
        if (!imagesData.success) {
          console.warn(`[Drip Feed Scheduler] Images warning: ${imagesData.error}`);
        } else {
          console.log(`[Drip Feed Scheduler] ✅ Uploaded ${imagesData.pushed || 0} images`);
        }
      } catch (imgErr) {
        console.warn(`[Drip Feed Scheduler] Images upload error: ${imgErr.message}`);
      }
    }

    // Step 2: Create the WordPress page
    console.log(`[Drip Feed Scheduler] Step 2: Creating WordPress page...`);
    const publishRes = await fetch(`${baseUrl}/api/elementor/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wpUrl: article.wp_url,
        wpUser: article.wp_user,
        wpPassword: article.wp_app_password,
        title: article.keyword,
        content: article.final_content,
        status: 'publish', // Publish immediately
        articleId: articleId
      })
    });

    const publishData = await publishRes.json();

    if (!publishData.success) {
      throw new Error(publishData.error || 'Failed to create WordPress page');
    }

    const wpPostId = publishData.page.id;
    const wpPostUrl = publishData.page.link;
    console.log(`[Drip Feed Scheduler] ✅ Created page: ${wpPostUrl}`);

    // Step 3: Push meta to SEO plugin
    console.log(`[Drip Feed Scheduler] Step 3: Pushing meta to ${article.seo_plugin || 'rankmath'}...`);
    try {
      const metaRes = await fetch(`${baseUrl}/api/seo/push-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl: article.wp_url,
          wpUser: article.wp_user,
          wpPassword: article.wp_app_password,
          postId: wpPostId,
          metaTitle: article.selected_meta_title,
          metaDescription: article.selected_meta_description,
          seoPlugin: article.seo_plugin || 'rankmath',
          articleId: articleId
        })
      });
      const metaData = await metaRes.json();
      if (!metaData.success) {
        console.warn(`[Drip Feed Scheduler] Meta warning: ${metaData.error}`);
      } else {
        console.log(`[Drip Feed Scheduler] ✅ Meta pushed successfully`);
      }
    } catch (metaErr) {
      console.warn(`[Drip Feed Scheduler] Meta push error: ${metaErr.message}`);
    }

    // Update schedule as published
    await sql`
      UPDATE drip_feed_schedules
      SET status = 'published', published_at = NOW(), wp_post_id = ${wpPostId}, wp_post_url = ${wpPostUrl}
      WHERE id = ${scheduleId}
    `;

    // Update article with WP post info
    await sql`
      UPDATE articles
      SET wp_post_id = ${wpPostId}, wp_post_url = ${wpPostUrl}, status = 'published'
      WHERE id = ${articleId}
    `;

    // Log success
    await sql`
      INSERT INTO drip_feed_log (schedule_id, website_id, article_id, action, details)
      VALUES (${scheduleId}, ${article.website_id}, ${articleId}, 'published', ${JSON.stringify({
        wp_post_id: wpPostId,
        wp_post_url: wpPostUrl
      })})
    `;

    // Check if first day monitor is enabled - create notification
    if (article.first_day_monitor) {
      const isFirstDay = await isFirstDayOfDripFeed(article.website_id);
      if (isFirstDay) {
        await createNotification({
          websiteId: article.website_id,
          scheduleId,
          articleId,
          type: 'first_day',
          title: `Published: ${article.keyword}`,
          message: `First day monitor: Article published to ${wpPostUrl}`
        });
      }
    }

    console.log(`[Drip Feed Scheduler] ✅ Successfully published: ${article.keyword}`);

    return { success: true, wpPostId, wpPostUrl };

  } catch (error) {
    console.error(`[Drip Feed Scheduler] ❌ Failed: ${article.keyword} - ${error.message}`);

    // Update schedule as failed
    await sql`
      UPDATE drip_feed_schedules
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${scheduleId}
    `;

    // Log failure
    await sql`
      INSERT INTO drip_feed_log (schedule_id, website_id, article_id, action, error_message)
      VALUES (${scheduleId}, ${article.website_id}, ${articleId}, 'failed', ${error.message})
    `;

    // Create error notification
    await createNotification({
      websiteId: article.website_id,
      scheduleId,
      articleId,
      type: 'publish_failed',
      title: `Publish Failed: ${article.keyword}`,
      message: error.message
    });

    return { success: false, error: error.message };
  }
}

/**
 * Check if this is the first day of drip feed publishing for a website
 */
async function isFirstDayOfDripFeed(websiteId) {
  const published = await sql`
    SELECT COUNT(*) as count FROM drip_feed_schedules
    WHERE website_id = ${websiteId} AND status = 'published'
  `;
  // If less than 10 articles published, consider it "first day" for monitoring
  return parseInt(published[0].count) < 10;
}

/**
 * Create a notification
 */
async function createNotification({ websiteId, scheduleId, articleId, type, title, message }) {
  try {
    await sql`
      INSERT INTO drip_feed_notifications (website_id, schedule_id, article_id, type, title, message, notify_at)
      VALUES (${websiteId}, ${scheduleId}, ${articleId}, ${type}, ${title}, ${message}, NOW())
    `;
  } catch (error) {
    console.error('[Drip Feed Scheduler] Error creating notification:', error);
  }
}

/**
 * Check for pending notifications and mark them as sent
 * (The frontend polls /api/drip-feed/notifications/pending to get these)
 */
async function checkPendingNotifications() {
  if (!isDatabaseEnabled()) return;

  try {
    // Check for meta_not_chosen notifications that need to be created
    const now = new Date();
    const upcomingArticles = await sql`
      SELECT s.*, a.keyword, a.selected_meta_title, ds.notification_hours
      FROM drip_feed_schedules s
      JOIN articles a ON s.article_id = a.id
      LEFT JOIN drip_feed_settings ds ON s.website_id = ds.website_id
      WHERE s.status = 'pending'
        AND a.selected_meta_title IS NULL
        AND (s.scheduled_date || ' ' || s.scheduled_time)::timestamp > NOW()
        AND (s.scheduled_date || ' ' || s.scheduled_time)::timestamp <= NOW() + interval '24 hours'
    `;

    for (const article of upcomingArticles) {
      const scheduledTime = new Date(`${article.scheduled_date}T${article.scheduled_time}`);
      const hoursUntilPublish = (scheduledTime - now) / (1000 * 60 * 60);

      const notificationHours = article.notification_hours || [24, 12, 6, 3];

      for (const hours of notificationHours) {
        if (hoursUntilPublish <= hours && hoursUntilPublish > hours - 1) {
          // Check if we already sent this notification
          const existing = await sql`
            SELECT id FROM drip_feed_notifications
            WHERE schedule_id = ${article.id}
              AND type = 'meta_not_chosen'
              AND title LIKE ${'%' + hours + ' hour%'}
          `;

          if (existing.length === 0) {
            await createNotification({
              websiteId: article.website_id,
              scheduleId: article.id,
              articleId: article.article_id,
              type: 'meta_not_chosen',
              title: `${hours} hour warning: ${article.keyword}`,
              message: `Article "${article.keyword}" is scheduled to publish in ${hours} hours but has no meta title selected.`
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[Drip Feed Scheduler] Error checking notifications:', error);
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    enabled: schedulerEnabled,
    isRunning,
    lastRun
  };
}

/**
 * Enable/disable the scheduler
 */
export function setSchedulerEnabled(enabled) {
  schedulerEnabled = enabled;
  console.log(`[Drip Feed Scheduler] ${enabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Force run the scheduler (for manual trigger)
 */
export async function forceRun() {
  console.log('[Drip Feed Scheduler] Manual trigger requested');
  await runDripFeedCycle();
}

export default {
  initDripFeedScheduler,
  getSchedulerStatus,
  setSchedulerEnabled,
  forceRun
};
