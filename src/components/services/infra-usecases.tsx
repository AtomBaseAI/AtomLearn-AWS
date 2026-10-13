"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Zap,
  ShieldCheck,
  LifeBuoy,
  Activity,
  Server,
  Building2,
  Network,
  Layers,
  RotateCcw,
  Globe2,
  Play,
  Pause,
} from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";

/* ------------------------------------------------------------------ */
/* SHARED BITS                                                         */
/* ------------------------------------------------------------------ */

const UC_TONES = {
  aws: { text: "text-aws", border: "border-aws/25" },
  mint: { text: "text-mint", border: "border-mint/30" },
  magenta: { text: "text-magenta", border: "border-magenta/30" },
} as const;

function DefStrip({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-inset px-4 py-3 flex items-start gap-3"
    >
      <span className="flex items-center justify-center w-9 h-9 border border-aws/50 bg-black/40 shrink-0">
        <Icon className="w-4 h-4 text-aws" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold tracking-[0.22em] text-aws uppercase">{title}</p>
        <p className="text-[9.5px] text-muted-foreground leading-relaxed mt-1">{children}</p>
      </div>
    </motion.div>
  );
}

function UcCard({
  icon: Icon,
  title,
  tone = "aws",
  delay = 0,
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone?: keyof typeof UC_TONES;
  delay?: number;
  children: React.ReactNode;
}) {
  const t = UC_TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={`glass p-3 border ${t.border}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${t.text}`} aria-hidden="true" />
        <p className="text-[8px] font-extrabold uppercase tracking-[0.2em]">{title}</p>
      </div>
      <p className="text-[9px] text-muted-foreground leading-relaxed mt-1.5">{children}</p>
    </motion.div>
  );
}

/** Directional packet-flow line — a glowing dot sweeps across the track. */
function FlowLine({ on, reverse = false, className }: { on: boolean; reverse?: boolean; className: string }) {
  return (
    <div className="relative h-[3px] w-full bg-black/70 border border-foreground/10 overflow-hidden">
      {on && (
        <motion.span
          key={reverse ? "rev" : "fwd"}
          className={`absolute top-0 h-full w-4 ${className}`}
          animate={reverse ? { left: ["96%", "-8%"] } : { left: ["-8%", "96%"] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 02 — REGIONS BEST USE CASE                                      */
/* ------------------------------------------------------------------ */

const FLOWS = [
  { d: "M 92 45 C 320 45, 430 45, 552 45", label: "12ms", lx: 300, ly: 38, good: true, dur: 2.0 },
  { d: "M 92 105 C 320 105, 430 105, 552 105", label: "4ms", lx: 300, ly: 98, good: true, dur: 1.7 },
  { d: "M 92 165 C 320 165, 430 165, 552 165", label: "9ms", lx: 300, ly: 158, good: true, dur: 1.9 },
  { d: "M 92 45 C 330 45, 420 227, 552 227", label: "218ms · AVOID", lx: 330, ly: 142, good: false, dur: 4.2 },
] as const;

const USER_NODES = [
  { x: 80, y: 45, label: "USERS · MUMBAI" },
  { x: 80, y: 105, label: "USERS · SINGAPORE" },
  { x: 80, y: 165, label: "USERS · LONDON" },
] as const;

const REGION_CHIPS = [
  { x: 552, y: 45, code: "AP-SOUTH-1", name: "MUMBAI", avoid: false },
  { x: 552, y: 105, code: "AP-SOUTHEAST-1", name: "SINGAPORE", avoid: false },
  { x: 552, y: 165, code: "EU-WEST-2", name: "LONDON", avoid: false },
  { x: 552, y: 227, code: "US-EAST-1", name: "N. VIRGINIA", avoid: true },
] as const;

function DrCard({
  code,
  city,
  role,
  cap,
  offline,
}: {
  code: string;
  city: string;
  role: string;
  cap: number;
  offline: boolean;
}) {
  return (
    <div className={`glass-inset p-3 border transition-colors ${offline ? "border-danger/70" : "border-mint/50"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold text-aws tracking-[0.1em]">{code}</span>
        <span
          className={`flex items-center gap-1 text-[7px] font-bold tracking-[0.18em] whitespace-nowrap ${
            offline ? "text-danger" : "text-mint"
          }`}
        >
          <span className={`w-1.5 h-1.5 shrink-0 ${offline ? "bg-danger animate-pulse" : "bg-mint animate-pulse"}`} />
          {role}
        </span>
      </div>
      <p className="text-[7.5px] text-muted-foreground uppercase tracking-[0.2em] mt-1">{city}</p>
      <p className="text-[6.5px] uppercase tracking-[0.18em] text-muted-foreground mt-2.5 flex justify-between">
        <span>CAPACITY</span>
        <span className={`font-bold tabular-nums ${offline ? "text-danger" : "text-mint"}`}>{cap}%</span>
      </p>
      <div className="mt-1 h-1.5 bg-black/60 border border-foreground/10 overflow-hidden">
        <motion.div
          className={`h-full ${offline ? "bg-danger/70" : "bg-mint shadow-[0_0_8px_rgba(0,255,163,0.5)]"}`}
          animate={{ width: `${cap}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function RegionsUseCase() {
  const [failedOver, setFailedOver] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <DefStrip icon={Globe2} title="AWS REGION — DEFINITION">
        A Region is a separate geographic area where AWS operates. Each Region is fully independent — for
        example Mumbai (ap-south-1) and Singapore (ap-southeast-1).
      </DefStrip>

      {/* LATENCY DIAGRAM */}
      <GlassPanel
        title="DIAGRAM // LATENCY-DRIVEN REGION SELECTION"
        subtitle="ANIMATED PACKET FLOW — RED ROUTE = WRONG REGION CHOICE"
        className="!p-0"
      >
        <div className="p-3 overflow-x-auto cyber-scroll">
          <svg
            viewBox="0 0 760 252"
            className="w-full min-w-[660px] select-none"
            role="img"
            aria-label="Diagram: user clusters route to their nearest AWS region with low latency; one wrong high-latency route is flagged"
          >
            <text x={92} y={16} fontSize={8} fill="#9c8873" letterSpacing={2}>USER CLUSTERS</text>
            <text x={736} y={16} fontSize={8} fill="#9c8873" letterSpacing={2} textAnchor="end">AWS REGIONS</text>

            {FLOWS.map((f) => (
              <g key={f.label}>
                <motion.path
                  d={f.d}
                  fill="none"
                  stroke={f.good ? "#00ffa3" : "#ff2d78"}
                  strokeWidth={f.good ? 1.4 : 1.2}
                  strokeOpacity={0.75}
                  style={{ strokeDasharray: f.good ? "5 7" : "3 6" }}
                  animate={{ strokeDashoffset: [0, f.good ? -48 : -36] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
                <circle r={2.6} fill={f.good ? "#baffdf" : "#ff2d78"}>
                  <animateMotion dur={`${f.dur}s`} repeatCount="indefinite" path={f.d} />
                </circle>
              </g>
            ))}

            {FLOWS.map((f) => (
              <text key={`lbl-${f.label}`} x={f.lx} y={f.ly} fontSize={9} fontWeight={700} fill={f.good ? "#00ffa3" : "#ff2d78"}>
                {f.label}
              </text>
            ))}

            {USER_NODES.map((u) => (
              <g key={u.label}>
                <circle cx={u.x} cy={u.y} r={5} fill="#0b0b12" stroke="#ffb347" strokeWidth={1.4} />
                <circle cx={u.x} cy={u.y} r={1.8} fill="#ffb347" />
                <text x={u.x + 12} y={u.y + 3} fontSize={9} fill="#d8cfc2" letterSpacing={1}>{u.label}</text>
              </g>
            ))}

            {REGION_CHIPS.map((c) => (
              <g key={c.code}>
                <rect
                  x={c.x}
                  y={c.y - 13}
                  width={184}
                  height={26}
                  fill="rgba(11,11,18,0.8)"
                  stroke={c.avoid ? "rgba(255,45,120,0.4)" : "rgba(255,153,0,0.4)"}
                  strokeWidth={1}
                />
                <rect x={c.x} y={c.y - 13} width={3} height={26} fill={c.avoid ? "#ff2d78" : "#ff9900"} />
                <text x={c.x + 12} y={c.y + 3.5} fontSize={9.5} fontWeight={700} fill="#ffb347" letterSpacing={1}>
                  {c.code}
                </text>
                <text x={c.x + 174} y={c.y + 3.5} fontSize={8} fill="#9c8873" textAnchor="end" letterSpacing={1}>
                  {c.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="px-3 pb-3 flex flex-wrap gap-x-4 gap-y-1 text-[7px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-mint inline-block" /> LOW-LATENCY ROUTE</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-magenta inline-block" /> HIGH-LATENCY — AVOID</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-aws inline-block" /> AWS REGION</span>
        </div>
      </GlassPanel>

      {/* USE CASE CARDS */}
      <div className="grid md:grid-cols-3 gap-3">
        <UcCard icon={Zap} title="REDUCE LATENCY" tone="mint" delay={0}>
          Serve users from the geographically closest Region. Mumbai users hit ap-south-1 in ~12ms — the
          same request to us-east-1 takes ~218ms (see the red route above).
        </UcCard>
        <UcCard icon={ShieldCheck} title="DATA RESIDENCY" tone="aws" delay={0.05}>
          Compliance laws can require data to stay in-country. Content written to a Region never leaves its
          geography unless you explicitly replicate it — pick the Region matching your regulation.
        </UcCard>
        <UcCard icon={LifeBuoy} title="DISASTER RECOVERY" tone="magenta" delay={0.1}>
          Regions are independent failure domains. Replicate workloads across Regions so a full regional
          outage can&apos;t take the business down — simulate it below.
        </UcCard>
      </div>

      {/* DR SIMULATION */}
      <GlassPanel
        title="DIAGRAM // CROSS-REGION DISASTER RECOVERY"
        subtitle="LIVE SIMULATION — TRIGGER FAILOVER AND WATCH TRAFFIC REROUTE"
        className="!p-0"
      >
        <div className="p-4 flex flex-col gap-3">
          <div className="grid sm:grid-cols-[1fr_150px_1fr] gap-3 items-stretch">
            <DrCard
              code="US-EAST-1"
              city="N. Virginia, US"
              role={failedOver ? "OFFLINE" : "PRIMARY — ACTIVE"}
              cap={failedOver ? 0 : 94}
              offline={failedOver}
            />
            <div className="flex flex-col justify-center gap-1.5 px-1">
              <p className="text-[6.5px] uppercase tracking-[0.18em] text-muted-foreground text-center">CRR REPLICATION</p>
              <FlowLine
                on={!failedOver}
                className="bg-mint shadow-[0_0_8px_rgba(0,255,163,0.7)]"
              />
              <p className={`text-[6.5px] uppercase tracking-[0.14em] text-center ${failedOver ? "text-danger" : "text-mint"}`}>
                {failedOver ? "PAUSED — PRIMARY DOWN" : "IN SYNC · 0 DRIFT"}
              </p>
              <p className="text-[6.5px] uppercase tracking-[0.18em] text-muted-foreground text-center mt-1.5">FAILOVER PATH</p>
              <FlowLine
                on={failedOver}
                className="bg-magenta shadow-[0_0_8px_rgba(255,45,120,0.7)]"
              />
              <p className={`text-[6.5px] uppercase tracking-[0.14em] text-center ${failedOver ? "text-magenta" : "text-muted-foreground"}`}>
                {failedOver ? "ACTIVATED — TRAFFIC REROUTED" : "ARMED — IDLE"}
              </p>
            </div>
            <DrCard
              code="EU-WEST-1"
              city="Dublin, IE"
              role={failedOver ? "ACTIVE — FAILOVER" : "STANDBY — PILOT LIGHT"}
              cap={failedOver ? 96 : 12}
              offline={false}
            />
          </div>

          <div className="glass-inset px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[8px] text-muted-foreground tracking-[0.08em]">
              ROUTE53 HEALTH CHECKS:{" "}
              <span className={`font-bold ${failedOver ? "text-danger" : "text-mint"}`}>
                {failedOver ? "PRIMARY 0/3 — FAILOVER TRIGGERED" : "PRIMARY 3/3 PASSING"}
              </span>
              <span className="mx-2 opacity-40">|</span> RPO ≈ 1s
              <span className="mx-2 opacity-40">|</span> RTO &lt; 60s
            </p>
            <button
              type="button"
              onClick={() => setFailedOver((v) => !v)}
              aria-pressed={failedOver}
              className={`flex items-center gap-1.5 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.2em] border backdrop-blur-md transition-colors ${
                failedOver
                  ? "border-mint/70 text-mint shadow-[0_0_14px_rgba(0,255,163,0.3)]"
                  : "border-magenta/70 text-magenta shadow-[0_0_14px_rgba(255,45,120,0.3)]"
              }`}
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              {failedOver ? "RESTORE PRIMARY" : "SIMULATE FAILOVER"}
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 03 — AVAILABILITY ZONE USE CASE (LIVE OPERATIONS THEATER)       */
/* ------------------------------------------------------------------ */

const AZ_COLUMNS = [
  { id: "ap-south-1a", azId: "aps1-az1", dcs: 2, inst: ["i-0a1f9e2", "i-0b2c8d3", "i-0c3e7f4", "i-0d4f6a8"] },
  { id: "ap-south-1b", azId: "aps1-az2", dcs: 2, inst: ["i-1a4d2c5", "i-1b5e3f6", "i-1c6a4b7", "i-1d7b9e0"] },
  { id: "ap-south-1c", azId: "aps1-az3", dcs: 1, inst: ["i-2a7b8c0", "i-2b9d0e1", "i-2c0f3d2"] },
] as const;

const REPLICATION_LINKS: Array<[string, string]> = [
  ["ap-south-1a", "ap-south-1b"],
  ["ap-south-1a", "ap-south-1c"],
  ["ap-south-1b", "ap-south-1c"],
];

const azLetter = (id: string) => id.slice(-2).toUpperCase();
const azHash = (id: string) => id.split("").reduce((a, c) => a + c.charCodeAt(0) * 31, 0);
const azPpsBase = (id: string) => 430 + (azHash(id) % 160);

/** Scripted failover showcase — loops while AUTO DEMO is engaged. */
const SCENARIO: Array<{ label: string; down: string[]; hold: number; log: string }> = [
  { label: "NOMINAL FLOW", down: [], hold: 4200, log: "ALL AZs NOMINAL — LOAD SPREAD 33/33/34" },
  { label: "FAIL AZ 1A", down: ["ap-south-1a"], hold: 4800, log: "AZ 1A ISOLATED — TRAFFIC REROUTED → 1B · 1C" },
  { label: "RESTORE AZ 1A", down: [], hold: 3400, log: "AZ 1A BACK ONLINE — LOAD REBALANCED" },
  { label: "FAIL AZ 1C", down: ["ap-south-1c"], hold: 4800, log: "AZ 1C ISOLATED — TRAFFIC REROUTED → 1A · 1B" },
  { label: "FULL MESH", down: [], hold: 4600, log: "AZ 1C BACK ONLINE — FULL FIBER MESH RESTORED" },
];

/** Rack LED — blinks mint while healthy, flickers red when the AZ is isolated. */
function RackLed({ down, i }: { down: boolean; i: number }) {
  return (
    <motion.span
      className={`w-1 h-1 sm:w-1.5 sm:h-1.5 ${down ? "bg-danger/90" : "bg-mint shadow-[0_0_4px_rgba(0,255,163,0.8)]"}`}
      animate={{ opacity: down ? [1, 0.2, 1] : [1, 0.35, 1] }}
      transition={{ duration: down ? 0.55 : 1.6, repeat: Infinity, delay: (i % 8) * 0.19 }}
    />
  );
}

export function AzUseCase() {
  const [auto, setAuto] = useState(true);
  const [step, setStep] = useState(0);
  const [down, setDown] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<Array<{ t: string; msg: string; bad: boolean }>>([]);
  const [events, setEvents] = useState(0);
  const [tick, setTick] = useState(0);
  const stepRef = useRef(0);
  const appliedRef = useRef<string | null>(null);

  const pushLog = useCallback((msg: string, bad: boolean) => {
    const t = new Date().toISOString().slice(11, 19);
    setLog((l) => [{ t, msg, bad }, ...l].slice(0, 4));
  }, []);

  const applyScenario = useCallback(
    (s: (typeof SCENARIO)[number]) => {
      appliedRef.current = s.down.join(",");
      setDown(new Set(s.down));
      pushLog(s.log, s.down.length > 0);
      if (s.down.length > 0) setEvents((e) => e + 1);
    },
    [pushLog]
  );

  // scenario engine — apply the current step, schedule the next one
  useEffect(() => {
    if (!auto) return;
    const s = SCENARIO[stepRef.current];
    if (appliedRef.current !== s.down.join(",")) applyScenario(s);
    const timer = setTimeout(() => {
      stepRef.current = (stepRef.current + 1) % SCENARIO.length;
      setStep(stepRef.current);
    }, s.hold);
    return () => clearTimeout(timer);
  }, [auto, step, applyScenario]);

  // deterministic live packet wobble for the PKT/S counters
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 900);
    return () => clearInterval(t);
  }, []);

  const shareFor = (id: string) => {
    const alive = AZ_COLUMNS.filter((a) => !down.has(a.id));
    if (alive.length === 0 || down.has(id)) return 0;
    const base = Math.floor(100 / alive.length);
    return base + (alive[alive.length - 1].id === id ? 100 - base * alive.length : 0);
  };
  const ppsFor = (id: string) => {
    const share = shareFor(id);
    if (share === 0) return 0;
    const wobble = (tick * ((azHash(id) % 5) + 3)) % 80;
    return Math.round(((azPpsBase(id) + wobble) * share) / 33.4);
  };
  const totalPps = AZ_COLUMNS.reduce((s, a) => s + ppsFor(a.id), 0);

  const healthy = AZ_COLUMNS.filter((a) => !down.has(a.id));
  const allDown = healthy.length === 0;
  const someDown = down.size > 0 && !allDown;

  const toggleAz = (id: string) => {
    setAuto(false);
    const wasDown = down.has(id);
    // functional update: rapid burst clicks must compose, not overwrite
    setDown((prev) => {
      const next = new Set(prev);
      if (wasDown) next.delete(id);
      else next.add(id);
      appliedRef.current = Array.from(next).sort().join(",");
      return next;
    });
    pushLog(wasDown ? `AZ ${azLetter(id)} RESTORED — MANUAL` : `AZ ${azLetter(id)} ISOLATED — MANUAL FAILOVER`, !wasDown);
    if (!wasDown) setEvents((e) => e + 1);
  };

  const restoreAll = () => {
    setAuto(false);
    appliedRef.current = "";
    setDown(new Set());
    pushLog("ALL AZs RESTORED — FULL MESH", false);
  };

  const jumpTo = (i: number) => {
    stepRef.current = i;
    setStep(i);
    if (auto) appliedRef.current = null; // engine effect re-applies this step
    else applyScenario(SCENARIO[i]);
  };

  const runDemo = () => {
    if (auto) {
      setAuto(false);
      pushLog("AUTO DEMO PAUSED — MANUAL CONTROL", false);
      return;
    }
    stepRef.current = 0;
    setStep(0);
    appliedRef.current = null;
    setAuto(true);
    pushLog("AUTO DEMO ENGAGED — SCRIPTED FAILOVER", false);
  };

  return (
    <div className="flex flex-col gap-4">
      <DefStrip icon={Building2} title="AVAILABILITY ZONE (AZ) — DEFINITION">
        An AZ is an isolated location within an AWS Region. Every Region contains multiple AZs, and each AZ
        consists of one or more data centers.
      </DefStrip>

      {/* LIVE OPERATIONS THEATER */}
      <GlassPanel
        title="LIVE SHOWCASE // AZ OPERATIONS THEATER — REGION AP-SOUTH-1 (MUMBAI)"
        subtitle="SELF-RUNNING FAILOVER SCRIPT — INTERRUPT WITH THE CHAOS CONTROLS ANY TIME"
        className="!p-0"
      >
        {/* scenario stepper */}
        <div className="px-3 pt-3 pb-2.5 border-b border-foreground/10">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">
              FAILOVER SCRIPT — CLICK A STEP TO JUMP {auto ? "· AUTO RUNNING" : "· MANUAL"}
            </p>
            <p className={`text-[7px] font-bold tracking-[0.16em] ${allDown ? "text-danger" : "text-aws"}`}>
              NOW: {SCENARIO[step].label}
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1" role="tablist" aria-label="Failover scenario steps">
            {SCENARIO.map((s, i) => {
              const active = i === step;
              return (
                <button
                  key={s.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => jumpTo(i)}
                  className={`px-2 py-1 text-[7px] font-bold uppercase tracking-[0.14em] border transition-colors ${
                    active
                      ? "border-aws/70 bg-aws/15 text-aws shadow-[0_0_12px_rgba(255,153,0,0.3)]"
                      : "border-foreground/15 bg-black/40 text-muted-foreground hover:border-aws/40 hover:text-aws"
                  }`}
                >
                  <span className="tabular-nums opacity-60 mr-1">{String(i + 1).padStart(2, "0")}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
          {auto && (
            <div className="mt-2 h-[2px] bg-black/60 overflow-hidden" aria-hidden="true">
              <motion.div
                key={step}
                className="h-full bg-aws/80 shadow-[0_0_8px_rgba(255,153,0,0.6)]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: SCENARIO[step].hold / 1000, ease: "linear" }}
              />
            </div>
          )}
        </div>

        <div className="p-3 flex flex-col gap-3">
          {/* REGION FRAME */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className={`relative border bg-black/30 transition-colors ${
              allDown ? "border-danger/70 shadow-[0_0_30px_rgba(255,51,85,0.15)]" : "border-aws/40"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-aws/25">
              <p className="text-[9px] font-extrabold text-aws tracking-[0.18em] flex items-center gap-2">
                <motion.span
                  className={`w-1.5 h-1.5 ${allDown ? "bg-danger" : "bg-aws"}`}
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  aria-hidden="true"
                />
                REGION · AP-SOUTH-1 — MUMBAI, IN
              </p>
              <p className={`text-[7px] font-bold tracking-[0.18em] ${allDown ? "text-danger" : "text-mint"}`}>
                {AZ_COLUMNS.length - down.size}/3 AZs SERVING{someDown ? " — REROUTING" : ""}
              </p>
            </div>

            {/* inbound trunk */}
            <div className="px-3 pt-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[6.5px] uppercase tracking-[0.2em] text-muted-foreground">INBOUND TRAFFIC — INTERNET GATEWAY</p>
                <p className={`text-[6.5px] font-bold uppercase tracking-[0.14em] tabular-nums ${allDown ? "text-danger" : "text-mint"}`}>
                  {allDown ? "0 PKT/S — GATEWAY DRAINING" : `${totalPps.toLocaleString("en-US")} PKT/S ROUTED`}
                </p>
              </div>
              <div className="relative mt-1 h-3.5 border border-foreground/10 bg-black/60 overflow-hidden" aria-hidden="true">
                {allDown
                  ? [0, 1, 2].map((l) => (
                      <span key={l} className="absolute left-0 right-0 h-[2px] bg-danger/25" style={{ top: 4 + l * 4 }} />
                    ))
                  : [0, 1, 2].map((l) => (
                      <motion.span
                        key={l}
                        className="absolute h-[2px] w-5 bg-mint/80 shadow-[0_0_6px_rgba(0,255,163,0.6)]"
                        style={{ top: 4 + l * 4 }}
                        animate={{ left: ["-6%", "104%"] }}
                        transition={{ duration: 1.5 + l * 0.35, repeat: Infinity, ease: "linear", delay: l * 0.28 }}
                      />
                    ))}
              </div>
            </div>

            {/* AZ towers */}
            <div className="grid sm:grid-cols-3 gap-2 p-2">
              {AZ_COLUMNS.map((az, i) => {
                const isDown = down.has(az.id);
                const share = shareFor(az.id);
                const pps = ppsFor(az.id);
                return (
                  <motion.div
                    key={az.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      x: isDown ? [0, -3, 3, -2, 2, 0] : 0,
                    }}
                    transition={{
                      opacity: { delay: 0.15 + i * 0.14, duration: 0.45 },
                      y: { delay: 0.15 + i * 0.14, duration: 0.45 },
                      x: { duration: 0.4 },
                    }}
                    className={`relative border p-2.5 flex flex-col gap-2 overflow-hidden transition-colors ${
                      isDown ? "border-danger/70 bg-danger/[0.06]" : "border-mint/35 bg-black/40"
                    }`}
                  >
                    {/* radar sweep */}
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                      <motion.span
                        className={`absolute top-0 bottom-0 w-10 ${
                          isDown
                            ? "bg-gradient-to-r from-transparent via-danger/[0.08] to-transparent"
                            : "bg-gradient-to-r from-transparent via-mint/[0.09] to-transparent"
                        }`}
                        animate={{ left: ["-15%", "110%"] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: "linear", delay: i * 0.6 }}
                      />
                    </span>

                    {/* connector from region trunk */}
                    <div className="relative h-6 flex justify-center" aria-hidden="true">
                      <div className={`w-[2px] h-full ${isDown ? "bg-danger/60" : "bg-gradient-to-b from-mint/50 to-mint/15"}`} />
                      {isDown ? (
                        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[6.5px] font-bold tracking-[0.14em] text-danger">
                          ✕ LINK DOWN
                        </span>
                      ) : (
                        <motion.span
                          className="absolute w-1.5 h-1.5 bg-mint shadow-[0_0_8px_rgba(0,255,163,0.95)]"
                          animate={{ top: ["0%", "84%"] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                        />
                      )}
                      <span
                        className={`absolute right-0 top-1/2 -translate-y-1/2 text-[7px] font-bold tabular-nums ${
                          isDown ? "text-danger" : "text-mint/90"
                        }`}
                      >
                        {share}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 relative">
                      <p className="text-[8px] font-extrabold tracking-[0.1em] text-foreground">{az.id.toUpperCase()}</p>
                      <span
                        className={`text-[6px] font-bold px-1 py-0.5 border tracking-[0.14em] ${
                          isDown ? "border-danger/60 text-danger" : "border-mint/50 text-mint"
                        }`}
                      >
                        {isDown ? "ISOLATED" : "ACTIVE"}
                      </span>
                    </div>
                    <p className="text-[6.5px] uppercase tracking-[0.16em] text-muted-foreground relative">
                      AZ ID {az.azId} · {az.dcs} DATA CENTER{az.dcs > 1 ? "S" : ""}
                    </p>

                    {/* data centers — live instance racks */}
                    <div className="flex gap-1.5 relative">
                      {Array.from({ length: az.dcs }).map((_, d) => (
                        <div
                          key={d}
                          className={`flex-1 border bg-black/50 p-1.5 ${isDown ? "border-danger/30" : "border-foreground/25"}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="flex items-center gap-1">
                              <Server className={`w-2.5 h-2.5 ${isDown ? "text-danger" : "text-aws"}`} aria-hidden="true" />
                              <span className="text-[6px] text-muted-foreground tracking-[0.1em]">DC-{d + 1}</span>
                            </span>
                            <motion.span
                              className={`w-1 h-1 ${isDown ? "bg-danger" : "bg-mint"}`}
                              animate={{ opacity: [1, 0.25, 1] }}
                              transition={{ duration: isDown ? 0.5 : 1.3, repeat: Infinity, delay: d * 0.3 }}
                              aria-hidden="true"
                            />
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {Array.from({ length: 8 }).map((_, k) => (
                              <RackLed key={k} down={isDown} i={d * 8 + k} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* load share */}
                    <div className="relative">
                      <div className="flex justify-between text-[6.5px] uppercase tracking-[0.14em] text-muted-foreground">
                        <span>LOAD SHARE</span>
                        <span className={`font-bold tabular-nums ${isDown ? "text-danger" : "text-mint"}`}>
                          {share}% · {pps.toLocaleString("en-US")} PKT/S
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-black/60 border border-foreground/10 overflow-hidden">
                        <motion.div
                          className={`h-full ${isDown ? "bg-danger/60" : "bg-mint shadow-[0_0_8px_rgba(0,255,163,0.5)]"}`}
                          animate={{ width: `${Math.max(share, 2)}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>

                    {/* instances */}
                    <div className="flex flex-wrap gap-1 relative">
                      {az.inst.map((inst) => (
                        <motion.span
                          key={inst}
                          animate={{ opacity: isDown ? 0.4 : 1 }}
                          transition={{ duration: 0.3 }}
                          className={`text-[6.5px] px-1 py-0.5 border tabular-nums tracking-[0.04em] ${
                            isDown ? "border-danger/50 text-danger" : "border-foreground/20 text-muted-foreground"
                          }`}
                        >
                          {isDown ? "✕ " : "● "}
                          {inst}
                        </motion.span>
                      ))}
                    </div>

                    {/* shockwave on failure */}
                    <AnimatePresence>
                      {isDown && (
                        <motion.span
                          key="shock"
                          aria-hidden="true"
                          initial={{ opacity: 0.95, scale: 0.55 }}
                          animate={{ opacity: 0, scale: 1.28 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.95, ease: "easeOut" }}
                          className="pointer-events-none absolute inset-0 border-2 border-danger shadow-[0_0_24px_rgba(255,51,85,0.55)]"
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* cross-AZ replication mesh */}
          <div className="grid sm:grid-cols-3 gap-2">
            {REPLICATION_LINKS.map(([a, b], i) => {
              const dead = down.has(a) || down.has(b);
              return (
                <div key={`${a}-${b}`} className={`border px-2.5 py-2 bg-black/40 ${dead ? "border-danger/40" : "border-mint/25"}`}>
                  <div className="flex items-center justify-between text-[6.5px] tracking-[0.14em] uppercase">
                    <span className="text-muted-foreground">CROSS-AZ REPLICATION</span>
                    <span className={`font-bold ${dead ? "text-danger" : "text-mint"}`}>{dead ? "PARTNER ISOLATED" : "SYNC · <2MS"}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[7px] font-bold text-aws">{azLetter(a)}</span>
                    <div className="relative flex-1 h-[3px] bg-black/70 border border-foreground/10 overflow-hidden">
                      {dead ? (
                        <span className="absolute inset-0 flex items-center justify-center text-[6px] text-danger font-bold leading-none">✕</span>
                      ) : (
                        <>
                          <motion.span
                            className="absolute top-0 h-full w-3 bg-mint/90 shadow-[0_0_6px_rgba(0,255,163,0.8)]"
                            animate={{ left: ["-8%", "100%"] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
                          />
                          <motion.span
                            className="absolute top-0 h-full w-3 bg-neon/70"
                            animate={{ left: ["100%", "-8%"] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "linear", delay: 0.55 + i * 0.2 }}
                          />
                        </>
                      )}
                    </div>
                    <span className="text-[7px] font-bold text-aws">{azLetter(b)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* availability ledger */}
          <div className="glass-inset px-3 py-2.5 flex flex-wrap items-center gap-3">
            <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground w-[110px] shrink-0">SERVICE AVAILABILITY</p>
            <div className="flex-1 min-w-[110px] h-1.5 bg-black/70 border border-foreground/10 overflow-hidden">
              <motion.div
                className={`h-full ${allDown ? "bg-danger" : "bg-mint shadow-[0_0_8px_rgba(0,255,163,0.55)]"}`}
                animate={{ width: allDown ? "1.5%" : "99.99%" }}
                transition={{ duration: 0.7 }}
              />
            </div>
            <span className={`text-[10px] font-extrabold tabular-nums ${allDown ? "text-danger" : "text-mint"}`}>
              {allDown ? "0.00%" : "99.99%"}
            </span>
            <span className={`text-[7px] font-bold uppercase tracking-[0.14em] ${allDown ? "text-danger" : "text-mint"}`}>
              {allDown
                ? "TOTAL OUTAGE — ALL AZs DOWN"
                : someDown
                  ? `ZERO DOWNTIME — REROUTED → ${healthy.map((h) => azLetter(h.id)).join(" · ")}`
                  : "ALL AZs NOMINAL — LOAD SPREAD"}
            </span>
          </div>

          {/* health checks */}
          <div className="glass-inset px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">ROUTE53 HEALTH CHECKS</p>
            {AZ_COLUMNS.map((az) => {
              const bad = down.has(az.id);
              return (
                <span key={az.id} className={`flex items-center gap-1 text-[7px] font-bold tracking-[0.12em] ${bad ? "text-danger" : "text-mint"}`}>
                  <motion.span
                    className={`w-1.5 h-1.5 ${bad ? "bg-danger" : "bg-mint"}`}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: bad ? 0.6 : 1.8, repeat: Infinity }}
                    aria-hidden="true"
                  />
                  {az.azId} {bad ? "✕ FAILING" : "✓ PASSING"}
                </span>
              );
            })}
            <span className="ml-auto text-[7px] uppercase tracking-[0.16em] text-muted-foreground">
              FAILOVER EVENTS <span className="text-magenta font-bold tabular-nums">{events}</span>
            </span>
          </div>

          {/* chaos + demo controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground mr-1.5">CHAOS CONTROLS:</p>
            {AZ_COLUMNS.map((az) => {
              const isDown = down.has(az.id);
              return (
                <button
                  key={az.id}
                  type="button"
                  onClick={() => toggleAz(az.id)}
                  aria-pressed={isDown}
                  className={`px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.16em] border backdrop-blur-md transition-colors ${
                    isDown
                      ? "border-mint/70 text-mint shadow-[0_0_12px_rgba(0,255,163,0.25)]"
                      : "border-danger/60 text-danger hover:bg-danger/10"
                  }`}
                >
                  {isDown ? `RESTORE ${azLetter(az.id)}` : `FAIL ${azLetter(az.id)}`}
                </button>
              );
            })}
            <button
              type="button"
              onClick={restoreAll}
              disabled={down.size === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.16em] border border-foreground/20 text-muted-foreground transition-colors hover:border-aws/50 hover:text-aws disabled:opacity-40 disabled:pointer-events-none"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" /> ALL
            </button>
            <button
              type="button"
              onClick={runDemo}
              aria-pressed={auto}
              className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.16em] border backdrop-blur-md transition-colors ${
                auto
                  ? "border-magenta/70 text-magenta shadow-[0_0_14px_rgba(255,45,120,0.35)]"
                  : "border-foreground/20 text-muted-foreground hover:border-magenta/50 hover:text-magenta"
              }`}
            >
              {auto ? <Pause className="w-3 h-3" aria-hidden="true" /> : <Play className="w-3 h-3" aria-hidden="true" />}
              AUTO DEMO {auto ? "ON" : "OFF"}
            </button>
          </div>

          {/* scenario log */}
          <div className="glass-inset px-3 py-2" aria-live="polite">
            <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">SCENARIO LOG — UTC</p>
            <div className="flex flex-col gap-1 min-h-[60px]">
              <AnimatePresence initial={false}>
                {log.map((e, i) => (
                  <motion.p
                    key={`${e.t}-${e.msg}-${i}`}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1 - i * 0.18, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`text-[7.5px] tracking-[0.08em] ${e.bad ? "text-danger" : "text-mint"}`}
                  >
                    <span className="text-muted-foreground mr-1.5 tabular-nums">{e.t}</span>
                    {e.msg}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* USE CASE CARDS */}
      <div className="grid md:grid-cols-3 gap-3">
        <UcCard icon={Layers} title="IMPROVE AVAILABILITY" tone="aws" delay={0}>
          Run the same workload across 2+ AZs. An AZ-level failure — power, flood, networking — never takes
          the application down because the other AZs keep serving.
        </UcCard>
        <UcCard icon={Activity} title="REDUCE DOWNTIME" tone="mint" delay={0.05}>
          Failures stay contained inside a single AZ. Traffic reroutes to healthy AZs in seconds — try the
          chaos controls above: uptime holds at 99.99%.
        </UcCard>
        <UcCard icon={Network} title="ISOLATED · FIBER-LINKED" tone="magenta" delay={0.1}>
          Every AZ has independent power, cooling and networking. AZs connect over redundant low-latency
          fiber, so cross-AZ replication stays in single-digit milliseconds.
        </UcCard>
      </div>
    </div>
  );
}
