"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { gsap } from "gsap";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface RoastPattern {
  emoji: string; title: string;
  body?: string; closer?: string;
  lines?: string[];
}
interface RoastData    { cosmic_title: string; patterns: RoastPattern[]; }
interface ChartSummary {
  session_id: string; name: string; ascendant: string;
  sun_sign: string; moon_sign: string; location: string;
  dominant_planet: string;
}
interface UserProfile { name: string; email: string; password?: string; }

type Screen    = "intro" | "input" | "loading" | "result";
type Intensity = "Gentle" | "Chaotic" | "Unhinged";
type Platform  = "instagram" | "snapchat" | "whatsapp" | "facebook" | "twitter" | "copy";

/* ─── Theme ──────────────────────────────────────────────────────────────────── */

const DARK = {
  bg:         "#060A14",  card:       "#0C1422",  cardDeep:   "#080E1C",
  gold:       "#C08B2F",  goldLight:  "#DEB86A",  goldFaint:  "rgba(192,139,47,0.09)",
  goldBorder: "rgba(192,139,47,0.28)",  text:  "#E2E8F4",  muted:      "#64748B",
  dim:        "#1E293B",  border:     "rgba(59,100,200,0.18)",
  navBg:      "rgba(6,10,20,0.94)",     inputBg:    "rgba(255,255,255,0.04)",
  inputBorder:"rgba(59,100,200,0.2)",   sheetBg:    "#0C1422",
  overlayBg:  "rgba(6,10,20,0.88)",     selectBg:   "#0C1422",
} as const;

const LIGHT = {
  bg:         "#F8F4EC",  card:       "#FFFDF7",  cardDeep:   "#F5EFE0",
  gold:       "#9A6B18",  goldLight:  "#7A5010",  goldFaint:  "rgba(154,107,24,0.08)",
  goldBorder: "rgba(154,107,24,0.22)",  text:  "#1C1628",  muted:      "#6B7280",
  dim:        "#C4B89A",  border:     "rgba(59,100,200,0.1)",
  navBg:      "rgba(248,244,236,0.97)", inputBg:    "rgba(0,0,0,0.04)",
  inputBorder:"rgba(59,100,200,0.15)",  sheetBg:    "#FFFDF7",
  overlayBg:  "rgba(30,20,10,0.55)",    selectBg:   "#FFFDF7",
} as const;

type Colors = Record<keyof typeof DARK, string>;

interface ThemeCtxType { C: Colors; isDark: boolean; toggleTheme: () => void; }
const ThemeCtx = createContext<ThemeCtxType>({ C: DARK, isDark: true, toggleTheme: () => {} });
const useTheme = () => useContext(ThemeCtx);

/* ─── Fonts ──────────────────────────────────────────────────────────────────── */
const F = {
  cinematic: "'Cormorant Garamond', serif",
  display:   "'Space Grotesk', sans-serif",
  ui:        "'Syne', sans-serif",
  mono:      "'Inconsolata', monospace",
} as const;

/* ─── Config ─────────────────────────────────────────────────────────────────── */
const API_URL         = process.env.NEXT_PUBLIC_API_URL ?? "";
const FORMSPREE_ID    = process.env.NEXT_PUBLIC_FORMSPREE_ID ?? "mqengjav";
// TODO: Add these to your .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const COSMOS_CHAT_URL = "https://my-destiny-murex.vercel.app/";

/* ─── Supabase profile saver ─────────────────────────────────────────────────── */
// Run this SQL in your Supabase dashboard first:
//   CREATE TABLE IF NOT EXISTS profiles (
//     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     email text NOT NULL,
//     name text,
//     created_at timestamptz DEFAULT now()
//   );
//   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "anon_insert" ON profiles FOR INSERT WITH CHECK (true);

async function saveProfileToSupabase(profile: UserProfile): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({ email: profile.email, name: profile.name }),
  });
  if (!res.ok) throw new Error("Supabase save failed");
}

/* ─── Planet metadata ────────────────────────────────────────────────────────── */

const PLANET_META: Record<string, { symbol: string; color: string }> = {
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

const PLANET_GENTILIC: Record<string, string> = {
  Sun: "Solar", Moon: "Lunar", Mars: "Martian", Mercury: "Mercurian",
  Jupiter: "Jovian", Venus: "Venusian", Saturn: "Saturnian",
  Rahu: "Rahuvian", Ketu: "Ketuvian",
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

/* ─── Languages ──────────────────────────────────────────────────────────────── */

const LANGUAGES = [
  "English","Spanish","French","German","Portuguese","Hindi","Arabic",
  "Japanese","Korean","Mandarin Chinese","Italian","Russian","Dutch",
  "Turkish","Polish","Bengali","Urdu","Indonesian","Malay","Thai",
  "Vietnamese","Swahili","Punjabi","Persian/Farsi","Greek","Swedish",
  "Norwegian","Danish","Finnish","Hebrew","Ukrainian","Romanian","Czech","Hungarian",
];

/* ─── Global CSS (injected once, uses CSS vars for theme) ────────────────────── */

const CSS = `
*, *::before, *::after { box-sizing: border-box; }

.rm-input {
  width: 100%; background: var(--rm-input-bg); border: 1px solid var(--rm-input-border);
  color: var(--rm-input-color); padding: 13px 15px; border-radius: 6px;
  font-family: 'Syne', sans-serif; font-size: 14px; outline: none;
  transition: border-color 0.2s, background 0.2s; appearance: none; letter-spacing: 0.01em;
}
.rm-input:focus { border-color: var(--rm-gold-border); background: var(--rm-input-bg); filter: brightness(1.04); }
.rm-input::placeholder { color: var(--rm-input-ph); }
input[type=date]::-webkit-calendar-picker-indicator,
input[type=time]::-webkit-calendar-picker-indicator { filter: invert(0.45) sepia(0.3); cursor: pointer; }

@keyframes rmSpin    { to { transform: rotate(360deg);  } }
@keyframes rmSpinRev { to { transform: rotate(-360deg); } }
@keyframes rmFadeUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
@keyframes rmFadeIn  { from { opacity:0; } to { opacity:1; } }
@keyframes rmTwinkle { 0%,100%{opacity:0.4} 50%{opacity:1} }
@keyframes rmSlideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }

.rm-hero { animation: rmFadeIn 0.9s ease forwards; }

.rm-btn { transition: all 0.15s ease; cursor: pointer; }
.rm-btn:hover { opacity: 0.75; }
.rm-btn:active { transform: scale(0.97); }

.rm-overlay {
  position: fixed; inset: 0; background: var(--rm-overlay-bg);
  backdrop-filter: blur(6px); z-index: 100;
  display: flex; align-items: flex-end; justify-content: center;
  animation: rmFadeIn 0.2s ease;
}
@media (min-width: 480px) { .rm-overlay { align-items: center; } }

.rm-sheet {
  background: var(--rm-sheet-bg); border: 1px solid var(--rm-gold-border);
  border-radius: 18px 18px 0 0; padding: 1.5rem 1.25rem 2.75rem;
  width: 100%; max-width: 460px; animation: rmFadeUp 0.25s ease;
}
@media (min-width: 480px) { .rm-sheet { border-radius: 16px; } }

.rm-star { position:absolute; border-radius:50%; background:rgba(255,255,255,0.75); pointer-events:none; }
.rm-star-twinkle { animation: rmTwinkle var(--d,3s) ease-in-out infinite; }

.rm-mobile-menu {
  position: fixed; top: 62px; left: 0; right: 0; z-index: 199;
  background: var(--rm-nav-bg); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--rm-border);
  padding: 1rem 1.5rem 1.25rem;
  display: flex; flex-direction: column; gap: 14px;
  animation: rmSlideDown 0.18s ease;
}

.rm-copy-btn {
  position: absolute; top: 10px; right: 10px;
  padding: 3px 8px; border-radius: 4px; font-size: 10px;
  font-family: 'Syne', sans-serif; font-weight: 600;
  background: transparent; border: 1px solid var(--rm-border);
  color: var(--rm-muted); cursor: pointer; opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  letter-spacing: 0.04em;
}
.rm-card:hover .rm-copy-btn { opacity: 1; }
.rm-copy-btn:hover { background: var(--rm-gold-faint); border-color: var(--rm-gold-border); }
`;

/* ─── Canvas planet renderer ──────────────────────────────────────────────── */

function drawPlanetOnCanvas(ctx: CanvasRenderingContext2D, planet: string, color: string, cx: number, cy: number, r: number) {
  ctx.save();
  switch (planet) {
    case "Sun": {
      // Outer glow
      const sg = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.2);
      sg.addColorStop(0, color + "55"); sg.addColorStop(1, "transparent");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
      // Rays
      for (let i = 0; i < 12; i++) {
        const a = (i * 30 * Math.PI) / 180;
        ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = r * 0.08;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(cx + r * 1.1 * Math.cos(a), cy + r * 1.1 * Math.sin(a));
        ctx.lineTo(cx + r * 1.5 * Math.cos(a), cy + r * 1.5 * Math.sin(a)); ctx.stroke(); ctx.restore();
      }
      // Main disk
      const sunG = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
      sunG.addColorStop(0, "#FFEAA0"); sunG.addColorStop(0.4, color); sunG.addColorStop(1, "#B86000");
      ctx.fillStyle = sunG; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      // Sunspots
      ctx.fillStyle = "rgba(180,80,0,0.5)";
      ctx.beginPath(); ctx.ellipse(cx - r*0.25, cy - r*0.2, r*0.14, r*0.1, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + r*0.3, cy + r*0.25, r*0.09, r*0.07, 0.5, 0, Math.PI*2); ctx.fill();
      break;
    }
    case "Moon": {
      // Glow
      const mg = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.8);
      mg.addColorStop(0, "#C0D0E822"); mg.addColorStop(1, "transparent");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2); ctx.fill();
      // Main disc
      const moonG = ctx.createRadialGradient(cx - r*0.2, cy - r*0.2, 0, cx, cy, r);
      moonG.addColorStop(0, "#D8E8F8"); moonG.addColorStop(0.6, color); moonG.addColorStop(1, "#8090A8");
      ctx.fillStyle = moonG; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      // Dark side crescent
      ctx.fillStyle = "#060A14"; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(cx + r * 0.25, cy, r * 0.82, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Craters
      const craters = [[-0.35, -0.2, 0.18], [0.1, 0.35, 0.12], [-0.15, 0.38, 0.09], [-0.42, 0.18, 0.1]];
      for (const [ox, oy, cr] of craters) {
        ctx.fillStyle = "rgba(90,105,130,0.6)";
        ctx.beginPath(); ctx.arc(cx + ox*r, cy + oy*r, cr*r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(120,140,170,0.35)"; ctx.lineWidth = r*0.025;
        ctx.beginPath(); ctx.arc(cx + ox*r, cy + oy*r, cr*r, 0, Math.PI*2); ctx.stroke();
      }
      break;
    }
    case "Mars": {
      const marg = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.6);
      marg.addColorStop(0, color + "33"); marg.addColorStop(1, "transparent");
      ctx.fillStyle = marg; ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2); ctx.fill();
      const marsG = ctx.createRadialGradient(cx - r*0.25, cy - r*0.25, 0, cx, cy, r);
      marsG.addColorStop(0, "#E86040"); marsG.addColorStop(0.5, color); marsG.addColorStop(1, "#7A2010");
      ctx.fillStyle = marsG; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      // Dark surface bands
      ctx.fillStyle = "rgba(100,20,0,0.35)";
      ctx.beginPath(); ctx.ellipse(cx, cy - r*0.2, r*0.9, r*0.32, 0.1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy + r*0.18, r*0.85, r*0.2, -0.1, 0, Math.PI*2); ctx.fill();
      // Polar ice cap
      ctx.fillStyle = "rgba(230,230,220,0.8)";
      ctx.beginPath(); ctx.ellipse(cx, cy - r*0.78, r*0.42, r*0.18, 0, 0, Math.PI*2); ctx.fill();
      // Craters / Valles
      ctx.strokeStyle = "rgba(80,15,0,0.45)"; ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.arc(cx - r*0.3, cy + r*0.1, r*0.2, 0, Math.PI*2); ctx.stroke();
      break;
    }
    case "Mercury": {
      const mercG = ctx.createRadialGradient(cx - r*0.2, cy - r*0.2, 0, cx, cy, r);
      mercG.addColorStop(0, "#A0B0C0"); mercG.addColorStop(0.4, color); mercG.addColorStop(1, "#3A4A55");
      ctx.fillStyle = mercG; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      // Terminator
      ctx.fillStyle = "rgba(10,15,25,0.4)";
      ctx.beginPath(); ctx.arc(cx + r*0.35, cy, r, 0, Math.PI*2); ctx.fill();
      // Craters
      const merc = [[-0.28, -0.25, 0.22], [0.2, 0.3, 0.17], [-0.12, 0.36, 0.12], [0.25, -0.18, 0.1], [-0.05, 0.05, 0.06]];
      for (const [ox, oy, cr] of merc) {
        const cg = ctx.createRadialGradient(cx+ox*r-cr*r*0.3, cy+oy*r-cr*r*0.3, 0, cx+ox*r, cy+oy*r, cr*r);
        cg.addColorStop(0, "rgba(60,70,80,0.75)"); cg.addColorStop(0.7, "rgba(40,50,60,0.55)"); cg.addColorStop(1, "rgba(80,95,110,0.3)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx + ox*r, cy + oy*r, cr*r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(140,160,180,0.3)"; ctx.lineWidth = cr*r*0.2;
        ctx.beginPath(); ctx.arc(cx + ox*r, cy + oy*r, cr*r, 0, Math.PI*2); ctx.stroke();
      }
      break;
    }
    case "Jupiter": {
      // Clip to planet circle
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      const jupG = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      jupG.addColorStop(0, "#F0C870"); jupG.addColorStop(0.5, color); jupG.addColorStop(1, "#7A5020");
      ctx.fillStyle = jupG; ctx.fillRect(cx-r, cy-r, r*2, r*2);
      // Bands
      const bands = [[-0.55, 0.18, "#7A4A18", 0.5], [-0.25, 0.13, "#C09040", 0.3], [-0.04, 0.1, "#7A4A18", 0.45], [0.16, 0.15, "#C09040", 0.28], [0.38, 0.17, "#7A4A18", 0.42]];
      for (const [by, bh, bc, ba] of bands) {
        ctx.fillStyle = bc as string; ctx.globalAlpha = ba as number;
        ctx.fillRect(cx - r, cy + (by as number)*r, r*2, (bh as number)*r);
      }
      ctx.globalAlpha = 1;
      // Great Red Spot
      ctx.save(); ctx.translate(cx + r*0.35, cy + r*0.2);
      const grs = ctx.createRadialGradient(0, 0, 0, 0, 0, r*0.22);
      grs.addColorStop(0, "rgba(180,40,20,0.9)"); grs.addColorStop(0.6, "rgba(150,30,10,0.7)"); grs.addColorStop(1, "transparent");
      ctx.fillStyle = grs; ctx.beginPath(); ctx.ellipse(0, 0, r*0.22, r*0.14, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
      ctx.restore();
      break;
    }
    case "Venus": {
      // Thick cloud glow
      const vg = ctx.createRadialGradient(cx, cy, r*0.7, cx, cy, r*1.6);
      vg.addColorStop(0, color + "55"); vg.addColorStop(0.5, color + "22"); vg.addColorStop(1, "transparent");
      ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(cx, cy, r*1.6, 0, Math.PI*2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      const venG = ctx.createRadialGradient(cx - r*0.15, cy - r*0.2, 0, cx, cy, r);
      venG.addColorStop(0, "#FFEAA0"); venG.addColorStop(0.4, color); venG.addColorStop(1, "#A08010");
      ctx.fillStyle = venG; ctx.fillRect(cx-r, cy-r, r*2, r*2);
      // Cloud swirls
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(220,200,80,${0.25 - i*0.04})`; ctx.lineWidth = r * 0.12;
        ctx.beginPath(); ctx.ellipse(cx, cy - r*(0.4 - i*0.25), r*0.85, r*0.12, 0.15*i, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "Saturn": {
      // Rings (behind)
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.28);
      for (const [ri, ro, rc, ra] of [[r*1.25, r*1.65, "#D4B870", 0.55], [r*1.68, r*1.98, "#B8984A", 0.45], [r*2.0, r*2.25, "#C4A860", 0.35]]) {
        const rg = ctx.createRadialGradient(0, 0, ri as number, 0, 0, ro as number);
        rg.addColorStop(0, `rgba(212,184,112,${ra})`); rg.addColorStop(0.5, rc as string); rg.addColorStop(1, "transparent");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(0, 0, ro as number, 0, Math.PI*2); ctx.arc(0, 0, ri as number, 0, Math.PI*2, true); ctx.fill();
      }
      ctx.restore();
      // Planet
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      const satG = ctx.createRadialGradient(cx - r*0.1, cy - r*0.1, 0, cx, cy, r);
      satG.addColorStop(0, "#E8D898"); satG.addColorStop(0.5, color); satG.addColorStop(1, "#887848");
      ctx.fillStyle = satG; ctx.fillRect(cx-r, cy-r, r*2, r*2);
      ctx.fillStyle = "rgba(140,110,60,0.35)";
      ctx.beginPath(); ctx.ellipse(cx, cy - r*0.2, r, r*0.14, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy + r*0.22, r, r*0.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // Ring front (over planet)
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.28);
      ctx.fillStyle = "rgba(6,10,20,0.85)";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "rgba(212,184,112,0.5)"; ctx.lineWidth = r*0.18;
      ctx.beginPath(); ctx.arc(0, 0, r*1.45, Math.PI*0.05, Math.PI*0.95); ctx.stroke();
      ctx.strokeStyle = "rgba(184,152,74,0.4)"; ctx.lineWidth = r*0.25;
      ctx.beginPath(); ctx.arc(0, 0, r*1.82, Math.PI*0.05, Math.PI*0.95); ctx.stroke();
      ctx.restore();
      break;
    }
    case "Rahu": {
      const rg = ctx.createRadialGradient(cx, cy, r*0.5, cx, cy, r*2);
      rg.addColorStop(0, "#9070C055"); rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, r*2, 0, Math.PI*2); ctx.fill();
      const rahuG = ctx.createRadialGradient(cx + r*0.2, cy - r*0.2, 0, cx, cy, r);
      rahuG.addColorStop(0, "#8060A8"); rahuG.addColorStop(0.5, color); rahuG.addColorStop(1, "#1A1030");
      ctx.fillStyle = rahuG; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      // Shadow
      ctx.fillStyle = "rgba(6,10,20,0.5)"; ctx.beginPath(); ctx.arc(cx + r*0.3, cy - r*0.2, r*0.85, 0, Math.PI*2); ctx.fill();
      // Aura rings
      for (let i = 1; i <= 3; i++) {
        ctx.strokeStyle = `rgba(144,112,192,${0.22 - i*0.06})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r + i*r*0.15, 0, Math.PI*2); ctx.stroke();
      }
      break;
    }
    case "Ketu": {
      const kg = ctx.createRadialGradient(cx, cy, r*0.5, cx, cy, r*1.8);
      kg.addColorStop(0, "#C0606055"); kg.addColorStop(1, "transparent");
      ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(cx, cy, r*1.8, 0, Math.PI*2); ctx.fill();
      const ketuG = ctx.createRadialGradient(cx + r*0.2, cy - r*0.2, 0, cx, cy, r);
      ketuG.addColorStop(0, "#C07060"); ketuG.addColorStop(0.5, color); ketuG.addColorStop(1, "#3A1010");
      ctx.fillStyle = ketuG; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(6,10,20,0.45)"; ctx.beginPath(); ctx.arc(cx + r*0.28, cy - r*0.18, r*0.82, 0, Math.PI*2); ctx.fill();
      // Tail / comet tail
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const tg = ctx.createLinearGradient(cx + r*0.6, cy + r*(0.5 + i*0.15), cx + r*2.8, cy + r*(1.8 + i*0.25));
        tg.addColorStop(0, `rgba(180,80,60,${0.4 - i*0.1})`); tg.addColorStop(1, "transparent");
        ctx.strokeStyle = tg; ctx.lineWidth = r * (0.1 - i*0.025); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(cx + r*0.6, cy + r*(0.5 + i*0.15)); ctx.lineTo(cx + r*2.8, cy + r*(1.8 + i*0.25)); ctx.stroke();
      }
      ctx.restore();
      break;
    }
    default: {
      const dg = ctx.createRadialGradient(cx - r*0.2, cy - r*0.2, 0, cx, cy, r);
      dg.addColorStop(0, "#E0D8C8"); dg.addColorStop(1, color);
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}

/* ─── Canvas story generator ──────────────────────────────────────────────────── */

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): number {
  const words = text.split(" ");
  let line = "", cy = y;
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxW && n > 0) {
      ctx.fillText(line.trim(), x, cy); line = words[n] + " "; cy += lh;
    } else { line = test; }
  }
  ctx.fillText(line.trim(), x, cy);
  return cy;
}

async function genStoryBlob(name: string, cosmicTitle: string, planet: string, roastTitle: string, body: string): Promise<Blob> {
  await document.fonts.ready;
  const cv = document.createElement("canvas");
  cv.width = 1080; cv.height = 1920;
  const x = cv.getContext("2d")!;

  /* ── Deep space background ── */
  const bg = x.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0, "#03060F");
  bg.addColorStop(0.35, "#080E1C");
  bg.addColorStop(0.65, "#060A18");
  bg.addColorStop(1, "#020408");
  x.fillStyle = bg; x.fillRect(0, 0, 1080, 1920);

  /* ── Nebula glows ── */
  const neb1 = x.createRadialGradient(200, 400, 0, 200, 400, 600);
  neb1.addColorStop(0, "rgba(40,20,100,0.35)"); neb1.addColorStop(1, "transparent");
  x.fillStyle = neb1; x.fillRect(0, 0, 1080, 1920);

  const neb2 = x.createRadialGradient(880, 1100, 0, 880, 1100, 550);
  neb2.addColorStop(0, "rgba(100,30,20,0.25)"); neb2.addColorStop(1, "transparent");
  x.fillStyle = neb2; x.fillRect(0, 0, 1080, 1920);

  const neb3 = x.createRadialGradient(540, 960, 0, 540, 960, 480);
  neb3.addColorStop(0, "rgba(20,40,90,0.3)"); neb3.addColorStop(1, "transparent");
  x.fillStyle = neb3; x.fillRect(0, 0, 1080, 1920);

  /* ── Stars ── */
  const starData = Array.from({ length: 280 }, (_, i) => ({
    sx: (i * 197 + 37) % 1080, sy: (i * 313 + 89) % 1920,
    sr: i % 7 === 0 ? 3 : i % 4 === 0 ? 2 : i % 3 === 0 ? 1.4 : 0.7,
    bright: i % 5 === 0,
  }));
  for (const { sx, sy, sr, bright } of starData) {
    if (bright) {
      const sg = x.createRadialGradient(sx, sy, 0, sx, sy, sr * 4);
      sg.addColorStop(0, "rgba(255,255,255,0.9)"); sg.addColorStop(1, "transparent");
      x.fillStyle = sg; x.beginPath(); x.arc(sx, sy, sr * 4, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = bright ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)";
    x.beginPath(); x.arc(sx, sy, sr, 0, Math.PI * 2); x.fill();
  }

  /* ── Planet  ── */
  const pm = PLANET_META[planet] ?? PLANET_META.Saturn;
  const planetY = 960;
  const planetR = 330;

  // Planet ambient glow
  const pg = x.createRadialGradient(540, planetY, planetR * 0.6, 540, planetY, planetR * 2.4);
  pg.addColorStop(0, pm.color + "40"); pg.addColorStop(0.5, pm.color + "18"); pg.addColorStop(1, "transparent");
  x.fillStyle = pg; x.beginPath(); x.arc(540, planetY, planetR * 2.4, 0, Math.PI * 2); x.fill();

  drawPlanetOnCanvas(x, planet, pm.color, 540, planetY, planetR);

  /* ── Top section: branding ── */
  // Decorative gold lines
  x.strokeStyle = "#C08B2F"; x.lineWidth = 1.5;
  const drawGoldLine = (y: number) => {
    const lg = x.createLinearGradient(80, y, 1000, y);
    lg.addColorStop(0, "transparent"); lg.addColorStop(0.15, "#C08B2F"); lg.addColorStop(0.85, "#C08B2F"); lg.addColorStop(1, "transparent");
    x.strokeStyle = lg; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(80, y); x.lineTo(1000, y); x.stroke();
  };
  drawGoldLine(148);

  // Brand
  x.fillStyle = "#C08B2F"; x.font = "800 34px 'Syne', sans-serif";
  x.textAlign = "center"; x.letterSpacing = "0.12em";
  x.fillText("ROAST-ME", 540, 118);

  // Planet label pill
  const gentilic = PLANET_GENTILIC[planet] ?? planet;
  const pillText = `${pm.symbol}  You are a ${gentilic} person`;
  x.font = "600 30px 'Syne', sans-serif";
  const pillW = x.measureText(pillText).width + 60;
  const pillX = 540 - pillW / 2, pillY = 172, pillH = 52;
  x.fillStyle = pm.color + "22";
  x.strokeStyle = pm.color + "66"; x.lineWidth = 1.5;
  roundRect(x, pillX, pillY, pillW, pillH, 26);
  x.fill(); x.stroke();
  x.fillStyle = pm.color; x.font = "700 28px 'Syne', sans-serif";
  x.fillText(pillText, 540, pillY + 34);

  /* ── Name & guess who ── */
  const dn = name.trim() ? name.trim().toUpperCase() : "SOMEONE YOU KNOW";
  x.fillStyle = "rgba(150,165,190,0.85)"; x.font = "500 28px 'Space Grotesk', sans-serif";
  x.fillText(`GUESS WHO ${dn} ACTUALLY IS?`, 540, 260);

  /* ── Cosmic title ── */
  x.fillStyle = "#E8EEF8";
  x.font = `700 ${cosmicTitle.length > 24 ? 60 : 68}px 'Space Grotesk', sans-serif`;
  const titleY = wrapText(x, `"${cosmicTitle}"`, 540, 340, 920, 80);

  // Subtle glow under title
  const titleGlow = x.createLinearGradient(80, titleY + 24, 1000, titleY + 26);
  titleGlow.addColorStop(0, "transparent"); titleGlow.addColorStop(0.2, pm.color + "66"); titleGlow.addColorStop(0.8, pm.color + "66"); titleGlow.addColorStop(1, "transparent");
  x.strokeStyle = titleGlow; x.lineWidth = 2;
  x.beginPath(); x.moveTo(80, titleY + 28); x.lineTo(1000, titleY + 28); x.stroke();

  /* ── Roast card in the lower section ── */
  const cardTop = Math.max(titleY + 80, 1340);
  const cardH = 440;

  // Card background
  const cardG = x.createLinearGradient(60, cardTop, 60, cardTop + cardH);
  cardG.addColorStop(0, "rgba(12,20,36,0.92)"); cardG.addColorStop(1, "rgba(8,14,28,0.96)");
  x.fillStyle = cardG;
  roundRect(x, 60, cardTop, 960, cardH, 20);
  x.fill();

  // Card border
  const borderG = x.createLinearGradient(60, cardTop, 1020, cardTop + cardH);
  borderG.addColorStop(0, pm.color + "55"); borderG.addColorStop(0.5, pm.color + "99"); borderG.addColorStop(1, pm.color + "44");
  x.strokeStyle = borderG; x.lineWidth = 2;
  roundRect(x, 60, cardTop, 960, cardH, 20); x.stroke();

  // Gold top stripe on card
  const stripeG = x.createLinearGradient(60, cardTop, 1020, cardTop);
  stripeG.addColorStop(0, "transparent"); stripeG.addColorStop(0.1, "#C08B2F"); stripeG.addColorStop(0.9, "#DEB86A"); stripeG.addColorStop(1, "transparent");
  x.fillStyle = stripeG; x.fillRect(60, cardTop, 960, 3);

  // Roast title
  x.fillStyle = pm.color; x.font = "700 46px 'Space Grotesk', sans-serif";
  const rt2 = wrapText(x, roastTitle, 540, cardTop + 68, 880, 58);

  // Body text
  const shortBody = body.length > 200 ? body.slice(0, 197) + "…" : body;
  x.fillStyle = "rgba(195,210,230,0.88)"; x.font = "400 30px 'Inconsolata', monospace";
  wrapText(x, shortBody, 540, rt2 + 52, 880, 42);

  /* ── Bottom branding ── */
  drawGoldLine(1804);
  x.fillStyle = "rgba(100,116,139,0.9)"; x.font = "500 28px 'Space Grotesk', sans-serif";
  x.fillText("Find your cosmic truth at", 540, 1852);
  x.fillStyle = "#C08B2F"; x.font = "800 44px 'Space Grotesk', sans-serif";
  x.fillText("roast-me.me", 540, 1906);

  return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/png"));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ─── Share text builder ──────────────────────────────────────────────────────── */

function buildShareText(name: string, cosmicTitle: string, planet: string, roastTitle: string, body: string, closer: string): string {
  const pm = PLANET_META[planet];
  const gentilic = PLANET_GENTILIC[planet] ?? planet;
  const who = name.trim() ? `Guess who ${name.trim()} actually is?` : "Guess who this person actually is?";
  return [`👁 ${who}`, "", `"${cosmicTitle}"`, `${pm?.symbol ?? "★"} You are a ${gentilic} person`, "", `— ${roastTitle} —`, body, "", closer, "", "Find your cosmic truth ↓", "roast-me.me"].join("\n");
}

/* ─── Stream parser ───────────────────────────────────────────────────────────── */

function parseRoast(raw: string): RoastData | null {
  const text = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(text); } catch { /* fall through */ }
  let fixed = text;
  if ((fixed.match(/(?<!\\)"/g) ?? []).length % 2 !== 0) fixed += '"';
  const stack: string[] = [];
  for (const ch of fixed) {
    if (ch === "{") stack.push("}"); else if (ch === "[") stack.push("]");
    else if ((ch === "}" || ch === "]") && stack.length) stack.pop();
  }
  fixed += stack.reverse().join("");
  try { return JSON.parse(fixed); } catch { return null; }
}

function patternText(p: RoastPattern): { body: string; closer: string } {
  if (p.body !== undefined) return { body: p.body ?? "", closer: p.closer ?? "" };
  const lines = p.lines ?? [];
  return { body: lines.slice(0, -1).join(" "), closer: lines[lines.length - 1] ?? "" };
}

/* ─── Feedback Modal ──────────────────────────────────────────────────────────── */

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { C } = useTheme();
  const [emoji,    setEmoji]    = useState<"sad" | "ok" | "happy" | null>(null);
  const [comment,  setComment]  = useState("");
  const [sending,  setSending]  = useState(false);
  const [done,     setDone]     = useState(false);

  const submit = async () => {
    if (!emoji) return;
    setSending(true);
    try {
      await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: emoji, message: comment }),
      });
      setDone(true);
    } catch { /* silent */ } finally { setSending(false); }
  };

  return (
    <div id="feedbackBackdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div id="feedbackModal">
        {done ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: 40, marginBottom: "0.75rem" }}>✨</div>
            <div className="fb-title" style={{ marginBottom: 6 }}>Thank you!</div>
            <div className="fb-sub">The cosmos received your message.</div>
            <button className="fb-cancel" style={{ marginTop: "1.25rem", width: "100%" }} onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div>
              <div className="fb-title">Share your feedback</div>
              <div className="fb-sub">How has your experience been?</div>
            </div>
            <div className="fb-emojis">
              <button className={`fb-emoji${emoji === "sad"   ? " selected" : ""}`} onClick={() => setEmoji("sad")}   title="Not great">😢</button>
              <button className={`fb-emoji${emoji === "ok"    ? " selected" : ""}`} onClick={() => setEmoji("ok")}    title="It's okay">😐</button>
              <button className={`fb-emoji${emoji === "happy" ? " selected" : ""}`} onClick={() => setEmoji("happy")} title="Love it">😊</button>
            </div>
            <textarea className="fb-comment" value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Any suggestions or thoughts? (optional)" />
            <div className="fb-row">
              <button className="fb-cancel" onClick={onClose}>Cancel</button>
              <button className="fb-send" disabled={!emoji || sending} onClick={submit}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Profile Modal ───────────────────────────────────────────────────────────── */

function ProfileModal({ onClose, onSave, initial }: {
  onClose: () => void;
  onSave: (p: UserProfile) => void;
  initial: UserProfile | null;
}) {
  const { C } = useTheme();
  const [name,    setName]    = useState(initial?.name  ?? "");
  const [email,   setEmail]   = useState(initial?.email ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [showPw,  setShowPw]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [err,     setErr]     = useState("");

  const validate = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const save = async () => {
    if (!validate(email)) { setErr("Please enter a valid email address."); return; }
    setSaving(true); setErr("");
    const profile: UserProfile = { name: name.trim(), email: email.trim(), password: password || undefined };
    try {
      await saveProfileToSupabase(profile);
      localStorage.setItem("rm-profile", JSON.stringify(profile));
      onSave(profile);
      setSaved(true);
      setTimeout(onClose, 1400);
    } catch { setErr("Couldn't save. Check your connection and try again."); }
    finally { setSaving(false); }
  };

  const supabaseReady = !!(SUPABASE_URL && SUPABASE_KEY);
  const initial2 = (name[0] ?? email[0] ?? "").toUpperCase();

  return (
    <div className="rm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rm-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, padding: "1.75rem 1.5rem 2rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 18, color: C.text }}>My Profile</div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: F.ui, marginTop: 3 }}>
              Email is required to receive receipts
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* Avatar preview */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: initial2 ? `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` : C.dim,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 800, color: "#FFF8EE",
            border: `2px solid ${C.goldBorder}`,
            fontFamily: F.display,
          }}>
            {initial2 || "✦"}
          </div>
        </div>

        {!supabaseReady && (
          <div style={{
            fontSize: 11, color: C.gold, background: C.goldFaint,
            border: `1px solid ${C.goldBorder}`, borderRadius: 6,
            padding: "8px 12px", fontFamily: F.ui, marginBottom: "1.25rem", lineHeight: 1.6,
          }}>
            ⚠️ Supabase not configured — profile won&apos;t sync to server until you set NEXT_PUBLIC_SUPABASE_URL &amp; NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 6, fontFamily: F.ui }}>
              Your name (optional)
            </div>
            <input type="text" className="rm-input" placeholder="How the cosmos knows you"
              value={name} onChange={e => { setName(e.target.value); setSaved(false); }} />
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 6, fontFamily: F.ui }}>
              Email address <span style={{ color: C.gold }}>*</span>
            </div>
            <input type="email" className="rm-input" placeholder="you@example.com"
              value={email} onChange={e => { setEmail(e.target.value); setErr(""); setSaved(false); }} />
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 6, fontFamily: F.ui }}>
              Password <span style={{ color: C.dim, fontWeight: 400 }}>(optional)</span>
            </div>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} className="rm-input" placeholder="Set a password"
                value={password} onChange={e => { setPassword(e.target.value); setSaved(false); }}
                style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: 2,
              }}>{showPw ? "🙈" : "👁"}</button>
            </div>
          </div>

          {err && <p style={{ fontSize: 12, color: "#E8665A", fontFamily: F.ui }}>{err}</p>}

          {saved ? (
            <div style={{ textAlign: "center", padding: "10px 0", color: C.gold, fontFamily: F.ui, fontWeight: 700, fontSize: 14 }}>
              ✓ Profile saved
            </div>
          ) : (
            <button className="rm-btn" onClick={save} disabled={saving || !email.trim()} style={{
              marginTop: 4, height: 48, border: "none", borderRadius: 6,
              background: `linear-gradient(135deg, ${C.gold} 0%, #7A5010 100%)`,
              color: "#FFF8EE", fontSize: 14, fontFamily: F.display,
              fontWeight: 700, letterSpacing: "0.05em",
              opacity: email.trim() ? 1 : 0.5,
            }}>
              {saving ? "Saving…" : "Save Profile"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── NavBar ──────────────────────────────────────────────────────────────────── */

function NavBar({
  onFeedback, onProfile, profile, mobileOpen, setMobileOpen,
}: {
  onFeedback: () => void;
  onProfile:  () => void;
  profile:    UserProfile | null;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const { C, isDark, toggleTheme } = useTheme();

  const initial = (profile?.name?.[0] ?? profile?.email?.[0] ?? "").toUpperCase();

  const lk: React.CSSProperties = {
    fontSize: 11, fontFamily: F.ui, fontWeight: 600,
    color: C.muted, textDecoration: "underline",
    textUnderlineOffset: 3, letterSpacing: "0.02em",
    cursor: "pointer", background: "none", border: "none", padding: 0,
  };

  const Avatar = (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      background: initial
        ? `linear-gradient(135deg, ${C.gold} 0%, ${C.goldLight} 100%)`
        : C.dim,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 800, color: initial ? "#07060D" : C.muted,
      border: `1.5px solid ${C.goldBorder}`, fontFamily: F.display,
    }}>
      {initial || "✦"}
    </div>
  );

  return (
    <>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: 62, background: C.navBg, backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "0 1.5rem", gap: 0,
      }}>
        {/* Brand */}
        <a href="/" style={{
          fontFamily: F.ui, fontSize: 15, fontWeight: 800,
          color: C.gold, letterSpacing: "0.1em", marginRight: "auto",
          textDecoration: "none", flexShrink: 0,
        }}>
          ROAST-ME
        </a>

        {/* Desktop links — right-aligned: Wanna Chat | Know Creator | Feedback | My Profile */}
        <div className="rm-nav-links" style={{ gap: 0, alignItems: "center" }}>
          <a href={COSMOS_CHAT_URL} style={{ ...lk, fontSize: 12 }}>Wanna Chat with Cosmos?</a>
          <span style={{ color: C.dim, margin: "0 12px", fontSize: 13 }}>|</span>
          <a href="/know-the-creator" style={{ ...lk, fontSize: 12 }}>Know the Creator</a>
          <span style={{ color: C.dim, margin: "0 12px", fontSize: 13 }}>|</span>
          <button onClick={onFeedback} style={{ ...lk, fontSize: 12 }}>Feedback</button>
          <span style={{ color: C.dim, margin: "0 12px", fontSize: 13 }}>|</span>

          {/* My Profile — highlighted */}
          <button onClick={onProfile} className="rm-nav-links"
            title="My Profile" style={{
              background: C.goldFaint,
              border: `1px solid ${C.goldBorder}`,
              borderRadius: 20,
              padding: "5px 14px 5px 10px",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7,
            }}>
            {Avatar}
            <span style={{ fontSize: 12, fontWeight: 700, color: C.goldLight, fontFamily: F.ui, letterSpacing: "0.03em" }}>
              My Profile
            </span>
          </button>
        </div>

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={isDark ? "Switch to light" : "Switch to dark"} style={{
          background: C.goldFaint, border: `1px solid ${C.goldBorder}`,
          borderRadius: 20, padding: "4px 11px", cursor: "pointer",
          fontSize: 14, display: "flex", alignItems: "center", gap: 5,
          transition: "all 0.2s", marginLeft: 12,
        }} className="rm-nav-links">
          {isDark ? "☀️" : "🌙"}
        </button>

        {/* Hamburger */}
        <button className="rm-hamburger" onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexDirection: "column", gap: 4, marginLeft: 12 }}>
          <div style={{ width: 20, height: 2, background: C.muted, borderRadius: 2, transition: "transform 0.15s", transform: mobileOpen ? "rotate(45deg) translate(4px, 4px)" : "none" }} />
          <div style={{ width: 20, height: 2, background: C.muted, borderRadius: 2, opacity: mobileOpen ? 0 : 1, transition: "opacity 0.15s" }} />
          <div style={{ width: 20, height: 2, background: C.muted, borderRadius: 2, transition: "transform 0.15s", transform: mobileOpen ? "rotate(-45deg) translate(4px, -4px)" : "none" }} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="rm-mobile-menu">
          <button onClick={() => { onProfile(); setMobileOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {Avatar}
            <span style={{ ...lk, textDecoration: "none", color: C.text, fontSize: 13, fontWeight: 700 }}>My Profile</span>
          </button>
          <a href={COSMOS_CHAT_URL} style={{ ...lk, textDecoration: "underline", display: "block" }}>Wanna Chat with Cosmos?</a>
          <button onClick={() => { onFeedback(); setMobileOpen(false); }} style={{ ...lk, display: "block" }}>Feedback</button>
          <a href="/know-the-creator" style={{ ...lk, textDecoration: "underline", display: "block" }}>Know the Creator</a>
          <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
          <button onClick={() => { toggleTheme(); setMobileOpen(false); }}
            style={{ ...lk, display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span>{isDark ? "☀️" : "🌙"}</span>
            <span>{isDark ? "Switch to Light" : "Switch to Dark"}</span>
          </button>
        </div>
      )}
    </>
  );
}

/* ─── Label + Ghost ───────────────────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  const { C } = useTheme();
  return (
    <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 7, fontFamily: F.ui }}>
      {children}
    </div>
  );
}

function Ghost({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const { C } = useTheme();
  return (
    <button className="rm-btn" onClick={onClick} style={{
      padding: "9px 18px", borderRadius: 6, fontSize: 12, fontFamily: F.ui,
      fontWeight: 600, background: "transparent",
      border: `1px solid rgba(59,100,200,0.22)`, color: C.muted, letterSpacing: "0.03em",
    }}>
      {children}
    </button>
  );
}

/* ─── Planet SVG content ──────────────────────────────────────────────────────── */

function PlanetContent({ planet, color }: { planet: string; color: string }) {
  switch (planet) {
    case "Sun": {
      const rays = Array.from({ length: 12 }, (_, i) => i * 30);
      return (<>
        <circle cx="250" cy="250" r="175" fill={color} opacity="0.15" />
        {rays.map(a => { const r = (a * Math.PI) / 180; return (<line key={a} x1={250+148*Math.cos(r)} y1={250+148*Math.sin(r)} x2={250+210*Math.cos(r)} y2={250+210*Math.sin(r)} stroke={color} strokeWidth="14" strokeLinecap="round" opacity="0.85" />); })}
        <circle cx="250" cy="250" r="142" fill={color} />
        <circle cx="250" cy="250" r="115" fill="#F8DC78" opacity="0.35" />
        <circle cx="200" cy="215" r="20" fill="#E8933A" opacity="0.55" />
        <circle cx="308" cy="285" r="13" fill="#E8933A" opacity="0.45" />
      </>);
    }
    case "Moon": return (<>
      <circle cx="250" cy="250" r="155" fill={color} />
      <circle cx="328" cy="215" r="132" fill="#060A14" />
      <circle cx="178" cy="245" r="24" fill="#8A9BB0" opacity="0.75" />
      <circle cx="178" cy="245" r="18" fill={color} opacity="0.25" />
      <circle cx="215" cy="325" r="15" fill="#8A9BB0" opacity="0.65" />
      <circle cx="158" cy="295" r="11" fill="#8A9BB0" opacity="0.6" />
      <circle cx="195" cy="172" r="17" fill="#8A9BB0" opacity="0.65" />
    </>);
    case "Mars": return (<>
      <circle cx="250" cy="250" r="155" fill={color} />
      <ellipse cx="250" cy="215" rx="142" ry="52" fill="#A83010" opacity="0.38" />
      <ellipse cx="250" cy="95" rx="58" ry="24" fill="#EEE8E0" opacity="0.88" />
      <circle cx="192" cy="265" r="26" fill="#8B2800" opacity="0.55" />
      <circle cx="318" cy="228" r="18" fill="#8B2800" opacity="0.5" />
      <circle cx="272" cy="318" r="13" fill="#8B2800" opacity="0.48" />
      <path d="M 145 275 Q 250 290 355 265" stroke="#7A2400" strokeWidth="6" fill="none" opacity="0.5" strokeLinecap="round" />
    </>);
    case "Mercury": return (<>
      <circle cx="250" cy="250" r="140" fill={color} />
      <circle cx="185" cy="198" r="32" fill="#4A4A4A" opacity="0.68" />
      <circle cx="315" cy="295" r="24" fill="#4A4A4A" opacity="0.62" />
      <circle cx="228" cy="328" r="17" fill="#4A4A4A" opacity="0.58" />
      <circle cx="295" cy="175" r="15" fill="#4A4A4A" opacity="0.55" />
      <circle cx="258" cy="252" r="9" fill="#4A4A4A" opacity="0.45" />
    </>);
    case "Jupiter": return (<>
      <circle cx="250" cy="250" r="168" fill={color} />
      <ellipse cx="250" cy="195" rx="168" ry="30" fill="#8B5A1A" opacity="0.52" />
      <ellipse cx="250" cy="238" rx="168" ry="19" fill="#A06530" opacity="0.33" />
      <ellipse cx="250" cy="302" rx="168" ry="24" fill="#8B5A1A" opacity="0.48" />
      <ellipse cx="318" cy="278" rx="38" ry="22" fill="#C03030" opacity="0.82" />
      <ellipse cx="318" cy="278" rx="30" ry="15" fill="#D04040" opacity="0.45" />
    </>);
    case "Venus": return (<>
      <circle cx="250" cy="250" r="158" fill={color} />
      <path d="M 95 218 Q 200 175 305 218 Q 385 248 355 292" stroke="#C49030" strokeWidth="13" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M 118 282 Q 222 252 325 272 Q 385 284 372 325" stroke="#C49030" strokeWidth="9" fill="none" opacity="0.4" strokeLinecap="round" />
      <circle cx="250" cy="250" r="85" fill="#F8E090" opacity="0.18" />
    </>);
    case "Saturn": return (<>
      <ellipse cx="250" cy="265" rx="238" ry="44" fill="none" stroke="#B8984A" strokeWidth="20" opacity="0.68" />
      <ellipse cx="250" cy="265" rx="208" ry="37" fill="none" stroke="#D4B870" strokeWidth="11" opacity="0.5" />
      <circle cx="250" cy="250" r="132" fill={color} />
      <ellipse cx="250" cy="228" rx="132" ry="24" fill="#B09060" opacity="0.48" />
      <ellipse cx="250" cy="270" rx="132" ry="15" fill="#B09060" opacity="0.32" />
      <path d="M 14 265 A 236 44 0 0 0 252 309" stroke="#B8984A" strokeWidth="20" fill="none" opacity="0.68" />
      <path d="M 44 265 A 206 37 0 0 0 252 302" stroke="#D4B870" strokeWidth="11" fill="none" opacity="0.5" />
    </>);
    case "Rahu": return (<>
      <circle cx="250" cy="250" r="150" fill={color} />
      <circle cx="308" cy="198" r="132" fill="#060A14" opacity="0.48" />
      <path d="M 250 98 Q 292 155 272 252" stroke="#9070C0" strokeWidth="9" fill="none" opacity="0.58" strokeLinecap="round" />
      <circle cx="250" cy="250" r="154" fill="none" stroke="#7050A0" strokeWidth="5" opacity="0.38" />
    </>);
    case "Ketu": return (<>
      <circle cx="250" cy="250" r="132" fill={color} />
      <circle cx="292" cy="208" r="112" fill="#060A14" opacity="0.44" />
      <path d="M 252 382 Q 305 425 388 488" stroke="#C06060" strokeWidth="12" fill="none" opacity="0.52" strokeLinecap="round" />
      <path d="M 232 392 Q 275 448 348 508" stroke="#C06060" strokeWidth="5" fill="none" opacity="0.33" strokeLinecap="round" />
      <circle cx="250" cy="250" r="137" fill="none" stroke="#A04040" strokeWidth="5" opacity="0.38" />
    </>);
    default: return <circle cx="250" cy="250" r="155" fill={color} />;
  }
}

function PlanetBg({ planet }: { planet: string }) {
  const m = PLANET_META[planet] ?? PLANET_META.Saturn;
  return (<>
    <svg className="rm-planet-left"  viewBox="0 0 500 500" aria-hidden="true"><PlanetContent planet={planet} color={m.color} /></svg>
    <svg className="rm-planet-right" viewBox="0 0 500 500" aria-hidden="true"><PlanetContent planet={planet} color={m.color} /></svg>
  </>);
}

/* ─── Star field ─────────────────────────────────────────────────────────────── */

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: (i * 197 + 37) % 100, y: (i * 313 + 89) % 100,
  size: i % 5 === 0 ? 2.2 : i % 3 === 0 ? 1.5 : 0.9, dur: 2 + (i % 4),
}));

/* ─── Main component ──────────────────────────────────────────────────────────── */

export default function Home() {
  // ── Theme
  const [isDark, setIsDark] = useState(true);
  const C = isDark ? DARK : LIGHT;

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem("rm-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("light-theme", !next);
      return next;
    });
  }, []);

  // ── Core state
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
  const [language,   setLanguage]   = useState("English");

  // ── Share
  const [share, setShare] = useState<{ open: boolean; idx: number | "hero" | null }>({ open: false, idx: null });
  const [namePrompt, setNamePrompt] = useState<{ open: boolean; platform: Platform | null; idx: number | "hero" | null }>({ open: false, platform: null, idx: null });
  const [tempName,   setTempName]   = useState("");

  // ── UI modals
  const [feedbackOpen,  setFeedbackOpen]  = useState(false);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [profile,       setProfile]       = useState<UserProfile | null>(null);
  const [copiedIdx,     setCopiedIdx]     = useState<number | null>(null);

  const introRef = useRef<HTMLDivElement>(null);
  const msgRef   = useRef<HTMLDivElement>(null);

  // ── Inject CSS + read saved theme & profile
  useEffect(() => {
    const id = "rm-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id; s.textContent = CSS;
      document.head.appendChild(s);
    }
    // Restore theme
    const savedTheme = localStorage.getItem("rm-theme");
    if (savedTheme === "light") {
      setIsDark(false);
      document.documentElement.classList.add("light-theme");
    }
    // Restore profile
    try {
      const saved = localStorage.getItem("rm-profile");
      if (saved) setProfile(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // ── Intro animation
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
        el.appendChild(span); return span;
      });
    }

    const chars1 = makeCharSpans(line1);
    const chars2 = makeCharSpans(line2);
    const tl = gsap.timeline();

    tl.fromTo(chars1, { opacity: 0, y: 22, filter: "blur(5px)" }, { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.038, duration: 0.58, ease: "power3.out" });
    tl.fromTo(chars2, { opacity: 0, y: 22, filter: "blur(5px)" }, { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.052, duration: 0.62, ease: "power3.out" }, "-=0.15");
    tl.to(container, { opacity: 0, duration: 1.1, ease: "power2.in" }, "+=1.8");
    tl.call(() => setScreen("input"));

    // Safety fallback — if GSAP doesn't fire (browser issues, slow load)
    const safeguard = window.setTimeout(() => setScreen("input"), 5500);

    return () => { tl.kill(); clearTimeout(safeguard); };
  }, [screen]);

  // ── Loading message animation
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
    const tl = gsap.timeline({ onComplete: () => { if (!cancelled) setMsgIdx(p => (p + 1) % MSGS.length); } });
    tl.fromTo(spans, { opacity: 0, y: 16, skewY: 3 }, { opacity: 1, y: 0, skewY: 0, stagger: 0.09, duration: 0.45, ease: "power3.out" });
    tl.to(el, { opacity: 0, duration: 0.35, ease: "power2.in" }, "+=2");

    return () => { cancelled = true; tl.kill(); if (el) { gsap.set(el, { opacity: 0 }); el.innerHTML = ""; } };
  }, [msgIdx, screen]);

  // ── Handlers
  const getContent = useCallback((idx: number | "hero" | null) => {
    if (!roastData || idx === null) return { title: "", body: "", closer: "" };
    if (idx === "hero") return { title: roastData.cosmic_title, body: "", closer: "" };
    const p = roastData.patterns[idx as number];
    const { body, closer } = patternText(p);
    return { title: p?.title ?? "", body, closer };
  }, [roastData]);

  const doShare = useCallback(async (platform: Platform, shareName: string, idx: number | "hero" | null) => {
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
          const a = document.createElement("a"); a.href = url; a.download = "cosmic-roast.png"; a.click();
          URL.revokeObjectURL(url);
        }
      } catch (e) { console.error("Story share failed:", e); }
      finally { setGenerating(false); }
    } else if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://roast-me.me")}&quote=${encodeURIComponent(shareText)}`, "_blank");
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
    closeShare(); doShare(platform, name, idx);
  }, [share, name, closeShare, doShare]);

  const submitName = useCallback(async () => {
    const { platform, idx } = namePrompt;
    setNamePrompt({ open: false, platform: null, idx: null });
    if (!platform) return;
    await doShare(platform, tempName || name, idx);
    setTempName("");
  }, [namePrompt, tempName, name, doShare]);

  const copyCard = useCallback((idx: number) => {
    if (!roastData) return;
    const p = roastData.patterns[idx];
    const { body, closer } = patternText(p);
    const text = [p.title, body, closer].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, [roastData]);

  const handleSubmit = useCallback(async () => {
    if (!dob || !tob || !pob.trim()) {
      setError("Date, time, and city are required. The cosmos need coordinates."); return;
    }
    setError(""); setScreen("loading"); setMsgIdx(0);

    try {
      const cr = await fetch(`${API_URL}/api/chart`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dob, tob, pob }),
      });
      if (!cr.ok) { const e = await cr.json(); throw new Error(e.detail ?? "Chart calculation failed"); }
      const cd: ChartSummary = await cr.json();
      setChart(cd);

      const rr = await fetch(`${API_URL}/api/roast`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: cd.session_id, intensity, language }),
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
            if (p.done) { const d = parseRoast(full); if (d) { setRoastData(d); setScreen("result"); } }
          } catch { /* partial chunk */ }
        }
      }
      if (full) { const d = parseRoast(full); if (d) { setRoastData(d); setScreen("result"); } }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stars unavailable. Try again.");
      setScreen("input");
    }
  }, [dob, tob, pob, intensity, name, language]);

  const restart = useCallback(() => {
    setScreen("input"); setRoastData(null); setChart(null); setError("");
  }, []);

  /* ═══ Provide theme context to all children ════════════════════════════════ */
  const themeValue = { C, isDark, toggleTheme };

  /* ═══ INTRO ═════════════════════════════════════════════════════════════════ */

  if (screen === "intro") return (
    <ThemeCtx.Provider value={themeValue}>
      <div onClick={() => { gsap.killTweensOf("*"); setScreen("input"); }} style={{
        minHeight: "100vh", background: C.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden", cursor: "default",
      }}>
        {STARS.map((s, i) => (
          <div key={i} className="rm-star rm-star-twinkle" style={{
            left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size,
            ["--d" as string]: `${s.dur}s`, animationDelay: `${(i * 0.37) % s.dur}s`,
          }} />
        ))}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(30,58,140,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div ref={introRef} style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "2rem 1.5rem" }}>
          <div className="intro-line-1" style={{ fontFamily: F.cinematic, fontSize: "clamp(2.4rem, 6.5vw, 5.2rem)", fontWeight: 600, color: C.text, letterSpacing: "0.01em", lineHeight: 1.2, marginBottom: "0.65rem" }}>
            The cosmos has seen everything.
          </div>
          <div className="intro-line-2" style={{ fontFamily: F.cinematic, fontSize: "clamp(1.7rem, 4.5vw, 3.6rem)", fontWeight: 500, color: C.gold, letterSpacing: "0.03em", lineHeight: 1.3, fontStyle: "italic" }}>
            And they have notes.
          </div>
        </div>
        <div style={{ position: "absolute", bottom: "2.5rem", left: 0, right: 0, textAlign: "center", fontSize: 11, color: C.dim, fontFamily: F.ui, letterSpacing: "0.12em", animation: "rmFadeIn 1s ease 3.5s both" }}>
          tap anywhere to skip
        </div>
      </div>
    </ThemeCtx.Provider>
  );

  /* ═══ INPUT ══════════════════════════════════════════════════════════════════ */

  if (screen === "input") return (
    <ThemeCtx.Provider value={themeValue}>
      <div style={{ minHeight: "100vh", background: C.bg, position: "relative" }}>
        <NavBar onFeedback={() => setFeedbackOpen(true)} onProfile={() => setProfileOpen(true)} profile={profile} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(30,58,140,0.28) 0%, transparent 65%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "82px 1.5rem 3rem" }}>
          <div style={{ width: "100%", maxWidth: 700 }}>
            <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.3em", color: C.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem", fontFamily: F.ui }}>
                ROAST&#8209;ME
              </div>
              <h1 style={{ fontFamily: F.cinematic, fontSize: "clamp(2.1rem, 6vw, 3.4rem)", fontWeight: 600, color: C.text, lineHeight: 1.15, marginBottom: "0.55rem", letterSpacing: "0.01em" }}>
                Welcome to Roast&#8209;me
              </h1>
              <p style={{ fontFamily: F.cinematic, fontSize: "clamp(1rem, 2.8vw, 1.35rem)", color: C.gold, fontStyle: "italic", lineHeight: 1.5, letterSpacing: "0.01em" }}>
                where the Cosmos roasts you. Personally&nbsp;😉
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <Label>Your name (optional)</Label>
                <input type="text" className="rm-input" placeholder="Used for sharing — keeps it personal" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Date of birth</Label>
                <input type="date" className="rm-input" value={dob} onChange={e => setDob(e.target.value)} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: "1 1 200px" }}>
                  <Label>Time of birth</Label>
                  <input type="time" className="rm-input" value={tob} onChange={e => setTob(e.target.value)} />
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <Label>City of birth</Label>
                  <input type="text" className="rm-input" placeholder="Mumbai" value={pob} onChange={e => setPob(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: "1 1 200px" }}>
                  <Label>Roast intensity</Label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
                    {(["Gentle", "Chaotic", "Unhinged"] as Intensity[]).map(lvl => (
                      <button key={lvl} className="rm-btn" onClick={() => setIntensity(lvl)} style={{
                        padding: "10px 0", borderRadius: 6, fontSize: 13, fontFamily: F.ui,
                        border: `1px solid ${intensity === lvl ? C.gold : C.dim}`,
                        background: intensity === lvl ? C.goldFaint : "transparent",
                        color: intensity === lvl ? C.goldLight : C.muted,
                        fontWeight: intensity === lvl ? 700 : 400, letterSpacing: "0.02em",
                      }}>{lvl}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <Label>Output language</Label>
                  <select className="rm-input" value={language} onChange={e => setLanguage(e.target.value)} style={{ cursor: "pointer", height: 46 }}>
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang} style={{ background: C.selectBg, color: C.text }}>{lang}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <p style={{ fontSize: 12, color: "#E8665A", textAlign: "center", fontFamily: F.ui }}>{error}</p>}

              <button className="rm-btn" onClick={handleSubmit} style={{
                marginTop: 4, height: 54, border: "none", borderRadius: 6,
                background: `linear-gradient(135deg, ${C.gold} 0%, #7A5010 100%)`,
                color: "#FFF8EE", fontSize: 15, fontFamily: F.display,
                fontWeight: 700, letterSpacing: "0.05em",
              }}>
                CONSULT THE COSMOS →
              </button>
            </div>

            <p style={{ textAlign: "center", fontSize: 11, color: C.dim, marginTop: "1.6rem", lineHeight: 1.7, fontFamily: F.ui }}>
              Zero astrology in the output.<br />Just your patterns, held up to a light.
            </p>
          </div>
        </div>

        {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
        {profileOpen  && <ProfileModal onClose={() => setProfileOpen(false)} onSave={p => setProfile(p)} initial={profile} />}
      </div>
    </ThemeCtx.Provider>
  );

  /* ═══ LOADING ════════════════════════════════════════════════════════════════ */

  if (screen === "loading") return (
    <ThemeCtx.Provider value={themeValue}>
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "default" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(30,58,140,0.22) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "2rem", maxWidth: 440, width: "100%" }}>
          <div style={{ position: "relative", width: 68, height: 68, margin: "0 auto 2.5rem" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1px solid ${C.dim}` }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: C.gold, animation: "rmSpin 1.1s linear infinite" }} />
            <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "1px solid transparent", borderTopColor: C.goldLight, animation: "rmSpinRev 0.75s linear infinite" }} />
            <div style={{ position: "absolute", inset: 22, borderRadius: "50%", border: `1px solid ${C.goldBorder}` }} />
          </div>
          <div ref={msgRef} style={{ fontFamily: F.cinematic, fontSize: "clamp(1.2rem, 4vw, 1.6rem)", fontWeight: 500, color: C.text, letterSpacing: "0.005em", lineHeight: 1.4, minHeight: 52, marginBottom: "1rem", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 5px", fontStyle: "italic", userSelect: "none", pointerEvents: "none", caretColor: "transparent" }} />
          <div style={{ fontSize: 12, color: C.dim, fontFamily: F.ui, letterSpacing: "0.05em" }}>
            About 15 seconds. The planets are deliberating.
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );

  /* ═══ RESULT ═════════════════════════════════════════════════════════════════ */

  const patterns    = roastData?.patterns ?? [];
  const cosmicTitle = roastData?.cosmic_title ?? "Certified Chaos Architect";
  const planet      = chart?.dominant_planet ?? "Saturn";
  const pm          = PLANET_META[planet];
  const gentilic    = PLANET_GENTILIC[planet] ?? planet;

  return (
    <ThemeCtx.Provider value={themeValue}>
      <div style={{ minHeight: "100vh", background: C.bg, position: "relative" }}>
        <NavBar onFeedback={() => setFeedbackOpen(true)} onProfile={() => setProfileOpen(true)} profile={profile} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(30,58,140,0.1) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

        <div className="rm-result-content" style={{ paddingTop: 62 }}>
          {/* Hero */}
          <div className="rm-hero-section rm-hero">
            <PlanetBg planet={planet} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.28em", color: C.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: "1rem", fontFamily: F.ui }}>
                ROAST&#8209;ME · YOUR COSMIC VERDICT
              </div>
              <h2 style={{ fontFamily: F.cinematic, fontSize: "clamp(2rem, 5.5vw, 3.5rem)", fontWeight: 600, color: C.text, lineHeight: 1.15, marginBottom: "1rem", letterSpacing: "0.005em", fontStyle: "italic" }}>
                &ldquo;{cosmicTitle}&rdquo;
              </h2>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 18px", borderRadius: 20, border: `1px solid ${C.goldBorder}`, background: C.goldFaint, marginBottom: "1.25rem" }}>
                <span style={{ color: pm?.color ?? C.gold, fontSize: 18 }}>{pm?.symbol}</span>
                <span style={{ fontSize: 12, fontFamily: F.ui, fontWeight: 700, letterSpacing: "0.1em", color: C.goldLight, textTransform: "uppercase" }}>
                  You are a {gentilic} person
                </span>
              </div>
              <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                {[pob || chart?.location, `${intensity} mode`].filter(Boolean).map(t => (
                  <span key={t} style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, border: `1px solid ${C.border}`, color: C.muted, fontFamily: F.ui }}>{t}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <Ghost onClick={() => openShare("hero")}>Share your title ↗</Ghost>
                <Ghost onClick={restart}>Read me again</Ghost>
              </div>
            </div>
          </div>

          {/* Pattern cards */}
          <div className="rm-grid-wrap">
            {patterns.map((p, i) => {
              const last = i === patterns.length - 1;
              const { body, closer } = patternText(p);
              return (
                <div key={i} className="rm-card" style={{
                  background: last ? C.cardDeep : C.card,
                  border: `1px solid ${last ? C.goldBorder : C.border}`,
                  borderRadius: 12, padding: "1.3rem 1.25rem 1rem",
                  position: "relative", overflow: "hidden",
                }}>
                  {last && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold} 35%, ${C.goldLight} 65%, transparent)` }} />}

                  {/* Copy button */}
                  <button className="rm-copy-btn" onClick={() => copyCard(i)}>
                    {copiedIdx === i ? "✓ Copied" : "Copy"}
                  </button>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 10 }}>
                    <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 3 }}>{p.emoji}</span>
                    <h3 style={{ fontFamily: F.display, fontSize: "clamp(0.95rem, 3vw, 1.15rem)", fontWeight: last ? 700 : 600, color: last ? C.goldLight : C.text, lineHeight: 1.25, letterSpacing: "-0.015em" }}>
                      {p.title}
                    </h3>
                  </div>
                  <div style={{ paddingLeft: 31, marginBottom: 10 }}>
                    <p style={{ fontFamily: F.mono, fontSize: 13.5, lineHeight: 1.82, color: isDark ? "#C5BEDD" : C.muted, fontWeight: 400 }}>{body}</p>
                  </div>
                  {closer && (
                    <div style={{ paddingLeft: 31, marginBottom: 11, borderTop: `1px solid ${last ? C.goldBorder : C.border}`, paddingTop: 9 }}>
                      <p style={{ fontFamily: F.cinematic, fontSize: 15, lineHeight: 1.65, color: isDark ? "#B8C5D6" : C.muted, fontStyle: "italic", letterSpacing: "0.01em" }}>{closer}</p>
                    </div>
                  )}
                  <div style={{ paddingLeft: 31, display: "flex", justifyContent: "flex-end" }}>
                    <button className="rm-btn" onClick={() => openShare(i)} style={{
                      padding: "4px 14px", borderRadius: 6, fontSize: 11,
                      fontFamily: F.ui, fontWeight: 600, background: "transparent",
                      border: `1px solid ${C.border}`, color: C.muted, letterSpacing: "0.04em",
                    }}>
                      Share ↗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: "2.5rem 1rem 0", textAlign: "center" }}>
            <p style={{ fontFamily: F.cinematic, fontSize: "1.1rem", fontStyle: "italic", color: C.muted, marginBottom: "1.1rem", lineHeight: 1.65 }}>
              Know someone who needs to see themselves clearly?
            </p>
            <button className="rm-btn" onClick={restart} style={{
              padding: "13px 30px", background: `linear-gradient(135deg, ${C.gold} 0%, #7A5010 100%)`,
              border: "none", borderRadius: 6, color: "#FFF8EE",
              fontSize: 14, fontFamily: F.display, fontWeight: 700, letterSpacing: "0.05em",
            }}>
              ROAST SOMEONE ELSE →
            </button>
            <p style={{ fontSize: 10, color: C.dim, marginTop: "1.75rem", letterSpacing: "0.1em", fontFamily: F.ui }}>
              ROAST&#8209;ME · COSMIC DAMAGE REPORTS
            </p>
          </div>
        </div>

        {/* Share modal */}
        {share.open && (
          <div className="rm-overlay" onClick={closeShare}>
            <div className="rm-sheet" onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 16, color: C.text, letterSpacing: "-0.01em" }}>Share this reading</span>
                <button onClick={closeShare} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
              </div>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: "1.25rem", fontFamily: F.mono, lineHeight: 1.5, borderLeft: `2px solid ${C.goldBorder}`, paddingLeft: 10 }}>
                {share.idx === "hero" ? `"${roastData?.cosmic_title}"` : roastData?.patterns[share.idx as number]?.title}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {([
                  { id: "instagram" as Platform, icon: "📸", label: "Instagram Story", note: "STORY IMAGE" },
                  { id: "snapchat"  as Platform, icon: "👻", label: "Snapchat Story",  note: "STORY IMAGE" },
                  { id: "whatsapp" as Platform,  icon: "💬", label: "WhatsApp",         note: "" },
                  { id: "facebook" as Platform,  icon: "📘", label: "Facebook",         note: "" },
                  { id: "twitter"  as Platform,  icon: "𝕏",  label: "Twitter / X",     note: "" },
                  { id: "copy"     as Platform,  icon: "📋", label: "Copy Text",        note: "" },
                ]).map(({ id, icon, label, note }) => (
                  <button key={id} className="rm-btn" disabled={generating} onClick={() => handlePlatform(id)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 8,
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                    color: C.text, fontFamily: F.ui, fontWeight: 600,
                    fontSize: 14, textAlign: "left", width: "100%",
                    opacity: generating ? 0.5 : 1,
                  }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span>{label}</span>
                    {note && (
                      <span style={{ marginLeft: "auto", fontSize: 10, color: generating && (id === "instagram" || id === "snapchat") ? C.gold : C.muted, letterSpacing: "0.06em" }}>
                        {generating && (id === "instagram" || id === "snapchat") ? "Generating…" : note}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Name prompt modal */}
        {namePrompt.open && (
          <div className="rm-overlay" onClick={() => setNamePrompt({ open: false, platform: null, idx: null })}>
            <div className="rm-sheet" onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: F.cinematic, fontWeight: 600, fontSize: 22, color: C.text, marginBottom: 6, letterSpacing: "0.005em", fontStyle: "italic" }}>
                Add your name to the story?
              </h3>
              <p style={{ fontSize: 13, color: C.muted, fontFamily: F.ui, lineHeight: 1.65, marginBottom: "1.5rem" }}>
                Your story will say &ldquo;Guess who{" "}
                <strong style={{ color: C.text }}>{tempName || "you"}</strong>
                {" "}actually is?&rdquo; — totally optional.
              </p>
              <input type="text" className="rm-input" placeholder="Your name (or leave blank)"
                value={tempName} onChange={e => setTempName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitName()}
                style={{ marginBottom: 12 }} autoFocus />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button className="rm-btn" onClick={() => { setTempName(""); submitName(); }} style={{
                  padding: "11px 0", borderRadius: 6, background: "transparent",
                  border: `1px solid ${C.border}`, color: C.muted, fontFamily: F.ui, fontWeight: 600, fontSize: 13,
                }}>Skip</button>
                <button className="rm-btn" onClick={submitName} style={{
                  padding: "11px 0", borderRadius: 6,
                  background: `linear-gradient(135deg, ${C.gold} 0%, #7A5010 100%)`,
                  border: "none", color: "#FFF8EE", fontFamily: F.display, fontWeight: 700, fontSize: 13, letterSpacing: "0.04em",
                }}>Generate Story →</button>
              </div>
            </div>
          </div>
        )}

        {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
        {profileOpen  && <ProfileModal onClose={() => setProfileOpen(false)} onSave={p => setProfile(p)} initial={profile} />}
      </div>
    </ThemeCtx.Provider>
  );
}
