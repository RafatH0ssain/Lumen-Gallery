import { useEffect, useRef, useState } from "react";
import { useFeed } from "../feed/useFeed.js";
import ArtCard from "./ArtCard.jsx";
import SkeletonCard from "./SkeletonCard.jsx";
import Lightbox from "./Lightbox.jsx";

export default function Feed() {
  const { state, loadMore, focusGenre, markSeen } = useFeed();
  const [viewing, setViewing] = useState(null); // single-tap lightbox
  const [hintVisible, setHintVisible] = useState(true);
  const sentinelRef = useRef(null);

  // The scroll invitation retires after the first real scroll.
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > window.innerHeight / 2) {
        setHintVisible(false);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <div>
      {state.mode === "FOCUSED" && state.focus && (
        <div
          role="status"
          key={state.focus.genre}
          className="genre-banner fixed top-14 sm:top-3 left-1/2 z-20 w-max max-w-[85vw] truncate rounded-full bg-ink-soft/90 backdrop-blur px-4 py-1.5 text-xs tracking-widest uppercase text-brass border border-brass/30"
        >
          Now hanging · {state.focus.genre}
        </div>
      )}

      {state.items.length === 0 && !state.error && <SkeletonCard />}

      {state.items.map((item, i) =>
        item.kind === "skeleton" ? (
          <SkeletonCard key={item.key} />
        ) : (
          <ArtCard
            key={item.art.id}
            art={item.art}
            number={i + 1}
            focusGenre={item.focusGenre}
            onFocusRequest={focusGenre}
            onScrolledPast={markSeen}
            onView={setViewing}
            eager={i === 0}
          />
        ),
      )}

      {/* First-visit invitation to scroll. */}
      {hintVisible && state.items.length > 0 && (
        <div
          aria-hidden="true"
          className="scroll-hint pointer-events-none fixed bottom-1.5 left-1/2 -translate-x-1/2 z-10 text-brass"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {state.error && (
        <p className="text-center text-oxblood py-8" role="alert">
          {state.error}{" "}
          <button onClick={loadMore} className="underline text-ivory">
            Retry
          </button>
        </p>
      )}

      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      <Lightbox art={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
