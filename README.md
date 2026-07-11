# Lumen — the museum in primary colour

**Live: https://lumen-gallery.pages.dev**

An endless corridor through the Art Institute of Chicago's open collection,
hung against a black wall in the primary red/blue/yellow of a De Stijl poster.
One artwork per screen, each framed like a print with a hard offset shadow.
**Tap** a work to open it full-screen — then **pinch, double-tap or scroll**
to zoom in on the brushwork. **Double-tap** a work you love and the gallery
hangs the next few pieces from the same genre; scroll past them without
tapping and it drifts back to serendipity. Every piece comes with an
AI-written docent note, streamed token-by-token and generated at most once
ever.

**Stack:** React 18 + Vite 6 + Tailwind 4 + Motion, deployed on Cloudflare
Pages with two Pages Functions (`/api/describe`, `/api/contact`) and one
Workers KV namespace. No auth, no database, no server. The only paid
dependency is OpenAI — throttled by a write-once description cache, per-IP
rate limits, and a hard budget cap.

## How it's built

This project was built by pairing with [Claude Code](https://claude.com/claude-code)
under a written spec: [`CLAUDE.md`](CLAUDE.md) defines the product semantics
(the genre hierarchy, the engagement-loop state machine, hard rules like
"never commit secrets" and "keep the dependency surface minimal"), and the
agent executed against it — verifying every assumption against the live APIs
rather than trusting the code as written. That process caught real bugs the
code review couldn't: AIC's search API caps pagination at 1,000 records (not
the assumed 10,000), and its CDN silently 403s any server-side fetch without
a `User-Agent`. Each commit is co-authored accordingly; the git history reads
as the build log.

## Features

- **Snap feed** — full-screen `scroll-snap` sections; every flick lands on
  exactly one artwork (`scroll-snap-stop: always`)
- **The engagement loop** — a pure client-side state machine
  (`src/feed/feedReducer.js`): double-tap splices an optimistic skeleton
  batch after the tapped card, backfills it from a hierarchy-weighted genre
  query (Style > Subject > Classification, expressed as Elasticsearch boosts
  in `src/lib/aic.js`), and reverts to explore once the batch scrolls past
  untapped
- **Zoomable lightbox** — single tap (or `Enter`) opens the work at AIC's
  maximum IIIF resolution; a self-contained gesture engine
  (`src/hooks/usePinchZoom.js`) drives pinch, drag-to-pan, double-tap and
  scroll-wheel zoom off raw pointer events, so the picture stays pinned under
  your fingers instead of drifting off a scroll-snap page
- **Docent notes** — one Pages Function proxies OpenAI as a text stream;
  KV write-through means each artwork is described exactly once, ever. The
  note unfolds inside the wall label itself, set off by a hard rule
- **De Stijl wall labels** — each placard is a printed block: paper stock, a
  black keyline, a thick colour edge, a solid offset shadow and a stamped
  catalogue number
- **Ambient light** — each artwork's LQIP, blurred wall-wide behind it
- **Performance** — Lighthouse a11y 100 / CLS 0: the first search request is
  fired from an inline `<head>` script before the bundle arrives, the LCP
  image is preloaded from its response, images ship at a 1.5× density cap,
  and the animation layer is transform/opacity only

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars     # then paste your OpenAI key
npx wrangler kv namespace create LUMEN_KV
# paste the returned id into wrangler.toml
```

## Local development

Two terminals — Vite serves the app with HMR, Wrangler serves the functions,
and the Vite proxy routes `/api/*` between them:

```bash
npm run dev:functions   # terminal 1 — functions on :8788
npm run dev             # terminal 2 — the app on :5173 (open this one)
```

Or run the production build under Wrangler end-to-end: `npm run cf:preview`

## Deployment (Cloudflare Pages, free tier)

1. Connect the repo in the Cloudflare dashboard (**Workers & Pages → Pages**,
   build `npm run build`, output `dist`) — or `npm run cf:deploy`.
2. Bind the **LUMEN_KV** namespace in the Pages project settings.
3. `npx wrangler pages secret put OPENAI_API_KEY` (takes effect on the next
   deployment).
4. **Set a monthly budget cap in the OpenAI dashboard** — the non-negotiable
   backstop for a keyless public endpoint.
5. Optional: `RESEND_API_KEY` + `CONTACT_TO_EMAIL` for contact email
   delivery, `TURNSTILE_SECRET_KEY` for an invisible CAPTCHA on the form.

Smoke-test after deploy:

- `GET /api/describe?id=27992` twice — second response must carry
  `x-lumen-cache: hit`
- `GET /api/describe?id=abc` → 400; eleven rapid misses from one IP → 429
- Submit the contact form → `npx wrangler kv key list --binding LUMEN_KV
  --prefix contact:`

## Architecture notes

- **AIC's API is called directly from the browser** (free and keyless); only
  OpenAI traffic goes through a function, so the key never ships to the
  client — and the endpoint validates every id against AIC's catalog before
  generating, so it can't be repurposed as a general LLM proxy.
- **Abuse economics over abuse prevention:** KV-backed per-IP rate limits
  and the once-ever description cache make abuse unprofitable; the OpenAI
  budget cap makes it bounded.
- **Field-verified quirks** (documented in code comments): AIC search 403s
  past 1,000 records (`page × limit`), IIIF caps at 843px width, and
  server-side fetches need an explicit `User-Agent` to clear its CDN.

## Free-tier budget reality check

| Piece | Provider | Cost |
| --- | --- | --- |
| Hosting + functions + KV | Cloudflare Pages free tier | $0 |
| Artwork data & images | AIC public API | $0 |
| Contact delivery | Resend free tier / KV fallback | $0 |
| AI descriptions | OpenAI gpt-4o-mini | ~$0.0001/artwork, once ever |

---

Artwork and metadata courtesy of the [Art Institute of Chicago public API](https://api.artic.edu/docs/).
Docent notes are AI-generated and may contain inaccuracies.
