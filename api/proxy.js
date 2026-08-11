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
 * SAFETY: HTTPS + PRIVATE-NETWORK GUARD
 * This endpoint will relay a request to any HTTPS host the caller
 * points it at (no allowlist) — that's what "allow any service" means
 * in practice, so any AI provider works without editing this file. The
 * one thing still blocked is a target that resolves to a private/
 * loopback/link-local address, since a public relay that could reach
 * your own internal network is a real risk even when everything else
 * is open. Note this is still an OPEN PROXY to the public internet:
 * anyone who learns this endpoint's URL can use it to make HTTPS
 * requests that appear to come from your Vercel project (and consume
 * your function-invocation quota). That's an acceptable trade for a
 * personal tool whose URL you don't publish; if you ever want to close
 * that off, add back a small ALLOWED_HOSTS allowlist, or gate this
 * endpoint behind a shared secret header checked here.
 *
 * DEPLOY — see the README in this same folder for step-by-step Vercel
 * setup (CLI or GitHub-import, either works).
 */

export const config = { runtime: 'edge' };

// Blocks a target host that resolves to a private/loopback/link-local
// address, so an otherwise-open proxy can't be used to reach into your
// own internal network. This is a hostname-pattern check, not a real
// DNS-resolution check (Edge runtime has no DNS module) — it catches
// the direct, obvious cases (literal IPs, localhost, .local) but not a
// public hostname that's been set up to resolve to a private address.
function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    return false;
  }
  if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  return false;
}

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
  if (isPrivateHost(parsed.hostname)) {
    return new Response(
      `Host "${parsed.hostname}" looks like a private/internal address and is blocked.`,
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
