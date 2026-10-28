import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile (bot check). The site key is public; the secret lives in the Pages project.
const TURNSTILE_SITE_KEY = "0x4AAAAAAFp7yttF2cEi3OQ7";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${TURNSTILE_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(window.turnstile));
    script.addEventListener("error", reject);
  });
}

const inputCls =
  "w-full bg-ink border-2 border-paper/25 px-4 py-3 text-paper placeholder:text-paper-dim/60 focus:border-blue focus:outline-none transition-colors";

export default function ContactForm() {
  const [fields, setFields] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");
  const [token, setToken] = useState("");
  const box = useRef(null);
  const widget = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current) return;
        widget.current = ts.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: setToken,
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widget.current != null) window.turnstile?.remove(widget.current);
    };
  }, []);

  function set(key) {
    return (e) => setFields((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit() {
    if (!fields.name.trim() || !fields.message.trim()) {
      setErrorMsg("Name and message are required.");
      setStatus("error");
      return;
    }
    if (!token) {
      setErrorMsg("Please wait for the verification check to finish.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fields, turnstileToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A token is single-use: get a fresh one for the retry.
        setToken("");
        if (widget.current != null) window.turnstile?.reset(widget.current);
        setErrorMsg(data.error ?? "The note couldn't be delivered. Try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setErrorMsg("The note couldn't be delivered. Check your connection.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="placard px-5 py-4 w-fit font-bold uppercase tracking-wide text-sm" role="status">
        Note received. Thank you for visiting.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-paper-dim">
        Name
        <input
          className={`${inputCls} mt-1`}
          value={fields.name}
          onChange={set("name")}
          maxLength={100}
          autoComplete="name"
        />
      </label>
      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-paper-dim">
        Email (optional)
        <input
          type="email"
          className={`${inputCls} mt-1`}
          value={fields.email}
          onChange={set("email")}
          maxLength={200}
          autoComplete="email"
        />
      </label>
      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-paper-dim">
        Message
        <textarea
          className={`${inputCls} mt-1 min-h-32 resize-y`}
          value={fields.message}
          onChange={set("message")}
          maxLength={2000}
        />
      </label>

      <div ref={box} />

      {status === "error" && (
        <p className="text-red text-sm font-semibold" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        onClick={submit}
        disabled={status === "sending"}
        className="w-fit bg-red text-paper border-2 border-red px-6 py-3 text-sm font-bold tracking-[0.12em] uppercase hover:bg-ink hover:text-paper disabled:opacity-50 transition-colors"
      >
        {status === "sending" ? "Sending…" : "Leave note"}
      </button>
    </div>
  );
}
