/**
 * api/proxy.js — a tiny, stateless CORS relay for the AI Chat panel in
 * low_poly_3d.html, running as a Vercel Edge Function.
 *
 * WHY THIS EXISTS
 * Most AI providers' /chat/completions endpoints don't send CORS
 * headers, so a browser calling them directly gets blocked. This
 * function sits in between: the browser calls this endpoint (which
 * *does* send CORS headers), it forwards the request byte-for-byte to
 * the real endpoint, and streams the response straight back.
 *
 * WHAT IT DOES NOT DO
 * - It does not read, store, log, or inspect the Authorization header.
 *   It is copied from the incoming request to the outgoing one and
 *   nothing else touches it.
 * - It does not persist request or response bodies anywhere. Edge
 *   Functions are stateless per-request; nothing here writes to a
 *   database, KV store, or disk.
 * - It does not add its own API key. The user's own key, entered in the
 *   AI Chat panel, is what gets forwarded.
 *
 * HOW THE BROWSER USES IT
 * POST to this endpoint's URL (…/api/proxy) with:
 *   - header  X-Target-Url: <the full real endpoint>,
 *             e.g. https://api.openai.com/v1/chat/completions
 *   - header  Authorization: Bearer <the user's own key>   (as usual)
 *   - the normal JSON body (model/messages/stream/etc.)
 * This forwards the request to X-Target-Url with that header set, and
 * streams the response (including SSE streaming bodies) straight back
 * to the browser with CORS headers attached.
 *
 * SAFETY: OPEN-PROXY GUARD
 * Because this endpoint will relay a request anywhere the caller points
 * it, X-Target-Url is checked against an allowlist of known AI API
 * hosts below so this can't be abused as a generic anonymous HTTP
 * relay. Add a host here if you want to point the panel at another
 * OpenAI-compatible provider (Azure OpenAI, a self-hosted vLLM/Ollama
 * box, etc).
 *
 * DEPLOY — see the README in this same folder for step-by-step Vercel
 * setup (CLI or GitHub-import, either works).
 */

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = [
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.x.ai',
  'openrouter.ai',
  'api.groq.com',
  'api.together.xyz',
  'api.mistral.ai',
  'api.deepseek.com',
  // Add your own OpenAI-compatible host here, e.g. an Azure OpenAI
  // resource or a self-hosted vLLM/Ollama endpoint you control:
  // 'your-resource.openai.azure.com',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

// Headers stripped from the browser's request before forwarding — these
// are either platform-internal, or would break the upstream request if
// passed through verbatim (Host/Content-Length get recalculated by fetch()).
const STRIP_REQUEST_HEADERS = new Set([
  'host', 'content-length', 'x-target-url', 'connection',
  'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'x-vercel-id',
]);

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return new Response('Only POST is supported.', { status: 405, headers: CORS_HEADERS });
  }

  const targetUrl = request.headers.get('X-Target-Url');
  if (!targetUrl) {
    return new Response('Missing X-Target-Url header.', { status: 400, headers: CORS_HEADERS });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    return new Response('X-Target-Url is not a valid URL.', { status: 400, headers: CORS_HEADERS });
  }
  if (parsed.protocol !== 'https:') {
    return new Response('X-Target-Url must be https.', { status: 400, headers: CORS_HEADERS });
  }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response(
      `Host "${parsed.hostname}" is not in this proxy's allowlist. Add it to ALLOWED_HOSTS in api/proxy.js and redeploy.`,
      { status: 403, headers: CORS_HEADERS }
    );
  }

  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) forwardHeaders.set(key, value);
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(parsed.toString(), {
      method: 'POST',
      headers: forwardHeaders,
      body: request.body,
      duplex: 'half',
    });
  } catch (e) {
    return new Response(`Upstream request failed: ${e.message}`, { status: 502, headers: CORS_HEADERS });
  }

  // Stream the upstream response straight back — this is what keeps SSE
  // streaming responses (the whole point of this panel) live instead of
  // buffering the whole reply before responding.
  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) responseHeaders.set(k, v);
  responseHeaders.delete('content-encoding'); // fetch() already decoded it; forwarding the old header breaks the browser's decode
  responseHeaders.delete('content-length');   // length no longer matches after that

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
