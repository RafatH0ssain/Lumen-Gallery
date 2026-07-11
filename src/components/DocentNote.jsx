import { useRef, useState } from "react";

// In-memory client cache: a note is only ever streamed once per session.
const noteCache = new Map();

export default function DocentNote({ artId }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(noteCache.get(artId) ?? "");
  const [status, setStatus] = useState("idle"); // idle | streaming | done | error
  const started = useRef(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !started.current && !noteCache.has(artId)) fetchNote();
  }

  async function fetchNote() {
    started.current = true;
    setStatus("streaming");

    try {
      const res = await fetch(`/api/describe?id=${artId}`);
      if (!res.ok) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setText(full);
      }
      noteCache.set(artId, full);
      setStatus("done");
    } catch {
      setStatus("error");
      started.current = false; // allow retry
    }
  }

  return (
    <div className="min-w-0 flex-1">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] uppercase text-ink hover:text-blue transition-colors"
      >
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 border-2 border-ink transition-colors ${
            open ? "bg-blue" : "bg-transparent"
          }`}
        />
        {open ? "Hide note" : "Docent note"}
      </button>

      {open && (
        <div className="mt-2 border-l-4 border-blue pl-3 text-sm leading-relaxed text-ink/85 max-h-[22dvh] overflow-y-auto overscroll-contain">
          {status === "error" ? (
            <p>
              The docent stepped away.{" "}
              <button
                onClick={fetchNote}
                className="font-bold uppercase tracking-wide text-red underline"
              >
                Ask again
              </button>
            </p>
          ) : (
            <p className={status === "streaming" ? "caret" : ""}>
              {text || "\u2026"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
