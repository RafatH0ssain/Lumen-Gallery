/**
 * The API answers only on the custom domain. lumen-gallery.pages.dev serves the same functions but
 * skips the zone's WAF and rate-limiting rules on rafathossain.com, so it would be the way around
 * them. Scoped to /api/* so static assets never become (metered) function invocations.
 */
export async function onRequest({ request, next }) {
  if (new URL(request.url).hostname !== "lumen.rafathossain.com") {
    return new Response("Not found", { status: 404 });
  }
  return next();
}
