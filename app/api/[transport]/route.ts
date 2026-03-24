import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { dispatch, SUPPORTED_SERVICES } from "../../../lib/dispatcher";

const handler = createMcpHandler(
  (server) => {
    // Tool 1: Send notification with inline URLs
    server.registerTool(
      "send_notification",
      {
        title: "Send Notification",
        description:
          "Send a notification to one or more services using Apprise-compatible URL(s). Supports Slack, Discord, Telegram, MS Teams, Pushover, Ntfy, JSON/Form webhooks, and Email. Use list_services to discover supported URL formats.",
        inputSchema: {
          urls: z
            .string()
            .describe(
              "Comma-separated Apprise URL(s). Examples: 'slack://TokenA/TokenB/TokenC', 'discord://WebhookID/WebhookToken', 'tgram://BotToken/ChatID', 'ntfy://mytopic'."
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
              "Notification type. Defaults to 'info'. Controls styling/color on services that support it."
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
        try {
          const result = await dispatch(urls, { body, title, type, format });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "Failed to send notification",
                  detail: String(err),
                }),
              },
            ],
          };
        }
      }
    );

    // Tool 2: List supported notification services
    server.registerTool(
      "list_services",
      {
        title: "List Services",
        description:
          "List all supported notification services with their URL format and setup instructions.",
        inputSchema: {},
      },
      async () => {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(SUPPORTED_SERVICES, null, 2),
            },
          ],
        };
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
