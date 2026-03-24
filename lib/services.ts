/**
 * Native notification service implementations.
 * Each function sends a notification directly via the service's API.
 */

import type { ParsedService } from "./parser";

export interface NotifyOptions {
  body: string;
  title?: string;
  type?: "info" | "success" | "warning" | "failure";
  format?: "text" | "markdown" | "html";
}

export interface NotifyResult {
  service: string;
  success: boolean;
  detail?: string;
}

/**
 * Send to a raw webhook URL (https://...).
 * Auto-detects the service from the hostname and sends in the appropriate format.
 */
export async function sendToWebhookUrl(
  rawUrl: string,
  opts: NotifyOptions
): Promise<NotifyResult> {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    // Slack
    if (host === "hooks.slack.com") {
      const payload: Record<string, unknown> = { text: formatMessage(opts) };
      const res = await fetch(rawUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return {
        service: "slack",
        success: res.ok,
        detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
      };
    }

    // Discord
    if (host === "discord.com" || host === "discordapp.com") {
      const payload: Record<string, unknown> = {};
      if (opts.title) {
        payload.embeds = [
          {
            title: opts.title,
            description: opts.body,
            color: typeToColor(opts.type),
          },
        ];
      } else {
        payload.content = opts.body;
      }
      const res = await fetch(rawUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return {
        service: "discord",
        success: res.ok || res.status === 204,
        detail: res.ok || res.status === 204 ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
      };
    }

    // Microsoft Teams (Power Automate workflow webhooks)
    if (
      host.includes(".webhook.office.com") ||
      host.includes(".logic.azure.com") ||
      host.includes("prod-") // Power Automate URLs like prod-XX.westus.logic.azure.com
    ) {
      const payload = {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [
                ...(opts.title
                  ? [
                      {
                        type: "TextBlock",
                        text: opts.title,
                        weight: "Bolder",
                        size: "Medium",
                      },
                    ]
                  : []),
                {
                  type: "TextBlock",
                  text: opts.body,
                  wrap: true,
                },
              ],
            },
          },
        ],
      };
      const res = await fetch(rawUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return {
        service: "msteams",
        success: res.ok || res.status === 202,
        detail:
          res.ok || res.status === 202
            ? "Sent"
            : `HTTP ${res.status}: ${await res.text()}`,
      };
    }

    // Ntfy
    if (host === "ntfy.sh" || host.includes("ntfy")) {
      const headers: Record<string, string> = {};
      if (opts.title) headers["X-Title"] = opts.title;
      if (opts.type) {
        const tagMap: Record<string, string> = {
          info: "information_source",
          success: "white_check_mark",
          warning: "warning",
          failure: "x",
        };
        headers["X-Tags"] = tagMap[opts.type] || "";
      }
      if (opts.format === "markdown") headers["X-Markdown"] = "yes";
      const res = await fetch(rawUrl, { method: "POST", headers, body: opts.body });
      return {
        service: "ntfy",
        success: res.ok,
        detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
      };
    }

    // Generic webhook — POST JSON
    const payload = {
      title: opts.title || "",
      body: opts.body,
      type: opts.type || "info",
    };
    const res = await fetch(rawUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return {
      service: "webhook",
      success: res.ok,
      detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
    };
  } catch (err) {
    return {
      service: "webhook",
      success: false,
      detail: String(err),
    };
  }
}

export async function sendToService(
  parsed: ParsedService,
  opts: NotifyOptions
): Promise<NotifyResult> {
  try {
    switch (parsed.type) {
      case "slack":
        return await sendSlack(parsed.config, opts);
      case "discord":
        return await sendDiscord(parsed.config, opts);
      case "telegram":
        return await sendTelegram(parsed.config, opts);
      case "msteams":
        return await sendMsTeams(parsed.config, opts);
      case "pushover":
        return await sendPushover(parsed.config, opts);
      case "ntfy":
        return await sendNtfy(parsed.config, opts);
      case "json":
        return await sendJsonWebhook(parsed.config, opts);
      case "form":
        return await sendFormWebhook(parsed.config, opts);
      case "email":
        return await sendEmail(parsed.config, opts);
      default:
        return { service: parsed.type, success: false, detail: "Unsupported service" };
    }
  } catch (err) {
    return {
      service: parsed.type,
      success: false,
      detail: String(err),
    };
  }
}

// ─── Slack ───────────────────────────────────────────────────────────────────

async function sendSlack(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  const { tokenA, tokenB, tokenC } = config as Record<string, string>;
  const webhookUrl = `https://hooks.slack.com/services/${tokenA}/${tokenB}/${tokenC}`;

  const payload: Record<string, unknown> = { text: formatMessage(opts) };
  if (config.channels) {
    payload.channel = `#${(config.channels as string).split(",")[0]}`;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    service: "slack",
    success: res.ok,
    detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
  };
}

// ─── Discord ─────────────────────────────────────────────────────────────────

async function sendDiscord(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  const { webhookId, webhookToken } = config as Record<string, string>;
  const url = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}`;

  const payload: Record<string, unknown> = {
    content: formatMessage(opts),
  };

  if (opts.title) {
    payload.embeds = [
      {
        title: opts.title,
        description: opts.body,
        color: typeToColor(opts.type),
      },
    ];
    delete payload.content;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    service: "discord",
    success: res.ok || res.status === 204,
    detail: res.ok || res.status === 204 ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
  };
}

// ─── Telegram ────────────────────────────────────────────────────────────────

async function sendTelegram(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  const { botToken, chatIds } = config as Record<string, string>;
  const ids = chatIds.split(",").filter(Boolean);
  const results: string[] = [];
  let allOk = true;

  const parseMode =
    opts.format === "html"
      ? "HTML"
      : opts.format === "markdown"
        ? "MarkdownV2"
        : undefined;

  for (const chatId of ids) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: formatMessage(opts),
    };
    if (parseMode) payload.parse_mode = parseMode;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      allOk = false;
      results.push(`${chatId}: HTTP ${res.status}`);
    } else {
      results.push(`${chatId}: Sent`);
    }
  }

  return {
    service: "telegram",
    success: allOk,
    detail: results.join("; "),
  };
}

// ─── Microsoft Teams ─────────────────────────────────────────────────────────

async function sendMsTeams(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  const { tokenA, tokenB, tokenC, tokenD } = config as Record<string, string>;
  const url = `https://${tokenA}.webhook.office.com/webhookb2/${tokenB}/IncomingWebhook/${tokenC}/${tokenD}`;

  const payload = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: opts.title || "Notification",
    themeColor: typeToHex(opts.type),
    title: opts.title || "",
    text: opts.body,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    service: "msteams",
    success: res.ok,
    detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
  };
}

// ─── Pushover ────────────────────────────────────────────────────────────────

async function sendPushover(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  const { userKey, token, devices } = config as Record<string, string>;

  const form = new URLSearchParams();
  form.set("token", token);
  form.set("user", userKey);
  form.set("message", opts.body);
  if (opts.title) form.set("title", opts.title);
  if (devices) form.set("device", devices);

  const priority = opts.type === "failure" ? "1" : opts.type === "warning" ? "0" : "-1";
  form.set("priority", priority);

  if (opts.format === "html") form.set("html", "1");

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    body: form,
  });

  return {
    service: "pushover",
    success: res.ok,
    detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
  };
}

// ─── Ntfy ────────────────────────────────────────────────────────────────────

async function sendNtfy(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  const { host, topic, user, pass } = config as Record<string, string>;
  const url = `${host}/${topic}`;

  const headers: Record<string, string> = {};
  if (opts.title) headers["X-Title"] = opts.title;
  if (opts.type) {
    const tagMap: Record<string, string> = {
      info: "information_source",
      success: "white_check_mark",
      warning: "warning",
      failure: "x",
    };
    headers["X-Tags"] = tagMap[opts.type] || "";
  }
  if (opts.format === "markdown") headers["X-Markdown"] = "yes";

  if (user && pass) {
    headers["Authorization"] =
      "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: opts.body,
  });

  return {
    service: "ntfy",
    success: res.ok,
    detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
  };
}

// ─── JSON Webhook ────────────────────────────────────────────────────────────

async function sendJsonWebhook(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  const { url } = config as Record<string, string>;

  const payload = {
    title: opts.title || "",
    body: opts.body,
    type: opts.type || "info",
    format: opts.format || "text",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    service: "json webhook",
    success: res.ok,
    detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
  };
}

// ─── Form Webhook ────────────────────────────────────────────────────────────

async function sendFormWebhook(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  const { url } = config as Record<string, string>;

  const form = new URLSearchParams();
  if (opts.title) form.set("title", opts.title);
  form.set("body", opts.body);
  form.set("type", opts.type || "info");

  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  return {
    service: "form webhook",
    success: res.ok,
    detail: res.ok ? "Sent" : `HTTP ${res.status}: ${await res.text()}`,
  };
}

// ─── Email (SMTP via nodemailer) ─────────────────────────────────────────────

async function sendEmail(
  config: Record<string, unknown>,
  opts: NotifyOptions
): Promise<NotifyResult> {
  try {
    const nodemailer = await import("nodemailer");

    const { host, port, secure, user, pass, to } = config as Record<
      string,
      string | number | boolean
    >;

    const transporter = nodemailer.default.createTransport({
      host: host as string,
      port: port as number,
      secure: secure as boolean,
      auth: {
        user: user as string,
        pass: pass as string,
      },
    });

    const info = await transporter.sendMail({
      from: user as string,
      to: to as string,
      subject: opts.title || "Notification",
      ...(opts.format === "html" ? { html: opts.body } : { text: opts.body }),
    });

    return {
      service: "email",
      success: true,
      detail: `Message sent: ${info.messageId}`,
    };
  } catch (err) {
    return {
      service: "email",
      success: false,
      detail: `Email sending failed: ${String(err)}`,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMessage(opts: NotifyOptions): string {
  if (opts.title) {
    return `${opts.title}\n${opts.body}`;
  }
  return opts.body;
}

function typeToColor(type?: string): number {
  switch (type) {
    case "success":
      return 0x2ecc71;
    case "warning":
      return 0xf1c40f;
    case "failure":
      return 0xe74c3c;
    default:
      return 0x3498db;
  }
}

function typeToHex(type?: string): string {
  switch (type) {
    case "success":
      return "2ecc71";
    case "warning":
      return "f1c40f";
    case "failure":
      return "e74c3c";
    default:
      return "3498db";
  }
}
