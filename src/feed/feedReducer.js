/**
 * The engagement-loop state machine.
 *
 * Two modes:
 *   EXPLORE  — queue fed by random AIC pages.
 *   FOCUSED  — a batch of 3–5 same-genre works spliced directly after the
 *              double-tapped card. If the user scrolls past the whole batch
 *              without double-tapping any of them, we REVERT to EXPLORE.
 *              A double-tap on any card (focused or not) starts a fresh
 *              FOCUS cycle for that card's genre.
 *
 * The explore cursor is never discarded during FOCUSED — appends simply land
 * after the focused batch, so reverting is free.
 */

export const FOCUS_BATCH = 5;

export const initialFeedState = {
  items: [], // { kind: 'art', art, focusGenre? } | { kind: 'skeleton', key }
  seenIds: new Set(), // artwork ids present anywhere in the feed (dedupe)
  mode: "EXPLORE",
  focus: null, // { genre, memberIds: Set, size, seen, pending }
  error: null,
};

function indexOfArt(items, artId) {
  return items.findIndex((it) => it.kind === "art" && it.art.id === artId);
}

export function feedReducer(state, action) {
  switch (action.type) {
    case "EXPLORE_APPEND": {
      const fresh = action.arts.filter((a) => !state.seenIds.has(a.id));
      if (!fresh.length) return state;
      const seenIds = new Set(state.seenIds);
      fresh.forEach((a) => seenIds.add(a.id));
      return {
        ...state,
        error: null,
        seenIds,
        items: [...state.items, ...fresh.map((art) => ({ kind: "art", art }))],
      };
    }

    case "FOCUS_START": {
      // Optimistic: splice skeletons in immediately after the tapped card.
      const { genre, anchorArtId, placeholderKeys } = action;
      const items = [...state.items];
      const anchor = indexOfArt(items, anchorArtId);
      const skeletons = placeholderKeys.map((key) => ({
        kind: "skeleton",
        key,
      }));
      items.splice(anchor === -1 ? items.length : anchor + 1, 0, ...skeletons);
      return {
        ...state,
        items,
        mode: "FOCUSED",
        focus: { genre, memberIds: new Set(), size: 0, seen: 0, pending: true },
      };
    }

    case "FOCUS_FILL": {
      const { arts, placeholderKeys } = action;
      const keys = new Set(placeholderKeys);
      const firstSkeleton = state.items.findIndex(
        (it) => it.kind === "skeleton" && keys.has(it.key),
      );
      const items = state.items.filter(
        (it) => !(it.kind === "skeleton" && keys.has(it.key)),
      );

      if (!arts.length || !state.focus) {
        // Nothing retrievable for this genre — quiet revert.
        return { ...state, items, mode: "EXPLORE", focus: null };
      }

      const seenIds = new Set(state.seenIds);
      const memberIds = new Set();
      arts.forEach((a) => {
        seenIds.add(a.id);
        memberIds.add(a.id);
      });
      const focusedItems = arts.map((art) => ({
        kind: "art",
        art,
        focusGenre: state.focus.genre,
      }));
      items.splice(
        firstSkeleton === -1 ? items.length : firstSkeleton,
        0,
        ...focusedItems,
      );
      return {
        ...state,
        items,
        seenIds,
        focus: {
          ...state.focus,
          memberIds,
          size: arts.length,
          pending: false,
        },
      };
    }

    case "ITEM_SEEN": {
      // "Seen" = the user scrolled fully past a focused card without tapping.
      const { focus } = state;
      if (
        state.mode !== "FOCUSED" ||
        !focus ||
        focus.pending ||
        !focus.memberIds.has(action.artId)
      ) {
        return state;
      }
      const memberIds = new Set(focus.memberIds);
      memberIds.delete(action.artId); // count each member once
      const seen = focus.seen + 1;
      if (seen >= focus.size) {
        // Whole batch scrolled past, zero double-taps: revert to EXPLORE.
        return { ...state, mode: "EXPLORE", focus: null };
      }
      return { ...state, focus: { ...focus, memberIds, seen } };
    }

    case "FOCUS_ABORT": {
      // Genre fetch failed — remove skeletons, resume EXPLORE.
      const keys = new Set(action.placeholderKeys);
      return {
        ...state,
        items: state.items.filter(
          (it) => !(it.kind === "skeleton" && keys.has(it.key)),
        ),
        mode: "EXPLORE",
        focus: null,
      };
    }

    case "ERROR":
      return { ...state, error: action.message };

    default:
      return state;
  }
}
