/**
 * Parse Apprise-compatible notification URLs into structured service configs.
 *
 * Supported URL formats:
 *   slack://TokenA/TokenB/TokenC/#channel
 *   discord://WebhookID/WebhookToken
 *   tgram://BotToken/ChatID
 *   msteams://TokenA/TokenB/TokenC/TokenD
 *   pover://UserKey@Token
 *   pover://UserKey@Token/Device
 *   ntfy://Topic
 *   ntfy://user:pass@host/Topic
 *   ntfys://Topic  (uses https)
 *   json://host/path
 *   jsons://host/path  (uses https)
 *   form://host/path
 *   forms://host/path  (uses https)
 *   mailto://user:pass@host/to@email.com
 *   mailtos://user:pass@host/to@email.com  (uses TLS)
 */

export type ServiceType =
  | "slack"
  | "discord"
  | "telegram"
  | "msteams"
  | "pushover"
  | "ntfy"
  | "json"
  | "form"
  | "email";

export interface ParsedService {
  type: ServiceType;
  config: Record<string, string | string[] | number | boolean>;
}

export function parseAppriseUrl(raw: string): ParsedService {
  const trimmed = raw.trim();

  // Extract scheme (before ://)
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/{2}(.*)$/);
  if (!schemeMatch) {
    throw new Error(`Invalid Apprise URL: ${trimmed}`);
  }

  const scheme = schemeMatch[1].toLowerCase();
  const rest = schemeMatch[2];

  switch (scheme) {
    case "slack":
      return parseSlack(rest);
    case "discord":
      return parseDiscord(rest);
    case "tgram":
      return parseTelegram(rest);
    case "msteams":
      return parseMsTeams(rest);
    case "pover":
      return parsePushover(rest);
    case "ntfy":
      return parseNtfy(rest, false);
    case "ntfys":
      return parseNtfy(rest, true);
    case "json":
      return parseWebhook(rest, "json", false);
    case "jsons":
      return parseWebhook(rest, "json", true);
    case "form":
      return parseWebhook(rest, "form", false);
    case "forms":
      return parseWebhook(rest, "form", true);
    case "mailto":
      return parseEmail(rest, false);
    case "mailtos":
      return parseEmail(rest, true);
    default:
      throw new Error(`Unsupported service scheme: ${scheme}`);
  }
}

function parseSlack(rest: string): ParsedService {
  // slack://TokenA/TokenB/TokenC/#channel1/#channel2
  // or slack://user@IncomingWebhookURL
  const parts = rest.split("/").filter(Boolean);

  if (parts.length >= 3) {
    const tokenA = parts[0];
    const tokenB = parts[1];
    const tokenC = parts[2];
    const channels = parts
      .slice(3)
      .map((c) => c.replace(/^[#@]/, ""))
      .filter(Boolean);

    return {
      type: "slack",
      config: {
        tokenA,
        tokenB,
        tokenC,
        channels: channels.length > 0 ? channels.join(",") : "",
        mode: "webhook",
      },
    };
  }

  throw new Error(
    "Slack URL requires at least 3 token parts: slack://TokenA/TokenB/TokenC"
  );
}

function parseDiscord(rest: string): ParsedService {
  // discord://WebhookID/WebhookToken
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      "Discord URL requires WebhookID and WebhookToken: discord://WebhookID/WebhookToken"
    );
  }
  return {
    type: "discord",
    config: {
      webhookId: parts[0],
      webhookToken: parts[1],
    },
  };
}

function parseTelegram(rest: string): ParsedService {
  // tgram://BotToken/ChatID1/ChatID2
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      "Telegram URL requires BotToken and at least one ChatID: tgram://BotToken/ChatID"
    );
  }
  return {
    type: "telegram",
    config: {
      botToken: parts[0],
      chatIds: parts.slice(1).join(","),
    },
  };
}

function parseMsTeams(rest: string): ParsedService {
  // msteams://TokenA/TokenB/TokenC/TokenD
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 4) {
    throw new Error(
      "MS Teams URL requires 4 tokens: msteams://TokenA/TokenB/TokenC/TokenD"
    );
  }
  return {
    type: "msteams",
    config: {
      tokenA: parts[0],
      tokenB: parts[1],
      tokenC: parts[2],
      tokenD: parts[3],
    },
  };
}

function parsePushover(rest: string): ParsedService {
  // pover://UserKey@Token or pover://UserKey@Token/Device1/Device2
  const atIdx = rest.indexOf("@");
  if (atIdx === -1) {
    throw new Error("Pushover URL requires UserKey@Token: pover://UserKey@Token");
  }
  const userKey = rest.substring(0, atIdx);
  const afterAt = rest.substring(atIdx + 1);
  const parts = afterAt.split("/").filter(Boolean);
  const token = parts[0];
  const devices = parts.slice(1);

  return {
    type: "pushover",
    config: {
      userKey,
      token,
      devices: devices.join(","),
    },
  };
}

function parseNtfy(rest: string, secure: boolean): ParsedService {
  // ntfy://Topic  (uses ntfy.sh)
  // ntfy://user:pass@host/Topic
  // ntfys://Topic (https)
  const atIdx = rest.indexOf("@");

  if (atIdx !== -1) {
    // Has auth: user:pass@host/topic
    const authPart = rest.substring(0, atIdx);
    const hostAndTopic = rest.substring(atIdx + 1);
    const [user, pass] = authPart.split(":");
    const slashIdx = hostAndTopic.indexOf("/");
    const host = slashIdx !== -1 ? hostAndTopic.substring(0, slashIdx) : hostAndTopic;
    const topic = slashIdx !== -1 ? hostAndTopic.substring(slashIdx + 1) : "";

    return {
      type: "ntfy",
      config: {
        host: `${secure ? "https" : "http"}://${host}`,
        topic,
        user: user || "",
        pass: pass || "",
      },
    };
  }

  // No auth: just topic (uses ntfy.sh) or host/topic
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 1) {
    return {
      type: "ntfy",
      config: {
        host: "https://ntfy.sh",
        topic: parts[0],
        user: "",
        pass: "",
      },
    };
  }

  // host/topic
  const host = parts[0];
  const topic = parts.slice(1).join("/");
  return {
    type: "ntfy",
    config: {
      host: `${secure ? "https" : "http"}://${host}`,
      topic,
      user: "",
      pass: "",
    },
  };
}

function parseWebhook(
  rest: string,
  type: "json" | "form",
  secure: boolean
): ParsedService {
  // json://host:port/path or jsons://host/path
  const proto = secure ? "https" : "http";
  return {
    type,
    config: {
      url: `${proto}://${rest}`,
    },
  };
}

function parseEmail(rest: string, secure: boolean): ParsedService {
  // mailto://user:pass@host/to@email.com?from=from@email.com
  // mailtos://user:pass@host:port/to@email.com
  const atParts = rest.split("@");
  if (atParts.length < 2) {
    throw new Error("Email URL requires user:pass@host format");
  }

  // Parse user:pass
  const userPass = atParts[0];
  const [user, pass] = userPass.split(":");

  // Remaining: host/to@domain or host:port/to@domain
  const remaining = atParts.slice(1).join("@");
  const slashIdx = remaining.indexOf("/");

  let host: string;
  let recipients: string;

  if (slashIdx !== -1) {
    host = remaining.substring(0, slashIdx);
    recipients = remaining.substring(slashIdx + 1);
  } else {
    host = remaining;
    recipients = user ? `${user}@${remaining.split(":")[0]}` : "";
  }

  // Parse port from host
  const [hostname, portStr] = host.split(":");
  const port = portStr ? parseInt(portStr, 10) : secure ? 465 : 587;

  return {
    type: "email",
    config: {
      host: hostname,
      port,
      secure,
      user: decodeURIComponent(user || ""),
      pass: decodeURIComponent(pass || ""),
      to: decodeURIComponent(recipients),
    },
  };
}

/**
 * Parse a comma or space-separated list of Apprise URLs.
 */
export function parseAppriseUrls(urls: string): ParsedService[] {
  return urls
    .split(/[,\s]+/)
    .map((u) => u.trim())
    .filter(Boolean)
    .map(parseAppriseUrl);
}
