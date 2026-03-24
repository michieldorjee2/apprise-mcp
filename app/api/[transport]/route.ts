import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

async function appriseFetch(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<{ content: { type: "text"; text: string }[] }> {
  const baseUrl = process.env.APPRISE_API_URL || "http://apprise:8000";

  try {
    const url = `${baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { Accept: "application/json" },
    };

    if (method === "POST" && body) {
      options.headers = {
        ...options.headers,
        "Content-Type": "application/json",
      };
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    let data: unknown;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Apprise API returned ${response.status}`,
              details: data,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: `Could not reach the Apprise API at ${baseUrl}. Ensure the Apprise API server is running.`,
            details: String(err),
          }),
        },
      ],
    };
  }
}

const handler = createMcpHandler(
  (server) => {
    // Tool 1: Send notification with inline URLs
    server.registerTool(
      "send_notification",
      {
        title: "Send Notification",
        description:
          "Send a notification to one or more services using Apprise URL(s). Supports 130+ services including Slack, Discord, Email, Telegram, and more. Use list_services to discover supported URL formats.",
        inputSchema: {
          urls: z
            .string()
            .describe(
              "Comma-separated Apprise URL(s) for the notification services. Examples: 'slack://token_a/token_b/token_c', 'discord://webhook_id/webhook_token', 'mailto://user:pass@gmail.com'."
            ),
          body: z.string().describe("The notification message body."),
          title: z
            .string()
            .optional()
            .describe("Optional notification title/subject."),
          type: z
            .enum(["info", "success", "warning", "failure"])
            .optional()
            .describe(
              "Notification type. Defaults to 'info'. Controls styling/icon on services that support it."
            ),
          format: z
            .enum(["text", "markdown", "html"])
            .optional()
            .describe(
              "Body format. Defaults to 'text'. Use 'markdown' or 'html' for rich formatting on supporting services."
            ),
        },
      },
      async ({ urls, body, title, type, format }) => {
        const payload: Record<string, unknown> = { urls, body };
        if (title) payload.title = title;
        if (type) payload.type = type;
        if (format) payload.format = format;
        return appriseFetch("POST", "/notify/", payload);
      }
    );

    // Tool 2: Send notification using stored config key
    server.registerTool(
      "send_stored_notification",
      {
        title: "Send Stored Notification",
        description:
          "Send a notification using a previously saved configuration key. The key references stored service URLs and tags, so you don't need to provide URLs directly.",
        inputSchema: {
          key: z
            .string()
            .describe(
              "The storage key referencing saved notification configuration."
            ),
          body: z.string().describe("The notification message body."),
          title: z
            .string()
            .optional()
            .describe("Optional notification title/subject."),
          type: z
            .enum(["info", "success", "warning", "failure"])
            .optional()
            .describe("Notification type. Defaults to 'info'."),
          tag: z
            .string()
            .optional()
            .describe(
              "Filter which stored URLs receive the notification by tag. Supports logic: 'tagA, tagB' (OR), 'tagA tagB' (AND)."
            ),
          format: z
            .enum(["text", "markdown", "html"])
            .optional()
            .describe("Body format. Defaults to 'text'."),
        },
      },
      async ({ key, body, title, type, tag, format }) => {
        const payload: Record<string, unknown> = { body };
        if (title) payload.title = title;
        if (type) payload.type = type;
        if (tag) payload.tag = tag;
        if (format) payload.format = format;
        return appriseFetch("POST", `/notify/${encodeURIComponent(key)}`, payload);
      }
    );

    // Tool 3: Save notification config
    server.registerTool(
      "save_config",
      {
        title: "Save Config",
        description:
          "Save notification service URLs to persistent storage under a key. Once saved, use send_stored_notification with the same key to send notifications without re-specifying URLs.",
        inputSchema: {
          key: z
            .string()
            .describe(
              "Storage key to save the configuration under (e.g. 'myteam', 'alerts')."
            ),
          urls: z
            .string()
            .optional()
            .describe(
              "Comma or space-separated Apprise URL(s) to store. Example: 'slack://token, discord://webhook_id/webhook_token'."
            ),
          config: z
            .string()
            .optional()
            .describe(
              "Apprise YAML or TEXT configuration block as an alternative to individual URLs. Useful for complex setups with tags."
            ),
          format: z
            .enum(["text", "yaml"])
            .optional()
            .describe("Format of the config parameter: 'text' (default) or 'yaml'."),
        },
      },
      async ({ key, urls, config, format }) => {
        const payload: Record<string, unknown> = {};
        if (urls) payload.urls = urls;
        if (config) payload.config = config;
        if (format) payload.format = format;
        return appriseFetch("POST", `/add/${encodeURIComponent(key)}`, payload);
      }
    );

    // Tool 4: Remove saved config
    server.registerTool(
      "remove_config",
      {
        title: "Remove Config",
        description:
          "Remove a saved notification configuration by its storage key.",
        inputSchema: {
          key: z
            .string()
            .describe("The storage key of the configuration to remove."),
        },
      },
      async ({ key }) => {
        return appriseFetch("POST", `/del/${encodeURIComponent(key)}`);
      }
    );

    // Tool 5: Get saved config
    server.registerTool(
      "get_config",
      {
        title: "Get Config",
        description:
          "Retrieve a saved notification configuration by its storage key.",
        inputSchema: {
          key: z.string().describe("The storage key to retrieve."),
        },
      },
      async ({ key }) => {
        return appriseFetch("POST", `/get/${encodeURIComponent(key)}`);
      }
    );

    // Tool 6: Get stored URLs as JSON
    server.registerTool(
      "get_urls",
      {
        title: "Get URLs",
        description:
          "Get the stored notification URLs for a key as structured JSON, including their associated tags. Useful for inspecting what services are configured under a key.",
        inputSchema: {
          key: z.string().describe("The storage key to inspect."),
          privacy: z
            .boolean()
            .optional()
            .describe(
              "When true, hides sensitive credentials/tokens in the returned URLs. Defaults to false."
            ),
          tag: z
            .string()
            .optional()
            .describe("Filter returned URLs by tag."),
        },
      },
      async ({ key, privacy, tag }) => {
        const params = new URLSearchParams();
        if (privacy) params.set("privacy", "1");
        if (tag) params.set("tag", tag);
        const query = params.toString();
        const path = `/json/urls/${encodeURIComponent(key)}${query ? `?${query}` : ""}`;
        return appriseFetch("GET", path);
      }
    );

    // Tool 7: List supported notification services
    server.registerTool(
      "list_services",
      {
        title: "List Services",
        description:
          "List all notification services supported by the Apprise instance, including their URL format requirements and capabilities.",
        inputSchema: {},
      },
      async () => {
        return appriseFetch("GET", "/details");
      }
    );

    // Tool 8: Health check
    server.registerTool(
      "check_health",
      {
        title: "Check Health",
        description:
          "Check the health and status of the Apprise API server.",
        inputSchema: {},
      },
      async () => {
        return appriseFetch("GET", "/status");
      }
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
