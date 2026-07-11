import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export default function HeartBurst({ at, onDone }) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {at && (
        <motion.div
          key={`${at.x}-${at.y}`}
          className="pointer-events-none absolute z-10"
          style={{ left: at.x, top: at.y, x: "-50%", y: "-50%" }}
          initial={{ scale: 0, opacity: 0.9, rotate: -8 }}
          animate={
            reduced
              ? { scale: 1, opacity: [0.9, 0.9, 0] }
              : { scale: [0, 1.25, 1], opacity: [0.9, 1, 0], rotate: 0 }
          }
          transition={{ duration: 0.85, times: [0, 0.35, 1] }}
          onAnimationComplete={onDone}
          aria-hidden="true"
        >
          <svg width="88" height="88" viewBox="0 0 24 24" fill="#d8231f">
            <path d="M12 21s-6.7-4.35-9.33-8.11C.9 10.34 1.7 6.9 4.42 5.6 6.4 4.66 8.7 5.3 12 8.28c3.3-2.98 5.6-3.62 7.58-2.68 2.72 1.3 3.52 4.74 1.75 7.29C18.7 16.65 12 21 12 21z" />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
