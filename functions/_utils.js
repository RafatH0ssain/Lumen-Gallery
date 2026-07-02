export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function clientIp(request) {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Best-effort fixed-window rate limiter on Workers KV.
 * KV is eventually consistent and has no atomic increment, so this is a
 * backstop, not a turnstile — combined with the response cache and the hard
 * OpenAI budget cap, it makes abuse unprofitable rather than impossible,
 * which is the right bar for a free, no-auth gallery.
 *
 * Returns true if the request should be rejected.
 */
export async function isRateLimited(env, request, bucket, perMinute) {
  try {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `rl:${bucket}:${clientIp(request)}:${minute}`;
    const count = parseInt((await env.LUMEN_KV.get(key)) ?? "0", 10);
    if (count >= perMinute) return true;
    await env.LUMEN_KV.put(key, String(count + 1), { expirationTtl: 120 });
    return false;
  } catch {
    // If KV hiccups, fail open — the OpenAI budget cap is the last line.
    return false;
  }
}
