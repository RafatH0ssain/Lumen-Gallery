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
      <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="contact-sheet absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-ink-soft border-l-4 border-blue px-6 py-10 shadow-[-30px_0_80px_rgba(0,0,0,0.7)]"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-10 w-10 border-2 border-paper bg-red text-paper text-lg font-bold leading-none hover:bg-paper hover:text-ink transition-colors"
        >
          ×
        </button>
        <p className="inline-block bg-yellow text-ink text-[10px] font-bold tracking-[0.22em] uppercase px-2 py-1 mb-4">
          The front desk
        </p>
        <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight leading-[0.95]">
          Leave a note
        </h2>
        <p className="text-paper-dim mt-3 mb-8 text-sm">
          Questions, corrections, or a work you think belongs here.
        </p>
        <ContactForm />
        <p className="text-[11px] text-paper-dim mt-12 leading-relaxed uppercase tracking-wide">
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
      <header className="pointer-events-none fixed top-0 inset-x-0 z-30 flex items-start justify-between px-5 py-4 bg-gradient-to-b from-ink/85 to-transparent">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-tight leading-none">
            Lumen
            <span aria-hidden="true" className="flex gap-1">
              <span className="h-3 w-3 bg-red" />
              <span className="h-3 w-3 bg-blue" />
              <span className="h-3 w-3 bg-yellow" />
            </span>
          </h1>
          <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-paper-dim mt-1.5">
            Art Institute of Chicago
          </p>
        </div>
        <button
          onClick={() => setContactOpen(true)}
          className="pointer-events-auto text-[11px] font-bold tracking-[0.16em] uppercase text-paper hover:bg-red border-2 border-paper hover:border-red px-4 py-2 transition-colors"
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
