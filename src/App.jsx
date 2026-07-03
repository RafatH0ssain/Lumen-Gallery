import { useEffect, useRef, useState } from "react";
import Feed from "./components/Feed.jsx";
import ContactForm from "./components/ContactForm.jsx";

function ContactSheet({ open, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Leave a note at the desk">
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="contact-sheet absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-ink-soft border-l border-brass/20 px-6 py-10 shadow-[-30px_0_80px_rgba(0,0,0,0.6)]"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-10 w-10 rounded-full border border-brass/40 text-brass text-lg leading-none hover:bg-ink"
        >
          ×
        </button>
        <h2 className="font-display text-3xl font-light italic">
          Leave a note at the desk
        </h2>
        <p className="text-ivory-dim mt-2 mb-8">
          Questions, corrections, or a work you think belongs here.
        </p>
        <ContactForm />
        <p className="text-xs text-ivory-dim mt-12 leading-relaxed">
          An endless corridor through the Art Institute of Chicago's open
          collection. Artwork and metadata courtesy of the AIC public API.
          Docent notes are AI-generated and may contain inaccuracies.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div>
      {/* Floating gallery signage — stays out of the artwork's way. */}
      <header className="pointer-events-none fixed top-0 inset-x-0 z-30 flex items-start justify-between px-5 py-4 bg-gradient-to-b from-ink/80 to-transparent">
        <div>
          <h1 className="font-display text-2xl font-light italic leading-none">
            Lumen
          </h1>
          <p className="text-[10px] tracking-[0.28em] uppercase text-brass mt-1">
            Art Institute of Chicago
          </p>
        </div>
        <button
          onClick={() => setContactOpen(true)}
          className="pointer-events-auto text-[11px] tracking-[0.2em] uppercase text-ivory-dim hover:text-brass border border-ivory-dim/30 hover:border-brass/50 rounded-full px-4 py-2 transition-colors"
        >
          Leave a note
        </button>
      </header>

      <main>
        <Feed />
      </main>

      <ContactSheet open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
