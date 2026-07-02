import { json, isRateLimited, clientIp } from "../_utils.js";

/**
 * POST /api/contact  { name, email?, message, turnstileToken? }
 *
 * The one write endpoint with no auth, so it's the most defended:
 *   - strict shape/length validation
 *   - per-IP rate limit (3/min)
 *   - optional Cloudflare Turnstile verification (enabled by setting
 *     TURNSTILE_SECRET_KEY — becomes required once configured)
 * Delivery: Resend email if RESEND_API_KEY is set; otherwise notes are
 * stored in KV under `contact:*` (readable via dashboard or wrangler),
 * so the form works on day one with zero third-party signups.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (await isRateLimited(env, request, "contact", 3)) {
    return json({ error: "Too many notes at once. Try again shortly." }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name || name.length > 100) {
    return json({ error: "Name is required (max 100 characters)." }, 400);
  }
  if (!message || message.length > 2000) {
    return json({ error: "Message is required (max 2000 characters)." }, 400);
  }
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return json({ error: "That email address doesn't look right." }, 400);
  }

  // Turnstile: opt-in via env. Once the secret exists, tokens are mandatory.
  if (env.TURNSTILE_SECRET_KEY) {
    const token = String(body.turnstileToken ?? "");
    if (!token) return json({ error: "Verification required." }, 400);
    const verify = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: clientIp(request),
        }),
      },
    );
    const outcome = await verify.json().catch(() => ({ success: false }));
    if (!outcome.success) {
      return json({ error: "Verification failed. Please retry." }, 400);
    }
  }

  const note = {
    name,
    email: email || null,
    message,
    at: new Date().toISOString(),
  };

  if (env.RESEND_API_KEY && env.CONTACT_TO_EMAIL) {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "Lumen Gallery <onboarding@resend.dev>",
        to: [env.CONTACT_TO_EMAIL],
        reply_to: email || undefined,
        subject: `Lumen note from ${name}`,
        text: `${message}\n\n— ${name}${email ? ` <${email}>` : ""}\n${note.at}`,
      }),
    });
    if (!sent.ok) {
      // Don't lose the note if email delivery hiccups — fall through to KV.
      await storeNote(env, note);
    }
  } else {
    await storeNote(env, note);
  }

  return json({ ok: true });
}

async function storeNote(env, note) {
  const key = `contact:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;
  await env.LUMEN_KV.put(key, JSON.stringify(note), {
    expirationTtl: 60 * 60 * 24 * 90, // 90 days
  });
}
