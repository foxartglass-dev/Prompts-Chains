/**
 * Drip Feed API Routes
 * Handles scheduling and auto-publishing of articles to WordPress
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// ============================================
// DRIP FEED SETTINGS
// ============================================

// GET settings for a website
router.get('/settings/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    // Get or create settings for this website
    let settings = await sql`
      SELECT * FROM drip_feed_settings WHERE website_id = ${websiteId}
    `;

    if (settings.length === 0) {
      // Create default settings
      settings = await sql`
        INSERT INTO drip_feed_settings (website_id)
        VALUES (${websiteId})
        RETURNING *
      `;
    }

    res.json({ settings: settings[0] });
  } catch (error) {
    console.error('Error fetching drip feed settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update settings for a website
router.put('/settings/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const {
      articles_per_day,
      variance_enabled,
      variance_min,
      variance_max,
      publish_time_start,
      publish_time_end,
      skip_weekdays,
      skip_dates,
      notification_hours,
      first_day_monitor,
      is_enabled
    } = req.body;

    // Upsert settings
    const settings = await sql`
      INSERT INTO drip_feed_settings (
        website_id,
        articles_per_day,
        variance_enabled,
        variance_min,
        variance_max,
        publish_time_start,
        publish_time_end,
        skip_weekdays,
        skip_dates,
        notification_hours,
        first_day_monitor,
        is_enabled,
        updated_at
      ) VALUES (
        ${websiteId},
        ${articles_per_day ?? 7},
        ${variance_enabled ?? true},
        ${variance_min ?? 6},
        ${variance_max ?? 8},
        ${publish_time_start ?? '07:00'},
        ${publish_time_end ?? '19:00'},
        ${JSON.stringify(skip_weekdays ?? [])},
        ${JSON.stringify(skip_dates ?? [])},
        ${JSON.stringify(notification_hours ?? [24, 12, 6])},
        ${first_day_monitor ?? true},
        ${is_enabled ?? false},
        NOW()
      )
      ON CONFLICT (website_id)
      DO UPDATE SET
        articles_per_day = EXCLUDED.articles_per_day,
        variance_enabled = EXCLUDED.variance_enabled,
        variance_min = EXCLUDED.variance_min,
        variance_max = EXCLUDED.variance_max,
        publish_time_start = EXCLUDED.publish_time_start,
        publish_time_end = EXCLUDED.publish_time_end,
        skip_weekdays = EXCLUDED.skip_weekdays,
        skip_dates = EXCLUDED.skip_dates,
        notification_hours = EXCLUDED.notification_hours,
        first_day_monitor = EXCLUDED.first_day_monitor,
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW()
      RETURNING *
    `;

    res.json({ success: true, settings: settings[0] });
  } catch (error) {
    console.error('Error updating drip feed settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SCHEDULE MANAGEMENT (THE HOPPER)
// ============================================

// GET all scheduled articles for a website
router.get('/schedule/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { status } = req.query;

    let schedules;
    if (status) {
      schedules = await sql`
        SELECT s.*, a.keyword, a.selected_meta_title, a.selected_meta_description,
               a.generated_images, a.status as article_status
        FROM drip_feed_schedules s
        JOIN articles a ON s.article_id = a.id
        WHERE s.website_id = ${websiteId} AND s.status = ${status}
        ORDER BY s.scheduled_date, s.scheduled_time
      `;
    } else {
      schedules = await sql`
        SELECT s.*, a.keyword, a.selected_meta_title, a.selected_meta_description,
               a.generated_images, a.status as article_status
        FROM drip_feed_schedules s
        JOIN articles a ON s.article_id = a.id
        WHERE s.website_id = ${websiteId}
        ORDER BY s.scheduled_date, s.scheduled_time
      `;
    }

    // Group by date for easier frontend rendering
    const groupedByDate = {};
    for (const schedule of schedules) {
      const dateKey = schedule.scheduled_date.toISOString().split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(schedule);
    }

    res.json({ schedules, groupedByDate });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST add articles to schedule (batch scheduling)
router.post('/schedule/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { articleIds, startDate } = req.body;

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({ error: 'articleIds array is required' });
    }

    // Get settings for this website
    const settingsResult = await sql`
      SELECT * FROM drip_feed_settings WHERE website_id = ${websiteId}
    `;
    const settings = settingsResult[0] || {
      articles_per_day: 7,
      variance_enabled: true,
      variance_min: 6,
      variance_max: 8,
      publish_time_start: '07:00',
      publish_time_end: '19:00',
      skip_weekdays: [],
      skip_dates: []
    };

    // Generate schedule using the scheduling algorithm
    const schedules = generateSchedule(articleIds, settings, startDate ? new Date(startDate) : new Date());

    // Insert all schedules
    const inserted = [];
    for (const schedule of schedules) {
      try {
        const result = await sql`
          INSERT INTO drip_feed_schedules (
            website_id, article_id, scheduled_date, scheduled_time
          ) VALUES (
            ${websiteId}, ${schedule.articleId}, ${schedule.date}, ${schedule.time}
          )
          ON CONFLICT (article_id) DO UPDATE SET
            scheduled_date = EXCLUDED.scheduled_date,
            scheduled_time = EXCLUDED.scheduled_time,
            status = 'pending',
            updated_at = NOW()
          RETURNING *
        `;
        inserted.push(result[0]);

        // Log the scheduling action
        await sql`
          INSERT INTO drip_feed_log (schedule_id, website_id, article_id, action, details)
          VALUES (${result[0].id}, ${websiteId}, ${schedule.articleId}, 'scheduled', ${JSON.stringify({
            scheduled_date: schedule.date,
            scheduled_time: schedule.time
          })})
        `;
      } catch (err) {
        console.error(`Error scheduling article ${schedule.articleId}:`, err);
      }
    }

    res.json({
      success: true,
      scheduled: inserted.length,
      schedules: inserted
    });
  } catch (error) {
    console.error('Error scheduling articles:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE remove article from schedule
router.delete('/schedule/:websiteId/:scheduleId', requireDb, async (req, res) => {
  try {
    const { websiteId, scheduleId } = req.params;

    const deleted = await sql`
      DELETE FROM drip_feed_schedules
      WHERE id = ${scheduleId} AND website_id = ${websiteId}
      RETURNING *
    `;

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Log the cancellation
    await sql`
      INSERT INTO drip_feed_log (website_id, article_id, action)
      VALUES (${websiteId}, ${deleted[0].article_id}, 'cancelled')
    `;

    res.json({ success: true, deleted: deleted[0] });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update a single schedule (manual time override)
router.put('/schedule/:websiteId/:scheduleId', requireDb, async (req, res) => {
  try {
    const { websiteId, scheduleId } = req.params;
    const { scheduled_date, scheduled_time, is_manual_time } = req.body;

    const updated = await sql`
      UPDATE drip_feed_schedules
      SET
        scheduled_date = COALESCE(${scheduled_date}, scheduled_date),
        scheduled_time = COALESCE(${scheduled_time}, scheduled_time),
        is_manual_time = COALESCE(${is_manual_time}, is_manual_time),
        updated_at = NOW()
      WHERE id = ${scheduleId} AND website_id = ${websiteId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ success: true, schedule: updated[0] });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CALENDAR VIEW
// ============================================

// GET calendar data (schedule counts by date)
router.get('/calendar/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { startDate, endDate } = req.query;

    // Get counts by date
    const counts = await sql`
      SELECT
        scheduled_date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM drip_feed_schedules
      WHERE website_id = ${websiteId}
        AND scheduled_date >= ${startDate || new Date().toISOString().split('T')[0]}
        AND scheduled_date <= ${endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
      GROUP BY scheduled_date
      ORDER BY scheduled_date
    `;

    // Get settings for skip days
    const settings = await sql`
      SELECT skip_weekdays, skip_dates FROM drip_feed_settings WHERE website_id = ${websiteId}
    `;

    res.json({
      counts,
      skipWeekdays: settings[0]?.skip_weekdays || [],
      skipDates: settings[0]?.skip_dates || []
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PUBLISHING ENDPOINTS
// ============================================

// GET articles due for publishing
router.get('/due', requireDb, async (req, res) => {
  try {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    const dueArticles = await sql`
      SELECT s.*, a.keyword, a.final_content, a.selected_meta_title,
             a.selected_meta_description, a.generated_images,
             w.wp_url, w.wp_user, w.wp_app_password, w.seo_plugin
      FROM drip_feed_schedules s
      JOIN articles a ON s.article_id = a.id
      JOIN websites w ON s.website_id = w.id
      WHERE s.status = 'pending'
        AND (s.scheduled_date < ${currentDate}
             OR (s.scheduled_date = ${currentDate} AND s.scheduled_time <= ${currentTime}))
      ORDER BY s.scheduled_date, s.scheduled_time
    `;

    res.json({ dueArticles, count: dueArticles.length });
  } catch (error) {
    console.error('Error fetching due articles:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST process/publish due articles (called by cron)
router.post('/process', requireDb, async (req, res) => {
  try {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    // Get all due articles
    const dueArticles = await sql`
      SELECT s.*, a.keyword, a.final_content, a.selected_meta_title,
             a.selected_meta_description, a.generated_images,
             w.wp_url, w.wp_user, w.wp_app_password, w.seo_plugin,
             w.id as website_id
      FROM drip_feed_schedules s
      JOIN articles a ON s.article_id = a.id
      JOIN websites w ON s.website_id = w.id
      WHERE s.status = 'pending'
        AND (s.scheduled_date < ${currentDate}
             OR (s.scheduled_date = ${currentDate} AND s.scheduled_time <= ${currentTime}))
      ORDER BY s.scheduled_date, s.scheduled_time
      LIMIT 10
    `;

    console.log(`[Drip Feed] Found ${dueArticles.length} articles due for publishing`);

    const results = [];
    for (const article of dueArticles) {
      const result = await publishArticle(article);
      results.push(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      processed: results.length,
      successful,
      failed,
      results
    });
  } catch (error) {
    console.error('Error processing drip feed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATS & DASHBOARD
// ============================================

// GET stats for a website
router.get('/stats/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    const stats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        MIN(scheduled_date) FILTER (WHERE status = 'pending') as next_date,
        MAX(scheduled_date) FILTER (WHERE status = 'pending') as last_date
      FROM drip_feed_schedules
      WHERE website_id = ${websiteId}
    `;

    // Get today's schedule
    const today = new Date().toISOString().split('T')[0];
    const todaySchedule = await sql`
      SELECT s.*, a.keyword
      FROM drip_feed_schedules s
      JOIN articles a ON s.article_id = a.id
      WHERE s.website_id = ${websiteId}
        AND s.scheduled_date = ${today}
      ORDER BY s.scheduled_time
    `;

    // Check for articles needing attention (no meta selected)
    const needsAttention = await sql`
      SELECT COUNT(*) as count
      FROM drip_feed_schedules s
      JOIN articles a ON s.article_id = a.id
      WHERE s.website_id = ${websiteId}
        AND s.status = 'pending'
        AND (a.selected_meta_title IS NULL OR a.selected_meta_description IS NULL)
    `;

    res.json({
      ...stats[0],
      todayCount: todaySchedule.length,
      todaySchedule,
      needsAttention: parseInt(needsAttention[0].count)
    });
  } catch (error) {
    console.error('Error fetching drip feed stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LOG & HISTORY
// ============================================

// GET execution log
router.get('/log/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { limit = 50 } = req.query;

    const logs = await sql`
      SELECT l.*, a.keyword
      FROM drip_feed_log l
      LEFT JOIN articles a ON l.article_id = a.id
      WHERE l.website_id = ${websiteId}
      ORDER BY l.created_at DESC
      LIMIT ${parseInt(limit)}
    `;

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching drip feed log:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEST MODE - Quick scheduling for testing cron job
// ============================================

// POST test schedule - Schedule articles for 1, 2, 3, 4 minutes from now
router.post('/test-schedule/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { articleIds, minutesFromNow = [1, 2, 3, 4] } = req.body;

    if (!articleIds || articleIds.length === 0) {
      return res.status(400).json({ error: 'No articles selected' });
    }

    const results = [];
    const now = new Date();

    for (let i = 0; i < articleIds.length; i++) {
      const articleId = articleIds[i];
      const minutes = minutesFromNow[i] || minutesFromNow[0] || 1;

      // Calculate scheduled time (minutes from now)
      const scheduledTime = new Date(now.getTime() + minutes * 60 * 1000);
      const scheduledDate = scheduledTime.toISOString().split('T')[0];
      const scheduledTimeStr = scheduledTime.toTimeString().split(' ')[0].substring(0, 5);

      try {
        // Delete existing schedule for this article if any
        await sql`DELETE FROM drip_feed_schedules WHERE article_id = ${articleId}`;

        // Create new test schedule
        const schedule = await sql`
          INSERT INTO drip_feed_schedules (
            website_id, article_id, scheduled_date, scheduled_time, status, is_manual_time
          ) VALUES (
            ${websiteId}, ${articleId}, ${scheduledDate}, ${scheduledTimeStr}, 'pending', true
          )
          RETURNING *
        `;

        // Get article keyword for display
        const article = await sql`SELECT keyword FROM articles WHERE id = ${articleId}`;

        results.push({
          articleId,
          keyword: article[0]?.keyword,
          scheduledFor: `${scheduledDate} ${scheduledTimeStr}`,
          minutesFromNow: minutes,
          scheduleId: schedule[0].id,
          success: true
        });

        console.log(`[Test Schedule] Article ${articleId} scheduled for ${minutes} minute(s) from now: ${scheduledDate} ${scheduledTimeStr}`);
      } catch (err) {
        results.push({
          articleId,
          error: err.message,
          success: false
        });
      }
    }

    res.json({
      success: true,
      message: `Scheduled ${results.filter(r => r.success).length} articles for testing`,
      results,
      note: 'Cron runs every 5 minutes. Use "Process Now" to trigger immediately.'
    });
  } catch (error) {
    console.error('Error creating test schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST process-now - Manually trigger the cron job (for testing)
router.post('/process-now', requireDb, async (req, res) => {
  try {
    console.log('[Drip Feed] Manual process triggered');

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    // Get all due articles (same logic as cron)
    const dueArticles = await sql`
      SELECT s.*, a.keyword, a.final_content, a.selected_meta_title,
             a.selected_meta_description, a.generated_images,
             w.wp_url, w.wp_user, w.wp_app_password, w.seo_plugin,
             w.id as website_id
      FROM drip_feed_schedules s
      JOIN articles a ON s.article_id = a.id
      JOIN websites w ON s.website_id = w.id
      WHERE s.status = 'pending'
        AND (s.scheduled_date < ${currentDate}
             OR (s.scheduled_date = ${currentDate} AND s.scheduled_time <= ${currentTime}))
      ORDER BY s.scheduled_date, s.scheduled_time
      LIMIT 10
    `;

    console.log(`[Drip Feed] Found ${dueArticles.length} articles due for publishing`);

    if (dueArticles.length === 0) {
      return res.json({
        processed: 0,
        message: 'No articles due for publishing',
        currentTime: `${currentDate} ${currentTime}`
      });
    }

    const results = [];
    for (const article of dueArticles) {
      const result = await publishArticle(article);
      results.push(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      processed: results.length,
      successful,
      failed,
      results,
      currentTime: `${currentDate} ${currentTime}`
    });
  } catch (error) {
    console.error('Error in manual process:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET test status - Check what's scheduled and when cron will pick it up
router.get('/test-status', requireDb, async (req, res) => {
  try {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    // Get all pending schedules
    const pending = await sql`
      SELECT s.*, a.keyword,
             s.scheduled_date || ' ' || s.scheduled_time as scheduled_datetime
      FROM drip_feed_schedules s
      JOIN articles a ON s.article_id = a.id
      WHERE s.status = 'pending'
      ORDER BY s.scheduled_date, s.scheduled_time
      LIMIT 20
    `;

    // Calculate which are due now
    const dueNow = pending.filter(p => {
      return p.scheduled_date < currentDate ||
             (p.scheduled_date === currentDate && p.scheduled_time <= currentTime);
    });

    res.json({
      currentTime: `${currentDate} ${currentTime}`,
      pendingCount: pending.length,
      dueNowCount: dueNow.length,
      pending: pending.map(p => ({
        id: p.id,
        articleId: p.article_id,
        keyword: p.keyword,
        scheduledFor: `${p.scheduled_date} ${p.scheduled_time}`,
        isDueNow: dueNow.some(d => d.id === p.id)
      })),
      note: 'Cron runs every 5 minutes. Articles with isDueNow=true will be processed on next cron run.'
    });
  } catch (error) {
    console.error('Error fetching test status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NOTIFICATION SETTINGS (Pushover + Email-to-SMS)
// ============================================

// GET notification settings
router.get('/notifications/settings', requireDb, async (req, res) => {
  try {
    const settings = await sql`SELECT * FROM notification_settings WHERE id = 1`;

    if (settings.length === 0) {
      // Create default settings
      const newSettings = await sql`
        INSERT INTO notification_settings (id, pushover_enabled, email_sms_enabled)
        VALUES (1, false, false)
        RETURNING *
      `;
      return res.json({ settings: newSettings[0] });
    }

    res.json({ settings: settings[0] });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update notification settings
router.put('/notifications/settings', requireDb, async (req, res) => {
  try {
    const {
      pushover_enabled,
      pushover_user_keys,  // Array of { key, name, enabled }
      email_sms_enabled,
      email_sms_recipients, // Array of { phone, carrier, name, enabled }
      notify_on_publish,
      notify_on_failure,
      notify_on_missing_meta,
      notify_daily_summary,
      notify_queue_empty
    } = req.body;

    // Ensure settings row exists
    await sql`
      INSERT INTO notification_settings (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `;

    const settings = await sql`
      UPDATE notification_settings
      SET
        pushover_enabled = COALESCE(${pushover_enabled}, pushover_enabled),
        pushover_user_keys = COALESCE(${JSON.stringify(pushover_user_keys)}, pushover_user_keys),
        email_sms_enabled = COALESCE(${email_sms_enabled}, email_sms_enabled),
        email_sms_recipients = COALESCE(${JSON.stringify(email_sms_recipients)}, email_sms_recipients),
        notify_on_publish = COALESCE(${notify_on_publish}, notify_on_publish),
        notify_on_failure = COALESCE(${notify_on_failure}, notify_on_failure),
        notify_on_missing_meta = COALESCE(${notify_on_missing_meta}, notify_on_missing_meta),
        notify_daily_summary = COALESCE(${notify_daily_summary}, notify_daily_summary),
        notify_queue_empty = COALESCE(${notify_queue_empty}, notify_queue_empty),
        updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `;

    res.json({ success: true, settings: settings[0] });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST test Pushover notification
router.post('/notifications/test', requireDb, async (req, res) => {
  try {
    const { userKey } = req.body;

    if (!userKey) {
      return res.status(400).json({ error: 'User key is required' });
    }

    const { sendPushover } = await import('../services/pushover.js');

    const result = await sendPushover({
      message: 'This is a test notification from PromptFlow Drip Feed!',
      title: 'Test Notification',
      userKey
    });

    if (result.skipped) {
      return res.status(400).json({ error: result.reason || 'Notification skipped' });
    }

    res.json({ success: result.success, result });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST test Email-to-SMS notification
router.post('/notifications/test-sms', requireDb, async (req, res) => {
  try {
    const { phone, carrier } = req.body;

    if (!phone || !carrier) {
      return res.status(400).json({ error: 'Phone number and carrier are required' });
    }

    const { sendSms } = await import('../services/email-sms.js');

    const result = await sendSms({
      message: 'Test from PromptFlow Drip Feed!',
      recipients: [{ phone, carrier, enabled: true }]
    });

    if (result.skipped) {
      return res.status(400).json({ error: result.reason || 'SMS skipped' });
    }

    res.json({ success: result.success, result });
  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET supported carriers for Email-to-SMS
router.get('/notifications/carriers', (req, res) => {
  const carriers = [
    { id: 'verizon', name: 'Verizon' },
    { id: 'att', name: 'AT&T' },
    { id: 'tmobile', name: 'T-Mobile' },
    { id: 'sprint', name: 'Sprint' },
    { id: 'uscellular', name: 'US Cellular' },
    { id: 'boost', name: 'Boost Mobile' },
    { id: 'cricket', name: 'Cricket' },
    { id: 'metropcs', name: 'MetroPCS' },
    { id: 'googlefi', name: 'Google Fi' },
    { id: 'mint', name: 'Mint Mobile' },
    { id: 'visible', name: 'Visible' }
  ];
  res.json({ carriers });
});

// GET pending notifications
router.get('/notifications/pending', requireDb, async (req, res) => {
  try {
    const now = new Date();

    const notifications = await sql`
      SELECT n.*, a.keyword, s.scheduled_date, s.scheduled_time
      FROM drip_feed_notifications n
      LEFT JOIN articles a ON n.article_id = a.id
      LEFT JOIN drip_feed_schedules s ON n.schedule_id = s.id
      WHERE n.status = 'pending'
        AND n.notify_at <= ${now}
        AND (n.snooze_until IS NULL OR n.snooze_until <= ${now})
      ORDER BY n.notify_at
    `;

    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching pending notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST dismiss notification
router.post('/notifications/:id/dismiss', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    await sql`
      UPDATE drip_feed_notifications
      SET status = 'dismissed', dismissed_at = NOW()
      WHERE id = ${id}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error dismissing notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST snooze notification
router.post('/notifications/:id/snooze', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { minutes = 30 } = req.body;

    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);

    await sql`
      UPDATE drip_feed_notifications
      SET snooze_until = ${snoozeUntil}
      WHERE id = ${id}
    `;

    res.json({ success: true, snoozeUntil });
  } catch (error) {
    console.error('Error snoozing notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate schedule for articles based on settings
 */
function generateSchedule(articleIds, settings, startDate) {
  const schedules = [];
  let currentDate = new Date(startDate);
  let remainingArticles = [...articleIds];

  // Parse skip settings
  const skipWeekdays = settings.skip_weekdays || [];
  const skipDates = (settings.skip_dates || []).map(d => d.split('T')[0]);

  while (remainingArticles.length > 0) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();

    // Check if we should skip this day
    const isSkippedWeekday = skipWeekdays.includes(dayOfWeek);
    const isSkippedDate = skipDates.includes(dateStr);

    if (!isSkippedWeekday && !isSkippedDate) {
      // Determine how many articles for today
      let todayCount = settings.articles_per_day;
      if (settings.variance_enabled) {
        const min = settings.variance_min;
        const max = settings.variance_max;
        todayCount = Math.floor(Math.random() * (max - min + 1)) + min;
      }

      // Don't schedule more than we have
      todayCount = Math.min(todayCount, remainingArticles.length);

      // Generate random times within the publish window
      const times = generateRandomTimes(
        todayCount,
        settings.publish_time_start || '07:00',
        settings.publish_time_end || '19:00'
      );

      // Assign articles to times
      for (let i = 0; i < todayCount; i++) {
        const articleId = remainingArticles.shift();
        schedules.push({
          articleId,
          date: dateStr,
          time: times[i]
        });
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);

    // Safety: don't loop forever
    if (schedules.length > 1000) break;
  }

  return schedules;
}

/**
 * Generate random times within a window
 */
function generateRandomTimes(count, startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const range = endMinutes - startMinutes;

  const times = [];
  for (let i = 0; i < count; i++) {
    const randomMinutes = startMinutes + Math.floor(Math.random() * range);
    const hour = Math.floor(randomMinutes / 60);
    const min = randomMinutes % 60;
    times.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
  }

  // Sort times chronologically
  return times.sort();
}

/**
 * Publish a single article to WordPress
 * This follows the Images → Page → Meta order
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

    // Check if meta is selected
    if (!article.selected_meta_title) {
      throw new Error('Meta title not selected');
    }

    console.log(`[Drip Feed] Publishing article: ${article.keyword}`);

    // Import the publish function from elementor routes
    const { default: fetch } = await import('node-fetch');

    // Step 1: Push images (if any)
    const hasImages = article.generated_images && article.generated_images.length > 0;
    if (hasImages) {
      console.log(`[Drip Feed] Step 1: Uploading ${article.generated_images.length} images...`);
      // Images are uploaded as part of the page creation in our system
    }

    // Step 2: Create the page
    console.log(`[Drip Feed] Step 2: Creating WordPress page...`);

    // We need to call our own API endpoint for this
    // In production, you'd directly call the publishing function
    const publishResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/elementor/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wpUrl: article.wp_url,
        wpUser: article.wp_user,
        wpPassword: article.wp_app_password,
        title: article.keyword,
        content: article.final_content,
        status: 'publish', // Publish immediately (not draft)
        articleId: articleId
      })
    });

    const publishData = await publishResponse.json();

    if (!publishData.success) {
      throw new Error(publishData.error || 'Failed to publish page');
    }

    const wpPostId = publishData.page.id;
    const wpPostUrl = publishData.page.link;

    // Step 3: Push meta to SEO plugin
    console.log(`[Drip Feed] Step 3: Pushing meta to ${article.seo_plugin || 'rankmath'}...`);

    const metaResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/seo/push-direct`, {
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

    // Update schedule as published
    await sql`
      UPDATE drip_feed_schedules
      SET status = 'published', published_at = NOW(), wp_post_id = ${wpPostId}, wp_post_url = ${wpPostUrl}
      WHERE id = ${scheduleId}
    `;

    // Log success
    await sql`
      INSERT INTO drip_feed_log (schedule_id, website_id, article_id, action, details)
      VALUES (${scheduleId}, ${article.website_id}, ${articleId}, 'published', ${JSON.stringify({
        wp_post_id: wpPostId,
        wp_post_url: wpPostUrl
      })})
    `;

    console.log(`[Drip Feed] ✅ Successfully published: ${article.keyword}`);

    // Send Pushover notification on success (if enabled)
    await sendNotificationIfEnabled('published', {
      keyword: article.keyword,
      url: wpPostUrl
    });

    return {
      success: true,
      articleId,
      keyword: article.keyword,
      wpPostId,
      wpPostUrl
    };

  } catch (error) {
    console.error(`[Drip Feed] ❌ Failed to publish ${article.keyword}:`, error.message);

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
    await sql`
      INSERT INTO drip_feed_notifications (website_id, schedule_id, article_id, type, title, message, notify_at)
      VALUES (
        ${article.website_id},
        ${scheduleId},
        ${articleId},
        'publish_failed',
        ${'Publish Failed: ' + article.keyword},
        ${error.message},
        NOW()
      )
    `;

    // Send Pushover notification on failure (if enabled)
    await sendNotificationIfEnabled('failed', {
      keyword: article.keyword,
      error: error.message
    });

    return {
      success: false,
      articleId,
      keyword: article.keyword,
      error: error.message
    };
  }
}

/**
 * Send Pushover notification if enabled
 */
async function sendNotificationIfEnabled(type, data) {
  try {
    // Get notification settings
    const settings = await sql`SELECT * FROM notification_settings WHERE id = 1`;
    const config = settings[0];

    if (!config || !config.pushover_enabled) {
      return; // Notifications not enabled
    }

    // Check if this notification type is enabled
    const typeMap = {
      published: 'notify_on_publish',
      failed: 'notify_on_failure',
      no_meta: 'notify_on_missing_meta',
      daily_summary: 'notify_daily_summary',
      queue_empty: 'notify_queue_empty'
    };

    const settingKey = typeMap[type];
    if (settingKey && config[settingKey] === false) {
      return; // This notification type is disabled
    }

    // Get enabled user keys
    const userKeys = (config.pushover_user_keys || [])
      .filter(u => u.enabled !== false)
      .map(u => u.key);

    if (userKeys.length === 0) {
      return; // No user keys configured
    }

    // Send the notification
    const { notifyDripFeed } = await import('../services/pushover.js');
    await notifyDripFeed(type, data, userKeys);

  } catch (error) {
    console.error('[Drip Feed] Error sending notification:', error.message);
    // Don't throw - notifications failing shouldn't break the publish flow
  }
}

export default router;
