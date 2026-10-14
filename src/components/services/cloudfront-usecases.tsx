"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  KeyRound,
  Lock,
  MonitorPlay,
  Shield,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { FlowCanvas, FlowLabel, FlowLink, FlowNode } from "@/components/shared/flow";
import { SimControls } from "@/components/shared/sim-controls";
import {
  StepBadge,
  UCButton,
  UCToggle,
  UCStat,
  UseCaseNote,
  UseCaseShell,
  VerdictFlash,
  useScenarioRunner,
  useTicker,
} from "@/components/shared/use-case";
import { logTs } from "@/components/shared/auto-log";
import { CloudFrontIcon, S3Icon, UserIcon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES                                                        */
/* ================================================================== */

export type CfUseCaseId = "GLOBAL_EDGE" | "STREAMING" | "SIGNED_URLS";

interface CfUseCasesProps {
  id: CfUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

interface UcLine {
  id: number;
  text: string;
  tone?: string;
}

const pad3 = (n: number) => String(n).padStart(3, "0");

/* ================================================================== */
/* TAB 02 — GLOBAL EDGE ACCELERATION: 20ms POP vs 220ms ORIGIN RACE    */
/* ================================================================== */

function RaceBar({
  label,
  ms,
  tone,
  duration,
  note,
}: {
  label: string;
  ms: number;
  tone: "mint" | "danger";
  duration: number;
  note: string;
}) {
  const textCls = tone === "mint" ? "text-mint" : "text-danger";
  return (
    <div className={`border bg-black/60 px-2 py-1.5 backdrop-blur-sm ${tone === "mint" ? "border-mint/45" : "border-danger/45"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[7px] font-bold uppercase tracking-[0.2em] ${textCls}`}>{label}</span>
        <span className={`text-[9px] font-extrabold tabular-nums ${textCls}`}>{ms}ms</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden bg-white/10">
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration, ease: "easeOut" }}
          className={`h-full ${tone === "mint" ? "bg-mint shadow-[0_0_10px_rgba(0,255,163,0.7)]" : "bg-danger shadow-[0_0_10px_rgba(255,51,85,0.7)]"}`}
        />
      </div>
      <p className="mt-0.5 text-[6px] uppercase tracking-wider text-muted-foreground">{note}</p>
    </div>
  );
}

function GlobalEdgeUseCase({ immersiveActive, immersiveToggle }: CfUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [shieldOn, setShieldOn] = useState(false);
  const [raceId, setRaceId] = useState(0);
  const [edgeMs, setEdgeMs] = useState(20);
  const [originMs, setOriginMs] = useState(220);
  const [races, setRaces] = useState(0);
  const [originFetches, setOriginFetches] = useState(0);
  const [flash, setFlash] = useState<null | "ok" | "deny">(null);
  const [lines, setLines] = useState<UcLine[]>([]);

  const idRef = useRef(1);
  const raceRef = useRef(0);
  const shieldRef = useRef(false);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const doFlash = (f: "ok" | "deny") => {
    setFlash(f);
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1500);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  const toggleShield = () => {
    const next = !shieldOn;
    setShieldOn(next);
    shieldRef.current = next;
    push(
      next
        ? "ORIGIN SHIELD ON — edge misses collapse at the regional shield layer — origin fetches ↓ ~90%"
        : "ORIGIN SHIELD OFF — every edge miss round-trips to US-EAST-1",
      next ? "mint" : "danger"
    );
  };

  // race machine — s0 arms a new request race, s1 reads the verdict
  const { step, reset: resetStep } = useScenarioRunner(2, running, 2600, (s) => {
    if (s === 0) {
      const race = raceRef.current + 1;
      raceRef.current = race;
      setRaceId(race);
      setRaces((r) => r + 1);
      const em = 17 + Math.floor(Math.random() * 8);
      const om = 198 + Math.floor(Math.random() * 44);
      setEdgeMs(em);
      setOriginMs(om);
      push(`RACE #${race} — GET /assets/app.js — USER-MUMBAI 19.07°N`, "aws");
      push(`  ✓ NEAREST EDGE POP BOM1 — cache HIT — 200 OK in ${em}ms`, "mint");
    } else {
      const em = Math.max(12, edgeMs);
      if (!shieldRef.current || Math.random() < 0.2) {
        setOriginFetches((f) => f + 1);
        push(
          `  ✕ DIRECT — US-EAST-1 round-trip — 200 OK in ${originMs}ms — ${(originMs / em).toFixed(0)}× slower`,
          "danger"
        );
      } else {
        push("  ⛨ ORIGIN SHIELD — regional cache absorbed the fetch — origin untouched", "magenta");
      }
      doFlash("ok");
    }
  });

  const reset = () => {
    setRunning(false);
    resetStep();
    raceRef.current = 0;
    setRaceId(0);
    setRaces(0);
    setOriginFetches(0);
    setEdgeMs(20);
    setOriginMs(220);
    setFlash(null);
    setLines([]);
  };

  const hitPct = races > 0 ? "100%" : "—";

  return (
    <UseCaseShell
      title="USE CASE // GLOBAL EDGE ACCELERATION"
      subtitle="ONE GET FROM MUMBAI — VIA 600+ EDGE POPS (20MS) VS DIRECT TO US-EAST-1 (220MS)"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="EDGE HIT %" value={hitPct} tone="mint" />
          <UCStat label="EDGE LATENCY" value={races > 0 ? `${edgeMs}ms` : "—"} tone="mint" />
          <UCStat label="ORIGIN LATENCY" value={races > 0 ? `${originMs}ms` : "—"} tone="danger" />
          <UCStat label="ORIGIN FETCHES" value={originFetches} tone="aws" />
          <UCStat label="RACES RUN" value={races} tone="neutral" />
          <UCStat label="ORIGIN SHIELD" value={shieldOn ? "ON" : "OFF"} tone={shieldOn ? "magenta" : "neutral"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "RACE LIVE — EDGE POP VS DIRECT ORIGIN" : "RACE IDLE — PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">DISTRIBUTION CONFIG</p>
          <UCToggle on={shieldOn} onClick={toggleShield} accent="magenta" ariaLabel="Toggle Origin Shield">
            <Shield className="w-3 h-3" /> ORIGIN SHIELD {shieldOn ? "ON" : "OFF"}
          </UCToggle>
          <p className="text-[7px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-relaxed">
            SHIELD ADDS A REGIONAL CACHE BETWEEN 600+ EDGES AND ORIGIN — MISSES TERMINATE IN-REGION INSTEAD OF CROSSING THE GLOBE
          </p>
        </>
      }
      logLines={lines}
      logTitle="EDGE RACE LOG // LIVE"
      logEmpty="PRESS RUN — EVERY REQUEST CYCLE RACES BOTH ROUTES"
    >
      <FlowCanvas ariaLabel="CloudFront global edge acceleration race diagram" className="h-full">
        {/* lanes: user → edge pop / user → origin */}
        <FlowLink d="M13,46 C22,40 28,31 33,25" status={running ? "flowing" : "idle"} dotDuration={0.7} />
        <FlowLink d="M13,54 C22,60 28,69 33,75" status={running ? "error" : "idle"} dotDuration={1.6} />
        {/* lanes to the viewer */}
        <FlowLink d="M47,21 C60,16 72,30 84,45" status={running ? "success" : "idle"} dotDuration={0.9} />
        <FlowLink d="M47,79 C60,84 72,70 84,55" status={running ? "error" : "idle"} dotDuration={1.9} />

        <FlowNode x={8} y={50} size="sm" delay={0.1} icon={<UserIcon className="w-3 h-3" />} label="USER-MUMBAI" sub="AP-SOUTH-1" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={40} y={21} size="sm" delay={0.25} icon={<CloudFrontIcon className="w-3 h-3" />} label="NEAREST EDGE POP" sub="BOM1 · CACHE ZONE" status={running ? "success" : "idle"} pulse={running} />
        <FlowNode x={40} y={79} size="sm" delay={0.35} icon={<S3Icon className="w-3 h-3" />} label="US-EAST-1 ORIGIN" sub="S3 · 12,900 KM AWAY" status="idle" />
        <FlowNode x={91} y={50} size="sm" delay={0.45} icon={<MonitorPlay className="w-3 h-3" />} label="VIEWER" sub="RENDERS BYTES" status={running ? "success" : "idle"} />

        <FlowLabel x={40} y={9} tone="aws">600+ EDGE LOCATIONS · 90+ CITIES</FlowLabel>
        <FlowLabel x={27} y={31} tone="mint">~20ms</FlowLabel>
        <FlowLabel x={27} y={69} tone="danger">~220ms</FlowLabel>

        {/* latency race bars — remount + re-animate every request cycle */}
        {raceId > 0 ? (
          <div className="absolute left-[19%] right-[26%] top-[39%] z-10 flex flex-col gap-1.5">
            <RaceBar key={`edge-${raceId}`} label="VIA NEAREST EDGE POP" ms={edgeMs} tone="mint" duration={0.28} note="SERVED FROM CACHE — ORIGIN NEVER TOUCHED" />
            <RaceBar key={`direct-${raceId}`} label="DIRECT TO US-EAST-1" ms={originMs} tone="danger" duration={2.55} note="FULL ROUND-TRIP ACROSS THE PLANET" />
          </div>
        ) : (
          <div className="absolute left-[19%] right-[26%] top-[42%] z-10 border border-foreground/15 bg-black/50 px-2 py-2">
            <p className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              RACE ARMED — PRESS RUN TO FIRE THE FIRST REQUEST
            </p>
          </div>
        )}

        <AnimatePresence>
          {shieldOn && (
            <motion.div
              key="shield"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute z-20"
              style={{ left: "62%", top: "84%" }}
            >
              <FlowLabel x={0} y={0} tone="magenta">ORIGIN SHIELD · REGIONAL CACHE</FlowLabel>
            </motion.div>
          )}
        </AnimatePresence>

        <StepBadge step={step} total={2} text={step === 0 ? "REQUEST RACE IN FLIGHT" : "VERDICT — EDGE WINS"} />
      </FlowCanvas>

      <VerdictFlash show={flash === "ok"} text={`EDGE ${edgeMs}ms — DIRECT ${originMs}ms`} tone="ok" />
      <UseCaseNote>
        STATIC + DYNAMIC CONTENT SERVED FROM THE POP NEAREST THE USER — 10-30MS TTFP INSTEAD OF A MULTI-HUNDRED-MS ORIGIN ROUND-TRIP
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — MEDIA STREAMING: HLS SEGMENT PACKET TRAIN                  */
/* ================================================================== */

function StreamingUseCase({ immersiveActive, immersiveToggle }: CfUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [shieldOn, setShieldOn] = useState(false);
  const [segments, setSegments] = useState(0);
  const [seg, setSeg] = useState(0);
  const [buffer, setBuffer] = useState(0);
  const [originHits, setOriginHits] = useState(0);
  const [saved, setSaved] = useState(0);
  const [lines, setLines] = useState<UcLine[]>([]);

  const idRef = useRef(1);
  const segRef = useRef(0);
  const bufferRef = useRef(0);
  const shieldRef = useRef(false);
  const fullLoggedRef = useRef(false);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const toggleShield = () => {
    const next = !shieldOn;
    setShieldOn(next);
    shieldRef.current = next;
    push(
      next
        ? "ORIGIN SHIELD ON — shield collapsed 200 origin fetches → 12 (94% offload)"
        : "ORIGIN SHIELD OFF — every edge miss fetches the origin directly",
      next ? "mint" : "danger"
    );
  };

  // HLS packet train — origin → (shield) → edge → viewer, one segment per cycle
  const { step, reset: resetStep } = useScenarioRunner(4, running, 1500, (s) => {
    if (s === 0) {
      segRef.current += 1;
      setSeg(segRef.current);
      const seg = segRef.current;
      if (!shieldRef.current || Math.random() < 0.25) {
        setOriginHits((h) => h + 1);
        push(`SEG seg-${seg}.ts — EDGE MISS → ${shieldRef.current ? "ORIGIN SHIELD → origin" : "ORIGIN"} fetch`, "aws");
      } else {
        setSaved((v) => v + 1);
        push(`SEG seg-${seg}.ts — EDGE MISS → ORIGIN SHIELD absorbed — origin untouched`, "magenta");
      }
    } else if (s === 1) {
      push(`seg-${pad3(segRef.current)}.ts cached @ EDGE POP — 640KB · 2s HLS segment`, "aws");
    } else if (s === 2) {
      setSegments((c) => c + 1);
      push(`VIEWER — segment ${segRef.current} playing — buffer +2s`, "mint");
    } else {
      push("GET playlist.m3u8 — sliding window refreshed — next 3 segments advertised", "dim");
    }
  });

  // viewer buffer fill — 0 → 100% while the train keeps running
  useTicker(running, () => {
    if (bufferRef.current >= 100) return;
    const nb = Math.min(100, bufferRef.current + 7);
    bufferRef.current = nb;
    setBuffer(nb);
    if (nb === 100 && !fullLoggedRef.current) {
      fullLoggedRef.current = true;
      push("VIEWER BUFFER 100% — 30s of video ahead — zero rebuffering", "mint");
    }
  }, 420);

  const reset = () => {
    setRunning(false);
    resetStep();
    segRef.current = 0;
    bufferRef.current = 0;
    fullLoggedRef.current = false;
    setSegments(0);
    setSeg(0);
    setBuffer(0);
    setOriginHits(0);
    setSaved(0);
    setLines([]);
  };

  const offload = originHits + saved > 0 ? Math.round((saved / (originHits + saved)) * 100) : 0;

  return (
    <UseCaseShell
      title="USE CASE // MEDIA STREAMING AT THE EDGE"
      subtitle="HLS SEGMENT PACKET TRAIN — ORIGIN → EDGE → VIEWER — BUFFER NEVER RUNS DRY"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="SEGMENTS SERVED" value={segments} tone="mint" />
          <UCStat label="BUFFER %" value={`${buffer}%`} tone={buffer >= 100 ? "mint" : "aws"} />
          <UCStat label="ORIGIN HITS" value={originHits} tone="danger" />
          <UCStat label="SAVED FETCHES" value={saved} tone="magenta" />
          <UCStat label="ORIGIN OFFLOAD" value={`${offload}%`} tone="neutral" />
          <UCStat label="SEGMENT SIZE" value="640KB" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `STREAM LIVE — SEGMENT ${seg} — BUFFER ${buffer}%` : "STREAM IDLE — PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">DISTRIBUTION CONFIG</p>
          <UCToggle on={shieldOn} onClick={toggleShield} accent="magenta" ariaLabel="Toggle Origin Shield">
            <Shield className="w-3 h-3" /> ORIGIN SHIELD {shieldOn ? "ON" : "OFF"}
          </UCToggle>
          <p className="text-[7px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-relaxed">
            EVERY EDGE MISS WITH SHIELD ON STOPS AT A REGIONAL CACHE — ORIGIN SEES A HANDFUL OF FETCHES, NOT A STAMPEDE
          </p>
        </>
      }
      logLines={lines}
      logTitle="STREAM DELIVERY LOG // LIVE"
      logEmpty="PRESS RUN — THE SEGMENT TRAIN STARTS ROLLING"
    >
      <FlowCanvas ariaLabel="CloudFront HLS media streaming packet train diagram" className="h-full">
        {/* packet train links */}
        {shieldOn ? (
          <>
            <FlowLink d="M13,50 L22,50" status={running ? "flowing" : "idle"} dotDuration={0.8} />
            <FlowLink d="M38,50 L49,50" status={running ? "flowing" : "idle"} dotDuration={0.8} dotDelay={0.2} />
          </>
        ) : (
          <FlowLink d="M13,50 L49,50" status={running ? "flowing" : "idle"} dotDuration={1.4} />
        )}
        <FlowLink d="M63,50 L80,50" status={running ? "success" : "idle"} dotDuration={0.9} />

        <FlowNode x={8} y={50} size="sm" delay={0.1} icon={<S3Icon className="w-3 h-3" />} label="HLS ORIGIN" sub={`s3://vod-origin · FETCHES ${originHits}`} status={running ? "active" : "idle"} pulse={running && !shieldOn} />
        <FlowNode x={56} y={50} size="sm" delay={0.25} icon={<CloudFrontIcon className="w-3 h-3" />} label="EDGE POP" sub="HLS SEGMENT CACHE" status={running ? "success" : "idle"} pulse={running} />
        <FlowNode x={88} y={50} size="sm" delay={0.4} icon={<MonitorPlay className="w-3 h-3" />} label="VIEWER · MUMBAI" sub={`hls.js · BUFFER ${buffer}%`} status={running ? "success" : "idle"} />

        <AnimatePresence>
          {shieldOn && (
            <motion.div
              key="shield-node"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="absolute z-20"
              style={{ left: "30%", top: "50%" }}
            >
              <FlowNode x={0} y={0} size="xs" icon={<ShieldCheck className="w-3 h-3" />} label="ORIGIN SHIELD" sub="REGIONAL CACHE" status="cyber" />
            </motion.div>
          )}
        </AnimatePresence>

        <FlowLabel x={50} y={12} tone="aws">HLS SEGMENT PACKET TRAIN — 2s SEGMENTS · 6s WINDOW</FlowLabel>
        <FlowLabel x={50} y={88} tone="default">EDGE SERVES REPEAT VIEWERS — ORIGIN SERVES THE FIRST ONE ONLY</FlowLabel>

        {/* viewer buffer fill */}
        <div className="absolute bottom-[16%] left-[12%] right-[12%] z-10 border border-foreground/20 bg-black/60 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">VIEWER PLAYBACK BUFFER</span>
            <span className={`text-[8px] font-extrabold tabular-nums ${buffer >= 100 ? "text-mint" : "text-aws"}`}>{buffer}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden bg-white/10">
            <motion.div
              className="h-full bg-mint shadow-[0_0_10px_rgba(0,255,163,0.6)]"
              animate={{ width: `${buffer}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>

        <StepBadge step={step} total={4} text={["EDGE MISS → FETCH", "CACHE AT EDGE", "VIEWER PLAYS", "PLAYLIST REFRESH"][step]} />
      </FlowCanvas>

      <UseCaseNote>
        LIVE + VOD AT SCALE: ORIGIN SHIELD COLLAPSES HUNDREDS OF EDGE MISSES INTO A DOZEN ORIGIN FETCHES — THE ORIGIN NEVER SEES THE AUDIENCE
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — SIGNED URLS: TIME-BOXED PRIVATE CONTENT AT THE EDGE        */
/* ================================================================== */

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  ariaLabel: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className="text-[8px] font-extrabold tabular-nums text-aws">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label={ariaLabel}
        className="h-1.5 w-full cursor-pointer border border-foreground/20 bg-black/60 accent-[#ff9900]"
      />
    </div>
  );
}

interface SigState {
  n: number;
  left: number;
}

function SignatureCard({ sig, total }: { sig: SigState | null; total: number }) {
  const expired = !!sig && sig.left <= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="absolute z-10 w-[62%] max-w-[400px] -translate-x-1/2"
      style={{ left: "50%", top: "74%" }}
    >
      <div className={`glass cyber-cut p-2 ${expired ? "border border-danger/60" : "border border-magenta/40"}`}>
        <div className="flex items-center justify-between border-b border-aws/15 pb-1.5">
          <span className="flex items-center gap-1.5 text-[7px] font-bold uppercase tracking-[0.2em] text-aws">
            <KeyRound className="w-3 h-3" /> SIGNED URL #{sig ? String(sig.n).padStart(3, "0") : "—"}
          </span>
          <span className={`border px-1.5 py-0.5 text-[7px] font-extrabold tracking-[0.15em] ${expired ? "border-danger/60 text-danger" : sig ? "border-mint/60 text-mint" : "border-foreground/20 text-muted-foreground"}`}>
            {expired ? "EXPIRED" : sig ? `LIVE · ${sig.left}s` : "UNSIGNED"}
          </span>
        </div>
        <p className="truncate pt-1.5 text-[7px] font-bold tracking-wider text-neon">
          https://cdn.nexus.io/vod/ep1.m3u8?<span className="text-magenta">Expires={sig ? sig.left : "—"}</span>
          &<span className="text-magenta">Signature=KCm9f2A7…</span>&<span className="text-aws">Key-Pair-Id=APKAI7X</span>
        </p>
        <div className="mt-1 h-1 w-full overflow-hidden bg-white/10">
          <motion.div
            className={`h-full ${expired ? "bg-danger" : "bg-magenta"}`}
            animate={{ width: `${sig ? Math.max(0, Math.min(100, (sig.left / Math.max(1, total)) * 100)) : 0}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function SignedUrlsUseCase({ immersiveActive, immersiveToggle }: CfUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [expiry, setExpiry] = useState(20);
  const [sig, setSig] = useState<SigState | null>(null);
  const [signed, setSigned] = useState(0);
  const [ok, setOk] = useState(0);
  const [rejects, setRejects] = useState(0);
  const [flash, setFlash] = useState<null | "ok" | "deny">(null);
  const [lines, setLines] = useState<UcLine[]>([]);

  const idRef = useRef(1);
  const sigNRef = useRef(0);
  const sigRef = useRef<SigState | null>(null);
  const expiryRef = useRef(20);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    expiryRef.current = expiry;
  }, [expiry]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const doFlash = (f: "ok" | "deny") => {
    setFlash(f);
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1800);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  const doSign = () => {
    const n = sigNRef.current + 1;
    sigNRef.current = n;
    const s = { n, left: expiryRef.current };
    sigRef.current = s;
    setSig(s);
    setSigned((c) => c + 1);
    push(`SIGN — signed URL issued — Expires=${expiryRef.current}s · Key-Pair-Id=APKAI7X`, "magenta");
  };

  // access pipeline — auth → sign → edge validation → 200 from cache
  const { step, reset: resetStep } = useScenarioRunner(4, running, 1700, (s) => {
    if (s === 0) {
      push("AUTH — Cognito JWT validated — user viewer-42 allowed", "aws");
    } else if (s === 1) {
      doSign();
    } else if (s === 2) {
      const cur = sigRef.current;
      if (cur && cur.left > 0) {
        push("EDGE — signature verified · expiry checked — URL still valid", "aws");
      } else {
        setRejects((r) => r + 1);
        push("EDGE — Expires in the past → 403 Forbidden (signature expired)", "danger");
        doFlash("deny");
      }
    } else {
      setOk((c) => c + 1);
      doFlash("ok");
      push("200 OK — /vod/ep1.m3u8 served from edge cache — origin never touched", "mint");
    }
  });

  // signature expiry countdown — compressed: 1 sim s per real s
  useTicker(running && !!sig, () => {
    const cur = sigRef.current;
    if (!cur || cur.left <= 0) return;
    const left = cur.left - 1;
    const next = { ...cur, left };
    sigRef.current = next;
    setSig(next);
    if (left === 0) push("signed URL expired — the edge will 403 any new request", "dim");
  }, 1000);

  const requestExpired = () => {
    setRejects((r) => r + 1);
    doFlash("deny");
    push("GET /vod/ep1.m3u8?Expires=<past> — 403 Forbidden", "danger");
    push("signature expired at edge — origin never touched", "danger");
  };

  const reset = () => {
    setRunning(false);
    resetStep();
    sigRef.current = null;
    sigNRef.current = 0;
    setSig(null);
    setSigned(0);
    setOk(0);
    setRejects(0);
    setFlash(null);
    setLines([]);
  };

  return (
    <UseCaseShell
      title="USE CASE // SIGNED URLS — PRIVATE CONTENT AT THE EDGE"
      subtitle="AUTH → SIGN → EDGE VALIDATES SIG + EXPIRY → 200 FROM CACHE · EXPIRED → 403, ORIGIN NEVER TOUCHED"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="URLS SIGNED" value={signed} tone="magenta" />
          <UCStat label="VALIDATED OK" value={ok} tone="mint" />
          <UCStat label="403 REJECTS" value={rejects} tone={rejects > 0 ? "danger" : "neutral"} />
          <UCStat label="EXPIRY TTL" value={`${expiry}s`} tone="aws" />
          <UCStat label="SIG STATE" value={sig ? (sig.left > 0 ? `LIVE ${sig.left}s` : "EXPIRED") : "—"} tone={sig && sig.left > 0 ? "mint" : sig ? "danger" : "neutral"} />
          <UCStat label="COST OF AUTH CHECK" value="$0.000" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "PIPELINE LIVE — AUTH · SIGN · VALIDATE · SERVE" : "IDLE — PRESS RUN OR SIGN BY HAND"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">SIGNING CONFIG</p>
          <Slider label="URL EXPIRY (COMPRESSED)" value={expiry} min={5} max={60} onChange={(v) => setExpiry(v)} ariaLabel="Signed URL expiry seconds" suffix="s" />
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={doSign} tone="magenta" ariaLabel="Sign a new URL now">
              <KeyRound className="w-3 h-3" /> SIGN URL NOW
            </UCButton>
            <UCButton onClick={requestExpired} tone="danger" ariaLabel="Request an expired signed URL to trigger a 403">
              <Timer className="w-3 h-3" /> REQUEST EXPIRED URL
            </UCButton>
          </div>
        </>
      }
      logLines={lines}
      logTitle="SIGNED URL LOG // LIVE"
      logEmpty="PRESS RUN — OR SIGN A URL AND WATCH THE EDGE ENFORCE IT"
    >
      <FlowCanvas ariaLabel="CloudFront signed URL access pipeline diagram" className="h-full">
        {/* pipeline links */}
        <FlowLink d="M16,36 C22,36 26,36 30,36" status={running ? "flowing" : "idle"} dotDuration={0.8} />
        <FlowLink d="M42,36 C48,36 52,36 56,36" status={running ? "flowing" : "idle"} dotDuration={0.8} dotDelay={0.15} />
        <FlowLink d="M68,36 C74,36 78,36 82,36" status={running ? "success" : "idle"} dotDuration={0.8} dotDelay={0.3} />
        {/* rejected path — expired requests bounce at the edge */}
        <FlowLink d="M64,42 C58,52 50,58 42,60" status={rejects > 0 ? "error" : "idle"} dashed dotDuration={1.2} />

        <FlowNode x={10} y={36} size="sm" delay={0.1} icon={<Lock className="w-3 h-3" />} label="COGNITO AUTH" sub="JWT VALIDATED" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={36} y={36} size="sm" delay={0.2} icon={<KeyRound className="w-3 h-3" />} label="URL SIGNER" sub="CLOUDFRONT KEY-GROUP" status={running ? "active" : "idle"} />
        <FlowNode x={62} y={36} size="sm" delay={0.3} icon={<ShieldCheck className="w-3 h-3" />} label="EDGE VALIDATOR" sub="SIG + EXPIRY CHECK" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={88} y={36} size="sm" delay={0.4} icon={<MonitorPlay className="w-3 h-3" />} label="VIEWER" sub="200 FROM CACHE" status={running ? "success" : "idle"} />

        <FlowLabel x={30} y={52} tone="danger">403 — REJECTED AT THE EDGE</FlowLabel>
        <FlowLabel x={62} y={20} tone="aws">SIG + EXPIRY ENFORCED IN ~5ms — NO ORIGIN HOP</FlowLabel>
        <FlowLabel x={16} y={62} tone="magenta">EXPIRED = DEAD ON ARRIVAL</FlowLabel>

        <SignatureCard sig={sig} total={expiry} />

        <StepBadge step={step} total={4} text={["AUTH", "SIGN URL", "EDGE VALIDATION", "200 SERVE"][step]} />
      </FlowCanvas>

      <VerdictFlash show={flash === "ok"} text="200 — SIGNATURE VALID" tone="ok" />
      <VerdictFlash show={flash === "deny"} text="403 — SIGNATURE EXPIRED" tone="deny" />
      <UseCaseNote>
        PRIVATE VIDEO / SOFTWARE / TICKETS: TIME-BOXED URLS ENFORCED AT 600+ EDGES — SHARE SAFELY, EXPIRE AUTOMATICALLY
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function CfUseCases({ id, immersiveActive, immersiveToggle }: CfUseCasesProps) {
  if (id === "GLOBAL_EDGE") return <GlobalEdgeUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "STREAMING") return <StreamingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <SignedUrlsUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
