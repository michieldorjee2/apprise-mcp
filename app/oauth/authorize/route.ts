import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state");

  if (!redirectUri) {
    return new Response(JSON.stringify({ error: "missing redirect_uri" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(redirectUri);
  url.searchParams.set("code", "apprise-mcp-auth-code");
  if (state) {
    url.searchParams.set("state", state);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
}
