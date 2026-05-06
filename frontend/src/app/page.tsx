"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface RoastPattern {
  emoji: string;
  title: string;
  /** New structured fields (post-prompt-fix) */
  body?: string;
  closer?: string;
  /** Legacy fallback — old sessions still return lines[] */
  lines?: string[];
}
interface RoastData    { cosmic_title: string; patterns: RoastPattern[]; }
interface ChartSummary {
  session_id: string; name: string; ascendant: string;
  sun_sign: string; moon_sign: string; location: string;
  dominant_planet: string;
}

type Screen    = "intro" | "input" | "loading" | "result";
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
  cinematic: "'Cormorant Garamond', serif",
  display:   "'Space Grotesk', sans-serif",
  ui:        "'Syne', sans-serif",
  mono:      "'Inconsolata', monospace",
} as const;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/* ─── Planet metadata ────────────────────────────────────────────────────────── */

const PLANET_META: Record<string, { symbol: string; color: string; }> = {
  Sun:     { symbol: "☉", color: "#F4C030" },
  Moon:    { symbol: "☽", color: "#C0D0E8" },
  Mars:    { symbol: "♂", color: "#D44030" },
  Mercury: { symbol: "☿", color: "#70A8C0" },
  Jupiter: { symbol: "♃", color: "#D49040" },
  Venus:   { symbol: "♀", color: "#E8C060" },
  Saturn:  { symbol: "♄", color: "#C4B880" },
  Rahu:    { symbol: "☊", color: "#7055A0" },
  Ketu:    { symbol: "☋", color: "#A04040" },
};

/** How each planet's dominant people are described */
const PLANET_GENTILIC: Record<string, string> = {
  Sun:     "Solar",
  Moon:    "Lunar",
  Mars:    "Martian",
  Mercury: "Mercurian",
  Jupiter: "Jovian",
  Venus:   "Venusian",
  Saturn:  "Saturnian",
  Rahu:    "Rahuvian",
  Ketu:    "Ketuvian",
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

/* ─── Global CSS injected once ───────────────────────────────────────────────── */

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
@keyframes rmTwinkle { 0%,100%{opacity:0.4} 50%{opacity:1} }

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

/* Star twinkle helpers */
.rm-star { position:absolute; border-radius:50%; background:rgba(255,255,255,0.75); pointer-events:none; }
.rm-star-twinkle { animation: rmTwinkle var(--d,3s) ease-in-out infinite; }
`;

/* ─── Cartoon planet SVG content ─────────────────────────────────────────────── */

function PlanetContent({ planet, color }: { planet: string; color: string }) {
  switch (planet) {

    case "Sun": {
      const rays = Array.from({ length: 12 }, (_, i) => i * 30);
      return (
        <>
          <circle cx="250" cy="250" r="175" fill={color} opacity="0.15" />
          {rays.map(a => {
            const r = (a * Math.PI) / 180;
            return (
              <line key={a}
                x1={250 + 148 * Math.cos(r)} y1={250 + 148 * Math.sin(r)}
                x2={250 + 210 * Math.cos(r)} y2={250 + 210 * Math.sin(r)}
                stroke={color} strokeWidth="14" strokeLinecap="round" opacity="0.85"
              />
            );
          })}
          <circle cx="250" cy="250" r="142" fill={color} />
          <circle cx="250" cy="250" r="115" fill="#F8DC78" opacity="0.35" />
          <circle cx="200" cy="215" r="20" fill="#E8933A" opacity="0.55" />
          <circle cx="308" cy="285" r="13" fill="#E8933A" opacity="0.45" />
        </>
      );
    }

    case "Moon":
      return (
        <>
          <circle cx="250" cy="250" r="155" fill={color} />
          <circle cx="328" cy="215" r="132" fill="#060A14" />
          <circle cx="178" cy="245" r="24" fill="#8A9BB0" opacity="0.75" />
          <circle cx="178" cy="245" r="18" fill={color} opacity="0.25" />
          <circle cx="215" cy="325" r="15" fill="#8A9BB0" opacity="0.65" />
          <circle cx="158" cy="295" r="11" fill="#8A9BB0" opacity="0.6" />
          <circle cx="195" cy="172" r="17" fill="#8A9BB0" opacity="0.65" />
          <circle cx="160" cy="330" r="8"  fill="#8A9BB0" opacity="0.5" />
        </>
      );

    case "Mars":
      return (
        <>
          <circle cx="250" cy="250" r="155" fill={color} />
          <ellipse cx="250" cy="215" rx="142" ry="52" fill="#A83010" opacity="0.38" />
          <ellipse cx="250" cy="95"  rx="58"  ry="24" fill="#EEE8E0" opacity="0.88" />
          <circle cx="192" cy="265" r="26" fill="#8B2800" opacity="0.55" />
          <circle cx="192" cy="265" r="21" fill={color}   opacity="0.3"  />
          <circle cx="318" cy="228" r="18" fill="#8B2800" opacity="0.5"  />
          <circle cx="272" cy="318" r="13" fill="#8B2800" opacity="0.48" />
          <circle cx="172" cy="192" r="11" fill="#8B2800" opacity="0.48" />
          <path d="M 145 275 Q 250 290 355 265"
            stroke="#7A2400" strokeWidth="6" fill="none" opacity="0.5" strokeLinecap="round" />
        </>
      );

    case "Mercury":
      return (
        <>
          <circle cx="250" cy="250" r="140" fill={color} />
          <circle cx="185" cy="198" r="32" fill="#4A4A4A" opacity="0.68" />
          <circle cx="185" cy="198" r="27" fill={color}   opacity="0.28" />
          <circle cx="315" cy="295" r="24" fill="#4A4A4A" opacity="0.62" />
          <circle cx="315" cy="295" r="19" fill={color}   opacity="0.28" />
          <circle cx="228" cy="328" r="17" fill="#4A4A4A" opacity="0.58" />
          <circle cx="295" cy="175" r="15" fill="#4A4A4A" opacity="0.55" />
          <circle cx="168" cy="318" r="12" fill="#4A4A4A" opacity="0.5"  />
          <circle cx="335" cy="198" r="10" fill="#4A4A4A" opacity="0.48" />
          <circle cx="258" cy="252" r="9"  fill="#4A4A4A" opacity="0.45" />
        </>
      );

    case "Jupiter":
      return (
        <>
          <circle cx="250" cy="250" r="168" fill={color} />
          <ellipse cx="250" cy="195" rx="168" ry="30" fill="#8B5A1A" opacity="0.52" />
          <ellipse cx="250" cy="238" rx="168" ry="19" fill="#A06530" opacity="0.33" />
          <ellipse cx="250" cy="302" rx="168" ry="24" fill="#8B5A1A" opacity="0.48" />
          <ellipse cx="250" cy="338" rx="168" ry="15" fill="#A06530" opacity="0.28" />
          <ellipse cx="318" cy="278" rx="38"  ry="22" fill="#C03030" opacity="0.82" />
          <ellipse cx="318" cy="278" rx="30"  ry="15" fill="#D04040" opacity="0.45" />
        </>
      );

    case "Venus":
      return (
        <>
          <circle cx="250" cy="250" r="158" fill={color} />
          <path d="M 95 218 Q 200 175 305 218 Q 385 248 355 292"
            stroke="#C49030" strokeWidth="13" fill="none" opacity="0.5" strokeLinecap="round" />
          <path d="M 118 282 Q 222 252 325 272 Q 385 284 372 325"
            stroke="#C49030" strokeWidth="9"  fill="none" opacity="0.4" strokeLinecap="round" />
          <path d="M 148 178 Q 222 158 302 185"
            stroke="#B88028" strokeWidth="11" fill="none" opacity="0.42" strokeLinecap="round" />
          <path d="M 128 335 Q 222 312 335 338"
            stroke="#C49030" strokeWidth="7"  fill="none" opacity="0.33" strokeLinecap="round" />
          <circle cx="250" cy="250" r="85" fill="#F8E090" opacity="0.18" />
        </>
      );

    case "Saturn":
      return (
        <>
          {/* Rings behind planet */}
          <ellipse cx="250" cy="265" rx="238" ry="44"
            fill="none" stroke="#B8984A" strokeWidth="20" opacity="0.68" />
          <ellipse cx="250" cy="265" rx="208" ry="37"
            fill="none" stroke="#D4B870" strokeWidth="11" opacity="0.5"  />
          {/* Planet body */}
          <circle cx="250" cy="250" r="132" fill={color} />
          <ellipse cx="250" cy="228" rx="132" ry="24" fill="#B09060" opacity="0.48" />
          <ellipse cx="250" cy="270" rx="132" ry="15" fill="#B09060" opacity="0.32" />
          {/* Ring front arc */}
          <path d="M 14 265 A 236 44 0 0 0 252 309"
            stroke="#B8984A" strokeWidth="20" fill="none" opacity="0.68" />
          <path d="M 44 265 A 206 37 0 0 0 252 302"
            stroke="#D4B870" strokeWidth="11" fill="none" opacity="0.5"  />
        </>
      );

    case "Rahu":
      return (
        <>
          <circle cx="250" cy="250" r="150" fill={color} />
          <circle cx="308" cy="198" r="132" fill="#060A14" opacity="0.48" />
          <path d="M 250 98  Q 292 155 272 252"
            stroke="#9070C0" strokeWidth="9" fill="none" opacity="0.58" strokeLinecap="round" />
          <path d="M 355 162 Q 312 202 292 272"
            stroke="#8060B0" strokeWidth="6" fill="none" opacity="0.48" strokeLinecap="round" />
          <circle cx="250" cy="250" r="154"
            fill="none" stroke="#7050A0" strokeWidth="5" opacity="0.38" />
        </>
      );

    case "Ketu":
      return (
        <>
          <circle cx="250" cy="250" r="132" fill={color} />
          <circle cx="292" cy="208" r="112" fill="#060A14" opacity="0.44" />
          <path d="M 252 382 Q 305 425 388 488"
            stroke="#C06060" strokeWidth="12" fill="none" opacity="0.52" strokeLinecap="round" />
          <path d="M 272 372 Q 328 408 412 460"
            stroke="#A04040" strokeWidth="7"  fill="none" opacity="0.4"  strokeLinecap="round" />
          <path d="M 232 392 Q 275 448 348 508"
            stroke="#C06060" strokeWidth="5"  fill="none" opacity="0.33" strokeLinecap="round" />
          <circle cx="250" cy="250" r="137"
            fill="none" stroke="#A04040" strokeWidth="5" opacity="0.38" />
        </>
      );

    default:
      return <circle cx="250" cy="250" r="155" fill={color} />;
  }
}

/** Cartoon planet pair — flanks the hero on both sides */
function PlanetBg({ planet }: { planet: string }) {
  const m = PLANET_META[planet] ?? PLANET_META.Saturn;
  return (
    <>
      <svg className="rm-planet-left" viewBox="0 0 500 500" aria-hidden="true">
        <PlanetContent planet={planet} color={m.color} />
      </svg>
      <svg className="rm-planet-right" viewBox="0 0 500 500" aria-hidden="true">
        <PlanetContent planet={planet} color={m.color} />
      </svg>
    </>
  );
}

/* ─── Story card generator (share image) ─────────────────────────────────────── */

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
  body: string,
): Promise<Blob> {
  await document.fonts.ready;
  const cv = document.createElement("canvas");
  cv.width = 1080; cv.height = 1920;
  const x = cv.getContext("2d")!;

  // Background
  const bg = x.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0,   "#060A14");
  bg.addColorStop(0.5, "#0C1422");
  bg.addColorStop(1,   "#060A14");
  x.fillStyle = bg;
  x.fillRect(0, 0, 1080, 1920);

  // Deterministic stars
  x.fillStyle = "rgba(255,255,255,0.6)";
  for (let i = 0; i < 200; i++) {
    const sx = (i * 197 + 37) % 1080;
    const sy = (i * 313 + 89) % 1920;
    const sr = i % 5 === 0 ? 2 : i % 3 === 0 ? 1.3 : 0.8;
    x.beginPath(); x.arc(sx, sy, sr, 0, Math.PI * 2); x.fill();
  }

  const pm = PLANET_META[planet] ?? PLANET_META.Saturn;

  // Left planet — vivid, colorful cartoon disc
  x.globalAlpha = 0.52;
  x.fillStyle = pm.color;
  x.beginPath(); x.arc(-60, 960, 400, 0, Math.PI * 2); x.fill();
  // Surface detail band
  x.globalAlpha = 0.28;
  x.fillStyle = pm.color;
  x.beginPath(); x.ellipse(-60, 880, 360, 80, 0, 0, Math.PI * 2); x.fill();

  // Right planet — slightly smaller
  x.globalAlpha = 0.42;
  x.fillStyle = pm.color;
  x.beginPath(); x.arc(1140, 960, 340, 0, Math.PI * 2); x.fill();
  if (planet === "Saturn") {
    x.globalAlpha = 0.32;
    x.strokeStyle = pm.color; x.lineWidth = 30;
    x.beginPath(); x.ellipse(1140, 960, 580, 130, -0.22, 0, Math.PI * 2); x.stroke();
  }
  x.globalAlpha = 1;

  // Top rule
  x.strokeStyle = "#C08B2F"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(100, 178); x.lineTo(980, 178); x.stroke();

  // Brand
  x.fillStyle = "#C08B2F";
  x.font = "700 30px 'Syne', sans-serif";
  x.textAlign = "center";
  x.fillText("ROAST-ME.ME", 540, 140);

  // Name line
  const dn = name.trim() ? name.trim().toUpperCase() : "SOMEONE YOU KNOW";
  x.fillStyle = "#64748B";
  x.font = "500 32px 'Space Grotesk', sans-serif";
  x.fillText(`GUESS WHO ${dn} ACTUALLY IS?`, 540, 258);

  // Cosmic title
  x.fillStyle = "#E2E8F4";
  x.font = "700 60px 'Space Grotesk', sans-serif";
  const ty = wrapText(x, `"${cosmicTitle}"`, 540, 362, 860, 74);

  // Planet gentilic badge
  const gentilic = PLANET_GENTILIC[planet] ?? planet;
  x.fillStyle = pm.color;
  x.font = "600 36px 'Syne', sans-serif";
  x.fillText(`${pm.symbol}  You are a ${gentilic} person`, 540, ty + 74);

  // Divider
  x.strokeStyle = "rgba(192,139,47,0.3)"; x.lineWidth = 1;
  x.beginPath(); x.moveTo(200, ty + 114); x.lineTo(880, ty + 114); x.stroke();

  // Roast title
  const ry = Math.max(ty + 205, 1240);
  x.fillStyle = "#E2E8F4";
  x.font = "600 48px 'Space Grotesk', sans-serif";
  const ry2 = wrapText(x, roastTitle, 540, ry, 860, 60);

  // Body text
  x.fillStyle = "#64748B";
  x.font = "400 32px 'Inconsolata', monospace";
  wrapText(x, body, 540, ry2 + 60, 860, 44);

  // Bottom rule + CTA
  x.strokeStyle = "#C08B2F"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(100, 1748); x.lineTo(980, 1748); x.stroke();

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
  body: string,
  closer: string,
): string {
  const pm = PLANET_META[planet];
  const gentilic = PLANET_GENTILIC[planet] ?? planet;
  const who = name.trim()
    ? `Guess who ${name.trim()} actually is?`
    : "Guess who this person actually is?";
  return [
    `👁 ${who}`,
    "",
    `"${cosmicTitle}"`,
    `${pm?.symbol ?? "★"} You are a ${gentilic} person`,
    "",
    `— ${roastTitle} —`,
    body,
    "",
    closer,
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

/* ─── Helper: get body/closer from a pattern (handles old lines[] too) ────────── */

function patternText(p: RoastPattern): { body: string; closer: string } {
  if (p.body !== undefined) {
    return { body: p.body ?? "", closer: p.closer ?? "" };
  }
  // Legacy fallback: lines[] — last item is the closer
  const lines = p.lines ?? [];
  const closer = lines[lines.length - 1] ?? "";
  const body   = lines.slice(0, -1).join(" ");
  return { body, closer };
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

/* ─── Star field (deterministic) ────────────────────────────────────────────── */

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x:    (i * 197 + 37) % 100,
  y:    (i * 313 + 89) % 100,
  size: i % 5 === 0 ? 2.2 : i % 3 === 0 ? 1.5 : 0.9,
  dur:  2 + (i % 4),
}));

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function Home() {
  const [screen,     setScreen]     = useState<Screen>("intro");
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

  const [share, setShare] = useState<{
    open: boolean; idx: number | "hero" | null;
  }>({ open: false, idx: null });

  const [namePrompt, setNamePrompt] = useState<{
    open: boolean; platform: Platform | null; idx: number | "hero" | null;
  }>({ open: false, platform: null, idx: null });

  const [tempName, setTempName] = useState("");

  const introRef = useRef<HTMLDivElement>(null);
  const msgRef   = useRef<HTMLDivElement>(null);

  // ── Inject global styles once
  useEffect(() => {
    const id = "rm-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id; s.textContent = CSS;
      document.head.appendChild(s);
    }
  }, []);

  // ── Cinematic intro: letter-by-letter GSAP animation
  useEffect(() => {
    if (screen !== "intro" || !introRef.current) return;

    const container = introRef.current;
    const line1 = container.querySelector<HTMLElement>(".intro-line-1");
    const line2 = container.querySelector<HTMLElement>(".intro-line-2");
    if (!line1 || !line2) return;

    function makeCharSpans(el: HTMLElement): HTMLElement[] {
      const text = el.textContent ?? "";
      el.innerHTML = "";
      return Array.from(text).map(ch => {
        const span = document.createElement("span");
        span.textContent = ch === " " ? "\u00A0" : ch;
        span.style.cssText = "display:inline-block;opacity:0;will-change:transform,opacity,filter;";
        el.appendChild(span);
        return span;
      });
    }

    const chars1 = makeCharSpans(line1);
    const chars2 = makeCharSpans(line2);

    const tl = gsap.timeline();

    tl.fromTo(chars1,
      { opacity: 0, y: 22, filter: "blur(5px)" },
      { opacity: 1, y: 0,  filter: "blur(0px)", stagger: 0.038, duration: 0.58, ease: "power3.out" }
    );
    tl.fromTo(chars2,
      { opacity: 0, y: 22, filter: "blur(5px)" },
      { opacity: 1, y: 0,  filter: "blur(0px)", stagger: 0.052, duration: 0.62, ease: "power3.out" },
      "-=0.15"
    );
    tl.to(container, { opacity: 0, duration: 1.1, ease: "power2.in" }, "+=1.8");
    tl.call(() => setScreen("input"));

    return () => { tl.kill(); };
  }, [screen]);

  // ── GSAP stagger for loading messages
  useEffect(() => {
    if (screen !== "loading" || !msgRef.current) return;

    const el = msgRef.current;
    let cancelled = false;

    gsap.killTweensOf(el);
    gsap.set(el, { opacity: 1 });
    el.innerHTML = "";

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

    tl.fromTo(
      spans,
      { opacity: 0, y: 16, skewY: 3 },
      { opacity: 1, y: 0, skewY: 0, stagger: 0.09, duration: 0.45, ease: "power3.out" }
    );
    tl.to(el, { opacity: 0, duration: 0.35, ease: "power2.in" }, "+=2");

    return () => { cancelled = true; tl.kill(); };
  }, [msgIdx, screen]);

  // ── Content getter for share
  const getContent = useCallback((idx: number | "hero" | null) => {
    if (!roastData || idx === null) return { title: "", body: "", closer: "" };
    if (idx === "hero") return { title: roastData.cosmic_title, body: "", closer: "" };
    const p = roastData.patterns[idx as number];
    const { body, closer } = patternText(p);
    return { title: p?.title ?? "", body, closer };
  }, [roastData]);

  // ── Core share executor
  const doShare = useCallback(async (
    platform: Platform,
    shareName: string,
    idx: number | "hero" | null,
  ) => {
    if (!roastData || !chart) return;

    const { title, body, closer } = getContent(idx);
    const cosmicTitle = roastData.cosmic_title;
    const roastTitle  = idx === "hero" ? cosmicTitle : title;
    const planet      = chart.dominant_planet ?? "Saturn";
    const shareText   = buildShareText(shareName, cosmicTitle, planet, roastTitle, body, closer);

    if (platform === "instagram" || platform === "snapchat") {
      setGenerating(true);
      try {
        const blob = await genStoryBlob(shareName, cosmicTitle, planet, roastTitle, body);
        const file = new File([blob], "cosmic-roast.png", { type: "image/png" });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText });
        } else {
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

  const openShare  = useCallback((idx: number | "hero") => setShare({ open: true, idx }), []);
  const closeShare = useCallback(() => setShare({ open: false, idx: null }), []);

  const handlePlatform = useCallback((platform: Platform) => {
    const idx = share.idx;
    if ((platform === "instagram" || platform === "snapchat") && !name.trim()) {
      closeShare();
      setNamePrompt({ open: true, platform, idx });
      return;
    }
    closeShare();
    doShare(platform, name, idx);
  }, [share, name, closeShare, doShare]);

  const submitName = useCallback(async () => {
    const { platform, idx } = namePrompt;
    setNamePrompt({ open: false, platform: null, idx: null });
    if (!platform) return;
    await doShare(platform, tempName || name, idx);
    setTempName("");
  }, [namePrompt, tempName, name, doShare]);

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

  /* ═══════════════════════════════════════════════════════════
     INTRO SCREEN — cinematic letter-by-letter reveal
  ═══════════════════════════════════════════════════════════ */

  if (screen === "intro") return (
    <div
      onClick={() => { gsap.killTweensOf("*"); setScreen("input"); }}
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      {/* Deterministic star field */}
      {STARS.map((s, i) => (
        <div key={i} className="rm-star rm-star-twinkle" style={{
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          ["--d" as string]: `${s.dur}s`,
          animationDelay: `${(i * 0.37) % s.dur}s`,
        }} />
      ))}

      {/* Radial nebula glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(30,58,140,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Text */}
      <div ref={introRef} style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "2rem 1.5rem" }}>
        <div className="intro-line-1" style={{
          fontFamily: F.cinematic,
          fontSize: "clamp(2.4rem, 6.5vw, 5.2rem)",
          fontWeight: 600,
          color: C.text,
          letterSpacing: "0.01em",
          lineHeight: 1.2,
          marginBottom: "0.65rem",
        }}>
          The cosmos has seen everything.
        </div>
        <div className="intro-line-2" style={{
          fontFamily: F.cinematic,
          fontSize: "clamp(1.7rem, 4.5vw, 3.6rem)",
          fontWeight: 500,
          color: C.gold,
          letterSpacing: "0.03em",
          lineHeight: 1.3,
          fontStyle: "italic",
        }}>
          And they have notes.
        </div>
      </div>

      {/* Skip hint — fades in late */}
      <div style={{
        position: "absolute", bottom: "2.5rem", left: 0, right: 0,
        textAlign: "center", fontSize: 11, color: C.dim,
        fontFamily: F.ui, letterSpacing: "0.12em",
        animation: "rmFadeIn 1s ease 3.5s both",
      }}>
        tap anywhere to skip
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     INPUT SCREEN
  ═══════════════════════════════════════════════════════════ */

  if (screen === "input") return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: "2.5rem 1.25rem", position: "relative",
    }}>
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

          {/* Cinematic title */}
          <h1 style={{
            fontFamily: F.cinematic,
            fontSize: "clamp(2.1rem, 7vw, 3.2rem)",
            fontWeight: 600,
            color: C.text,
            lineHeight: 1.15,
            marginBottom: "0.55rem",
            letterSpacing: "0.01em",
          }}>
            Welcome to Roast&#8209;me
          </h1>

          {/* Tagline */}
          <p style={{
            fontFamily: F.cinematic,
            fontSize: "clamp(1rem, 3vw, 1.35rem)",
            color: C.gold,
            fontStyle: "italic",
            lineHeight: 1.5,
            letterSpacing: "0.01em",
          }}>
            where the Cosmos roasts you. Personally&nbsp;;)
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div>
            <Label>Your name (optional)</Label>
            <input
              type="text" className="rm-input"
              placeholder="Used for sharing — keeps it personal"
              value={name} onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <Label>Date of birth</Label>
            <input type="date" className="rm-input" value={dob} onChange={e => setDob(e.target.value)} />
          </div>

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

  /* ═══════════════════════════════════════════════════════════
     LOADING SCREEN
  ═══════════════════════════════════════════════════════════ */

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
        <div style={{ position: "relative", width: 68, height: 68, margin: "0 auto 2.5rem" }}>
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

        <div ref={msgRef} style={{
          fontFamily: F.cinematic,
          fontSize: "clamp(1.2rem, 4vw, 1.6rem)",
          fontWeight: 500,
          color: C.text,
          letterSpacing: "0.005em",
          lineHeight: 1.4,
          minHeight: 52,
          marginBottom: "1rem",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 5px",
          fontStyle: "italic",
        }} />

        <div style={{ fontSize: 12, color: C.dim, fontFamily: F.ui, letterSpacing: "0.05em" }}>
          About 15 seconds. The planets are deliberating.
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     RESULT SCREEN
  ═══════════════════════════════════════════════════════════ */

  const patterns    = roastData?.patterns ?? [];
  const cosmicTitle = roastData?.cosmic_title ?? "Certified Chaos Architect";
  const planet      = chart?.dominant_planet ?? "Saturn";
  const pm          = PLANET_META[planet];
  const gentilic    = PLANET_GENTILIC[planet] ?? planet;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, position: "relative" }}>
      <div style={{
        position: "fixed", inset: 0,
        background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(30,58,140,0.1) 0%, transparent 60%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div className="rm-result-content">

        {/* ── Hero — full width, planet flanked ────────────────────────── */}
        <div className="rm-hero-section rm-hero">

          {/* Cartoon planets on both sides */}
          <PlanetBg planet={planet} />

          <div style={{ position: "relative", zIndex: 1 }}>

            <div style={{
              fontSize: 9, letterSpacing: "0.28em", color: C.gold, textTransform: "uppercase",
              fontWeight: 700, marginBottom: "1rem", fontFamily: F.ui,
            }}>
              ROAST&#8209;ME.ME · YOUR COSMIC VERDICT
            </div>

            {/* Cosmic title — cinematic serif */}
            <h2 style={{
              fontFamily: F.cinematic,
              fontSize: "clamp(2rem, 5.5vw, 3.5rem)",
              fontWeight: 600,
              color: C.text,
              lineHeight: 1.15,
              marginBottom: "1rem",
              letterSpacing: "0.005em",
              fontStyle: "italic",
            }}>
              &ldquo;{cosmicTitle}&rdquo;
            </h2>

            {/* Planet gentilic badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "7px 18px", borderRadius: 20,
              border: `1px solid ${C.goldBorder}`, background: C.goldFaint,
              marginBottom: "1.25rem",
            }}>
              <span style={{ color: pm?.color ?? C.gold, fontSize: 18 }}>{pm?.symbol}</span>
              <span style={{
                fontSize: 12, fontFamily: F.ui, fontWeight: 700,
                letterSpacing: "0.1em", color: C.goldLight, textTransform: "uppercase",
              }}>
                You are a {gentilic} person
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

        {/* ── Pattern cards — 2-col grid on desktop ────────────────────── */}
        <div className="rm-grid-wrap">
          {patterns.map((p, i) => {
            const last = i === patterns.length - 1;
            const { body, closer } = patternText(p);

            return (
              <div key={i} className="rm-card" style={{
                background: last ? C.cardDeep : C.card,
                border: `1px solid ${last ? C.goldBorder : C.border}`,
                borderRadius: 12,
                padding: "1.3rem 1.25rem 1rem",
                position: "relative", overflow: "hidden",
              }}>
                {/* Gold accent top bar on final card */}
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
                    fontSize: "clamp(0.95rem, 3vw, 1.15rem)",
                    fontWeight: last ? 700 : 600,
                    color: last ? C.goldLight : C.text,
                    lineHeight: 1.25, letterSpacing: "-0.015em",
                  }}>
                    {p.title}
                  </h3>
                </div>

                {/* Body — beats 1-3 */}
                <div style={{ paddingLeft: 31, marginBottom: 10 }}>
                  <p style={{
                    fontFamily: F.mono,
                    fontSize: 13.5,
                    lineHeight: 1.82,
                    color: "#C5BEDD",
                    fontWeight: 400,
                  }}>
                    {body}
                  </p>
                </div>

                {/* Closer — beat 4, italic separator */}
                {closer && (
                  <div style={{
                    paddingLeft: 31,
                    marginBottom: 11,
                    borderTop: `1px solid ${last ? C.goldBorder : C.border}`,
                    paddingTop: 9,
                  }}>
                    <p style={{
                      fontFamily: F.cinematic,
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: C.muted,
                      fontStyle: "italic",
                      letterSpacing: "0.01em",
                    }}>
                      {closer}
                    </p>
                  </div>
                )}

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
        <div style={{ padding: "2.5rem 1rem 0", textAlign: "center" }}>
          <p style={{
            fontFamily: F.cinematic,
            fontSize: "1.1rem",
            fontStyle: "italic",
            color: C.muted,
            marginBottom: "1.1rem",
            lineHeight: 1.65,
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

      {/* ── Share modal ─────────────────────────────────────────────────── */}
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
                  key={id} className="rm-btn" disabled={generating}
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
                      {generating && (id === "instagram" || id === "snapchat") ? "Generating…" : note}
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
              fontFamily: F.cinematic, fontWeight: 600, fontSize: 22,
              color: C.text, marginBottom: 6, letterSpacing: "0.005em",
              fontStyle: "italic",
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
              type="text" className="rm-input"
              placeholder="Your name (or leave blank)"
              value={tempName} onChange={e => setTempName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitName()}
              style={{ marginBottom: 12 }}
              autoFocus
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="rm-btn" onClick={() => { setTempName(""); submitName(); }} style={{
                padding: "11px 0", borderRadius: 6, background: "transparent",
                border: `1px solid ${C.border}`, color: C.muted,
                fontFamily: F.ui, fontWeight: 600, fontSize: 13,
              }}>
                Skip
              </button>
              <button className="rm-btn" onClick={submitName} style={{
                padding: "11px 0", borderRadius: 6,
                background: `linear-gradient(135deg, ${C.gold} 0%, #9A6B18 100%)`,
                border: "none", color: "#07060D",
                fontFamily: F.display, fontWeight: 700, fontSize: 13,
                letterSpacing: "0.04em",
              }}>
                Generate Story →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
