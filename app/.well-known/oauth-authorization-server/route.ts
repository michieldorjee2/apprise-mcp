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
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
      code_challenge_methods_supported: ["S256", "plain"],
      scopes_supported: ["mcp"],
      client_id_metadata_document_supported: true,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
