/**
 * Notification dispatcher — detects service from URL and sends.
 * Accepts both raw webhook URLs and Apprise-style URLs.
 */

import { parseAppriseUrls } from "./parser";
import {
  sendToService,
  sendToWebhookUrl,
  type NotifyOptions,
  type NotifyResult,
} from "./services";

export interface DispatchResult {
  sent: number;
  failed: number;
  results: NotifyResult[];
}

/**
 * Detect if a URL is a raw webhook URL (https://...) or an Apprise-scheme URL.
 * Raw webhook URLs are auto-detected by hostname.
 */
function isRawUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export async function dispatch(
  urls: string,
  opts: NotifyOptions
): Promise<DispatchResult> {
  const urlList = urls
    .split(/[,\s]+/)
    .map((u) => u.trim())
    .filter(Boolean);

  if (urlList.length === 0) {
    return { sent: 0, failed: 0, results: [] };
  }

  const rawUrls = urlList.filter(isRawUrl);
  const appriseUrls = urlList.filter((u) => !isRawUrl(u));

  // Send to raw webhook URLs (auto-detect service)
  const rawResults = await Promise.all(
    rawUrls.map((url) => sendToWebhookUrl(url, opts))
  );

  // Send to Apprise-scheme URLs
  let appriseResults: NotifyResult[] = [];
  if (appriseUrls.length > 0) {
    try {
      const services = parseAppriseUrls(appriseUrls.join(","));
      appriseResults = await Promise.all(
        services.map((svc) => sendToService(svc, opts))
      );
    } catch (err) {
      appriseResults = [
        { service: "apprise", success: false, detail: String(err) },
      ];
    }
  }

  const results = [...rawResults, ...appriseResults];
  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return { sent, failed, results };
}

/**
 * List of supported services with setup instructions.
 */
export const SUPPORTED_SERVICES = [
  {
    name: "Slack",
    accepts: "Raw webhook URL or slack://TokenA/TokenB/TokenC",
    setup: [
      "1. Go to https://api.slack.com/apps and create an app (or use existing)",
      "2. Enable 'Incoming Webhooks' in the app settings",
      "3. Click 'Add New Webhook to Workspace' and select a channel",
      "4. Copy the webhook URL (looks like https://hooks.slack.com/services/T.../B.../xxx)",
      "5. Paste the full URL into send_notification",
    ],
  },
  {
    name: "Discord",
    accepts: "Raw webhook URL or discord://WebhookID/WebhookToken",
    setup: [
      "1. Open Discord and go to the channel you want notifications in",
      "2. Click the gear icon (Edit Channel) > Integrations > Webhooks",
      "3. Click 'New Webhook', name it, then click 'Copy Webhook URL'",
      "4. Paste the full URL (looks like https://discord.com/api/webhooks/123/abc)",
    ],
  },
  {
    name: "Microsoft Teams",
    accepts: "Raw workflow webhook URL",
    setup: [
      "1. In Teams, go to the channel where you want notifications",
      "2. Click '...' > Workflows > 'Post to a channel when a webhook request is received'",
      "3. Name the workflow and select the channel",
      "4. Copy the webhook URL provided",
      "5. Paste the full URL into send_notification",
      "",
      "Note: The old 'Incoming Webhook' connector is deprecated.",
      "Use Power Automate / Workflows instead.",
    ],
  },
  {
    name: "Telegram",
    accepts: "tgram://BotToken/ChatID",
    setup: [
      "1. Message @BotFather on Telegram and send /newbot",
      "2. Follow prompts to name your bot — you'll receive a Bot Token",
      "3. Message @userinfobot to get your Chat ID (or use group chat ID)",
      "4. Use: tgram://YOUR_BOT_TOKEN/YOUR_CHAT_ID",
    ],
  },
  {
    name: "Pushover",
    accepts: "pover://UserKey@AppToken",
    setup: [
      "1. Sign up at https://pushover.net/",
      "2. Your User Key is shown on the dashboard",
      "3. Create an Application to get an App Token",
      "4. Use: pover://YOUR_USER_KEY@YOUR_APP_TOKEN",
    ],
  },
  {
    name: "Ntfy",
    accepts: "Raw ntfy URL or ntfy://Topic",
    setup: [
      "1. Pick a topic name (e.g. 'my-alerts')",
      "2. Subscribe on your phone: install ntfy app and subscribe to the topic",
      "3. Use: ntfy://my-alerts (sends to ntfy.sh)",
      "4. Or use full URL: https://ntfy.sh/my-alerts",
      "5. For self-hosted: ntfys://user:pass@your-server.com/topic",
    ],
  },
  {
    name: "Generic Webhook",
    accepts: "Any https:// URL",
    setup: [
      "Any URL that accepts POST requests will work.",
      "JSON payload: { title, body, type, format }",
      "Or use Apprise format: json://host/path, form://host/path",
    ],
  },
  {
    name: "Email",
    accepts: "mailtos://user:pass@smtp-host/to@example.com",
    setup: [
      "1. You need SMTP credentials (e.g. Gmail app password, SendGrid, etc.)",
      "2. For Gmail: enable 2FA, create an App Password at https://myaccount.google.com/apppasswords",
      "3. Use: mailtos://you%40gmail.com:app-password@smtp.gmail.com/recipient@example.com",
      "4. URL-encode the @ in your email as %40",
    ],
  },
];
