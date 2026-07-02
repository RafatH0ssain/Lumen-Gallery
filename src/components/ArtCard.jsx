import { memo, useEffect, useRef, useState } from "react";
import { imageUrl, genreOf } from "../lib/aic.js";
import { useDoubleTap } from "../hooks/useDoubleTap.js";
import HeartBurst from "./HeartBurst.jsx";
import DocentNote from "./DocentNote.jsx";

function ArtCard({ art, focusGenre, onFocusRequest, onScrolledPast }) {
  const [heartAt, setHeartAt] = useState(null);
  const cardRef = useRef(null);
  const genre = genreOf(art);

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
        aria-label={`${art.title}. Double-tap to see more like this.`}
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
        <img
          src={imageUrl(art.image_id)}
          alt={art.title}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="relative h-full w-full object-cover"
        />
        <HeartBurst at={heartAt} onDone={() => setHeartAt(null)} />
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
              aria-label={`Show more artworks like this, from ${genre}`}
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
