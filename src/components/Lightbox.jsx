import { useEffect, useRef } from "react";
import { imageUrl } from "../lib/aic.js";

/**
 * Single-tap fullscreen view. Reuses AIC's largest rendition (843px — their
 * IIIF hard cap, verified live); on desktop that file is usually already in
 * the browser cache from the feed, so opening is instant.
 */
export default function Lightbox({ art, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!art) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden"; // freeze snap scroll
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [art, onClose]);

  if (!art) return null;

  return (
    <div
      className="lightbox fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${art.title} — enlarged view`}
      onClick={onClose}
    >
      {/* ambient wash from the artwork itself */}
      <div className="absolute inset-0 bg-ink/95" />
      {art.lqip && (
        <img
          src={art.lqip}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover blur-3xl scale-125 opacity-30"
        />
      )}

      <img
        src={imageUrl(art.image_id, 843)}
        alt={art.title}
        className="lightbox-art relative max-h-[82vh] max-w-full object-contain border-[6px] border-ink-soft shadow-[0_0_0_1px_rgba(194,164,92,0.35),0_40px_120px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      />

      <p className="relative mt-4 max-w-xl text-center text-sm text-ivory-dim">
        <span className="font-display italic text-ivory text-base">
          {art.title}
        </span>
        {art.date_display ? ` · ${art.date_display}` : ""}
      </p>

      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="Close enlarged view"
        className="absolute top-4 right-4 h-11 w-11 rounded-full border border-brass/40 bg-ink-soft/80 text-brass text-xl leading-none backdrop-blur hover:bg-ink-soft"
      >
        ×
      </button>
    </div>
  );
}
