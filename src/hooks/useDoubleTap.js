import { useCallback, useRef } from "react";

const WINDOW_MS = 300;
const MAX_DRIFT_PX = 30;

/**
 * Double-tap detection on pointer events rather than `dblclick`, so touch
 * and mouse behave identically and we control the timing window. Pair with
 * `touch-action: manipulation` on the element to suppress double-tap zoom.
 */
export function useDoubleTap(onDoubleTap) {
  const last = useRef({ t: 0, x: 0, y: 0 });

  const onPointerUp = useCallback(
    (e) => {
      const now = performance.now();
      const { t, x, y } = last.current;
      const isDouble =
        now - t < WINDOW_MS &&
        Math.hypot(e.clientX - x, e.clientY - y) < MAX_DRIFT_PX;

      if (isDouble) {
        last.current = { t: 0, x: 0, y: 0 };
        onDoubleTap(e);
      } else {
        last.current = { t: now, x: e.clientX, y: e.clientY };
      }
    },
    [onDoubleTap],
  );

  return { onPointerUp };
}
