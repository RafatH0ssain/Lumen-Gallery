/**
 * The API answers only on the custom domain. lumen-gallery.pages.dev serves the same functions but
 * skips the zone's WAF and rate-limiting rules on rafathossain.com, so it would be the way around
 * them (localhost stays allowed for `wrangler pages dev`). Scoped to /api/* so static assets never become (metered) function invocations.
 */
export async function onRequest({ request, next }) {
  const host = new URL(request.url).hostname;
  if (host !== "lumen.rafathossain.com" && host !== "localhost" && host !== "127.0.0.1") {
    return new Response("Not found", { status: 404 });
  }
  return next();
}
