import { useCallback, useEffect, useRef, useState } from "react";

const MIN = 1;
const MAX = 6;
const clampScale = (s) => Math.min(MAX, Math.max(MIN, s));

/**
 * Self-contained pinch / pan / double-tap / wheel zoom for a single image.
 *
 * The lightbox sits over a scroll-snap feed, so we can't lean on native
 * browser pinch — it pans the visual viewport and the picture drifts off
 * screen. Instead the frame takes `touch-action: none` (see styles.css) and
 * we drive the transform ourselves from pointer events, keeping the point
 * under the fingers (or cursor) pinned while scaling.
 *
 * Transform is written straight to the node in a ref, not React state, so a
 * drag doesn't re-render every frame. `zoomed` is the only state — it just
 * flips the cursor and tells the caller a pan is in progress.
 */
export function usePinchZoom() {
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const pointers = useRef(new Map()); // pointerId -> { x, y }
  const tf = useRef({ s: 1, x: 0, y: 0 }); // live transform
  const gesture = useRef(null); // pinch | pan baseline
  const tap = useRef({ x: 0, y: 0, moved: false });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const [zoomed, setZoomed] = useState(false);

  const apply = () => {
    const img = imgRef.current;
    if (img) {
      const { x, y, s } = tf.current;
      img.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    }
  };

  // Center of the frame in client coords — the origin for all math below.
  const center = () => {
    const r = frameRef.current.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  // Keep the picture from being dragged entirely off its own box.
  const clampTranslate = () => {
    const img = imgRef.current;
    if (!img) return;
    const s = tf.current.s;
    const maxX = (img.offsetWidth * (s - 1)) / 2 + 24;
    const maxY = (img.offsetHeight * (s - 1)) / 2 + 24;
    tf.current.x = Math.min(maxX, Math.max(-maxX, tf.current.x));
    tf.current.y = Math.min(maxY, Math.max(-maxY, tf.current.y));
  };

  // Scale toward a focal point (client coords), keeping that point fixed.
  const zoomToPoint = (clientX, clientY, nextScale, animate = false) => {
    const img = imgRef.current;
    if (!img) return;
    const { cx, cy } = center();
    const fx = clientX - cx;
    const fy = clientY - cy;
    const s0 = tf.current.s;
    const s1 = clampScale(nextScale);
    if (animate) img.classList.add("zooming");
    tf.current.x = fx - (fx - tf.current.x) * (s1 / s0);
    tf.current.y = fy - (fy - tf.current.y) * (s1 / s0);
    tf.current.s = s1;
    if (s1 === 1) {
      tf.current.x = 0;
      tf.current.y = 0;
    }
    clampTranslate();
    apply();
    setZoomed(s1 > 1.01);
  };

  const reset = useCallback((animate = false) => {
    const img = imgRef.current;
    if (img && animate) img.classList.add("zooming");
    tf.current = { s: 1, x: 0, y: 0 };
    pointers.current.clear();
    gesture.current = null;
    apply();
    setZoomed(false);
  }, []);

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const { cx, cy } = center();
    imgRef.current?.classList.remove("zooming");
    gesture.current = {
      type: "pinch",
      startDist: dist,
      startScale: tf.current.s,
      startTx: tf.current.x,
      startTy: tf.current.y,
      startMid: { x: (a.x + b.x) / 2 - cx, y: (a.y + b.y) / 2 - cy },
    };
  };

  const onPointerDown = (e) => {
    frameRef.current?.setPointerCapture?.(e.pointerId);
    imgRef.current?.classList.remove("zooming");
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap.current = { x: e.clientX, y: e.clientY, moved: false };
    if (pointers.current.size === 2) startPinch();
    else gesture.current = null; // pan baseline is set on first move
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 8) {
      tap.current.moved = true;
    }

    const g = gesture.current;
    if (pointers.current.size >= 2 && g?.type === "pinch") {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const { cx, cy } = center();
      const mid = { x: (a.x + b.x) / 2 - cx, y: (a.y + b.y) / 2 - cy };
      const s1 = clampScale(g.startScale * (dist / g.startDist));
      // Pin the content point that started under the midpoint (see derivation
      // in the module comment): t1 = mid - (startMid - startT) * s1/startScale.
      tf.current.s = s1;
      tf.current.x = mid.x - (g.startMid.x - g.startTx) * (s1 / g.startScale);
      tf.current.y = mid.y - (g.startMid.y - g.startTy) * (s1 / g.startScale);
      if (s1 === 1) {
        tf.current.x = 0;
        tf.current.y = 0;
      }
      clampTranslate();
      apply();
      setZoomed(s1 > 1.01);
    } else if (pointers.current.size === 1 && tf.current.s > 1) {
      if (g?.type !== "pan") {
        gesture.current = {
          type: "pan",
          startX: e.clientX,
          startY: e.clientY,
          startTx: tf.current.x,
          startTy: tf.current.y,
        };
      }
      const gp = gesture.current;
      tf.current.x = gp.startTx + (e.clientX - gp.startX);
      tf.current.y = gp.startTy + (e.clientY - gp.startY);
      clampTranslate();
      apply();
    }
  };

  const endPointer = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);

    if (pointers.current.size === 1) {
      // A finger lifted mid-pinch — rebase the remaining one for panning.
      gesture.current = null;
      return;
    }
    if (pointers.current.size > 1) return;

    // Last finger up. A clean tap (no drag) toggles zoom on a quick double.
    gesture.current = null;
    if (tap.current.moved) return;
    const now = performance.now();
    const near =
      Math.hypot(e.clientX - lastTap.current.x, e.clientY - lastTap.current.y) <
      30;
    if (now - lastTap.current.t < 300 && near) {
      lastTap.current = { t: 0, x: 0, y: 0 };
      const target = tf.current.s > 1.01 ? 1 : 2.6;
      zoomToPoint(e.clientX, e.clientY, target, true);
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  // Wheel zoom (desktop). Must be non-passive to preventDefault the page zoom.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomToPoint(e.clientX, e.clientY, tf.current.s * factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return {
    frameRef,
    imgRef,
    zoomed,
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
  };
}
