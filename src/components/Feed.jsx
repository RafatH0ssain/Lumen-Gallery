import { useEffect, useRef } from "react";
import { useFeed } from "../feed/useFeed.js";
import ArtCard from "./ArtCard.jsx";
import SkeletonCard from "./SkeletonCard.jsx";

export default function Feed() {
  const { state, loadMore, focusGenre, markSeen } = useFeed();
  const sentinelRef = useRef(null);

  // Infinite scroll: a sentinel ~4 viewport-heights early keeps the queue
  // filled well before the user reaches the end.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { rootMargin: "400% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="mx-auto max-w-2xl px-5">
      {state.mode === "FOCUSED" && state.focus && (
        <div
          role="status"
          className="sticky top-3 z-10 mx-auto w-fit rounded-full bg-ink-soft/90 backdrop-blur px-4 py-1.5 text-xs tracking-widest uppercase text-brass border border-brass/30"
        >
          Now hanging · {state.focus.genre}
        </div>
      )}

      {/* min-height keeps the footer below the fold before the first page of
          artworks lands — otherwise it paints high and the arriving cards
          shove it down (a massive layout shift on slow connections). */}
      <div className="flex flex-col gap-16 py-8 min-h-[150vh]">
        {state.items.map((item, i) =>
          item.kind === "skeleton" ? (
            <SkeletonCard key={item.key} />
          ) : (
            <ArtCard
              key={item.art.id}
              art={item.art}
              focusGenre={item.focusGenre}
              onFocusRequest={focusGenre}
              onScrolledPast={markSeen}
              eager={i === 0}
            />
          ),
        )}
      </div>

      {state.error && (
        <p className="text-center text-oxblood py-8" role="alert">
          {state.error}{" "}
          <button onClick={loadMore} className="underline text-ivory">
            Retry
          </button>
        </p>
      )}

      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <p className="text-center text-ivory-dim text-sm py-10">
        Fetching more from the vaults…
      </p>
    </div>
  );
}
