/**
 * Cleveland Museum of Art Open Access API client.
 * Free, keyless, CC0, called directly from the browser — no proxy needed.
 * Docs: https://openaccess-api.clevelandart.org/
 *
 * ── Why not the Art Institute of Chicago? ────────────────────────────────
 * The original build used AIC. Since 2025-12-05 their IIIF image host
 * (www.artic.edu/iiif/2) returns 403 to every programmatic request:
 *
 *     cf-mitigated: challenge
 *     cross-origin-resource-policy: same-origin
 *
 * Two separately-fatal blockers — a Cloudflare JS challenge an <img>
 * subresource can never solve, plus CORP forbidding cross-origin embedding
 * even on a 200. Verified blocked from residential, cellular, datacenter and
 * Cloudflare-edge vantage points, so a server-side proxy does NOT recover it.
 * Their metadata host (api.artic.edu) still works, which is why the old build
 * rendered placards and blurred backdrops but never a single artwork.
 * Upstream: art-institute-of-chicago/data-aggregator#151 (closed, unfixed).
 */

const API = "https://openaccess-api.clevelandart.org/api/artworks";

// Only what the feed renders — the full record is ~18KB each, this is ~1.9KB.
export const FIELDS = [
  "id",
  "title",
  "creators",
  "creation_date",
  "technique",
  "type",
  "culture",
  "images",
].join(",");

export const PAGE_SIZE = 12;

// CMA imposes no deep-pagination cap: verified reachable through skip=41,510,
// the last record of the CC0-with-image corpus. This is a straight upgrade on
// AIC, whose /artworks/search 403s past page*limit > 1,000 — the old explore
// pool was only the first 1,000 results in relevance order. Every page of a
// type's pool is reachable here, so random pages are genuinely random.

// The only types the gallery hangs. CMA's catalogue also contains ceramics,
// armour, furniture and jewellery, which are not what this feed is for.
// `weight` is the chance of drawing a page from that type and is deliberately
// NOT proportional to `total`: Print outnumbers everything else combined, and
// tiny pools like Tapestry would repeat constantly if drawn proportionally.
// `total` is seeded from a live count (2026-10-03) and re-synced per response.
const CLASSIC_TYPES = [
  { type: "Painting", weight: 30, total: 3955 },
  { type: "Print", weight: 20, total: 10825 },
  { type: "Drawing", weight: 15, total: 1995 },
  { type: "Sculpture", weight: 15, total: 1979 },
  { type: "Photograph", weight: 10, total: 989 },
  { type: "Portrait Miniature", weight: 5, total: 164 },
  { type: "Tapestry", weight: 3, total: 58 },
];

// lazy: a type whose pool is only a few pages deep (Tapestry ~5, Portrait
// Miniature ~14) can be drawn often enough in a very long session to re-serve
// a page it has already shown. The reducer dedupes those works away, so the
// cost is one wasted request, not a duplicate card. Mosaic was dropped from
// the table outright because its 6 works are a single page — a second draw
// could never add anything. Upgrade path if this ever bites: track visited
// pages per type and re-draw a different type once a pool is exhausted.

/**
 * CMA accepts exactly ONE `type` per request — repeating the param keeps only
 * the last, and comma or pipe lists return nothing. So diversity has to come
 * from choosing the type first, then the page, rather than from one query
 * spanning several types.
 */
function pickType() {
  const sum = CLASSIC_TYPES.reduce((n, t) => n + t.weight, 0);
  let r = Math.random() * sum;
  for (const t of CLASSIC_TYPES) if ((r -= t.weight) < 0) return t;
  return CLASSIC_TYPES[0];
}

/**
 * CMA serves three fixed renditions per work — `web` (~900px, ~400KB),
 * `print` (~3400px, ~5MB) and `full` (.tif, often >100MB). There is no IIIF
 * service, so unlike AIC we cannot request an exact pixel width.
 *
 * COMPROMISE: `feedImageWidth()` is gone, along with the srcset/sizes tuning
 * it fed. `web` is the only usable rendition — heavier than the 843px IIIF
 * crop we used to request, but the alternatives are 10x and 250x larger.
 * Long-scroll bytes go up; there is no lever to fix it here.
 */
export function imageUrl(art) {
  return art.image;
}

/**
 * The genre hierarchy, remapped.
 *
 * AIC gave us Style > Subject > Classification. CMA has no art-historical
 * style field and no subject field at all, so the closest honest mapping by
 * descending specificity is:
 *
 *     culture   ("Italy", "Egypt, Byzantine period")  ← was Style
 *     technique ("oil on canvas")                     ← was Subject
 *     type      ("Painting", "Drawing")               ← was Classification
 *
 * Extraction walks that order, exactly as `genreOf` did before.
 */
export function genreOf(art) {
  if (art.culture) return art.culture;
  if (art.technique) return art.technique;
  if (art.type) return art.type;
  return null;
}

// Which API filter to query for a genre taken from a given artwork — the
// retrieval half of the hierarchy above.
function genreFieldOf(art) {
  if (art.culture) return "culture";
  if (art.technique) return "technique";
  if (art.type) return "type";
  return null;
}

function normalize(records) {
  return records
    .filter((a) => a?.images?.web?.url)
    .map((a) => {
      const web = a.images.web;
      const w = Number(web.width);
      const h = Number(web.height);
      return {
        id: a.id,
        title: a.title || "Untitled",
        // creators[0].description reads "Paolo Veronese (Italian, 1528–1588)"
        // — the same shape AIC's artist_display had. Some records (ancient,
        // anonymous) have no creator at all; fall back to culture.
        artist_display:
          a.creators?.[0]?.description ||
          (Array.isArray(a.culture) ? a.culture[0] : a.culture) ||
          "Maker unrecorded",
        date_display: a.creation_date || "",
        medium_display: a.technique || "",
        image: web.url,
        // Known before paint, so the frame reserves its box and CLS stays 0.
        aspect: w && h ? w / h : 4 / 5,
        // CMA has no LQIP/base64 placeholder equivalent. ArtCard's ambient
        // wash now reuses `image` (same URL, so it costs no extra request)
        // and the frame falls back to its flat ink-soft background.
        culture: Array.isArray(a.culture) ? a.culture[0] : a.culture || null,
        technique: a.technique || null,
        type: a.type || null,
      };
    });
}

async function request(params, signal) {
  const url = new URL(API);
  url.searchParams.set("has_image", "1");
  url.searchParams.set("cc0", "1");
  url.searchParams.set("fields", FIELDS);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`CMA search failed: ${res.status}`);
  const json = await res.json();
  return { arts: normalize(json.data ?? []), total: json.info?.total ?? 0 };
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
 * EXPLORE mode: a pseudo-random page of CC0 works with images, drawn from
 * anywhere within one randomly chosen fine-art type.
 */
export async function fetchExplorePage(visitedPages, signal) {
  const entry = pickType();
  const maxPage = Math.max(1, Math.floor(entry.total / PAGE_SIZE));
  // Page 5 of Painting and page 5 of Print are different works, so the dedupe
  // key has to carry the type — a bare page number would let the same offset
  // of two different pools count as a repeat.
  const keyOf = (page) => `${entry.type}:${page}`;

  let page;
  do {
    page = Math.floor(Math.random() * maxPage);
  } while (visitedPages.has(keyOf(page)) && visitedPages.size < maxPage);
  visitedPages.add(keyOf(page));

  const { arts, total } = await request(
    { type: entry.type, skip: page * PAGE_SIZE, limit: PAGE_SIZE },
    signal,
  );
  // The seed is only a guess about how deep this type runs; the response knows
  // for sure, and the two filters above can change it between visits.
  if (total) entry.total = total;
  return arts;
}

// How many works each genre filter matches, learned from the first query for
// that genre. Needed because a blind random offset overshoots narrow genres:
// "Turkey (Iznik), Ottoman Period" has 10 works, so a skip of 15/30/45 returns
// nothing and the tap silently falls through to a broader tier — or produces
// no batch at all. Bounded by the number of distinct genres a session sees.
const genreTotals = new Map();

/**
 * FOCUSED mode: same-genre works for the double-tapped artwork.
 *
 * COMPROMISE: AIC let us express the hierarchy as Elasticsearch `should`
 * boosts (4/2/1) inside one weighted query. CMA's API offers plain field
 * filters with no scoring control, so the identical priority is expressed as
 * an ordered cascade instead: query the artwork's own tier, and widen to the
 * next tier ONLY if that tier returns nothing usable. Widening on a merely
 * thin result would put works on the wall that don't belong to the genre the
 * "Now hanging" banner is naming, so a short honest batch beats a padded one
 * — the reducer already sizes the focus batch from what it actually receives.
 *
 * One request per tap: the first query for a genre runs at offset 0 and
 * records its total, and later taps on that same genre randomise the offset
 * within the range that total proves is real.
 *
 * Note that CMA's filters are tokenised rather than exact, which works in our
 * favour: the collection labels the same culture inconsistently, so filtering
 * on "Turkey (Iznik), Ottoman Period" also returns works catalogued as
 * "Turkey, Iznik, Ottoman period (1299–1922)". Do not "fix" this by demanding
 * an exact string match — it would fragment genres that belong together.
 */
export async function fetchGenreBatch(art, excludeIds, count, signal) {
  const primary = genreFieldOf(art);
  if (!primary) return [];

  // The artwork's own tier first, then successively broader ones.
  const tiers = ["culture", "technique", "type"];
  const order = [primary, ...tiers.filter((t) => t !== primary)];

  const taken = new Set(excludeIds);
  const window = count + 10; // headroom for dedupe against the current feed

  for (const field of order) {
    const value = art[field];
    if (!value) continue;

    // "Italy" or "woodcut" match the whole catalogue, ceramics and armour
    // included, so a focused batch could hang a pot next to the painting that
    // named the genre. ANDing the anchor's own type closes that hole, and the
    // filters narrow together rather than multiply out. On the `type` tier this
    // is the same value the field already carries, so it collapses to one param
    // rather than sending `type` twice — which CMA resolves by keeping only
    // the last.

    // Only randomise within a range a previous query proved exists. The key
    // has to include the type: the same culture constrained to Painting and the
    // same culture unconstrained are different pools with different totals.
    const known = genreTotals.get(`${field}:${value}:${art.type ?? ""}`);
    const maxSkip = known === undefined ? 0 : Math.max(0, known - window);
    const skip = maxSkip > 0 ? Math.floor(Math.random() * (maxSkip + 1)) : 0;

    const { arts, total } = await request(
      { [field]: value, type: art.type, limit: window, skip },
      signal,
    );
    genreTotals.set(`${field}:${value}:${art.type ?? ""}`, total);

    const collected = [];
    for (const a of arts) {
      if (taken.has(a.id)) continue;
      taken.add(a.id);
      collected.push(a);
      if (collected.length === count) break;
    }
    if (collected.length) return collected;
  }

  return [];
}
