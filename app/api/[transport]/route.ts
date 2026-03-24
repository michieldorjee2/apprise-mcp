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
          "Send a notification to one or more services. Accepts raw webhook URLs (just paste the URL you copied from Slack, Discord, Teams, etc.) or Apprise-style URLs. Use list_services to see setup instructions for each service.",
        inputSchema: {
          urls: z
            .string()
            .describe(
              "One or more webhook URLs, comma-separated. Accepts raw URLs: 'https://hooks.slack.com/services/...', 'https://discord.com/api/webhooks/...', Teams workflow URLs, 'https://ntfy.sh/mytopic'. Also accepts Apprise-style: 'tgram://BotToken/ChatID', 'pover://UserKey@Token'."
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
          "List all supported notification services with their URL format and step-by-step setup instructions.",
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
