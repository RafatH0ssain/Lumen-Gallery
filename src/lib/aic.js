/**
 * Art Institute of Chicago API client.
 * Free, keyless, called directly from the browser — no proxy needed.
 * Docs: https://api.artic.edu/docs/
 */

const API = "https://api.artic.edu/api/v1";
const IIIF = "https://www.artic.edu/iiif/2";

export const FIELDS = [
  "id",
  "title",
  "artist_display",
  "date_display",
  "medium_display",
  "image_id",
  "style_title",
  "subject_titles",
  "classification_titles",
  "thumbnail",
].join(",");

export const PAGE_SIZE = 12;

// Verified against the live API (2026-07): /artworks/search rejects any
// request where page * limit > 1,000 with a 403 "Invalid number of results"
// (page 83 × limit 12 = 996 is the last page that succeeds). The corpus is
// ~59k public-domain works but only the first 1,000 are reachable per query,
// so the explore pool is those 1,000 in relevance order, sampled by random
// page. function_score/random_score is accepted but silently ignored, so
// there is no server-side shuffle available.
const MAX_RANDOM_PAGE = Math.floor(1000 / PAGE_SIZE);

/**
 * IIIF lets us request the exact pixel width we render at — the single
 * biggest lever for scroll performance. `width` should roughly match the
 * card's rendered width (x2 for retina is overkill for a feed; 1.5x reads well).
 */
export function imageUrl(imageId, width = 843) {
  return `${IIIF}/${imageId}/full/${width},/0/default.jpg`;
}

/**
 * The exact IIIF width the feed should request: the rendered slot is
 * min(100vw - 40px, 632px), density capped at 1.5x per the note above,
 * rounded up to 50px buckets so the IIIF cache stays warm across similar
 * viewports, and never above AIC's recommended 843.
 * KEEP IN SYNC with the boot-time preload in index.html.
 */
export function feedImageWidth() {
  const slot = Math.min((window.innerWidth || 672) - 40, 632);
  const density = Math.min(window.devicePixelRatio || 1, 1.5);
  return Math.min(843, Math.ceil((slot * density) / 50) * 50);
}

/**
 * The agreed genre hierarchy: Style > Subject > Classification.
 * Extraction (what genre does *this* artwork belong to) walks the same order.
 */
export function genreOf(art) {
  if (art.style_title) return art.style_title;
  if (art.subject_titles?.length) return art.subject_titles[0];
  if (art.classification_titles?.length) return art.classification_titles[0];
  return null;
}

function normalize(results) {
  return results
    .filter((a) => a.image_id)
    .map((a) => ({
      ...a,
      aspect:
        a.thumbnail?.width && a.thumbnail?.height
          ? a.thumbnail.width / a.thumbnail.height
          : 4 / 5,
      lqip: a.thumbnail?.lqip ?? null,
    }));
}

async function search(body, signal) {
  const res = await fetch(`${API}/artworks/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`AIC search failed: ${res.status}`);
  const json = await res.json();
  return normalize(json.data ?? []);
}

/**
 * Consume the boot-time explore fetch fired inline in index.html (which
 * duplicates the explore query — keep the two in sync). Returns normalized
 * arts, or null so the caller falls back to a regular fetch.
 */
export async function resolveBootPage(boot) {
  try {
    const res = await boot.firstPage;
    if (!res?.ok) return null;
    const json = await res.json();
    const arts = normalize(json.data ?? []);
    return arts.length ? arts : null;
  } catch {
    return null;
  }
}

/**
 * EXPLORE mode: a pseudo-random page of public-domain works with images.
 * Random deep pages over a ~120k-work corpus give the feed its serendipity
 * without needing any server-side state.
 */
export async function fetchExplorePage(visitedPages, signal) {
  let page;
  do {
    page = 1 + Math.floor(Math.random() * MAX_RANDOM_PAGE);
  } while (visitedPages.has(page) && visitedPages.size < MAX_RANDOM_PAGE);
  visitedPages.add(page);

  return search(
    {
      query: {
        bool: {
          must: [
            { term: { is_public_domain: true } },
            { exists: { field: "image_id" } },
          ],
        },
      },
      fields: FIELDS,
      page,
      limit: PAGE_SIZE,
    },
    signal,
  );
}

/**
 * FOCUSED mode: hierarchy-weighted genre search.
 * Style matches are boosted hardest, then Subject, then Classification —
 * implementing the agreed retrieval weighting directly in the ES query.
 */
export async function fetchGenreBatch(genre, excludeIds, count, signal) {
  const results = await search(
    {
      query: {
        bool: {
          must: [
            { term: { is_public_domain: true } },
            { exists: { field: "image_id" } },
          ],
          should: [
            { match_phrase: { style_title: { query: genre, boost: 4 } } },
            { match_phrase: { subject_titles: { query: genre, boost: 2 } } },
            {
              match_phrase: {
                classification_titles: { query: genre, boost: 1 },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      fields: FIELDS,
      limit: count + 10, // headroom for dedupe against the current feed
      page: 1 + Math.floor(Math.random() * 4), // variety across repeat taps
    },
    signal,
  );
  return results.filter((a) => !excludeIds.has(a.id)).slice(0, count);
}
