"use client";

import { useState } from "react";

const C = {
  bg:         "#060A14",
  card:       "#0C1422",
  gold:       "#C08B2F",
  goldLight:  "#DEB86A",
  goldFaint:  "rgba(192,139,47,0.09)",
  goldBorder: "rgba(192,139,47,0.28)",
  text:       "#E2E8F4",
  muted:      "#64748B",
  dim:        "#1E293B",
  border:     "rgba(59,100,200,0.18)",
} as const;

const F = {
  cinematic: "'Cormorant Garamond', serif",
  display:   "'Space Grotesk', sans-serif",
  ui:        "'Syne', sans-serif",
  mono:      "'Inconsolata', monospace",
} as const;

// ─── Replace YOUR_FORM_ID with your actual Formspree form ID ───────────────────
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

type Rating = "sad" | "alright" | "happy";

export default function Feedback() {
  const [rating,    setRating]    = useState<Rating | null>(null);
  const [message,   setMessage]   = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async () => {
    if (!rating) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Couldn't send feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const navLinkBase: React.CSSProperties = {
    fontSize: 11, fontFamily: F.ui, fontWeight: 600,
    color: C.muted, textDecoration: "underline",
    textUnderlineOffset: 3,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F.ui }}>

      {/* Nav bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: 46, background: "rgba(6,10,20,0.94)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid rgba(59,100,200,0.15)`,
        display: "flex", alignItems: "center", padding: "0 1.5rem", gap: 0,
      }}>
        <a href="/" style={{
          fontFamily: F.ui, fontSize: 13, fontWeight: 800,
          color: C.gold, letterSpacing: "0.1em", marginRight: 18, textDecoration: "none",
        }}>
          ROAST-ME.ME
        </a>
        <span style={{ color: C.dim, marginRight: 14, fontSize: 12 }}>|</span>
        <a href="/know-the-creator" style={{ ...navLinkBase, marginRight: 10 }}>Know the Creator</a>
        <span style={{ color: C.dim, marginRight: 10, fontSize: 12 }}>|</span>
        <a href="/feedback" style={{ ...navLinkBase, color: C.goldLight }}>Feedback</a>
      </div>

      {/* Background glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(30,58,140,0.2) 0%, transparent 65%)",
      }} />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "80px 1.5rem 4rem",
      }}>
        <div style={{ width: "100%", maxWidth: 540 }}>

          <a href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, color: C.muted, textDecoration: "none",
            fontFamily: F.ui, letterSpacing: "0.08em",
            marginBottom: "2.5rem", opacity: 0.7,
          }}>
            ← Back to the cosmos
          </a>

          {submitted ? (
            <div style={{ textAlign: "center", padding: "3rem 0" }}>
              <div style={{ fontSize: 52, marginBottom: "1.25rem" }}>✨</div>
              <h2 style={{
                fontFamily: F.cinematic,
                fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
                fontWeight: 600, color: C.text,
                fontStyle: "italic", marginBottom: "0.75rem",
              }}>
                Thank you.
              </h2>
              <p style={{ fontSize: 13, color: C.muted, fontFamily: F.ui, lineHeight: 1.7 }}>
                Your feedback has been received by the cosmos.<br />
                It will be used to make this experience better.
              </p>
              <a href="/" style={{
                display: "inline-block", marginTop: "2rem",
                padding: "11px 28px", borderRadius: 6,
                background: `linear-gradient(135deg, ${C.gold} 0%, #9A6B18 100%)`,
                color: "#07060D", fontSize: 13, fontFamily: F.display,
                fontWeight: 700, letterSpacing: "0.05em", textDecoration: "none",
              }}>
                Back to Roast-Me →
              </a>
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 9, letterSpacing: "0.28em", color: C.gold,
                textTransform: "uppercase", fontWeight: 700,
                marginBottom: "1rem", fontFamily: F.ui,
              }}>
                Feedback
              </div>

              <h1 style={{
                fontFamily: F.cinematic,
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 600, color: C.text,
                fontStyle: "italic", lineHeight: 1.2,
                marginBottom: "0.6rem",
              }}>
                How was the experience?
              </h1>
              <p style={{
                fontSize: 13, color: C.muted, fontFamily: F.ui,
                lineHeight: 1.7, marginBottom: "2rem",
              }}>
                Your honest reaction helps improve the cosmic readings.
              </p>

              {/* Emoji rating */}
              <div style={{ display: "flex", gap: 14, marginBottom: "1.75rem" }}>
                {([
                  { key: "sad"    as Rating, emoji: "😢", label: "Not great" },
                  { key: "alright" as Rating, emoji: "😐", label: "Alright"   },
                  { key: "happy"  as Rating, emoji: "😊", label: "Loved it"  },
                ]).map(({ key, emoji, label }) => (
                  <button
                    key={key}
                    onClick={() => setRating(key)}
                    style={{
                      flex: 1, display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 6,
                      padding: "16px 8px", borderRadius: 10,
                      background: rating === key ? C.goldFaint : "rgba(255,255,255,0.02)",
                      border: `1px solid ${rating === key ? C.gold : C.dim}`,
                      cursor: "pointer",
                      transform: rating === key ? "scale(1.05)" : "scale(1)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: 34 }}>{emoji}</span>
                    <span style={{
                      fontSize: 10, fontFamily: F.ui, fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: rating === key ? C.goldLight : C.muted,
                    }}>
                      {label.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>

              {/* Optional message */}
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{
                  fontSize: 10, letterSpacing: "0.15em", color: C.muted,
                  textTransform: "uppercase", fontWeight: 700, marginBottom: 7,
                  fontFamily: F.ui,
                }}>
                  Tell us more (optional)
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder="What worked, what didn't, what could be better…"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid rgba(59,100,200,0.2)`,
                    color: C.text,
                    padding: "13px 15px",
                    borderRadius: 6,
                    fontFamily: F.ui, fontSize: 14,
                    outline: "none", resize: "none", lineHeight: 1.65,
                  }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 12, color: "#E8665A", marginBottom: "0.75rem", fontFamily: F.ui }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!rating || loading}
                style={{
                  width: "100%", height: 52, border: "none", borderRadius: 6,
                  background: rating
                    ? `linear-gradient(135deg, ${C.gold} 0%, #9A6B18 100%)`
                    : C.dim,
                  color: rating ? "#07060D" : C.muted,
                  fontSize: 14, fontFamily: F.display, fontWeight: 700,
                  letterSpacing: "0.05em",
                  cursor: rating && !loading ? "pointer" : "default",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Sending…" : "Send Feedback →"}
              </button>

              <p style={{
                textAlign: "center", fontSize: 10, color: C.dim,
                marginTop: "1.25rem", fontFamily: F.ui, letterSpacing: "0.05em",
              }}>
                Responses go directly to the creator. No spam, ever.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
