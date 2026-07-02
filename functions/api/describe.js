import { json, isRateLimited } from "../_utils.js";

/**
 * GET /api/describe?id=<aic-artwork-id>
 *
 * Defense-in-depth for a keyless, no-auth endpoint:
 *   1. Cache-first: descriptions are deterministic per artwork, generated at
 *      most once ever. Cache hits cost nothing and return instantly.
 *   2. Input is a numeric AIC id, validated to exist in AIC's catalog before
 *      any OpenAI call — this endpoint cannot be used as a general LLM proxy.
 *   3. Per-IP rate limit on cache misses only.
 *   4. Hard max_tokens cap here + monthly budget cap in the OpenAI dashboard.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get("id") ?? "";

  if (!/^\d{1,10}$/.test(id)) {
    return json({ error: "Invalid artwork id." }, 400);
  }

  // 1. Cache first — the hot path for everything after first generation.
  const cacheKey = `desc:${id}`;
  const cached = await env.LUMEN_KV.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=86400",
        "x-lumen-cache": "hit",
      },
    });
  }

  // 2. Rate limit only the expensive path.
  if (await isRateLimited(env, request, "describe", 10)) {
    return json({ error: "Too many requests. Try again in a minute." }, 429);
  }

  // 3. The id must be a real artwork — fetch its metadata (which we also
  //    need for the prompt), rejecting anything AIC doesn't recognize.
  // AIC sits behind CloudFront, which 403s requests without a User-Agent.
  // Browsers set their own; workerd does not, so this fetch must.
  const artRes = await fetch(
    `https://api.artic.edu/api/v1/artworks/${id}` +
      `?fields=title,artist_display,date_display,medium_display,style_title,subject_titles,classification_titles`,
    {
      headers: {
        "user-agent": "lumen-gallery/2.0 (Cloudflare Pages Function)",
        "AIC-User-Agent": "lumen-gallery/2.0 (Cloudflare Pages Function)",
      },
    },
  );
  if (!artRes.ok) {
    return json({ error: "Artwork not found." }, 404);
  }
  const { data: art } = await artRes.json();

  const prompt = [
    `Write a museum docent note (110-150 words) for this artwork:`,
    `Title: ${art.title}`,
    `Artist: ${art.artist_display ?? "Unknown"}`,
    `Date: ${art.date_display ?? "Unknown"}`,
    `Medium: ${art.medium_display ?? "Unknown"}`,
    `Style: ${art.style_title ?? "Unspecified"}`,
    `Subjects: ${(art.subject_titles ?? []).join(", ") || "Unspecified"}`,
    ``,
    `Tone: warm, knowledgeable, conversational — a docent speaking to a`,
    `curious visitor, not an encyclopedia. Focus on what to notice and why`,
    `it matters. Do not invent specific facts (prices, provenance, quotes).`,
    `Plain prose only, no headings or lists.`,
  ].join("\n");

  const oaRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      max_tokens: 260,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!oaRes.ok || !oaRes.body) {
    return json({ error: "Description unavailable right now." }, 502);
  }

  // 4. Re-emit OpenAI's SSE as a plain text stream, accumulating the full
  //    note so it can be written through to KV after the stream closes.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));

  const transformed = oaRes.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const delta =
              JSON.parse(payload).choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullText += delta;
              controller.enqueue(encoder.encode(delta));
            }
          } catch {
            // Partial/keepalive line — ignore.
          }
        }
      },
      flush() {
        resolveDone(fullText);
      },
    }),
  );

  // Write-through cache after the stream completes, without blocking it.
  context.waitUntil(
    done.then((text) =>
      text && text.length > 40 ? env.LUMEN_KV.put(cacheKey, text) : null,
    ),
  );

  return new Response(transformed, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-lumen-cache": "miss",
    },
  });
}
