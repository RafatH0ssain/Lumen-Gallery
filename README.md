# Lumen Gallery 2.0

An endless corridor through the Art Institute of Chicago's open collection,
with AI-written docent notes. Double-tap a work you love and the gallery
hangs the next few pieces from the same genre; scroll past them without
tapping and it drifts back to serendipity.

**Stack:** React 18 + Vite 6 + Tailwind 4 + Framer Motion, deployed on
Cloudflare Pages with two Pages Functions (`/api/describe`, `/api/contact`)
and one Workers KV namespace. No auth, no database, no server. The only paid
dependency is OpenAI, throttled by a write-once description cache, per-IP
rate limits, and a dashboard budget cap.

---

## Phase 0 — Do this before anything else (old repo remediation)

The previous repo committed live secrets. Rotating without purging is not
enough — old values live in git history forever.

1. **Revoke at the provider first.** Delete the leaked OpenAI key in the
   OpenAI dashboard and delete the old MongoDB Atlas database user (then the
   cluster itself — this stack no longer uses Mongo at all).
2. **Start this project as a fresh repository.** For a solo MVP, a clean
   `git init` here is faster and more reliably clean than rewriting history
   with `git filter-repo`. Archive the old repo as **private**.
3. **Enable GitHub secret scanning + push protection** on the new repo
   (Settings → Code security) so this class of leak can't recur.
4. Note that `.gitignore` here excludes `.env*` and `.dev.vars*` — only the
   `*.example` templates are committable.

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars     # then paste your (new) OpenAI key
```

Create the KV namespace and wire it up:

```bash
npx wrangler kv namespace create LUMEN_KV
# paste the returned id into wrangler.toml
```

## Local development

Two terminals — Vite serves the app with HMR, Wrangler serves the functions,
and the Vite proxy routes `/api/*` between them:

```bash
# terminal 1 — the functions on :8788 (builds once so wrangler has assets;
# the functions themselves hot-reload on edit)
npm run dev:functions

# terminal 2 — the app on :5173 (open this one)
npm run dev
```

Or run the production build under Wrangler end-to-end:

```bash
npm run cf:preview
```

## Deployment (Cloudflare Pages, free tier)

1. Push to GitHub, then in the Cloudflare dashboard: **Workers & Pages →
   Create → Pages → connect the repo.** Build command `npm run build`,
   output directory `dist`. (Or deploy from the CLI: `npm run cf:deploy`.)
2. In the Pages project settings, bind the **LUMEN_KV** namespace
   (Settings → Functions → KV namespace bindings, binding name `LUMEN_KV`).
3. Add the secret: `npx wrangler pages secret put OPENAI_API_KEY`
   (or via dashboard → Settings → Environment variables, type *Secret*).
4. **Set a monthly budget cap in the OpenAI dashboard.** This is the
   non-negotiable backstop for a keyless public endpoint.
5. Optional hardening: add `RESEND_API_KEY` + `CONTACT_TO_EMAIL` for contact
   email delivery, and `TURNSTILE_SECRET_KEY` (plus the site key in the
   frontend) for an invisible CAPTCHA on the form.

Smoke-test after deploy:

- `GET /api/describe?id=27992` twice — second response must carry
  `x-lumen-cache: hit`.
- `GET /api/describe?id=abc` → 400. Eleven rapid misses from one IP → 429.
- Submit the contact form → check email or `npx wrangler kv key list
  --binding LUMEN_KV --prefix contact:`.

## Architecture notes

- **AIC API is called directly from the browser** (it's free and keyless);
  only OpenAI traffic goes through our function, so the key never ships to
  the client and the endpoint can't be repurposed as a general LLM proxy —
  it validates every id against AIC's catalog before generating.
- **Descriptions are generated at most once ever** (KV write-through cache),
  which is simultaneously the latency win and the cost cap.
- **The engagement loop is entirely client-side** (`src/feed/feedReducer.js`):
  double-tap splices an optimistic skeleton batch after the tapped card,
  backfills it from a hierarchy-weighted genre query
  (Style > Subject > Classification, expressed as ES boosts in
  `src/lib/aic.js`), and reverts to EXPLORE once the batch scrolls past
  with no further taps. The explore cursor is never discarded, so reverting
  is free.
- **Scroll performance** comes from IIIF exact-width images, LQIP blur-up,
  lazy decoding, and `content-visibility: auto` on cards. If very long
  sessions ever strain the DOM, `react-virtuoso` is the drop-in upgrade.
- **Accessibility:** the double-tap gesture has a visible "More like this"
  button equivalent on every placard; focus states and reduced-motion are
  handled globally.

## Free-tier budget reality check

| Piece | Provider | Cost |
| --- | --- | --- |
| Hosting + functions + KV | Cloudflare Pages free tier | $0 |
| Artwork data & images | AIC public API | $0 |
| Contact delivery | Resend free tier / KV fallback | $0 |
| AI descriptions | OpenAI gpt-4o-mini | ~$0.0001/artwork, once ever |

