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

function ArtCard({
  art,
  focusGenre,
  onFocusRequest,
  onScrolledPast,
  onView,
  eager,
  number,
}) {
  const [heartAt, setHeartAt] = useState(null);
  // Hold the real image back until the card is within ~2.5 viewports AND the
  // page has loaded (so upcoming artworks never contend with the LCP image);
  // the LQIP paints inside the frame box in the meantime.
  const [showImage, setShowImage] = useState(Boolean(eager));
  // Active = mostly on screen; drives the ambient wash + placard entrance.
  const [active, setActive] = useState(false);
  const zoneRef = useRef(null);
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
      { rootMargin: "250% 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      window.removeEventListener("load", reveal);
    };
  }, [showImage]);

  // "Seen" for the engagement loop = card fully scrolled past (above
  // viewport). The same observer drives the active state for the entrance
  // animation and ambient light.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.intersectionRatio >= 0.55);
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
          onScrolledPast(art.id);
        }
      },
      { threshold: [0, 0.55] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [art.id, onScrolledPast]);

  const { onPointerUp } = useDoubleTap(
    (e) => {
      // Feedback first, data second — the burst is what makes it feel instant.
      // Coordinates are relative to the zone: the heart overlays it, since an
      // <img> can't contain children.
      const rect = zoneRef.current.getBoundingClientRect();
      setHeartAt({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      onFocusRequest(art);
    },
    () => onView(art),
  );

  const frameProps = {
    className: "art-frame relative block",
    style: {
      "--ar": art.aspect,
      aspectRatio: art.aspect,
      backgroundImage: art.lqip ? `url(${art.lqip})` : undefined,
    },
    onPointerUp,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onView(art);
      }
    },
    role: "button",
    tabIndex: 0,
    "aria-label": `View “${art.title}” enlarged. Double-tap to see more like this.`,
  };

  return (
    <article ref={cardRef} className="art-card relative" data-active={active}>
      {/* Ambient picture-light spill from the artwork itself. */}
      {art.lqip && (
        <img
          src={art.lqip}
          alt=""
          aria-hidden="true"
          className="ambient absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* The artwork, framed and centered on its stage. */}
      <div
        ref={zoneRef}
        className="art-zone flex items-center justify-center px-5"
      >
        {showImage ? (
          <img
            {...frameProps}
            src={imageUrl(art.image_id, FEED_IMAGE_WIDTH)}
            alt={art.title}
            loading={eager ? "eager" : "lazy"}
            fetchpriority={eager ? "high" : undefined}
            decoding="async"
            draggable={false}
          />
        ) : (
          <div {...frameProps} />
        )}
        {heartAt && (
          <Suspense fallback={null}>
            <HeartBurst at={heartAt} onDone={() => setHeartAt(null)} />
          </Suspense>
        )}
      </div>

      {/* The wall label — a De Stijl block: paper, hard keyline, colour edge. */}
      <div className="placard-zone placard-wrap w-full max-w-2xl mx-auto px-5 pb-8">
        {focusGenre && (
          <p className="mb-2 pl-1 inline-block bg-red text-paper text-[10px] font-bold tracking-[0.22em] uppercase px-2 py-1">
            More · {focusGenre}
          </p>
        )}
        <div className="placard ml-auto mr-0 relative w-[92%] max-w-md px-5 py-4">
          <p className="absolute -top-3 -right-3 h-8 w-8 flex items-center justify-center bg-yellow text-ink text-[11px] font-extrabold tracking-tight border-2 border-ink">
            {number}
          </p>
          <h2 className="font-display font-extrabold uppercase tracking-tight text-lg sm:text-xl leading-[1.05] pr-6">
            {art.title}
          </h2>
          <p className="text-xs font-semibold uppercase tracking-wide mt-2 whitespace-pre-line opacity-80">
            {art.artist_display}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wide mt-1 opacity-55">
            {art.date_display}
            {art.medium_display ? ` · ${art.medium_display}` : ""}
          </p>

          <div className="flex items-center gap-4 mt-3 pt-3 docent-note">
            <DocentNote artId={art.id} />
            {genre && (
              <button
                onClick={() => onFocusRequest(art)}
                className="text-[11px] font-bold tracking-[0.12em] uppercase text-red hover:bg-red hover:text-paper px-1 -mx-1 shrink-0 transition-colors"
                aria-label={`More like this, from ${genre}`}
              >
                More like this →
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(ArtCard);
