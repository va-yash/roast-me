"use client";

import { useState, useEffect } from "react";

const F = {
  cinematic: "'Cormorant Garamond', serif",
  display:   "'Space Grotesk', sans-serif",
  ui:        "'Syne', sans-serif",
};

// TODO: Replace with your cosmos chat URL
const COSMOS_CHAT_URL = "https://my-destiny-murex.vercel.app/";

const DARK = {
  bg: "#060A14", card: "#0C1422", gold: "#C08B2F", goldLight: "#DEB86A",
  goldFaint: "rgba(192,139,47,0.09)", goldBorder: "rgba(192,139,47,0.28)",
  text: "#E2E8F4", muted: "#64748B", dim: "#1E293B",
  border: "rgba(59,100,200,0.18)", navBg: "rgba(6,10,20,0.94)",
};
const LIGHT = {
  bg: "#F8F4EC", card: "#FFFDF7", gold: "#9A6B18", goldLight: "#7A5010",
  goldFaint: "rgba(154,107,24,0.08)", goldBorder: "rgba(154,107,24,0.22)",
  text: "#1C1628", muted: "#6B7280", dim: "#C4B89A",
  border: "rgba(59,100,200,0.1)", navBg: "rgba(248,244,236,0.97)",
};

export default function KnowTheCreator() {
  const [isDark, setIsDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const lk: React.CSSProperties = {
    fontSize: 11, fontFamily: F.ui, fontWeight: 600,
    color: C.muted, textDecoration: "underline",
    textUnderlineOffset: 3, letterSpacing: "0.02em",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F.ui, transition: "background 0.25s, color 0.25s" }}>

      {/* Nav */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: 46, background: C.navBg, backdropFilter: "blur(14px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 1.25rem" }}>
        <a href="/" style={{ fontFamily: F.ui, fontSize: 13, fontWeight: 800, color: C.gold, letterSpacing: "0.1em", marginRight: 16, textDecoration: "none", flexShrink: 0 }}>ROAST-ME</a>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", flex: 1 }} className="rm-nav-links">
          <span style={{ color: C.dim, marginRight: 12, fontSize: 12 }}>|</span>
          <a href={COSMOS_CHAT_URL} style={lk}>Wanna Chat with Cosmos?</a>
          <span style={{ color: C.dim, margin: "0 10px", fontSize: 12 }}>|</span>
          <a href="/feedback" style={lk}>Feedback</a>
          <span style={{ color: C.dim, margin: "0 10px", fontSize: 12 }}>|</span>
          <a href="/know-the-creator" style={{ ...lk, color: C.goldLight }}>Know the Creator</a>
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
          <a href="/feedback" style={lk}>Feedback</a>
          <a href="/know-the-creator" style={{ ...lk, color: C.goldLight }}>Know the Creator</a>
          <a href="/?openProfile=1" style={{ ...lk, textDecoration: "none" }}>My Profile</a>
          <button onClick={toggle} style={{ ...lk, background: "none", border: "none", display: "flex", gap: 6, cursor: "pointer" }}>{isDark ? "☀️ Light mode" : "🌙 Dark mode"}</button>
        </div>
      )}

      {/* Background glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(30,58,140,0.2) 0%, transparent 65%)" }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 1.5rem 4rem" }}>
        <div style={{ width: "100%", maxWidth: 680 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted, textDecoration: "none", fontFamily: F.ui, letterSpacing: "0.08em", marginBottom: "2.5rem", opacity: 0.7 }}>
            ← Back to the cosmos
          </a>

          <div style={{ fontSize: 9, letterSpacing: "0.28em", color: C.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem", fontFamily: F.ui }}>Know the Creator</div>

          <p style={{ fontFamily: F.cinematic, fontSize: "clamp(1rem, 2.5vw, 1.2rem)", color: C.muted, fontStyle: "italic", lineHeight: 1.7, marginBottom: "1.25rem" }}>
            Unfortunately the creator is unknown — but here is the person who built this webpage:
          </p>

          <h1 style={{ fontFamily: F.display, fontSize: "clamp(2.2rem, 5vw, 3.4rem)", fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "1.25rem" }}>
            Yashraj Vasishtha
          </h1>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
            {["Aviation", "Energy", "AI"].map(tag => (
              <span key={tag} style={{ padding: "4px 14px", borderRadius: 20, border: `1px solid ${C.goldBorder}`, background: C.goldFaint, fontSize: 11, fontFamily: F.ui, fontWeight: 700, letterSpacing: "0.08em", color: C.goldLight }}>{tag}</span>
            ))}
          </div>

          <p style={{ fontFamily: F.ui, fontSize: "clamp(0.95rem, 2vw, 1.1rem)", color: C.muted, lineHeight: 1.85, marginBottom: "2rem" }}>
            Has a knack for modern physics, vedic texts, anthropology, philosophy, and psychology. Building practical solutions at the edge — where ancient wisdom meets emerging technology.
          </p>

          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.goldBorder} 40%, ${C.goldBorder} 60%, transparent)`, marginBottom: "2rem" }} />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="https://www.linkedin.com/in/yashraj-vasishtha/" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 6, fontSize: 13, fontFamily: F.ui, fontWeight: 700, letterSpacing: "0.05em", background: C.goldFaint, border: `1px solid ${C.goldBorder}`, color: C.goldLight, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              LinkedIn
            </a>
            <a href="https://www.instagram.com/yashraj__v/" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 6, fontSize: 13, fontFamily: F.ui, fontWeight: 700, letterSpacing: "0.05em", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, color: C.muted, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              Instagram
            </a>
          </div>

          <p style={{ marginTop: "3rem", fontSize: 10, color: C.dim, fontFamily: F.ui, letterSpacing: "0.1em", textAlign: "center" }}>
            ROAST-ME · COSMIC DAMAGE REPORTS
          </p>
        </div>
      </div>
    </div>
  );
}
