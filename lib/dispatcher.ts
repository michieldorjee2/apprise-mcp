/**
 * Notification dispatcher — parses Apprise URLs and sends to all targets.
 */

import { parseAppriseUrls } from "./parser";
import { sendToService, type NotifyOptions, type NotifyResult } from "./services";

export interface DispatchResult {
  sent: number;
  failed: number;
  results: NotifyResult[];
}

export async function dispatch(
  urls: string,
  opts: NotifyOptions
): Promise<DispatchResult> {
  const services = parseAppriseUrls(urls);

  if (services.length === 0) {
    return { sent: 0, failed: 0, results: [] };
  }

  // Send to all services in parallel
  const results = await Promise.all(
    services.map((svc) => sendToService(svc, opts))
  );

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return { sent, failed, results };
}

/**
 * List of natively supported services with their URL format.
 */
export const SUPPORTED_SERVICES = [
  {
    name: "Slack",
    scheme: "slack",
    format: "slack://TokenA/TokenB/TokenC/#channel",
    description:
      "Send via Slack incoming webhook. Get tokens from https://api.slack.com/messaging/webhooks",
  },
  {
    name: "Discord",
    scheme: "discord",
    format: "discord://WebhookID/WebhookToken",
    description:
      "Send via Discord webhook. Create one in Server Settings > Integrations > Webhooks",
  },
  {
    name: "Telegram",
    scheme: "tgram",
    format: "tgram://BotToken/ChatID",
    description:
      "Send via Telegram Bot API. Create a bot with @BotFather, get chat ID from @userinfobot",
  },
  {
    name: "Microsoft Teams",
    scheme: "msteams",
    format: "msteams://TokenA/TokenB/TokenC/TokenD",
    description:
      "Send via MS Teams incoming webhook connector",
  },
  {
    name: "Pushover",
    scheme: "pover",
    format: "pover://UserKey@AppToken",
    description:
      "Send via Pushover. Get keys from https://pushover.net/",
  },
  {
    name: "Ntfy",
    scheme: "ntfy / ntfys",
    format: "ntfy://Topic or ntfys://user:pass@host/Topic",
    description:
      "Send via ntfy.sh (or self-hosted ntfy). ntfys:// uses HTTPS",
  },
  {
    name: "JSON Webhook",
    scheme: "json / jsons",
    format: "json://host/path or jsons://host/path",
    description:
      "POST JSON payload to any URL. jsons:// uses HTTPS",
  },
  {
    name: "Form Webhook",
    scheme: "form / forms",
    format: "form://host/path or forms://host/path",
    description:
      "POST form-encoded payload to any URL. forms:// uses HTTPS",
  },
  {
    name: "Email",
    scheme: "mailto / mailtos",
    format: "mailtos://user:pass@smtp-host/to@example.com",
    description:
      "Send email via SMTP. mailtos:// uses TLS. Uses nodemailer",
  },
];
