import { NextRequest } from "next/server";

function getBaseUrl(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  return new Response(
    JSON.stringify({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      scopes_supported: ["mcp"],
      bearer_methods_supported: ["header"],
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
