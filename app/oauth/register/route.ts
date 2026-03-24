import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  return new Response(
    JSON.stringify({
      client_id: body.client_id || "apprise-mcp-client",
      client_secret: "apprise-mcp-secret",
      client_name: body.client_name || "MCP Client",
      redirect_uris: body.redirect_uris || [],
      grant_types: body.grant_types || ["authorization_code", "refresh_token"],
      response_types: body.response_types || ["code"],
      token_endpoint_auth_method:
        body.token_endpoint_auth_method || "none",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
