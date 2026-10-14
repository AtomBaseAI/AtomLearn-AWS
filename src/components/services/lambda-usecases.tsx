"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Flame,
  ImageDown,
  Mail,
  Rocket,
  Share2,
  ShoppingCart,
  Snowflake,
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
  useTicker,
} from "@/components/shared/use-case";
import { LambdaIcon, S3Icon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES                                                        */
/* ================================================================== */

export type LambdaUseCaseId = "S3_EVENTS" | "COLD_WARM" | "FAN_OUT";

interface LambdaUseCasesProps {
  id: LambdaUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

type UCLog = { id: number; text: string; tone?: string };

/* ================================================================== */
/* HOISTED PRIMITIVES (never nested inside components)                 */
/* ================================================================== */

function LSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className="text-[8px] font-extrabold tabular-nums text-aws">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label={ariaLabel}
        className="w-full h-1.5 accent-[#ff9900] cursor-pointer bg-black/60 border border-foreground/20"
      />
    </div>
  );
}

/* ================================================================== */
/* TAB 02 — S3 EVENT PROCESSING                                        */
/* ================================================================== */

type S3EPhase = "IDLE" | "INIT" | "INVOKE" | "DONE";

const S3E_PHASE_TEXT: Record<S3EPhase, string> = {
  IDLE: "IDLE — AWAITING S3 EVENTS",
  INIT: "INIT — PROVISIONING SANDBOX…",
  INVOKE: "EXECUTING handler.run()",
  DONE: "DONE — THUMBNAILS WRITTEN",
};

const S3E_PHASE_STEP: Record<S3EPhase, number> = { IDLE: 0, INIT: 0, INVOKE: 1, DONE: 2 };
const S3E_PHASE_PCT: Record<S3EPhase, number> = { IDLE: 0, INIT: 22, INVOKE: 82, DONE: 100 };

function S3EventsUseCase({ immersiveActive, immersiveToggle }: LambdaUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<S3EPhase>("IDLE");
  const [curDur, setCurDur] = useState(0);
  const [lastBilled, setLastBilled] = useState<number | null>(null);
  const [totals, setTotals] = useState({ events: 0, thumbs: 0, durSum: 0, billedSum: 0, waste: 0 });
  const [lines, setLines] = useState<UCLog[]>([]);
  const idRef = useRef(1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  const fire = () => {
    const dur = 360 + Math.floor(Math.random() * 720); // 360–1080ms of real compute
    const billed = Math.ceil(dur / 100) * 100; // AWS rounds UP to the next 100ms
    const key = `img/uploads/IMG_${Math.floor(1000 + Math.random() * 9000)}.jpg`;

    setCurDur(dur);
    setPhase("INIT");
    push(`EVENT s3:ObjectCreated:* → [${key}] — lambda:InvokeAsync`, "aws");

    later(() => {
      setPhase("INVOKE");
      push(`EVENT s3:ObjectCreated:* → invoke duration ${dur}ms — billed ${billed}ms`, dur > 950 ? "neon" : "magenta");
    }, 420);

    later(() => {
      setPhase("DONE");
      setLastBilled(billed);
      setTotals((s) => ({
        events: s.events + 1,
        thumbs: s.thumbs + 3,
        durSum: s.durSum + dur,
        billedSum: s.billedSum + billed,
        waste: s.waste + (billed - dur),
      }));
      push(`DONE — 3 thumbnails written → s3://nexus-media/thumbs/ (${(dur / 1000).toFixed(2)}s compute)`, "mint");
    }, 420 + dur);

    later(() => setPhase("IDLE"), 420 + dur + 620);
  };

  // auto mode — one upload every ~2s while running
  useTicker(running, fire, 2000);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    },
    []
  );

  const reset = () => {
    setRunning(false);
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    setPhase("IDLE");
    setCurDur(0);
    setLastBilled(null);
    setTotals({ events: 0, thumbs: 0, durSum: 0, billedSum: 0, waste: 0 });
    setLines([]);
  };

  const avgMs = totals.events > 0 ? Math.round(totals.durSum / totals.events) : null;

  return (
    <UseCaseShell
      title="USE CASE // S3 EVENT PROCESSING — SERVERLESS IMAGE PIPELINE"
      subtitle="S3 UPLOAD → OBJECT-CREATED EVENT → λ HANDLER → THUMBNAILS"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="EVENTS" value={totals.events} />
          <UCStat label="INVOKE AVG MS" value={avgMs === null ? "—" : `${avgMs} MS`} tone="magenta" />
          <UCStat label="THUMBS PRODUCED" value={totals.thumbs} tone="mint" />
          <UCStat label="BILLED MS" value={`${totals.billedSum} MS`} tone="neon" />
          <UCStat label="LAST BILLED" value={lastBilled === null ? "—" : `${lastBilled} MS`} tone="neutral" />
          <UCStat label="BILLING WASTE" value={`${totals.waste} MS`} tone={totals.waste > 0 ? "danger" : "neutral"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "AUTO — 1 UPLOAD EVERY ~2S · PUSH NOT PULL" : "IDLE — PRESS RUN OR UPLOAD AN IMAGE"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">EVENT SOURCES</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={fire} ariaLabel="Upload an image to S3 and trigger the Lambda function">
              <ImageDown className="w-3 h-3" /> UPLOAD IMAGE
            </UCButton>
          </div>
        </>
      }
      logLines={lines}
      logTitle="EVENT PIPELINE LOG // LIVE"
      logEmpty="PRESS RUN — OR HIT UPLOAD IMAGE TO FIRE ONE EVENT"
    >
      <FlowCanvas ariaLabel="Lambda S3 event processing use case diagram" className="h-full">
        <FlowLink d="M23,50 C30,50 32,46 38,44" status={phase === "INIT" ? "flowing" : "idle"} dotDuration={0.8} />
        <FlowLink d="M64,54 C70,55 74,55 80,55" status={phase === "DONE" ? "success" : "idle"} dot={phase === "DONE"} dotDuration={1.0} />

        <FlowNode
          x={14}
          y={50}
          size="sm"
          delay={0.1}
          icon={<S3Icon className="w-3 h-3" />}
          label="S3 UPLOAD"
          sub="PUT /IMG/*.JPG"
          status={phase === "INIT" ? "active" : "idle"}
          pulse={phase === "INIT"}
        />

        {/* LAMBDA CORE — INIT → INVOKE → DONE */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[180px] sm:w-[210px]"
          style={{ left: "51%", top: "44%" }}
        >
          <div className={`glass cyber-cut p-2.5 ${phase !== "IDLE" ? "box-glow" : ""}`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-aws/15">
              <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                <LambdaIcon className="w-3.5 h-3.5" /> LAMBDA
              </span>
              <span
                className={`text-[6.5px] font-extrabold px-1 py-0.5 border tracking-wider ${
                  phase === "DONE"
                    ? "text-mint border-mint/60"
                    : phase === "INVOKE"
                      ? "text-aws border-aws/60"
                      : phase === "INIT"
                        ? "text-magenta border-magenta/60"
                        : "text-muted-foreground border-foreground/20"
                }`}
              >
                {phase}
              </span>
            </div>
            <p className="px-0.5 pt-1.5 text-[6.5px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              fn :: img-thumbnailer
            </p>
            <div className="flex flex-wrap gap-1 px-0.5 py-1.5">
              <span className="border border-aws/40 bg-aws/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-aws">nodejs20.x</span>
              <span className="border border-neon/40 bg-neon/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-neon">512 MB</span>
              <span className="border border-magenta/40 bg-magenta/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-magenta">
                s3:ObjectCreated:*
              </span>
            </div>
            <div className="min-h-[14px] px-0.5">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`text-[7px] font-bold uppercase tracking-[0.14em] ${
                    phase === "DONE" ? "text-mint" : phase === "INVOKE" ? "text-aws" : phase === "INIT" ? "text-magenta" : "text-muted-foreground/70"
                  }`}
                >
                  {S3E_PHASE_TEXT[phase]}
                  {phase === "INVOKE" && curDur > 0 ? ` — ${curDur}MS` : ""}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="mx-0.5 h-1.5 border border-aws/20 bg-black/60">
              <motion.div
                key={`${phase}-${curDur}`}
                className={`h-full ${phase === "INIT" ? "bg-magenta" : phase === "DONE" ? "bg-mint" : "bg-aws"}`}
                initial={{ width: 0 }}
                animate={{ width: `${S3E_PHASE_PCT[phase]}%` }}
                transition={{ duration: phase === "INVOKE" ? Math.max(0.35, curDur / 1000) : 0.4, ease: "linear" }}
              />
            </div>
            <p className="px-0.5 pt-1.5 text-[6.5px] font-bold tracking-[0.14em] text-muted-foreground/80 uppercase">
              billed in 100ms rounds — {totals.events} invokes · {totals.thumbs} thumbs
            </p>
          </div>
        </motion.div>

        <FlowNode
          x={87}
          y={55}
          size="sm"
          delay={0.5}
          icon={<ImageDown className="w-3 h-3" />}
          label="THUMBNAILS"
          sub={`${totals.thumbs} OBJECTS · /THUMBS/`}
          status={phase === "DONE" ? "success" : "idle"}
          pulse={phase === "DONE"}
        />

        <FlowLabel x={50} y={13} tone="aws">PUSH MODEL — S3 NOTIFIES LAMBDA PER OBJECT</FlowLabel>
        <FlowLabel x={50} y={87} tone="default">1MB IMAGE → 3 SIZES · ZERO SERVERS BETWEEN UPLOADS</FlowLabel>

        <StepBadge step={S3E_PHASE_STEP[phase]} total={3} text={phase === "IDLE" ? "AWAITING EVENT" : S3E_PHASE_TEXT[phase]} />
      </FlowCanvas>

      <UseCaseNote>
        NO POLLERS, NO IDLE COST: ONE 842MS INVOCATION ≈ $0.0000146 — AWS BILLS λ IN 100MS ROUNDS, SO SHORT HANDLERS PAY A TINY ROUNDING TAX
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — COLD VS WARM START RACE                                    */
/* ================================================================== */

type RaceState = "idle" | "running" | "done";
type ColdPhase = 0 | 1 | 2 | 3; // 0 idle · 1 download runtime · 2 init fn · 3 handler

const COLD_STEPS = ["DL RUNTIME", "INIT FN", "HANDLER"] as const;

function ColdWarmUseCase({ immersiveActive, immersiveToggle }: LambdaUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [provisioned, setProvisioned] = useState(false);
  const [raceState, setRaceState] = useState<RaceState>("idle");
  const [coldPhase, setColdPhase] = useState<ColdPhase>(0);
  const [segs, setSegs] = useState({ dl: 320, init: 380, exec: 150 });
  const [coldDone, setColdDone] = useState(false);
  const [warmDone, setWarmDone] = useState(false);
  const [warmMs, setWarmMs] = useState(34);
  const [races, setRaces] = useState(0);
  const [p50Cold, setP50Cold] = useState<number | null>(null);
  const [p50Warm, setP50Warm] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [lines, setLines] = useState<UCLog[]>([]);
  const idRef = useRef(1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const racesRef = useRef(0);
  const busyRef = useRef(false);
  const provisionedRef = useRef(false);
  useEffect(() => {
    provisionedRef.current = provisioned;
  }, [provisioned]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  const showFlash = (text: string) => {
    setFlash(text);
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1600);
  };

  const race = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const wms = 26 + Math.floor(Math.random() * 14);

    if (provisionedRef.current) {
      // no cold lane exists — provisioned sandbox answers instantly
      setRaceState("running");
      setWarmDone(false);
      setWarmMs(wms);
      push("RACE — warm pool pre-initialized: only the WARM lane exists", "mint");
      later(() => {
        setWarmDone(true);
        setRaceState("done");
        setRaces((r) => r + 1);
        racesRef.current += 1;
        setP50Warm((p) => (p === null ? wms : Math.round(p * 0.6 + wms * 0.4)));
        push(`WARM: handler ${wms}ms — sandbox pre-warmed by provisioned concurrency`, "mint");
        busyRef.current = false;
      }, 420);
      return;
    }

    const dl = 280 + Math.floor(Math.random() * 130);
    const init = 330 + Math.floor(Math.random() * 150);
    const exec = 120 + Math.floor(Math.random() * 90);
    const total = dl + init + exec;
    const n = racesRef.current + 1;

    setRaceState("running");
    setColdDone(false);
    setWarmDone(false);
    setColdPhase(1);
    setSegs({ dl, init, exec });
    setWarmMs(wms);
    push(`RACE #${n} — cold boot vs warm reuse — GO`, "aws");

    later(() => {
      setWarmDone(true);
      push(`WARM: handler ${wms}ms — sandbox reused, zero init`, "mint");
    }, wms + 60);
    later(() => {
      setColdPhase(2);
      push(`COLD: downloaded nodejs20.x runtime layer (${dl}ms) — deps unpacked`, "neon");
    }, dl);
    later(() => {
      setColdPhase(3);
      push(`COLD: fn init — top-level require + SDK clients (${init}ms)`, "magenta");
    }, dl + init);
    later(() => {
      setColdDone(true);
      push(`COLD: handler exec ${exec}ms — TOTAL ${total}ms before first byte`, "danger");
    }, dl + init + exec);
    later(() => {
      setRaceState("done");
      setRaces((r) => r + 1);
      racesRef.current += 1;
      setP50Cold((p) => (p === null ? total : Math.round(p * 0.6 + total * 0.4)));
      setP50Warm((p) => (p === null ? wms : Math.round(p * 0.6 + wms * 0.4)));
      const mult = (total / wms).toFixed(0);
      push(`RESULT: WARM WINS — ${mult}x faster (${wms}ms vs ${total}ms)`, "aws");
      showFlash(`WARM WINS ×${mult}`);
      busyRef.current = false;
    }, dl + init + exec + 420);
  };

  // auto-race while sim is running
  useTicker(running, race, 3400);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      if (flashT.current) clearTimeout(flashT.current);
    },
    []
  );

  const toggleProvisioned = () => {
    const v = !provisioned;
    setProvisioned(v);
    if (v) {
      push("PROVISIONED CONCURRENCY ON — warm pool pre-initialized (N sandboxes kept hot)", "mint");
      showFlash("WARM POOL PRE-INITIALIZED");
    } else {
      push("PROVISIONED CONCURRENCY OFF — cold starts return to the lane", "danger");
    }
  };

  const reset = () => {
    setRunning(false);
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    setRaceState("idle");
    setColdPhase(0);
    setColdDone(false);
    setWarmDone(false);
    setRaces(0);
    setP50Cold(null);
    setP50Warm(null);
    setFlash(null);
    setLines([]);
    racesRef.current = 0;
    busyRef.current = false;
  };

  const totalSegs = segs.dl + segs.init + segs.exec;
  const savings = p50Cold !== null && p50Warm !== null ? Math.round((1 - p50Warm / p50Cold) * 100) : null;

  return (
    <UseCaseShell
      title="USE CASE // COLD VS WARM START — THE 850MS TAX"
      subtitle="ON-DEMAND BOOT (DL RUNTIME → INIT → HANDLER) VS PRE-WARMED SANDBOX (~30MS)"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="P50 COLD" value={p50Cold === null ? "—" : `${p50Cold} MS`} tone="danger" />
          <UCStat label="P50 WARM" value={p50Warm === null ? "—" : `${p50Warm} MS`} tone="mint" />
          <UCStat label="SAVINGS" value={savings === null ? "—" : `${savings}% P99`} tone={savings !== null && savings > 80 ? "mint" : "neutral"} />
          <UCStat label="PC COST" value={provisioned ? "≈$11/MO" : "$0"} tone={provisioned ? "magenta" : "neutral"} />
          <UCStat label="RACES RUN" value={races} tone="neutral" />
          <UCStat label="LANE MODE" value={provisioned ? "PROVISIONED" : "ON-DEMAND"} tone={provisioned ? "aws" : "neutral"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "AUTO-RACING EVERY ~3.4S — WATCH THE LANES" : "IDLE — PRESS RUN OR START A RACE"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">RACE CONTROL</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={race} ariaLabel="Replay the cold vs warm race">
              <Rocket className="w-3 h-3" /> RACE NOW
            </UCButton>
            <UCToggle on={provisioned} onClick={toggleProvisioned} accent="mint" ariaLabel="Toggle provisioned concurrency">
              {provisioned ? <Flame className="w-3 h-3" /> : <Snowflake className="w-3 h-3" />}
              PROVISIONED CONCURRENCY {provisioned ? "ON" : "OFF"}
            </UCToggle>
          </div>
        </>
      }
      logLines={lines}
      logTitle="RACE TELEMETRY LOG // LIVE"
      logEmpty="PRESS RUN — OR HIT RACE NOW TO BOOT BOTH LANES"
    >
      <FlowCanvas ariaLabel="Lambda cold vs warm start race diagram" className="h-full">
        {/* COLD LANE */}
        <AnimatePresence>
          {!provisioned && (
            <motion.div
              key="cold-lane"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, y: -18 }}
              transition={{ duration: 0.35 }}
              className="absolute left-[5%] right-[5%] top-[16%] h-[27%] border border-danger/40 bg-danger/[0.04] z-10"
            >
              <div className="flex items-center justify-between px-2 pt-1.5">
                <span className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-[0.18em] text-danger">
                  <Snowflake className="w-3 h-3" /> COLD START · ON-DEMAND
                </span>
                <span className="text-[8px] font-extrabold tabular-nums text-danger">
                  {coldDone ? `${totalSegs} MS` : raceState === "running" ? "BOOTING…" : `~850 MS`}
                </span>
              </div>
              {/* segmented progress: DL RUNTIME → INIT FN → HANDLER */}
              <div className="mx-2 mt-1.5 flex h-3.5 border border-danger/40 bg-black/60">
                {COLD_STEPS.map((step, i) => {
                  const w = [segs.dl, segs.init, segs.exec][i] / totalSegs * 100;
                  const reached = coldPhase > i || (coldPhase === i + 1 && raceState !== "idle");
                  const isCurrent = raceState === "running" && coldPhase === i + 1 && !coldDone;
                  return (
                    <div key={step} style={{ width: `${w}%` }} className="relative h-full border-r border-black/80 last:border-r-0">
                      <motion.div
                        key={`${races}-${step}`}
                        className={`h-full ${isCurrent ? "bg-danger/70" : "bg-danger/30"}`}
                        initial={{ width: 0 }}
                        animate={{ width: reached || isCurrent || coldDone ? "100%" : "0%" }}
                        transition={{
                          duration: isCurrent ? [segs.dl, segs.init, segs.exec][i] / 1000 : 0.2,
                          ease: "linear",
                        }}
                      />
                      <span className={`absolute inset-0 flex items-center justify-center text-[5.5px] font-bold tracking-[0.14em] ${reached ? "text-danger" : "text-muted-foreground/50"}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="px-2 pt-1 flex flex-wrap gap-1">
                <span className="border border-neon/40 bg-neon/10 px-1 py-0.5 text-[6px] font-bold tracking-wider text-neon">DL RUNTIME ~{segs.dl}MS</span>
                <span className="border border-magenta/40 bg-magenta/10 px-1 py-0.5 text-[6px] font-bold tracking-wider text-magenta">INIT FN ~{segs.init}MS</span>
                <span className="border border-danger/40 bg-danger/10 px-1 py-0.5 text-[6px] font-bold tracking-wider text-danger">HANDLER ~{segs.exec}MS</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WARM LANE */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`absolute left-[5%] right-[5%] border border-mint/40 bg-mint/[0.04] z-10 ${provisioned ? "top-[38%] h-[27%]" : "top-[56%] h-[27%]"}`}
        >
          <div className="flex items-center justify-between px-2 pt-1.5">
            <span className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-[0.18em] text-mint">
              <Flame className="w-3 h-3" /> WARM · REUSED SANDBOX {provisioned ? "· PROVISIONED" : ""}
            </span>
            <span className="text-[8px] font-extrabold tabular-nums text-mint">{warmDone ? `${warmMs} MS` : `~30 MS`}</span>
          </div>
          <div className="mx-2 mt-1.5 h-3.5 border border-mint/40 bg-black/60">
            <motion.div
              key={`warm-${races}-${raceState}`}
              className={`h-full ${warmDone ? "bg-mint/80" : "bg-mint/40"}`}
              initial={{ width: 0 }}
              animate={{ width: raceState === "idle" ? "0%" : "100%" }}
              transition={{ duration: raceState === "idle" ? 0 : 0.14, ease: "linear" }}
            />
          </div>
          <p className="px-2 pt-0.5 text-[5.5px] font-bold tracking-[0.14em] text-mint/60 uppercase">
            HANDLER EXEC — SANDBOX STILL HOT FROM THE LAST INVOKE
          </p>
          <div className="px-2 pt-1 flex flex-wrap gap-1">
            <span className="border border-mint/40 bg-mint/10 px-1 py-0.5 text-[6px] font-bold tracking-wider text-mint">NO RUNTIME DL</span>
            <span className="border border-mint/40 bg-mint/10 px-1 py-0.5 text-[6px] font-bold tracking-wider text-mint">NO INIT</span>
            <span className="border border-mint/40 bg-mint/10 px-1 py-0.5 text-[6px] font-bold tracking-wider text-mint">/TMP WARM · CONNECTIONS LIVE</span>
          </div>
        </motion.div>

        {/* PC banner when provisioned — cold lane is gone */}
        {provisioned && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute left-[5%] right-[5%] top-[22%] z-[5] text-center"
          >
            <span className="text-[7px] font-bold uppercase tracking-[0.22em] text-mint/80 border border-mint/30 bg-black/60 px-2 py-1">
              COLD LANE REMOVED — WARM POOL PRE-INITIALIZED · p99 == p50
            </span>
          </motion.div>
        )}

        <FlowLabel x={50} y={9} tone="aws">SAME REQUEST · TWO WORLDS — BOOT COST IS THE DIFFERENCE</FlowLabel>
        <StepBadge
          step={raceState === "idle" ? 0 : raceState === "running" ? 1 : 2}
          total={3}
          text={raceState === "idle" ? "LANES IDLE" : raceState === "running" ? "RACING…" : "FINISHED"}
        />
      </FlowCanvas>

      <VerdictFlash show={flash !== null} text={flash ?? ""} tone="aws" />

      <UseCaseNote>
        PROVISIONED CONCURRENCY COSTS ≈$11/MO PER 1GB PRE-WARMED — CHEAP INSURANCE WHEN A 900MS COLD START WOULD BLOW YOUR p99 SLO
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — EVENT FAN-OUT (SNS → 3 PARALLEL CONSUMERS)                 */
/* ================================================================== */

interface FanOutConsumer {
  name: string;
  sub: string;
  icon: React.ReactNode;
  ms: number;
  straggler: boolean;
  done: boolean;
}

const FAN_CONSUMERS: { name: string; sub: string; icon: React.ReactNode }[] = [
  { name: "ORDER.SVC", sub: "CHARGE + PERSIST", icon: <ShoppingCart className="w-3 h-3" /> },
  { name: "EMAIL.SVC", sub: "RECEIPT → SES", icon: <Mail className="w-3 h-3" /> },
  { name: "ANALYTICS.SVC", sub: "BATCH → REDSHIFT", icon: <BarChart3 className="w-3 h-3" /> },
];

const FAN_LINKS = ["M26,50 C40,50 54,24 70,24", "M26,50 C40,50 54,50 70,50", "M26,50 C40,50 54,76 70,76"];

function FanOutLane({
  name,
  sub,
  icon,
  ms,
  straggler,
  done,
  active,
  eventKey,
}: {
  name: string;
  sub: string;
  icon: React.ReactNode;
  ms: number;
  straggler: boolean;
  done: boolean;
  active: boolean;
  eventKey: number;
}) {
  return (
    <div
      className={`border px-2 py-1.5 w-[190px] sm:w-[210px] ${
        done && straggler
          ? "border-magenta/70 bg-magenta/[0.08] shadow-[0_0_16px_rgba(255,45,120,0.3)]"
          : done
            ? "border-mint/60 bg-mint/[0.06]"
            : active
              ? "border-aws/70 bg-aws/[0.07] box-glow"
              : "border-foreground/15 bg-black/40"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={done && straggler ? "text-magenta" : done ? "text-mint" : active ? "text-aws" : "text-muted-foreground"}>{icon}</span>
        <span className={`text-[8px] font-extrabold uppercase tracking-[0.14em] ${done && straggler ? "text-magenta" : done ? "text-mint" : active ? "text-aws" : "text-muted-foreground"}`}>
          {name}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <span className={`text-[7.5px] font-extrabold tabular-nums ${done ? (straggler ? "text-magenta" : "text-mint") : "text-muted-foreground/60"}`}>
            {done ? `${ms}MS` : active ? "RUN…" : "—"}
          </span>
          {done && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`h-1.5 w-1.5 ping-ring ${straggler ? "bg-magenta" : "bg-mint"}`}
              aria-hidden="true"
            />
          )}
        </span>
      </div>
      <p className="text-[6px] font-bold tracking-[0.16em] text-muted-foreground/70 uppercase pt-0.5">{sub}</p>
      <div className="mt-1 h-1 border border-foreground/15 bg-black/60">
        {done ? (
          <div className={`h-full w-full ${straggler ? "bg-magenta" : "bg-mint"}`} />
        ) : (
          <motion.div
            key={`${eventKey}-${name}`}
            className={`h-full ${straggler ? "bg-magenta/70" : "bg-aws/70"}`}
            initial={{ width: 0 }}
            animate={{ width: active ? "100%" : "0%" }}
            transition={{ duration: active ? ms / 1000 : 0.2, ease: "linear" }}
          />
        )}
      </div>
    </div>
  );
}

function FanOutUseCase({ immersiveActive, immersiveToggle }: LambdaUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [consumers, setConsumers] = useState<FanOutConsumer[]>([]);
  const [active, setActive] = useState(false);
  const [eventNo, setEventNo] = useState(0);
  const [totals, setTotals] = useState({ published: 0, delivered: 0, stragglers: 0 });
  const [p50, setP50] = useState<number | null>(null);
  const [slowest, setSlowest] = useState<number | null>(null);
  const [lines, setLines] = useState<UCLog[]>([]);
  const idRef = useRef(1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latRef = useRef<number[]>([]);
  const totalsRef = useRef({ published: 0, delivered: 0, stragglers: 0 });
  const eventNoRef = useRef(0);
  useEffect(() => {
    totalsRef.current = totals;
  }, [totals]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const publish = () => {
    const stragglerIdx = Math.floor(Math.random() * FAN_CONSUMERS.length);
    const n = eventNoRef.current + 1;
    eventNoRef.current = n;
    const dur = FAN_CONSUMERS.map((_, i) => (i === stragglerIdx ? 1400 + Math.floor(Math.random() * 700) : 120 + Math.floor(Math.random() * 420)));

    setConsumers(
      FAN_CONSUMERS.map((c, i) => ({
        name: c.name,
        sub: c.sub,
        icon: c.icon,
        ms: dur[i],
        straggler: i === stragglerIdx,
        done: false,
      }))
    );
    setActive(true);
    setEventNo(n);
    setTotals((t) => ({ ...t, published: t.published + 1 }));
    push(`PUBLISH order.created #${n} → SNS STANDARD TOPIC — fan-out ×3 consumers`, "aws");

    FAN_CONSUMERS.forEach((c, i) => {
      timersRef.current.push(
        setTimeout(() => {
          setConsumers((prev) => prev.map((cc, j) => (j === i ? { ...cc, done: true } : cc)));
          setTotals((t) => ({ ...t, delivered: t.delivered + 1, stragglers: t.stragglers + (i === stragglerIdx ? 1 : 0) }));
          latRef.current = [...latRef.current.slice(-59), dur[i]];
          const sorted = [...latRef.current].sort((a, b) => a - b);
          setP50(sorted[Math.floor(sorted.length / 2)]);
          setSlowest((s) => (s === null ? dur[i] : Math.max(s, dur[i])));
          if (i === stragglerIdx) {
            // the straggler is always the slowest — its completion ends the fan-out
            setActive(false);
            push(`${c.name} ✓ ${dur[i]}ms — STRAGGLER (slow downstream) — magenta lane`, "magenta");
          } else {
            push(`${c.name} ✓ ${dur[i]}ms — ${c.sub.toLowerCase()} ok`, "mint");
          }
        }, dur[i])
      );
    });
  };

  // auto mode — publish every ~2.8s while running
  useTicker(running, publish, 2800);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    },
    []
  );

  const reset = () => {
    setRunning(false);
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    setConsumers([]);
    setActive(false);
    setEventNo(0);
    setTotals({ published: 0, delivered: 0, stragglers: 0 });
    setP50(null);
    setSlowest(null);
    setLines([]);
    latRef.current = [];
    eventNoRef.current = 0;
  };

  return (
    <UseCaseShell
      title="USE CASE // EVENT FAN-OUT — SNS → PARALLEL CONSUMERS"
      subtitle="ONE PUBLISH → 3 INDEPENDENT λ CONSUMERS · ONE SLOW STRAGGLER PER EVENT"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="EVENTS PUBLISHED" value={totals.published} />
          <UCStat label="CONSUMER P50" value={p50 === null ? "—" : `${p50} MS`} tone="mint" />
          <UCStat label="SLOWEST MS" value={slowest === null ? "—" : `${slowest} MS`} tone={slowest !== null && slowest > 1000 ? "magenta" : "neutral"} />
          <UCStat label="DELIVERED" value={totals.delivered} tone="neutral" />
          <UCStat label="STRAGGLERS" value={totals.stragglers} tone={totals.stragglers > 0 ? "magenta" : "neutral"} />
          <UCStat label="FAN-OUT WIDTH" value="×3" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "AUTO-PUBLISHING EVERY ~2.8S — WATCH FOR THE STRAGGLER" : "IDLE — PRESS RUN OR PUBLISH AN EVENT"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">TOPIC ACTIONS</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={publish} ariaLabel="Publish an event to the SNS topic">
              <Share2 className="w-3 h-3" /> PUBLISH EVENT
            </UCButton>
          </div>
        </>
      }
      logLines={lines}
      logTitle="FAN-OUT DELIVERY LOG // LIVE"
      logEmpty="PRESS RUN — OR PUBLISH ONE EVENT TO FAN OUT ×3"
    >
      <FlowCanvas ariaLabel="Lambda event fan-out use case diagram" className="h-full">
        {/* topic → consumer links (straggler lane runs magenta) */}
        {FAN_LINKS.map((d, i) => (
          <FlowLink
            key={d}
            d={d}
            status={consumers[i]?.straggler && active ? "cyber" : active ? "flowing" : "idle"}
            dotDuration={consumers[i]?.straggler ? 2.4 : i === 0 ? 0.9 : i === 1 ? 0.8 : 1.0}
            dotDelay={i * 0.1}
          />
        ))}

        {/* SNS TOPIC */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: "16%", top: "50%" }}
        >
          <div className={`glass cyber-cut p-2 w-[120px] sm:w-[140px] ${active ? "box-glow" : ""}`}>
            <div className="flex items-center gap-1.5 pb-1 border-b border-aws/15">
              <Share2 className="w-3.5 h-3.5 text-aws" />
              <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-aws">SNS TOPIC</span>
            </div>
            <p className="pt-1 text-[6.5px] font-bold tracking-[0.12em] text-muted-foreground uppercase">orders.fanout</p>
            <p className="text-[6px] tracking-wider text-muted-foreground/70 uppercase">standard · at-least-once</p>
            <p className="pt-1 text-[7px] font-extrabold tabular-nums text-aws">#{eventNo || "—"}</p>
          </div>
        </motion.div>

        {/* CONSUMER LANES */}
        <div className="absolute right-[4%] top-[8%] bottom-[8%] flex flex-col justify-around items-end z-10">
          {consumers.length === 0
            ? FAN_CONSUMERS.map((c) => (
                <FanOutLane key={c.name} name={c.name} sub={c.sub} icon={c.icon} ms={0} straggler={false} done={false} active={false} eventKey={0} />
              ))
            : consumers.map((c) => (
                <FanOutLane
                  key={c.name}
                  name={c.name}
                  sub={c.sub}
                  icon={c.icon}
                  ms={c.ms}
                  straggler={c.straggler}
                  done={c.done}
                  active={active && !c.done}
                  eventKey={eventNo}
                />
              ))}
        </div>

        <FlowLabel x={40} y={12} tone="aws">PUBLISH → 3 ATOMIC PARALLEL INVOKES</FlowLabel>
        <FlowLabel x={38} y={90} tone="magenta">ONE RANDOM STRAGGLER PER EVENT — ISOLATED PER CONSUMER</FlowLabel>

        <StepBadge
          step={active ? 1 : totals.published > 0 ? 2 : 0}
          total={3}
          text={active ? "FANNING OUT…" : totals.published > 0 ? "DELIVERED" : "TOPIC IDLE"}
        />
      </FlowCanvas>

      <UseCaseNote>
        EACH CONSUMER FAILS INDEPENDENTLY: ORDER.SVC RETRIES, ANALYTICS.SVC BUFFERS — NOBODY BLOCKS THE PUBLISHER, AND A 1.8S STRAGGLER NEVER STALLS THE EVENT LOOP
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function LambdaUseCases({ id, immersiveActive, immersiveToggle }: LambdaUseCasesProps) {
  if (id === "S3_EVENTS") return <S3EventsUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "COLD_WARM") return <ColdWarmUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <FanOutUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}


