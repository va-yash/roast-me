"use client";

import { useState, useEffect } from "react";

const F = {
  cinematic: "'Cormorant Garamond', serif",
  display:   "'Space Grotesk', sans-serif",
  ui:        "'Syne', sans-serif",
  mono:      "'Inconsolata', monospace",
};

const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID ?? "mqengjav";
const COSMOS_CHAT_URL = "#cosmos";

const DARK = {
  bg: "#060A14", card: "#0C1422", gold: "#C08B2F", goldLight: "#DEB86A",
  goldFaint: "rgba(192,139,47,0.09)", goldBorder: "rgba(192,139,47,0.28)",
  text: "#E2E8F4", muted: "#64748B", dim: "#1E293B",
  border: "rgba(59,100,200,0.18)", navBg: "rgba(6,10,20,0.94)",
  inputBg: "rgba(255,255,255,0.04)", inputBorder: "rgba(59,100,200,0.2)",
};
const LIGHT = {
  bg: "#F8F4EC", card: "#FFFDF7", gold: "#9A6B18", goldLight: "#7A5010",
  goldFaint: "rgba(154,107,24,0.08)", goldBorder: "rgba(154,107,24,0.22)",
  text: "#1C1628", muted: "#6B7280", dim: "#C4B89A",
  border: "rgba(59,100,200,0.1)", navBg: "rgba(248,244,236,0.97)",
  inputBg: "rgba(0,0,0,0.04)", inputBorder: "rgba(59,100,200,0.15)",
};

type Rating = "sad" | "ok" | "happy";

export default function Feedback() {
  const [isDark, setIsDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const C = isDark ? DARK : LIGHT;

  useEffect(() => {
    const saved = localStorage.getItem("rm-theme");
    if (saved === "light") { setIsDark(false); document.documentElement.classList.add("light-theme"); }
  }, []);

  const toggle = () => {
    setIsDark(p => {
      const next = !p;
      localStorage.setItem("rm-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("light-theme", !next);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch { setError("Couldn't send feedback. Please try again."); }
    finally { setLoading(false); }
  };

  const lk: React.CSSProperties = {
    fontSize: 11, fontFamily: F.ui, fontWeight: 600, color: C.muted,
    textDecoration: "underline", textUnderlineOffset: 3, letterSpacing: "0.02em",
  };

  const emojiBtn = (id: Rating, emoji: string, label: string) => (
    <button onClick={() => setRating(id)} title={label} style={{
      fontSize: 28, background: "none",
      border: `2px solid ${rating === id ? C.gold : C.border}`,
      borderRadius: "50%", width: 56, height: 56, cursor: "pointer",
      background: rating === id ? C.goldFaint : "none" as unknown as string,
      transform: rating === id ? "scale(1.12)" : "scale(1)",
      transition: "all 0.15s ease",
    } as React.CSSProperties}>
      {emoji}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F.ui, transition: "background 0.25s, color 0.25s" }}>

      {/* Nav */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: 46, background: C.navBg, backdropFilter: "blur(14px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 1.25rem" }}>
        <a href="/" style={{ fontFamily: F.ui, fontSize: 13, fontWeight: 800, color: C.gold, letterSpacing: "0.1em", marginRight: 16, textDecoration: "none", flexShrink: 0 }}>ROAST-ME</a>
        <div style={{ display: "flex", alignItems: "center", flex: 1 }} className="rm-nav-links">
          <span style={{ color: C.dim, marginRight: 12, fontSize: 12 }}>|</span>
          <a href={COSMOS_CHAT_URL} style={lk}>Wanna Chat with Cosmos?</a>
          <span style={{ color: C.dim, margin: "0 10px", fontSize: 12 }}>|</span>
          <a href="/feedback" style={{ ...lk, color: C.goldLight }}>Feedback</a>
          <span style={{ color: C.dim, margin: "0 10px", fontSize: 12 }}>|</span>
          <a href="/know-the-creator" style={lk}>Know the Creator</a>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggle} style={{ background: C.goldFaint, border: `1px solid ${C.goldBorder}`, borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 13 }}>
            {isDark ? "☀️" : "🌙"}
          </button>
          <a href="/?openProfile=1" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }} className="rm-nav-links">
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.muted, border: `1.5px solid ${C.goldBorder}` }}>✦</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, fontFamily: F.ui }}>My Profile</span>
          </a>
          <button onClick={() => setMobileOpen(p => !p)} className="rm-hamburger" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexDirection: "column", gap: 4, display: "flex" }}>
            <div style={{ width: 18, height: 2, background: C.muted, borderRadius: 2 }} />
            <div style={{ width: 18, height: 2, background: C.muted, borderRadius: 2 }} />
            <div style={{ width: 18, height: 2, background: C.muted, borderRadius: 2 }} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{ position: "fixed", top: 46, left: 0, right: 0, zIndex: 199, background: C.navBg, backdropFilter: "blur(14px)", borderBottom: `1px solid ${C.border}`, padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>
          <a href={COSMOS_CHAT_URL} style={lk}>Wanna Chat with Cosmos?</a>
          <a href="/feedback" style={{ ...lk, color: C.goldLight }}>Feedback</a>
          <a href="/know-the-creator" style={lk}>Know the Creator</a>
          <a href="/?openProfile=1" style={{ ...lk, textDecoration: "none" }}>My Profile</a>
          <button onClick={toggle} style={{ ...lk, background: "none", border: "none", display: "flex", gap: 6, cursor: "pointer" }}>{isDark ? "☀️ Light mode" : "🌙 Dark mode"}</button>
        </div>
      )}

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(30,58,140,0.2) 0%, transparent 65%)" }} />

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 1.5rem 4rem" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted, textDecoration: "none", fontFamily: F.ui, letterSpacing: "0.08em", marginBottom: "2.5rem", opacity: 0.7 }}>
            ← Back to the cosmos
          </a>

          {submitted ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <div style={{ fontSize: 48, marginBottom: "1rem" }}>✨</div>
              <h2 style={{ fontFamily: F.cinematic, fontSize: "clamp(1.8rem, 5vw, 2.6rem)", fontWeight: 600, color: C.text, marginBottom: "0.75rem", fontStyle: "italic" }}>
                The cosmos heard you.
              </h2>
              <p style={{ fontFamily: F.ui, fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: "2rem" }}>
                Thank you for your feedback — it helps shape this into something better.
              </p>
              <a href="/" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 6, background: `linear-gradient(135deg, ${C.gold} 0%, #7A5010 100%)`, color: "#FFF8EE", fontFamily: F.display, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textDecoration: "none" }}>
                Back to Roast-Me
              </a>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 9, letterSpacing: "0.28em", color: C.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem", fontFamily: F.ui }}>Feedback</div>
              <h1 style={{ fontFamily: F.cinematic, fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 600, color: C.text, lineHeight: 1.2, marginBottom: "0.5rem" }}>
                Share your experience
              </h1>
              <p style={{ fontFamily: F.cinematic, fontSize: "clamp(1rem, 2.5vw, 1.2rem)", color: C.muted, fontStyle: "italic", lineHeight: 1.7, marginBottom: "2.5rem" }}>
                How has it been? The cosmos are listening.
              </p>

              {/* Emoji selector */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.5rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem", fontFamily: F.ui }}>How has your experience been?</div>
                <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
                  {emojiBtn("sad", "😢", "Not great")}
                  {emojiBtn("ok", "😐", "It's okay")}
                  {emojiBtn("happy", "😊", "Love it")}
                </div>
              </div>

              {/* Message */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.5rem", marginBottom: "1.25rem" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem", fontFamily: F.ui }}>
                  Any thoughts? (optional)
                </div>
                <textarea
                  value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Suggestions, bugs, or just vibes..."
                  style={{
                    width: "100%", minHeight: 100, resize: "vertical",
                    background: C.inputBg, border: `1px solid ${C.inputBorder}`,
                    color: C.text, borderRadius: 8, padding: "10px 12px",
                    fontFamily: F.ui, fontSize: 13, outline: "none",
                  }}
                />
              </div>

              {error && <p style={{ fontSize: 12, color: "#E8665A", fontFamily: F.ui, marginBottom: "0.75rem" }}>{error}</p>}

              <div style={{ display: "flex", gap: 10 }}>
                <a href="/" style={{
                  flex: 1, padding: "13px 0", borderRadius: 6, textAlign: "center",
                  background: "transparent", border: `1px solid ${C.border}`,
                  color: C.muted, fontFamily: F.ui, fontWeight: 600, fontSize: 13,
                  textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
                }}>Cancel</a>
                <button onClick={handleSubmit} disabled={!rating || loading} style={{
                  flex: 2, padding: "13px 0", borderRadius: 6,
                  background: rating ? `linear-gradient(135deg, ${C.gold} 0%, #7A5010 100%)` : C.dim,
                  border: "none", color: rating ? "#FFF8EE" : C.muted,
                  fontFamily: F.display, fontWeight: 700, fontSize: 14,
                  letterSpacing: "0.04em", cursor: rating ? "pointer" : "default",
                  transition: "all 0.2s",
                }}>
                  {loading ? "Sending…" : "Send Feedback"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
