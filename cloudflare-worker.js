// ============================================================
//  Cloudflare Worker — Anthropic API Proxy
//  Deploy this at: workers.cloudflare.com
//
//  Environment variable to set in Cloudflare dashboard:
//    ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxxxxx
// ============================================================

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ALLOWED_ORIGIN = "*"; // Replace with your Pages URL e.g. "https://policy-pdf-extractor.pages.dev"

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(ALLOWED_ORIGIN),
      });
    }

    // ── Only allow POST ─────────────────────────────────────
    if (request.method !== "POST") {
      return jsonError(405, "Method not allowed");
    }

    // ── Parse body from the frontend ───────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    // ── Safety: force model & cap tokens ───────────────────
    body.model      = "claude-sonnet-4-20250514";
    body.max_tokens = body.max_tokens ?? 1000;

    // ── Forward to Anthropic ────────────────────────────────
    let anthropicRes;
    try {
      anthropicRes = await fetch(ANTHROPIC_API, {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      return jsonError(502, "Failed to reach Anthropic: " + err.message);
    }

    // ── Stream the response back with CORS headers ──────────
    const responseBody = await anthropicRes.text();
    return new Response(responseBody, {
      status:  anthropicRes.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(ALLOWED_ORIGIN),
      },
    });
  },
};

// ── Helpers ─────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(ALLOWED_ORIGIN),
    },
  });
}
