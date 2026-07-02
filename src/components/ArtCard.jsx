import { lazy, memo, Suspense, useEffect, useRef, useState } from "react";
import { imageUrl, genreOf, feedImageWidth } from "../lib/aic.js";
import { useDoubleTap } from "../hooks/useDoubleTap.js";
import DocentNote from "./DocentNote.jsx";

// Computed once: the one IIIF rendition this viewport needs (1.5x density cap).
const FEED_IMAGE_WIDTH = feedImageWidth();

// HeartBurst carries the motion library (~35KB gz) — the only use of it, and
// not needed until the first double-tap. Split it out of the critical bundle
// and warm the chunk once the main thread goes idle so that tap is instant.
const HeartBurst = lazy(() => import("./HeartBurst.jsx"));
const warmHeartBurst = () => {
  const idle = () => import("./HeartBurst.jsx");
  if ("requestIdleCallback" in window) requestIdleCallback(idle);
  else setTimeout(idle, 2000);
};
// After load, not just idle: the chunk must not race the LCP image.
if (document.readyState === "complete") warmHeartBurst();
else window.addEventListener("load", warmHeartBurst, { once: true });

function ArtCard({ art, focusGenre, onFocusRequest, onScrolledPast, eager }) {
  const [heartAt, setHeartAt] = useState(null);
  // Native loading="lazy" fetches from thousands of px away on slow
  // connections, so queued below-fold images contend with the first (LCP)
  // artwork for bandwidth. Hold the real image back until the card is within
  // ~1.5 viewports AND the page has loaded; the LQIP covers the gap, as the
  // blur-up intends.
  const [showImage, setShowImage] = useState(Boolean(eager));
  const cardRef = useRef(null);
  const genre = genreOf(art);

  useEffect(() => {
    if (showImage) return;
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    const reveal = () => !cancelled && setShowImage(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (document.readyState === "complete") reveal();
        else window.addEventListener("load", reveal, { once: true });
      },
      { rootMargin: "150% 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      window.removeEventListener("load", reveal);
    };
  }, [showImage]);

  const { onPointerUp } = useDoubleTap((e) => {
    // Feedback first, data second — the burst is what makes it feel instant.
    const rect = cardRef.current.getBoundingClientRect();
    setHeartAt({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    onFocusRequest(art);
  });

  // "Seen" for the engagement loop = card fully scrolled past (above viewport).
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
          onScrolledPast(art.id);
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [art.id, onScrolledPast]);

  return (
    <article className="art-card">
      {focusGenre && (
        <p className="text-[11px] tracking-[0.25em] uppercase text-brass mb-2">
          More · {focusGenre}
        </p>
      )}

      <div
        ref={cardRef}
        onPointerUp={onPointerUp}
        className="relative cursor-pointer border-[6px] border-ink-soft shadow-[0_0_0_1px_rgba(194,164,92,0.25),0_24px_60px_rgba(0,0,0,0.6)] bg-ink-soft"
        style={{ aspectRatio: art.aspect }}
      >
        {/* Blur-up: AIC ships a base64 LQIP with every thumbnail. */}
        {art.lqip && (
          <img
            src={art.lqip}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover blur-lg scale-105"
          />
        )}
        {/* The first card is the LCP element: eager + high priority, never
            gated. Everything else waits for showImage above. */}
        {showImage && (
          <img
            src={imageUrl(art.image_id, FEED_IMAGE_WIDTH)}
            alt={art.title}
            loading={eager ? "eager" : "lazy"}
            fetchpriority={eager ? "high" : undefined}
            decoding="async"
            draggable={false}
            className="relative h-full w-full object-cover"
          />
        )}
        {heartAt && (
          <Suspense fallback={null}>
            <HeartBurst at={heartAt} onDone={() => setHeartAt(null)} />
          </Suspense>
        )}
      </div>

      {/* The wall label — museum didactic placard, offset like the real thing. */}
      <div className="placard ml-auto mr-2 -mt-4 relative w-[85%] max-w-sm px-5 py-4">
        <h2 className="font-display text-xl leading-snug">{art.title}</h2>
        <p className="text-sm mt-1 whitespace-pre-line opacity-80">
          {art.artist_display}
        </p>
        <p className="text-xs mt-1 opacity-60">
          {art.date_display}
          {art.medium_display ? ` · ${art.medium_display}` : ""}
        </p>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-black/10">
          <DocentNote artId={art.id} />
          {genre && (
            <button
              onClick={() => onFocusRequest(art)}
              className="text-xs font-medium tracking-wide uppercase text-oxblood hover:opacity-70"
              aria-label={`More like this, from ${genre}`}
            >
              More like this
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default memo(ArtCard);
