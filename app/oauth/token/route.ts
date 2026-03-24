export async function POST() {
  return new Response(
    JSON.stringify({
      access_token: "apprise-mcp-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "apprise-mcp-refresh-token",
      scope: "mcp",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
