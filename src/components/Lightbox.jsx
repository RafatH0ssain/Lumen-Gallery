import { useEffect, useRef } from "react";
import { imageUrl } from "../lib/aic.js";
import { usePinchZoom } from "../hooks/usePinchZoom.js";

/**
 * Single-tap fullscreen view. Reuses AIC's largest rendition (843px — their
 * IIIF hard cap, verified live); on desktop that file is usually already in
 * the browser cache from the feed, so opening is instant.
 *
 * Pinch, drag, double-tap or scroll-wheel to zoom (usePinchZoom). The frame
 * owns the gesture via `touch-action: none`, so the picture no longer drifts
 * off when you try to pinch it.
 */
export default function Lightbox({ art, onClose }) {
  const closeRef = useRef(null);
  const { frameRef, imgRef, zoomed, reset, handlers } = usePinchZoom();

  useEffect(() => {
    if (!art) return;
    reset();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden"; // freeze snap scroll
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [art, onClose, reset]);

  if (!art) return null;

  return (
    <div
      className="lightbox fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${art.title} — enlarged view`}
      onClick={onClose}
    >
      {/* black canvas + a faint wash of the artwork's own colour */}
      <div className="absolute inset-0 bg-ink" />
      {art.lqip && (
        <img
          src={art.lqip}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover blur-3xl scale-125 opacity-20"
        />
      )}

      <div
        ref={frameRef}
        className="lightbox-frame relative bg-ink-soft"
        style={{ maxHeight: "82vh", maxWidth: "100%" }}
        {...handlers}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          ref={imgRef}
          src={imageUrl(art.image_id, 843)}
          alt={art.title}
          draggable={false}
          className="lightbox-img block max-h-[calc(82vh-16px)] max-w-full object-contain"
          style={{ cursor: zoomed ? "grab" : "zoom-in" }}
        />
      </div>

      {/* wall label, same graphic language as the feed placards */}
      <div
        className="placard relative mt-6 max-w-md px-5 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display font-extrabold uppercase tracking-tight text-base leading-tight">
          {art.title}
        </h2>
        {art.date_display && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60 mt-1">
            {art.date_display}
          </p>
        )}
      </div>

      <p className="pointer-events-none relative mt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-paper-dim">
        Pinch · scroll · double-tap to zoom
      </p>

      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="Close enlarged view"
        className="absolute top-4 right-4 h-11 w-11 border-2 border-paper bg-red text-paper text-xl font-bold leading-none hover:bg-paper hover:text-ink transition-colors"
      >
        ×
      </button>
    </div>
  );
}
