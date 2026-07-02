import Feed from "./components/Feed.jsx";
import ContactForm from "./components/ContactForm.jsx";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-2xl px-5 pt-12 pb-8">
        <p className="text-xs tracking-[0.3em] uppercase text-brass">
          Art Institute of Chicago · open collection
        </p>
        <h1 className="font-display text-5xl font-light italic mt-3">
          Lumen
        </h1>
        <p className="text-ivory-dim mt-3 max-w-md leading-relaxed">
          An endless corridor through the collection. Double-tap anything that
          stops you — the gallery will hang more like it.
        </p>
      </header>

      <main>
        <Feed />
      </main>

      <footer id="contact" className="mx-auto max-w-2xl px-5 py-20">
        <h2 className="font-display text-3xl font-light italic">
          Leave a note at the desk
        </h2>
        <p className="text-ivory-dim mt-2 mb-8">
          Questions, corrections, or a work you think belongs here.
        </p>
        <ContactForm />
        <p className="text-xs text-ivory-dim mt-16">
          Artwork and metadata courtesy of the Art Institute of Chicago public
          API. Docent notes are AI-generated and may contain inaccuracies.
        </p>
      </footer>
    </div>
  );
}
