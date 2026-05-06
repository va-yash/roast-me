"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoastPattern {
  emoji: string;
  title: string;
  lines: string[];
}

interface RoastData {
  cosmic_title: string;
  patterns: RoastPattern[];
}

interface ChartSummary {
  session_id: string;
  ascendant: string;
  sun_sign: string;
  moon_sign: string;
  location: string;
}

type Screen = "input" | "loading" | "result";
type Intensity = "Gentle" | "Chaotic" | "Unhinged";

const C = {
  bg:         "#09080F",
  card:       "#110F1A",
  cardLast:   "#0F0D16",
  gold:       "#C08B2F",
  goldLight:  "#DEB86A",
  goldFaint:  "rgba(192,139,47,0.09)",
  goldBorder: "rgba(192,139,47,0.22)",
  text:       "#EDE8E0",
  muted:      "#7A7090",
  dim:        "#2E2A3A",
} as const;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const LOADING_MSGS = [
  "Reading your birth chart...",
  "Consulting the planets about your choices...",
  "Finding the source of your trust issues...",
  "The stars have seen your recent decisions.",
  "Calculating how many times you've almost committed...",
  "Cross-referencing your patterns with the cosmos...",
  "Almost done. The planets are being thorough.",
  "Your chart is... a lot. Sit tight.",
  "Preparing your cosmic portrait...",
];

const INTENSITY_OPTIONS: Intensity[] = ["Gentle", "Chaotic", "Unhinged"];

const GLOBAL_CSS = `
.rm-input {
  width: 100%;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(192,139,47,0.22);
  color: #EDE8E0;
  padding: 13px 15px;
  border-radius: 8px;
  font-family: 'Syne', sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  appearance: none;
  box-sizing: border-box;
}
.rm-input:focus { border-color: rgba(192,139,47,0.55); background: rgba(255,255,255,0.05); }
.rm-input::placeholder { color: rgba(122,112,144,0.4); }
input[type=date]::-webkit-calendar-picker-indicator,
input[type=time]::-webkit-calendar-picker-indicator { filter: invert(0.5) sepia(0.2); cursor: pointer; }
@keyframes rmSpin    { to { transform: rotate(360deg); } }
@keyframes rmSpinRev { to { transform: rotate(-360deg); } }
@keyframes rmFadeUp  { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
@keyframes rmFadeIn  { from { opacity:0; } to { opacity:1; } }
@keyframes rmShimmer { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
.rm-card-anim { animation: rmFadeUp 0.55s ease forwards; opacity: 0; }
.rm-card-anim:nth-child(1)  { animation-delay: 0.05s; }
.rm-card-anim:nth-child(2)  { animation-delay: 0.13s; }
.rm-card-anim:nth-child(3)  { animation-delay: 0.21s; }
.rm-card-anim:nth-child(4)  { animation-delay: 0.29s; }
.rm-card-anim:nth-child(5)  { animation-delay: 0.37s; }
.rm-card-anim:nth-child(6)  { animation-delay: 0.45s; }
.rm-card-anim:nth-child(7)  { animation-delay: 0.53s; }
.rm-card-anim:nth-child(8)  { animation-delay: 0.61s; }
.rm-card-anim:nth-child(9)  { animation-delay: 0.69s; }
.rm-card-anim:nth-child(10) { animation-delay: 0.77s; }
.rm-hero-anim { animation: rmFadeIn 0.9s ease forwards; }
`;

export default function Home() {
  const [screen, setScreen]       = useState<Screen>("input");
  const [dob, setDob]             = useState("");
  const [tob, setTob]             = useState("");
  const [pob, setPob]             = useState("");
  const [intensity, setIntensity] = useState<Intensity>("Unhinged");
  const [error, setError]         = useState("");
  const [msgIdx, setMsgIdx]       = useState(0);
  const [roastData, setRoastData] = useState<RoastData | null>(null);
  const [chart, setChart]         = useState<ChartSummary | null>(null);
  const [copied, setCopied]       = useState<string | number | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const id = "rm-global-styles";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = GLOBAL_CSS;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (screen !== "loading") return;
    setMsgIdx(0);
    msgTimerRef.current = setInterval(
      () => setMsgIdx((i) => (i + 1) % LOADING_MSGS.length),
      1900
    );
    return () => { if (msgTimerRef.current) clearInterval(msgTimerRef.current); };
  }, [screen]);

  const handleSubmit = useCallback(async () => {
    if (!dob || !tob || !pob.trim()) {
      setError("All three fields are required. The cosmos need coordinates.");
      return;
    }
    setError("");
    setScreen("loading");
    try {
      const chartRes = await fetch(`${API_URL}/api/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, tob, pob }),
      });
      if (!chartRes.ok) {
        const err = await chartRes.json();
        throw new Error(err.detail ?? "Chart calculation failed");
      }
      const chartData: ChartSummary = await chartRes.json();
      setChart(chartData);

      const roastRes = await fetch(`${API_URL}/api/roast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: chartData.session_id, intensity }),
      });
      if (!roastRes.ok || !roastRes.body) throw new Error("Roast stream failed to start");

      const reader  = roastRes.body.getReader();
      const decoder = new TextDecoder();
      let fullText  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) throw new Error(payload.error);
            if (payload.text) fullText += payload.text;
            if (payload.done) {
              const parsed = JSON.parse(fullText.replace(/```json|```/g, "").trim()) as RoastData;
              setRoastData(parsed);
              setScreen("result");
            }
          } catch { /* partial chunk — keep accumulating */ }
        }
      }
      if (fullText && screen !== "result") {
        const parsed = JSON.parse(fullText.replace(/```json|```/g, "").trim()) as RoastData;
        setRoastData(parsed);
        setScreen("result");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The stars are temporarily unavailable. Try again.");
      setScreen("input");
    }
  }, [dob, tob, pob, intensity]);

  const copyText = useCallback((key: string | number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const restart = useCallback(() => {
    setScreen("input"); setRoastData(null); setChart(null); setError("");
  }, []);

  if (screen === "input") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 1.25rem", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 45% at 50% -8%, rgba(80,50,170,0.22) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: "2.75rem" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.28em", color: C.gold, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.1rem" }}>roast&#8209;me.me</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2rem,7vw,2.9rem)", fontWeight: 300, fontStyle: "italic", color: C.text, lineHeight: 1.2, marginBottom: "0.7rem" }}>
            The cosmos have<br />seen everything.
          </h1>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>And they have notes.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel>Date of birth</FieldLabel>
            <input type="date" className="rm-input" value={dob} onChange={e => setDob(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <FieldLabel>Time of birth</FieldLabel>
              <input type="time" className="rm-input" value={tob} onChange={e => setTob(e.target.value)} />
            </div>
            <div>
              <FieldLabel>City of birth</FieldLabel>
              <input type="text" className="rm-input" placeholder="Mumbai" value={pob} onChange={e => setPob(e.target.value)} />
            </div>
          </div>
          <div>
            <FieldLabel>Roast intensity</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              {INTENSITY_OPTIONS.map(lvl => (
                <button key={lvl} onClick={() => setIntensity(lvl)} style={{
                  padding: "10px 0", borderRadius: 8, fontSize: 13, fontFamily: "'Syne', sans-serif",
                  transition: "all 0.15s", cursor: "pointer",
                  border: `1px solid ${intensity === lvl ? C.gold : C.dim}`,
                  background: intensity === lvl ? C.goldFaint : "transparent",
                  color: intensity === lvl ? C.goldLight : C.muted,
                  fontWeight: intensity === lvl ? 600 : 400,
                }}>{lvl}</button>
              ))}
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: "#E8665A", textAlign: "center" }}>{error}</p>}
          <button onClick={handleSubmit} style={{
            marginTop: 4, height: 52, border: "none", borderRadius: 8, cursor: "pointer",
            background: `linear-gradient(135deg, ${C.gold} 0%, #9A6B18 100%)`,
            color: "#07060D", fontSize: 15, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: "0.04em",
          }}>Consult the cosmos →</button>
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: C.dim, marginTop: "1.6rem", lineHeight: 1.7 }}>
          Zero astrology in the output.<br />Just your patterns, held up to a light.
        </p>
      </div>
    </div>
  );

  if (screen === "loading") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 45% at 50% -8%, rgba(80,50,170,0.22) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "2rem" }}>
        <div style={{ position: "relative", width: 68, height: 68, margin: "0 auto 2rem" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1px solid ${C.dim}` }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: C.gold, animation: "rmSpin 1.1s linear infinite" }} />
          <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "1px solid transparent", borderTopColor: C.goldLight, animation: "rmSpinRev 0.75s linear infinite" }} />
          <div style={{ position: "absolute", inset: 22, borderRadius: "50%", border: `1px solid ${C.goldBorder}` }} />
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontStyle: "italic", fontWeight: 300, color: C.text, marginBottom: "0.75rem", animation: "rmShimmer 1.9s ease-in-out infinite", minHeight: 33 }}>
          {LOADING_MSGS[msgIdx]}
        </div>
        <div style={{ fontSize: 12, color: C.dim }}>About 15 seconds. The planets are deliberating.</div>
      </div>
    </div>
  );

  const patterns    = roastData?.patterns ?? [];
  const cosmicTitle = roastData?.cosmic_title ?? "Certified Chaos Architect";
  const lastIdx     = patterns.length - 1;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 90% 40% at 50% -5%, rgba(80,50,170,0.12) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 560, margin: "0 auto", paddingBottom: "4rem" }}>

        <div className="rm-hero-anim" style={{ background: "linear-gradient(165deg, #0E0B1B 0%, #07060D 100%)", borderBottom: `1px solid ${C.goldBorder}`, padding: "3rem 1.75rem 2.25rem", textAlign: "center" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.26em", color: C.gold, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.1rem" }}>roast&#8209;me.me · your cosmic verdict</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.55rem,4.5vw,2.25rem)", fontStyle: "italic", fontWeight: 400, color: C.text, lineHeight: 1.35, marginBottom: "1.5rem" }}>
            &ldquo;{cosmicTitle}&rdquo;
          </h2>
          <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap", marginBottom: "1.75rem" }}>
            {[pob, `${intensity} mode`].map(tag => (
              <span key={tag} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, border: `1px solid ${C.goldBorder}`, color: C.muted }}>{tag}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <GhostButton active={copied === "hero"} onClick={() => copyText("hero", `"${cosmicTitle}"\n\nget your own reading → roast-me.me`)}>
              {copied === "hero" ? "✓ copied" : "copy your title"}
            </GhostButton>
            <GhostButton onClick={restart}>read me again</GhostButton>
          </div>
        </div>

        <div style={{ padding: "1.25rem 0.9rem 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {patterns.map((p, i) => {
            const isLast = i === lastIdx;
            return (
              <div key={i} className="rm-card-anim" style={{ background: isLast ? C.cardLast : C.card, border: `1px solid ${isLast ? C.goldBorder : C.dim}`, borderRadius: 12, padding: "1.2rem 1.2rem 0.9rem", position: "relative", overflow: "hidden" }}>
                {isLast && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold} 40%, ${C.goldLight} 60%, transparent)` }} />}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 10 }}>
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 3 }}>{p.emoji}</span>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.1rem,3.5vw,1.3rem)", fontWeight: isLast ? 600 : 400, fontStyle: "italic", color: isLast ? C.goldLight : C.text, lineHeight: 1.25 }}>{p.title}</h3>
                </div>
                <div style={{ paddingLeft: 31, marginBottom: 11 }}>
                  {p.lines.map((line, j) => {
                    const isCloser = j === p.lines.length - 1;
                    return <p key={j} style={{ fontFamily: "'Inconsolata', monospace", fontSize: 13.5, lineHeight: 1.85, color: isCloser ? C.muted : "#C5BEDD", fontWeight: isCloser ? 300 : 400 }}>{line}</p>;
                  })}
                </div>
                <div style={{ paddingLeft: 31, display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => copyText(i, `${p.title}\n\n${p.lines.join("\n")}\n\n— roast-me.me`)} style={{ padding: "4px 11px", borderRadius: 6, fontSize: 11, fontFamily: "'Syne', sans-serif", transition: "all 0.15s", cursor: "pointer", background: copied === i ? C.goldFaint : "transparent", border: `1px solid ${copied === i ? C.goldBorder : C.dim}`, color: copied === i ? C.goldLight : C.dim }}>
                    {copied === i ? "✓ copied" : "copy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "2rem 1rem 0", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: "1.1rem", lineHeight: 1.65 }}>Know someone who needs to see themselves clearly?</p>
          <button onClick={restart} style={{ padding: "12px 28px", background: `linear-gradient(135deg, ${C.gold} 0%, #9A6B18 100%)`, border: "none", borderRadius: 8, color: "#07060D", fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer" }}>
            Roast someone else →
          </button>
          <p style={{ fontSize: 10, color: C.dim, marginTop: "1.75rem", letterSpacing: "0.1em" }}>ROAST&#8209;ME.ME · COSMIC DAMAGE REPORTS</p>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, letterSpacing: "0.13em", color: "#7A7090", textTransform: "uppercase", fontWeight: 600, marginBottom: 7 }}>{children}</div>;
}

function GhostButton({ children, onClick, active = false }: { children: React.ReactNode; onClick: () => void; active?: boolean; }) {
  return (
    <button onClick={onClick} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 12, fontFamily: "'Syne', sans-serif", transition: "all 0.15s", cursor: "pointer", background: active ? "rgba(192,139,47,0.09)" : "transparent", border: `1px solid ${active ? "rgba(192,139,47,0.22)" : "#2E2A3A"}`, color: active ? "#DEB86A" : "#7A7090" }}>
      {children}
    </button>
  );
}
