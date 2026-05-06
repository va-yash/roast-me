"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface RoastPattern { emoji: string; title: string; lines: string[]; }
interface RoastData    { cosmic_title: string; patterns: RoastPattern[]; }
interface ChartSummary {
  session_id: string; name: string; ascendant: string;
  sun_sign: string; moon_sign: string; location: string;
  dominant_planet: string;
}

type Screen    = "input" | "loading" | "result";
type Intensity = "Gentle" | "Chaotic" | "Unhinged";
type Platform  = "instagram" | "snapchat" | "whatsapp" | "facebook" | "twitter" | "copy";

/* ─── Design tokens ──────────────────────────────────────────────────────────── */

const C = {
  bg:         "#060A14",
  card:       "#0C1422",
  cardDeep:   "#080E1C",
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
  display: "'Space Grotesk', sans-serif",
  ui:      "'Syne', sans-serif",
  mono:    "'Inconsolata', monospace",
} as const;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/* ─── Planet metadata ────────────────────────────────────────────────────────── */

const PLANET_META: Record<string, { symbol: string; color: string; shape: string }> = {
  Sun:     { symbol: "☉", color: "#E8A020", shape: "sun"     },
  Moon:    { symbol: "☽", color: "#B8C8E0", shape: "moon"    },
  Mars:    { symbol: "♂", color: "#C44A4A", shape: "circle"  },
  Mercury: { symbol: "☿", color: "#6AA0B8", shape: "circle"  },
  Jupiter: { symbol: "♃", color: "#C4924A", shape: "jupiter" },
  Venus:   { symbol: "♀", color: "#C07090", shape: "circle"  },
  Saturn:  { symbol: "♄", color: "#8B9EB7", shape: "saturn"  },
  Rahu:    { symbol: "☊", color: "#6B5B8A", shape: "circle"  },
  Ketu:    { symbol: "☋", color: "#8A6B5B", shape: "circle"  },
};

/* ─── Loading messages ───────────────────────────────────────────────────────── */

const MSGS = [
  "Reading your birth chart",
  "Consulting the planets about your choices",
  "Finding the source of your trust issues",
  "The stars have seen your recent decisions",
  "Calculating how many times you almost committed",
  "Cross-referencing your patterns with the cosmos",
  "The planets are being thorough",
  "Your chart is a lot. Sit tight.",
  "Preparing your cosmic portrait",
];

/* ─── Global CSS ─────────────────────────────────────────────────────────────── */

const CSS = `
*, *::before, *::after { box-sizing: border-box; }
.rm-input {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(59,100,200,0.2);
  color: #E2E8F4;
  padding: 13px 15px;
  border-radius: 6px;
  font-family: 'Syne', sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  appearance: none;
  letter-spacing: 0.01em;
}
.rm-input:focus {
  border-color: rgba(192,139,47,0.5);
  background: rgba(255,255,255,0.06);
}
.rm-input::placeholder { color: rgba(100,116,139,0.5); }
input[type=date]::-webkit-calendar-picker-indicator,
input[type=time]::-webkit-calendar-picker-indicator {
  filter: invert(0.45) sepia(0.3); cursor: pointer;
}

@keyframes rmSpin    { to { transform: rotate(360deg);  } }
@keyframes rmSpinRev { to { transform: rotate(-360deg); } }
@keyframes rmFadeUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
@keyframes rmFadeIn  { from { opacity:0; } to { opacity:1; } }

.rm-card { animation: rmFadeUp 0.55s ease forwards; opacity: 0; }
.rm-card:nth-child(1)  { animation-delay: 0.05s; }
.rm-card:nth-child(2)  { animation-delay: 0.13s; }
.rm-card:nth-child(3)  { animation-delay: 0.21s; }
.rm-card:nth-child(4)  { animation-delay: 0.29s; }
.rm-card:nth-child(5)  { animation-delay: 0.37s; }
.rm-card:nth-child(6)  { animation-delay: 0.45s; }
.rm-card:nth-child(7)  { animation-delay: 0.53s; }
.rm-card:nth-child(8)  { animation-delay: 0.61s; }
.rm-card:nth-child(9)  { animation-delay: 0.69s; }
.rm-card:nth-child(10) { animation-delay: 0.77s; }
.rm-hero { animation: rmFadeIn 0.9s ease forwards; }

.rm-btn { transition: all 0.15s ease; cursor: pointer; }
.rm-btn:hover { opacity: 0.75; }
.rm-btn:active { transform: scale(0.97); }

.rm-overlay {
  position: fixed; inset: 0;
  background: rgba(6,10,20,0.88);
  backdrop-filter: blur(6px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: rmFadeIn 0.2s ease;
}
@media (min-width: 480px) { .rm-overlay { align-items: center; } }

.rm-sheet {
  background: #0C1422;
  border: 1px solid rgba(192,139,47,0.22);
  border-radius: 18px 18px 0 0;
  padding: 1.5rem 1.25rem 2.75rem;
  width: 100%;
  max-width: 460px;
  animation: rmFadeUp 0.25s ease;
}
@media (min-width: 480px) { .rm-sheet { border-radius: 16px; } }
`;

/* ─── Planet silhouette SVG ──────────────────────────────────────────────────── */

function PlanetBg({ planet }: { planet: string }) {
  const m = PLANET_META[planet] ?? PLANET_META.Saturn;
  const s: React.CSSProperties = {
    position: "absolute", right: -80, top: "50%",
    transform: "translateY(-50%)", width: 520, height: 520,
    opacity: 0.065, pointerEvents: "none", zIndex: 0,
    overflow: "visible",
  };

  if (m.shape === "saturn") return (
    <svg style={s} viewBox="0 0 500 500">
      <circle cx="250" cy="250" r="152" fill={m.color} />
      <ellipse cx="250" cy="250" rx="295" ry="66"
        fill="none" stroke={m.color} strokeWidth="22" />
    </svg>
  );

  if (m.shape === "sun") {
    const rays = [0, 45, 90, 135, 180, 225, 270, 315];
    return (
      <svg style={s} viewBox="0 0 500 500">
        <circle cx="250" cy="250" r="142" fill={m.color} />
        {rays.map(a => {
          const r = (a * Math.PI) / 180;
          return (
            <line key={a}
              x1={250 + 160 * Math.cos(r)} y1={250 + 160 * Math.sin(r)}
              x2={250 + 226 * Math.cos(r)} y2={250 + 226 * Math.sin(r)}
              stroke={m.color} strokeWidth="16" strokeLinecap="round" />
          );
        })}
      </svg>
    );
  }

  if (m.shape === "moon") return (
    <svg style={s} viewBox="0 0 500 500">
      <path d="M 325 118 A 158 158 0 1 0 325 382 A 122 122 0 1 1 325 118 Z" fill={m.color} />
    </svg>
  );

  if (m.shape === "jupiter") return (
    <svg style={s} viewBox="0 0 500 500">
      <circle cx="250" cy="250" r="178" fill={m.color} />
      <ellipse cx="250" cy="202" rx="178" ry="16" fill="rgba(0,0,0,0.35)" />
      <ellipse cx="250" cy="272" rx="178" ry="11" fill="rgba(0,0,0,0.25)" />
      <ellipse cx="250" cy="316" rx="178" ry="8"  fill="rgba(0,0,0,0.15)" />
    </svg>
  );

  return (
    <svg style={s} viewBox="0 0 500 500">
      <circle cx="250" cy="250" r="174" fill={m.color} />
    </svg>
  );
}

/* ─── Canvas story generator ─────────────────────────────────────────────────── */

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  maxW: number, lh: number
): number {
  const words = text.split(" ");
  let line = "", cy = y;
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxW && n > 0) {
      ctx.fillText(line.trim(), x, cy);
      line = words[n] + " ";
      cy += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, cy);
  return cy;
}

async function genStoryBlob(
  name: string,
  cosmicTitle: string,
  planet: string,
  roastTitle: string,
  roastLine: string,
): Promise<Blob> {
  await document.fonts.ready;
  const cv = document.createElement("canvas");
  cv.width = 1080; cv.height = 1920;
  const x = cv.getContext("2d")!;

  // Background gradient
  const bg = x.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0,   "#060A14");
  bg.addColorStop(0.5, "#0C1422");
  bg.addColorStop(1,   "#060A14");
  x.fillStyle = bg;
  x.fillRect(0, 0, 1080, 1920);

  // Deterministic stars (no Math.random → same image every call)
  x.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 180; i++) {
    const sx = (i * 197 + 37) % 1080;
    const sy = (i * 313 + 89) % 1920;
    const sr = i % 5 === 0 ? 1.8 : i % 3 === 0 ? 1.2 : 0.7;
    x.beginPath(); x.arc(sx, sy, sr, 0, Math.PI * 2); x.fill();
  }

  // Planet glow
  const pm = PLANET_META[planet] ?? PLANET_META.Saturn;
  x.globalAlpha = 0.09;
  x.fillStyle = pm.color;
  x.beginPath(); x.arc(840, 960, 400, 0, Math.PI * 2); x.fill();
  if (planet === "Saturn") {
    x.globalAlpha = 0.06;
    x.strokeStyle = pm.color; x.lineWidth = 26;
    x.beginPath(); x.ellipse(840, 960, 590, 138, -0.25, 0, Math.PI * 2); x.stroke();
  }
  x.globalAlpha = 1;

  // Top rule
  x.strokeStyle = "#C08B2F"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(100, 178); x.lineTo(980, 178); x.stroke();

  // Brand label
  x.fillStyle = "#C08B2F";
  x.font = "700 30px 'Syne', sans-serif";
  x.textAlign = "center";
  x.fillText("ROAST-ME.ME", 540, 140);

  // "Guess who…"
  const dn = name.trim() ? name.trim().toUpperCase() : "SOMEONE YOU KNOW";
  x.fillStyle = "#64748B";
  x.font = "500 32px 'Space Grotesk', sans-serif";
  x.fillText(`GUESS WHO ${dn} ACTUALLY IS?`, 540, 258);

  // Cosmic title
  x.fillStyle = "#E2E8F4";
  x.font = "700 62px 'Space Grotesk', sans-serif";
  const ty = wrapText(x, `"${cosmicTitle}"`, 540, 362, 860, 76);

  // Planet badge
  x.fillStyle = pm.color;
  x.font = "600 36px 'Syne', sans-serif";
  x.fillText(`${pm.symbol}  ${planet.toUpperCase()} DOMINANT`, 540, ty + 76);

  // Divider
  x.strokeStyle = "rgba(192,139,47,0.3)"; x.lineWidth = 1;
  x.beginPath(); x.moveTo(200, ty + 116); x.lineTo(880, ty + 116); x.stroke();

  // Roast title
  const ry = Math.max(ty + 210, 1270);
  x.fillStyle = "#E2E8F4";
  x.font = "600 48px 'Space Grotesk', sans-serif";
  const ry2 = wrapText(x, roastTitle, 540, ry, 860, 60);

  // Roast line
  x.fillStyle = "#64748B";
  x.font = "400 33px 'Inconsolata', monospace";
  wrapText(x, roastLine, 540, ry2 + 62, 860, 44);

  // Bottom rule
  x.strokeStyle = "#C08B2F"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(100, 1748); x.lineTo(980, 1748); x.stroke();

  // CTA
  x.fillStyle = "#64748B";
  x.font = "500 32px 'Space Grotesk', sans-serif";
  x.fillText("Find your cosmic truth", 540, 1810);
  x.fillStyle = "#C08B2F";
  x.font = "700 42px 'Space Grotesk', sans-serif";
  x.fillText("roast-me.me", 540, 1868);

  return new Promise((resolve, reject) =>
    cv.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png")
  );
}

/* ─── Share text builder ─────────────────────────────────────────────────────── */

function buildShareText(
  name: string,
  cosmicTitle: string,
  planet: string,
  roastTitle: string,
  lines: string[],
): string {
  const pm = PLANET_META[planet];
  const who = name.trim()
    ? `Guess who ${name.trim()} actually is?`
    : "Guess who this person actually is?";
  return [
    `👁 ${who}`,
    "",
    `"${cosmicTitle}"`,
    `${pm?.symbol ?? "★"} ${planet} Dominant`,
    "",
    `— ${roastTitle} —`,
    lines[0] ?? "",
    "",
    "Find your cosmic truth ↓",
    "roast-me.me",
  ].join("\n");
}

/* ─── Stream parser ──────────────────────────────────────────────────────────── */

function parseRoast(raw: string): RoastData | null {
  const text = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(text); } catch { /* fall through */ }
  let fixed = text;
  if ((fixed.match(/(?<!\\)"/g) ?? []).length % 2 !== 0) fixed += '"';
  const stack: string[] = [];
  for (const ch of fixed) {
    if      (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if ((ch === "}" || ch === "]") && stack.length) stack.pop();
  }
  fixed += stack.reverse().join("");
  try { return JSON.parse(fixed); } catch { return null; }
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: "0.15em", color: C.muted,
      textTransform: "uppercase", fontWeight: 700, marginBottom: 7,
      fontFamily: F.ui,
    }}>
      {children}
    </div>
  );
}

function Ghost({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="rm-btn" onClick={onClick} style={{
      padding: "9px 18px", borderRadius: 6, fontSize: 12, fontFamily: F.ui,
      fontWeight: 600, background: "transparent",
      border: `1px solid rgba(59,100,200,0.22)`, color: C.muted,
      letterSpacing: "0.03em",
    }}>
      {children}
    </button>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function Home() {
  const [screen,     setScreen]     = useState<Screen>("input");
  const [name,       setName]       = useState("");
  const [dob,        setDob]        = useState("");
  const [tob,        setTob]        = useState("");
  const [pob,        setPob]        = useState("");
  const [intensity,  setIntensity]  = useState<Intensity>("Unhinged");
  const [error,      setError]      = useState("");
  const [msgIdx,     setMsgIdx]     = useState(0);
  const [roastData,  setRoastData]  = useState<RoastData | null>(null);
  const [chart,      setChart]      = useState<ChartSummary | null>(null);
  const [generating, setGenerating] = useState(false);

  // Share modal state
  const [share, setShare] = useState<{
    open: boolean; idx: number | "hero" | null;
  }>({ open: false, idx: null });

  // Name prompt state (shown when user wants story share but hasn't entered name)
  const [namePrompt, setNamePrompt] = useState<{
    open: boolean; platform: Platform | null; idx: number | "hero" | null;
  }>({ open: false, platform: null, idx: null });

  const [tempName, setTempName] = useState("");

  const msgRef = useRef<HTMLDivElement>(null);

  // ── Inject global styles once
  useEffect(() => {
    const id = "rm-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id; s.textContent = CSS;
      document.head.appendChild(s);
    }
  }, []);

  // ── GSAP stagger animation for loading messages
  useEffect(() => {
    if (screen !== "loading" || !msgRef.current) return;

    const el = msgRef.current;
    let cancelled = false;

    gsap.killTweensOf(el);
    gsap.set(el, { opacity: 1 });
    el.innerHTML = "";

    // Build a span per word — GSAP animates each independently
    MSGS[msgIdx].split(" ").forEach(word => {
      const span = document.createElement("span");
      span.textContent = word;
      span.style.cssText = "display:inline-block;opacity:0;will-change:transform,opacity;";
      el.appendChild(span);
    });

    const spans = Array.from(el.querySelectorAll("span"));
    const tl = gsap.timeline({
      onComplete: () => {
        if (!cancelled) setMsgIdx(p => (p + 1) % MSGS.length);
      },
    });

    // Reveal words with stagger, then hold 2s, then fade out container
    tl.fromTo(
      spans,
      { opacity: 0, y: 16, skewY: 3 },
      { opacity: 1, y: 0, skewY: 0, stagger: 0.09, duration: 0.45, ease: "power3.out" }
    );
    tl.to(el, { opacity: 0, duration: 0.35, ease: "power2.in" }, "+=2");

    return () => { cancelled = true; tl.kill(); };
  }, [msgIdx, screen]);

  // ── Content getter for a given share index
  const getContent = useCallback((idx: number | "hero" | null) => {
    if (!roastData || idx === null) return { title: "", lines: [] as string[] };
    if (idx === "hero") return { title: roastData.cosmic_title, lines: [] };
    const p = roastData.patterns[idx as number];
    return { title: p?.title ?? "", lines: p?.lines ?? [] };
  }, [roastData]);

  // ── Core share executor
  const doShare = useCallback(async (
    platform: Platform,
    shareName: string,
    idx: number | "hero" | null,
  ) => {
    if (!roastData || !chart) return;

    const { title, lines } = getContent(idx);
    const cosmicTitle  = roastData.cosmic_title;
    const roastTitle   = idx === "hero" ? cosmicTitle : title;
    const planet       = chart.dominant_planet ?? "Saturn";
    const shareText    = buildShareText(shareName, cosmicTitle, planet, roastTitle, lines);

    if (platform === "instagram" || platform === "snapchat") {
      setGenerating(true);
      try {
        const blob = await genStoryBlob(shareName, cosmicTitle, planet, roastTitle, lines[0] ?? "");
        const file = new File([blob], "cosmic-roast.png", { type: "image/png" });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText });
        } else {
          // Desktop: download the image
          const url = URL.createObjectURL(blob);
          const a   = document.createElement("a");
          a.href = url; a.download = "cosmic-roast.png"; a.click();
          URL.revokeObjectURL(url);
        }
      } catch (e) { console.error("Story share failed:", e); }
      finally { setGenerating(false); }

    } else if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    } else if (platform === "facebook") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://roast-me.me")}&quote=${encodeURIComponent(shareText)}`,
        "_blank"
      );
    } else if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank");
    } else if (platform === "copy") {
      navigator.clipboard.writeText(shareText);
    }
  }, [roastData, chart, getContent]);

  // ── Open share modal
  const openShare = useCallback((idx: number | "hero") => {
    setShare({ open: true, idx });
  }, []);

  // ── Close share modal
  const closeShare = useCallback(() => {
    setShare({ open: false, idx: null });
  }, []);

  // ── Handle platform selection in share modal
  const handlePlatform = useCallback((platform: Platform) => {
    const idx = share.idx;

    // Visual story platforms — ask for name if not already provided
    if ((platform === "instagram" || platform === "snapchat") && !name.trim()) {
      closeShare();
      setNamePrompt({ open: true, platform, idx });
      return;
    }

    closeShare();
    doShare(platform, name, idx);
  }, [share, name, closeShare, doShare]);

  // ── Confirm name prompt and execute share
  const submitName = useCallback(async () => {
    const { platform, idx } = namePrompt;
    setNamePrompt({ open: false, platform: null, idx: null });
    if (!platform) return;
    await doShare(platform, tempName || name, idx);
    setTempName("");
  }, [namePrompt, tempName, name, doShare]);

  // ── Submit birth details
  const handleSubmit = useCallback(async () => {
    if (!dob || !tob || !pob.trim()) {
      setError("Date, time, and city are required. The cosmos need coordinates.");
      return;
    }
    setError("");
    setScreen("loading");
    setMsgIdx(0);

    try {
      const cr = await fetch(`${API_URL}/api/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dob, tob, pob }),
      });
      if (!cr.ok) {
        const e = await cr.json();
        throw new Error(e.detail ?? "Chart calculation failed");
      }
      const cd: ChartSummary = await cr.json();
      setChart(cd);

      const rr = await fetch(`${API_URL}/api/roast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: cd.session_id, intensity }),
      });
      if (!rr.ok || !rr.body) throw new Error("Stream failed to start");

      const reader = rr.body.getReader();
      const dec    = new TextDecoder();
      let full     = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const p = JSON.parse(line.slice(6));
            if (p.error) throw new Error(p.error);
            if (p.text) full += p.text;
            if (p.done) {
              const d = parseRoast(full);
              if (d) { setRoastData(d); setScreen("result"); }
            }
          } catch { /* partial chunk */ }
        }
      }
      // Fallback parse at stream end
      if (full) {
        const d = parseRoast(full);
        if (d) { setRoastData(d); setScreen("result"); }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stars unavailable. Try again.");
      setScreen("input");
    }
  }, [dob, tob, pob, intensity, name]);

  const restart = useCallback(() => {
    setScreen("input"); setRoastData(null); setChart(null); setError("");
  }, []);

  /* ─── INPUT SCREEN ──────────────────────────────────────────────────────── */

  if (screen === "input") return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: "2.5rem 1.25rem", position: "relative",
    }}>
      {/* Radial glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(30,58,140,0.28) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "2.75rem" }}>
          <div style={{
            fontSize: 10, letterSpacing: "0.3em", color: C.gold, textTransform: "uppercase",
            fontWeight: 700, marginBottom: "1.1rem", fontFamily: F.ui,
          }}>
            ROAST&#8209;ME.ME
          </div>
          <h1 style={{
            fontFamily: F.display, fontSize: "clamp(2rem,7vw,2.75rem)", fontWeight: 700,
            color: C.text, lineHeight: 1.15, marginBottom: "0.7rem", letterSpacing: "-0.025em",
          }}>
            The cosmos have<br />seen everything.
          </h1>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, fontFamily: F.ui }}>
            And they have notes.
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Optional name */}
          <div>
            <Label>Your name (optional)</Label>
            <input
              type="text"
              className="rm-input"
              placeholder="Used for sharing — keeps it personal"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Date */}
          <div>
            <Label>Date of birth</Label>
            <input type="date" className="rm-input" value={dob} onChange={e => setDob(e.target.value)} />
          </div>

          {/* Time + City */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <div style={{ flex: "1 1 130px" }}>
              <Label>Time of birth</Label>
              <input type="time" className="rm-input" value={tob} onChange={e => setTob(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 130px" }}>
              <Label>City of birth</Label>
              <input
                type="text" className="rm-input" placeholder="Mumbai"
                value={pob} onChange={e => setPob(e.target.value)}
              />
            </div>
          </div>

          {/* Intensity */}
          <div>
            <Label>Roast intensity</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              {(["Gentle", "Chaotic", "Unhinged"] as Intensity[]).map(lvl => (
                <button key={lvl} className="rm-btn" onClick={() => setIntensity(lvl)} style={{
                  padding: "10px 0", borderRadius: 6, fontSize: 13, fontFamily: F.ui,
                  border: `1px solid ${intensity === lvl ? C.gold : C.dim}`,
                  background: intensity === lvl ? C.goldFaint : "transparent",
                  color: intensity === lvl ? C.goldLight : C.muted,
                  fontWeight: intensity === lvl ? 700 : 400,
                  letterSpacing: "0.02em",
                }}>
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 12, color: "#E8665A", textAlign: "center", fontFamily: F.ui }}>
              {error}
            </p>
          )}

          <button className="rm-btn" onClick={handleSubmit} style={{
            marginTop: 4, height: 52, border: "none", borderRadius: 6,
            background: `linear-gradient(135deg, ${C.gold} 0%, #9A6B18 100%)`,
            color: "#07060D", fontSize: 15, fontFamily: F.display,
            fontWeight: 700, letterSpacing: "0.05em",
          }}>
            CONSULT THE COSMOS →
          </button>
        </div>

        <p style={{
          textAlign: "center", fontSize: 11, color: C.dim,
          marginTop: "1.6rem", lineHeight: 1.7, fontFamily: F.ui,
        }}>
          Zero astrology in the output.<br />Just your patterns, held up to a light.
        </p>
      </div>
    </div>
  );

  /* ─── LOADING SCREEN ─────────────────────────────────────────────────────── */

  if (screen === "loading") return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(30,58,140,0.22) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative", zIndex: 1, textAlign: "center",
        padding: "2rem", maxWidth: 440, width: "100%",
      }}>
        {/* Spinning rings */}
        <div style={{
          position: "relative", width: 68, height: 68,
          margin: "0 auto 2.5rem",
        }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1px solid ${C.dim}` }} />
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "2px solid transparent", borderTopColor: C.gold,
            animation: "rmSpin 1.1s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: 10, borderRadius: "50%",
            border: "1px solid transparent", borderTopColor: C.goldLight,
            animation: "rmSpinRev 0.75s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: 22, borderRadius: "50%",
            border: `1px solid ${C.goldBorder}`,
          }} />
        </div>

        {/* GSAP word-stagger container — content managed imperatively */}
        <div
          ref={msgRef}
          style={{
            fontFamily: F.display,
            fontSize: "clamp(1.1rem, 4vw, 1.35rem)",
            fontWeight: 600,
            color: C.text,
            letterSpacing: "-0.01em",
            lineHeight: 1.4,
            minHeight: 48,
            marginBottom: "1rem",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 5px",
          }}
        />

        <div style={{ fontSize: 12, color: C.dim, fontFamily: F.ui, letterSpacing: "0.05em" }}>
          About 15 seconds. The planets are deliberating.
        </div>
      </div>
    </div>
  );

  /* ─── RESULT SCREEN ──────────────────────────────────────────────────────── */

  const patterns    = roastData?.patterns ?? [];
  const cosmicTitle = roastData?.cosmic_title ?? "Certified Chaos Architect";
  const planet      = chart?.dominant_planet ?? "Saturn";
  const pm          = PLANET_META[planet];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, position: "relative" }}>
      {/* Fixed radial glow */}
      <div style={{
        position: "fixed", inset: 0,
        background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(30,58,140,0.1) 0%, transparent 60%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 560, margin: "0 auto", paddingBottom: "4rem" }}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="rm-hero" style={{
          background: "linear-gradient(165deg, #0C1422 0%, #060A14 100%)",
          borderBottom: `1px solid ${C.goldBorder}`,
          padding: "clamp(2rem,6vw,3rem) 1.5rem 2rem",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <PlanetBg planet={planet} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              fontSize: 9, letterSpacing: "0.28em", color: C.gold, textTransform: "uppercase",
              fontWeight: 700, marginBottom: "1rem", fontFamily: F.ui,
            }}>
              ROAST&#8209;ME.ME · YOUR COSMIC VERDICT
            </div>

            <h2 style={{
              fontFamily: F.display,
              fontSize: "clamp(1.5rem, 5vw, 2.1rem)",
              fontWeight: 700, color: C.text, lineHeight: 1.2,
              marginBottom: "1rem", letterSpacing: "-0.025em",
            }}>
              &ldquo;{cosmicTitle}&rdquo;
            </h2>

            {/* Dominant planet badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 16px", borderRadius: 20,
              border: `1px solid ${C.goldBorder}`, background: C.goldFaint,
              marginBottom: "1.25rem",
            }}>
              <span style={{ color: pm?.color ?? C.gold, fontSize: 17 }}>{pm?.symbol}</span>
              <span style={{
                fontSize: 11, fontFamily: F.ui, fontWeight: 700,
                letterSpacing: "0.13em", color: C.goldLight, textTransform: "uppercase",
              }}>
                {planet} Dominant
              </span>
            </div>

            {/* Context tags */}
            <div style={{
              display: "flex", gap: 7, justifyContent: "center",
              flexWrap: "wrap", marginBottom: "1.5rem",
            }}>
              {[pob || chart?.location, `${intensity} mode`].filter(Boolean).map(t => (
                <span key={t} style={{
                  fontSize: 11, padding: "3px 12px", borderRadius: 20,
                  border: `1px solid ${C.border}`, color: C.muted, fontFamily: F.ui,
                }}>
                  {t}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <Ghost onClick={() => openShare("hero")}>Share your title ↗</Ghost>
              <Ghost onClick={restart}>Read me again</Ghost>
            </div>
          </div>
        </div>

        {/* ── Pattern cards ─────────────────────────────────────────────── */}
        <div style={{
          padding: "1.25rem 0.9rem 0",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {patterns.map((p, i) => {
            const last = i === patterns.length - 1;
            return (
              <div key={i} className="rm-card" style={{
                background: last ? C.cardDeep : C.card,
                border: `1px solid ${last ? C.goldBorder : C.border}`,
                borderRadius: 10,
                padding: "1.2rem 1.2rem 0.9rem",
                position: "relative", overflow: "hidden",
              }}>
                {/* Gold accent bar on final card */}
                {last && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: `linear-gradient(90deg, transparent, ${C.gold} 35%, ${C.goldLight} 65%, transparent)`,
                  }} />
                )}

                {/* Title row */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 10 }}>
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 3 }}>
                    {p.emoji}
                  </span>
                  <h3 style={{
                    fontFamily: F.display,
                    fontSize: "clamp(1rem, 3.5vw, 1.2rem)",
                    fontWeight: last ? 700 : 600,
                    color: last ? C.goldLight : C.text,
                    lineHeight: 1.25, letterSpacing: "-0.015em",
                  }}>
                    {p.title}
                  </h3>
                </div>

                {/* Lines */}
                <div style={{ paddingLeft: 31, marginBottom: 11 }}>
                  {p.lines.map((line, j) => {
                    const closer = j === p.lines.length - 1;
                    return (
                      <p key={j} style={{
                        fontFamily: F.mono, fontSize: 13.5, lineHeight: 1.85,
                        color: closer ? C.muted : "#C5BEDD",
                        fontWeight: closer ? 300 : 400,
                      }}>
                        {line}
                      </p>
                    );
                  })}
                </div>

                {/* Share button */}
                <div style={{ paddingLeft: 31, display: "flex", justifyContent: "flex-end" }}>
                  <button className="rm-btn" onClick={() => openShare(i)} style={{
                    padding: "4px 14px", borderRadius: 6, fontSize: 11,
                    fontFamily: F.ui, fontWeight: 600,
                    background: "transparent", border: `1px solid ${C.border}`,
                    color: C.muted, letterSpacing: "0.04em",
                  }}>
                    Share ↗
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        <div style={{ padding: "2rem 1rem 0", textAlign: "center" }}>
          <p style={{
            fontSize: 13, color: C.muted, marginBottom: "1.1rem",
            lineHeight: 1.65, fontFamily: F.ui,
          }}>
            Know someone who needs to see themselves clearly?
          </p>
          <button className="rm-btn" onClick={restart} style={{
            padding: "13px 30px",
            background: `linear-gradient(135deg, ${C.gold} 0%, #9A6B18 100%)`,
            border: "none", borderRadius: 6, color: "#07060D",
            fontSize: 14, fontFamily: F.display, fontWeight: 700,
            letterSpacing: "0.05em",
          }}>
            ROAST SOMEONE ELSE →
          </button>
          <p style={{
            fontSize: 10, color: C.dim, marginTop: "1.75rem",
            letterSpacing: "0.1em", fontFamily: F.ui,
          }}>
            ROAST&#8209;ME.ME · COSMIC DAMAGE REPORTS
          </p>
        </div>
      </div>

      {/* ── Share modal ────────────────────────────────────────────────── */}
      {share.open && (
        <div className="rm-overlay" onClick={closeShare}>
          <div className="rm-sheet" onClick={e => e.stopPropagation()}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: "0.75rem",
            }}>
              <span style={{
                fontFamily: F.display, fontWeight: 700, fontSize: 16,
                color: C.text, letterSpacing: "-0.01em",
              }}>
                Share this reading
              </span>
              <button onClick={closeShare} style={{
                background: "none", border: "none", color: C.muted,
                fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1,
              }}>✕</button>
            </div>

            {/* Preview snippet */}
            <p style={{
              fontSize: 12, color: C.muted, marginBottom: "1.25rem",
              fontFamily: F.mono, lineHeight: 1.5,
              borderLeft: `2px solid ${C.goldBorder}`, paddingLeft: 10,
            }}>
              {share.idx === "hero"
                ? `"${roastData?.cosmic_title}"`
                : roastData?.patterns[share.idx as number]?.title}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {([
                { id: "instagram" as Platform, icon: "📸", label: "Instagram Story", note: "STORY IMAGE" },
                { id: "snapchat"  as Platform, icon: "👻", label: "Snapchat Story",  note: "STORY IMAGE" },
                { id: "whatsapp" as Platform, icon: "💬", label: "WhatsApp",          note: ""           },
                { id: "facebook" as Platform, icon: "📘", label: "Facebook",          note: ""           },
                { id: "twitter"  as Platform, icon: "𝕏",  label: "Twitter / X",      note: ""           },
                { id: "copy"     as Platform, icon: "📋", label: "Copy Text",         note: ""           },
              ]).map(({ id, icon, label, note }) => (
                <button
                  key={id}
                  className="rm-btn"
                  disabled={generating}
                  onClick={() => handlePlatform(id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${C.border}`,
                    color: C.text, fontFamily: F.ui, fontWeight: 600,
                    fontSize: 14, textAlign: "left", width: "100%",
                    opacity: generating ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span>{label}</span>
                  {note && (
                    <span style={{
                      marginLeft: "auto", fontSize: 10,
                      color: generating && (id === "instagram" || id === "snapchat") ? C.gold : C.muted,
                      letterSpacing: "0.06em",
                    }}>
                      {generating && (id === "instagram" || id === "snapchat")
                        ? "Generating…" : note}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Name prompt modal ──────────────────────────────────────────── */}
      {namePrompt.open && (
        <div
          className="rm-overlay"
          onClick={() => setNamePrompt({ open: false, platform: null, idx: null })}
        >
          <div className="rm-sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{
              fontFamily: F.display, fontWeight: 700, fontSize: 18,
              color: C.text, marginBottom: 6, letterSpacing: "-0.015em",
            }}>
              Add your name to the story?
            </h3>
            <p style={{
              fontSize: 13, color: C.muted, fontFamily: F.ui,
              lineHeight: 1.65, marginBottom: "1.5rem",
            }}>
              Your story will say &ldquo;Guess who{" "}
              <strong style={{ color: C.text }}>{tempName || "you"}</strong>
              {" "}actually is?&rdquo; — totally optional.
            </p>

            <input
              type="text"
              className="rm-input"
              placeholder="Your name (or leave blank)"
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitName()}
              style={{ marginBottom: 12 }}
              autoFocus
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                className="rm-btn"
                onClick={() => { setTempName(""); submitName(); }}
                style={{
                  padding: "11px 0", borderRadius: 6,
                  background: "transparent", border: `1px solid ${C.border}`,
                  color: C.muted, fontFamily: F.ui, fontWeight: 600, fontSize: 13,
                }}
              >
                Skip
              </button>
              <button
                className="rm-btn"
                onClick={submitName}
                style={{
                  padding: "11px 0", borderRadius: 6,
                  background: `linear-gradient(135deg, ${C.gold} 0%, #9A6B18 100%)`,
                  border: "none", color: "#07060D",
                  fontFamily: F.display, fontWeight: 700, fontSize: 13,
                  letterSpacing: "0.04em",
                }}
              >
                Generate Story →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
