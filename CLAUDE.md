# CLAUDE.md — Handoff: Finish & Ship Lumen Gallery 2.0

You are picking up a complete but **never-executed** codebase. It was written
in a sandbox with no network access: every file is syntax-checked but nothing
has been installed, built, run, or tested against live APIs. Your job is to
take it from "written" to "verified and deployed" — not to redesign it.

## Context (read first)

- `README.md` — architecture, setup, deployment. Treat it as the spec.
- This is a pivoted MVP: **no auth, no database, no Stripe, no chat.** The
  entire product is: infinite art scroll (Art Institute of Chicago public
  API, called directly from the browser), AI docent notes via one Cloudflare
  Pages Function, a contact form via a second Function, and Workers KV.
- The core product mechanic is the double-tap engagement loop in
  `src/feed/feedReducer.js`: double-tap → splice 3–5 same-genre works after
  the tapped card → revert to random explore if all are scrolled past
  untapped. Genre hierarchy is **Style > Subject > Classification**, both in
  extraction (`genreOf` in `src/lib/aic.js`) and as ES boosts (4/2/1) in the
  search query. Preserve these semantics exactly.

## Hard rules

1. **Never commit secrets.** `.env*` and `.dev.vars*` are gitignored except
   the `.example` templates. If you need a key, ask the user to provide it
   via `.dev.vars` locally or `wrangler pages secret put` in prod. Never
   echo key values into files, logs, or chat.
2. **Do not reintroduce removed features** (auth, Mongo, likes, profiles,
   Stripe) or add a database. If a task seems to need one, stop and ask.
3. **Keep the dependency surface minimal.** Don't add packages to solve
   problems that a small code change fixes. Exception explicitly
   pre-approved: `react-virtuoso` IF long-session DOM size proves to be a
   real, measured problem (it likely won't).
4. Ask the user before anything irreversible or paid: creating Cloudflare
   resources on their account, deploying to production, or any change that
   would increase OpenAI spend.

## Phase 1 — Boot & fix (local, no secrets needed yet)

1. `npm install`. Resolve any peer/version conflicts by adjusting pins in
   `package.json` — prefer moving to current stable minors of Vite 6,
   Tailwind 4, Wrangler, Framer Motion (the code targets stable APIs;
   Motion may now be published as `motion` — migrate imports if needed).
2. `npm run build` until clean, then `npm run dev` and open the app.
3. **Verify the AIC integration against the live API.** This is flagged as
   the highest-risk untested area:
   - Confirm `POST /api/v1/artworks/search` accepts the JSON bodies in
     `src/lib/aic.js` (bool query with `term`, `exists`, `match_phrase`
     with `boost`, plus `fields`, `page`, `limit`). If POST bodies are
     rejected, fall back to the GET form
     (`?query[term][is_public_domain]=true&...`) and reproduce the
     Style>Subject>Classification weighting as closely as the GET syntax
     allows — document any compromise in a code comment.
   - Confirm the deep-pagination cap assumption (`MAX_RANDOM_PAGE` in
     `aic.js`): random pages must never 4xx. Clamp if needed.
   - Confirm `subject_titles` / `classification_titles` /
     `thumbnail.lqip` come back for the requested fields; adjust `FIELDS`
     if any names are wrong.
4. Manually exercise the feed in a browser:
   - Infinite scroll loads continuously with no duplicate cards
     (dedupe lives in `seenIds`).
   - Double-tap (mouse: two fast clicks) fires the heart instantly,
     skeletons appear immediately, genre cards backfill, and the sticky
     "Now hanging · {genre}" banner shows.
   - Scrolling past the whole focused batch without tapping removes the
     banner (revert to EXPLORE). Double-tapping a focused card starts a
     fresh cycle.
   - Test on a phone or devtools touch emulation: double-tap must not
     zoom, and single taps must do nothing.
5. Fix what you find. Prefer minimal diffs; keep the reducer pure.

## Phase 2 — Functions (needs the user's OpenAI key in `.dev.vars`)

1. Create the KV namespace (`npx wrangler kv namespace create LUMEN_KV`),
   put the id in `wrangler.toml`. Ask the user to log in to wrangler first.
2. Run `npm run dev:functions` + `npm run dev` (Vite proxies `/api` → 8788).
3. Test `/api/describe`:
   - Valid id (e.g. `27992`): streams a note token-by-token into the
     "Docent note" panel; second request returns `x-lumen-cache: hit`
     and renders instantly.
   - `?id=abc` → 400. Nonexistent numeric id → 404. 11 rapid cache-miss
     requests from one IP → 429.
   - Verify the KV write-through actually persists
     (`npx wrangler kv key list --binding LUMEN_KV --prefix desc:` —
     add `--local` if testing against local dev storage).
4. Test `/api/contact`: valid note → `{ok:true}` and a `contact:*` KV key;
   missing name/message → 400 with a useful message; 4 rapid posts → 429.
5. If Wrangler's local KV or streaming behaves differently from prod
   assumptions, fix the functions, not the tests.

## Phase 3 — Polish gates (fix only if failing)

- Lighthouse (mobile, production build): Performance ≥ 90,
  Accessibility ≥ 95. Likely levers if short: font loading, image `sizes`,
  IIIF width in `imageUrl()`.
- Keyboard-only pass: every artwork's "More like this" and "Docent note"
  reachable and visibly focused; contact form fully operable.
- `prefers-reduced-motion`: heart burst degrades to a fade, no pulse spam.
- No console errors during a 100+ card scroll session; memory should not
  grow unboundedly (content-visibility should keep this flat).

## Phase 4 — Deploy (with the user's go-ahead)

1. Confirm the user has completed Phase 0 from the README (old OpenAI key
   revoked, Mongo cluster deleted, fresh repo, secret scanning on). Do not
   deploy if the old key is still live.
2. `npm run cf:deploy` (or connect the repo in the Pages dashboard —
   build `npm run build`, output `dist`).
3. Bind `LUMEN_KV` in the Pages project settings; set `OPENAI_API_KEY`
   as an encrypted secret. Remind the user to set the **monthly budget
   cap in the OpenAI dashboard** — treat this as a deploy blocker.
4. Run the README smoke tests against the production URL.
5. Optional, offer but don't require: Resend for contact email, Turnstile
   on the form (needs a frontend site-key wiring — small, additive change).

## Definition of done

Production URL where: the feed scrolls indefinitely; double-tap reliably
enters and exits the genre loop on desktop and mobile; docent notes stream
on first view and are instant on second; the contact form delivers; invalid
and abusive requests are rejected; no secrets exist anywhere in git history;
total hosting cost is $0 and OpenAI is budget-capped.

Report back with: what you fixed in Phase 1 (especially any AIC query-shape
changes), test results per phase, and the live URL.
