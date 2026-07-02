import { useCallback, useEffect, useReducer, useRef } from "react";
import { feedReducer, initialFeedState, FOCUS_BATCH } from "./feedReducer.js";
import { fetchExplorePage, fetchGenreBatch, genreOf } from "../lib/aic.js";

const PREFETCH_THRESHOLD = 8; // keep at least this many unseen cards queued

export function useFeed() {
  const [state, dispatch] = useReducer(feedReducer, initialFeedState);
  const visitedPages = useRef(new Set());
  const loading = useRef(false);
  const focusSeq = useRef(0); // invalidates in-flight genre fetches

  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const arts = await fetchExplorePage(visitedPages.current);
      dispatch({ type: "EXPLORE_APPEND", arts });
    } catch {
      dispatch({
        type: "ERROR",
        message: "The collection is unreachable right now. Pull to retry.",
      });
    } finally {
      loading.current = false;
    }
  }, []);

  // Initial fill: two pages so the scroll runway starts deep.
  useEffect(() => {
    (async () => {
      await loadMore();
      loadMore();
    })();
  }, [loadMore]);

  /**
   * The double-tap. Heart animation is fired by the card itself, synchronously
   * on the tap — everything here is the data side, and it begins with an
   * optimistic skeleton splice so the transition feels instantaneous.
   */
  const focusGenre = useCallback(
    async (art) => {
      const genre = genreOf(art);
      if (!genre) return; // no genre metadata: heart still plays, feed unchanged

      const seq = ++focusSeq.current;
      const placeholderKeys = Array.from(
        { length: 3 },
        (_, i) => `sk-${seq}-${i}`,
      );
      dispatch({
        type: "FOCUS_START",
        genre,
        anchorArtId: art.id,
        placeholderKeys,
      });

      try {
        const exclude = new Set(stateRef.current.seenIds);
        exclude.add(art.id);
        const arts = await fetchGenreBatch(genre, exclude, FOCUS_BATCH);
        if (focusSeq.current !== seq) return; // superseded by a newer tap
        dispatch({ type: "FOCUS_FILL", arts, placeholderKeys });
      } catch {
        if (focusSeq.current !== seq) return;
        dispatch({ type: "FOCUS_ABORT", placeholderKeys });
      }
    },
    [], // stateRef keeps this callback stable
  );

  // A ref mirror of state so focusGenre can read fresh seenIds without
  // re-creating the callback (and re-rendering every card) on each append.
  const stateRef = useRef(state);
  stateRef.current = state;

  const markSeen = useCallback((artId) => {
    dispatch({ type: "ITEM_SEEN", artId });
  }, []);

  return { state, loadMore, focusGenre, markSeen, PREFETCH_THRESHOLD };
}
