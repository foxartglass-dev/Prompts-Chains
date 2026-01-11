/**
 * Email-to-SMS Notification Service
 *
 * Sends SMS messages via carrier email gateways.
 * This is FREE - carriers provide email-to-SMS gateways.
 *
 * Each carrier has an email gateway:
 * - Verizon: number@vtext.com
 * - AT&T: number@txt.att.net
 * - T-Mobile: number@tmomail.net
 * - Sprint: number@messaging.sprintpcs.com
 * - etc.
 *
 * Just send an email to the gateway address and it arrives as an SMS.
 * Requires SMTP credentials (Gmail, SendGrid, etc.)
 */

import nodemailer from 'nodemailer';

// Carrier gateway domains
export const Carriers = {
  verizon: { domain: 'vtext.com', name: 'Verizon' },
  att: { domain: 'txt.att.net', name: 'AT&T' },
  tmobile: { domain: 'tmomail.net', name: 'T-Mobile' },
  sprint: { domain: 'messaging.sprintpcs.com', name: 'Sprint' },
  uscellular: { domain: 'email.uscc.net', name: 'US Cellular' },
  boost: { domain: 'sms.myboostmobile.com', name: 'Boost Mobile' },
  cricket: { domain: 'sms.cricketwireless.net', name: 'Cricket' },
  metropcs: { domain: 'mymetropcs.com', name: 'MetroPCS' },
  googlefi: { domain: 'msg.fi.google.com', name: 'Google Fi' },
  mint: { domain: 'tmomail.net', name: 'Mint Mobile' }, // Uses T-Mobile network
  visible: { domain: 'vtext.com', name: 'Visible' },    // Uses Verizon network
};

// Create transporter (cached)
let transporter = null;

/**
 * Initialize the email transporter
 * Call this once at startup or on first use
 */
function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('Email-SMS: SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporter;
}

/**
 * Build the SMS email address from phone number and carrier
 * @param {string} phoneNumber - 10-digit phone number (no dashes/spaces)
 * @param {string} carrier - Carrier key from Carriers object
 * @returns {string} Email address (e.g., "5551234567@vtext.com")
 */
export function buildSmsEmail(phoneNumber, carrier) {
  // Clean the phone number - remove all non-digits
  const cleanNumber = phoneNumber.replace(/\D/g, '');

  // Handle country code
  const number = cleanNumber.length === 11 && cleanNumber.startsWith('1')
    ? cleanNumber.slice(1)
    : cleanNumber;

  if (number.length !== 10) {
    throw new Error(`Invalid phone number: ${phoneNumber}. Must be 10 digits.`);
  }

  const carrierInfo = Carriers[carrier.toLowerCase()];
  if (!carrierInfo) {
    throw new Error(`Unknown carrier: ${carrier}. Valid: ${Object.keys(Carriers).join(', ')}`);
  }

  return `${number}@${carrierInfo.domain}`;
}

/**
 * Send an SMS via email gateway
 *
 * @param {Object} options
 * @param {string} options.message - The SMS message (keep under 160 chars for best results)
 * @param {string|Array} options.recipients - Array of { phone, carrier, name, enabled }
 * @returns {Promise<Object>} Result with success/failure details
 */
export async function sendSms(options) {
  const { message, recipients } = options;

  if (!message) {
    throw new Error('Message is required');
  }

  const transport = getTransporter();
  if (!transport) {
    return { skipped: true, reason: 'SMTP not configured' };
  }

  const recipientList = Array.isArray(recipients) ? recipients : [recipients];
  const enabledRecipients = recipientList.filter(r => r && r.enabled !== false);

  if (enabledRecipients.length === 0) {
    return { skipped: true, reason: 'No enabled recipients' };
  }

  const results = [];

  for (const recipient of enabledRecipients) {
    try {
      const toEmail = buildSmsEmail(recipient.phone, recipient.carrier);

      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: toEmail,
        subject: '', // No subject for SMS
        text: message.slice(0, 160) // SMS limit
      });

      results.push({
        phone: recipient.phone,
        name: recipient.name,
        success: true
      });
    } catch (error) {
      results.push({
        phone: recipient.phone,
        name: recipient.name,
        success: false,
        error: error.message
      });
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
 * Send a drip feed notification via SMS
 */
export async function notifyDripFeedSms(type, data, recipients) {
  if (!recipients || recipients.length === 0) {
    return { skipped: true };
  }

  // SMS messages are short - keep under 160 chars
  const messages = {
    published: `Published: "${data.keyword?.slice(0, 50)}"`,
    failed: `FAILED: "${data.keyword?.slice(0, 40)}" - ${data.error?.slice(0, 50) || 'Error'}`,
    no_meta: `Missing meta for "${data.keyword?.slice(0, 50)}" - add before publish`,
    daily_summary: `Drip Feed: ${data.published} published, ${data.failed} failed, ${data.pending} pending`,
    queue_empty: `Drip Feed queue empty - add more articles`
  };

  const message = messages[type];
  if (!message) {
    console.warn(`Email-SMS: Unknown notification type "${type}"`);
    return { skipped: true, reason: 'Unknown type' };
  }

  return sendSms({ message, recipients });
}

export default { sendSms, notifyDripFeedSms, buildSmsEmail, Carriers };
