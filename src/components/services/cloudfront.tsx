"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { AutoLog, logTs } from "@/components/shared/auto-log";
import { FullscreenToggle } from "@/components/shared/fullscreen-toggle";
import { UseCaseTabs, type UcTabDef } from "@/components/shared/use-case";
import { CfUseCases } from "./cloudfront-usecases";
import { useImmersiveView } from "@/hooks/use-immersive";
import { StatChip } from "@/components/shared/typography";
import { CloudFrontIcon, S3Icon, UserIcon } from "@/components/aws-icons";
import { KeyRound, MapPin, PlayCircle, Timer, Trash2, Zap } from "lucide-react";

type LogTone = "aws" | "mint" | "danger" | "magenta" | "dim";
type Phase = "idle" | "in" | "fetchOut" | "fetchBack" | "out";

interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
}

interface EdgeState {
  phase: Phase;
  reqId: number;
  age: number;
  gauge: number; // 0..100
  fillTick: number;
  hits: number;
  misses: number;
}

const USER_NAMES = ["USER-MUMBAI", "USER-FRANKFURT", "USER-TOKYO"] as const;
const EDGE_NAMES = ["EDGE-BOM", "EDGE-FRA", "EDGE-NRT"] as const;
const USER_YS = [16, 50, 84];
const PATHS = ["/assets/app.js", "/img/hero.jpg", "/api/data.json"] as const;

const CF_TABS = [
  { id: "GENERAL", label: "GENERAL", num: "01", icon: Zap },
  { id: "GLOBAL_EDGE", label: "GLOBAL EDGE ACCEL", num: "02", icon: MapPin },
  { id: "STREAMING", label: "MEDIA STREAMING", num: "03", icon: PlayCircle },
  { id: "SIGNED_URLS", label: "SIGNED URLS", num: "04", icon: KeyRound },
] as const satisfies readonly UcTabDef[];

type CfTabId = (typeof CF_TABS)[number]["id"];

const IN_D = ["M13,16 C20,16 24,16 33,16", "M13,50 C20,50 24,50 33,50", "M13,84 C20,84 24,84 33,84"];
const OUT_D = [
  "M33,18.5 C24,18.5 20,18.5 13,18.5",
  "M33,52.5 C24,52.5 20,52.5 13,52.5",
  "M33,86.5 C24,86.5 20,86.5 13,86.5",
];
const TO_ORIGIN_D = [
  "M51,17 C62,17 68,50 76,50",
  "M51,50 C62,50 68,50 76,50",
  "M51,83 C62,83 68,50 76,50",
];
const FROM_ORIGIN_D = [
  "M76,52 C68,52 62,19.5 51,19.5",
  "M76,52 C68,52 62,52.5 51,52.5",
  "M76,52 C68,52 62,85.5 51,85.5",
];

const PHASE_TICKS: Record<Exclude<Phase, "idle">, number> = { in: 2, fetchOut: 3, fetchBack: 3, out: 2 };
const TICK_MS = 300;

const MAX_LOG = 50;

const makeEdge = (): EdgeState => ({ phase: "idle", reqId: 0, age: 0, gauge: 0, fillTick: 0, hits: 0, misses: 0 });
const computeExpiryTicks = (ttl: number) => Math.min(72, Math.max(10, Math.round(ttl / 50)));

function EdgeNode({
  name,
  x,
  y,
  gauge,
  hits,
  misses,
  phase,
  delay,
}: {
  name: string;
  x: number;
  y: number;
  gauge: number;
  hits: number;
  misses: number;
  phase: Phase;
  delay: number;
}) {
  const fetching = phase === "fetchOut" || phase === "fetchBack";
  const active = phase !== "idle";
  const border = fetching
    ? "border-danger/70"
    : active
      ? "border-mint/70"
      : "border-foreground/25";
  const glow = fetching
    ? "shadow-[0_0_16px_rgba(255,51,85,0.3)]"
    : active
      ? "shadow-[0_0_16px_rgba(0,255,163,0.3)]"
      : "";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className={`glass cyber-cut-sm px-2 py-1.5 w-[112px] ${border} ${glow}`}>
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-block w-2 h-2 rotate-45 border shrink-0 ${
              active
                ? fetching
                  ? "border-danger bg-danger/60 shadow-[0_0_8px_rgba(255,51,85,0.9)]"
                  : "border-mint bg-mint/60 shadow-[0_0_8px_rgba(0,255,163,0.9)]"
                : "border-foreground/50"
            }`}
          />
          <span className={`text-[8px] font-bold tracking-[0.14em] ${active ? "text-mint" : "text-foreground/80"}`}>
            {name}
          </span>
        </div>
        <div className="mt-1 h-1 w-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-mint"
            animate={{ width: `${gauge}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[6.5px] font-bold tracking-wider">
          <span className="text-mint">HIT {hits}</span>
          <span className="text-danger">MISS {misses}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function CloudFrontVisualizer() {
  const immersive = useImmersiveView();
  const [tab, setTab] = useState<CfTabId>("GENERAL");
  const [running, setRunning] = useState(false);
  const [ttl, setTtl] = useState(600);

  const [edges, setEdges] = useState<EdgeState[]>([makeEdge(), makeEdge(), makeEdge()]);
  const [originFetches, setOriginFetches] = useState(0);
  const [avgHit, setAvgHit] = useState<number | null>(null);
  const [avgMiss, setAvgMiss] = useState<number | null>(null);
  const [originFlash, setOriginFlash] = useState(false);
  const [purging, setPurging] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);

  // refs as source of truth
  const edgesRef = useRef<EdgeState[]>([makeEdge(), makeEdge(), makeEdge()]);
  const tickRef = useRef(0);
  const reqIdRef = useRef(1);
  const rotRef = useRef(0);
  const sumHitRef = useRef(0);
  const hitCntRef = useRef(0);
  const sumMissRef = useRef(0);
  const missCntRef = useRef(0);
  const originFetchRef = useRef(0);
  const ttlRef = useRef(600);
  const expiryTicksRef = useRef(computeExpiryTicks(600));
  const logRef = useRef<LogLine[]>([]);
  const logIdRef = useRef(1);

  const pushLog = useCallback((text: string, tone: LogTone = "aws") => {
    logRef.current = [...logRef.current, { id: logIdRef.current++, text: `[${logTs()}] ${text}`, tone }].slice(-MAX_LOG);
  }, []);

  const flush = useCallback(() => {
    setEdges(edgesRef.current.map((e) => ({ ...e })));
    setOriginFetches(originFetchRef.current);
    setLog(logRef.current);
    setAvgHit(hitCntRef.current > 0 ? Math.round(sumHitRef.current / hitCntRef.current) : null);
    setAvgMiss(missCntRef.current > 0 ? Math.round(sumMissRef.current / missCntRef.current) : null);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const tick = ++tickRef.current;

      // 1. TTL EXPIRY — object at each edge goes stale after ttl (compressed sim: ttl/50 ticks)
      edgesRef.current.forEach((e, i) => {
        if (e.gauge > 0 && tick - e.fillTick >= expiryTicksRef.current) {
          e.gauge = 0;
          pushLog(`> TTL ${ttlRef.current}s expired — object evicted @ ${EDGE_NAMES[i]}`, "dim");
        }
      });

      // 2. SPAWN — alternate users every ~900ms, one request per edge at a time
      if (tick % 3 === 0) {
        const u = rotRef.current % 3;
        rotRef.current++;
        const e = edgesRef.current[u];
        if (e.phase === "idle") {
          e.phase = "in";
          e.age = 0;
          e.reqId = ++reqIdRef.current;
          pushLog(
            `> GET ${PATHS[Math.floor(Math.random() * PATHS.length)]} — ${USER_NAMES[u]} → ${EDGE_NAMES[u]}`,
            "aws"
          );
        }
      }

      // 3. ADVANCE PHASES — race HIT (short mint path) vs MISS (long origin round-trip)
      edgesRef.current.forEach((e, i) => {
        if (e.phase === "idle") return;
        e.age++;
        if (e.age < PHASE_TICKS[e.phase]) return;
        if (e.phase === "in") {
          // resolve the cache roll
          if (e.gauge > 0) {
            const lat = 9 + Math.floor(Math.random() * 6);
            e.hits++;
            hitCntRef.current++;
            sumHitRef.current += lat;
            pushLog(`  ✓ HIT ${lat}ms — served @ ${EDGE_NAMES[i]}`, "mint");
            e.phase = "out";
          } else {
            const lat = 120 + Math.floor(Math.random() * 121);
            e.misses++;
            missCntRef.current++;
            sumMissRef.current += lat;
            originFetchRef.current++;
            pushLog("  ✗ MISS — routing to origin", "danger");
            e.phase = "fetchOut";
          }
          e.age = 0;
        } else if (e.phase === "fetchOut") {
          e.phase = "fetchBack";
          e.age = 0;
          pushLog(`  « s3://app-bucket 200 OK — ${120 + Math.floor(Math.random() * 900)}KB streaming`, "aws");
          setOriginFlash(true);
          setTimeout(() => setOriginFlash(false), 700);
        } else if (e.phase === "fetchBack") {
          e.gauge = 100;
          e.fillTick = tick;
          pushLog(`  » object cached @ ${EDGE_NAMES[i]} — TTL ${ttlRef.current}s`, "mint");
          e.phase = "out";
          e.age = 0;
        } else if (e.phase === "out") {
          e.phase = "idle";
        }
      });

      flush();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, pushLog, flush]);

  const reset = () => {
    setRunning(false);
    edgesRef.current = [makeEdge(), makeEdge(), makeEdge()];
    tickRef.current = 0;
    reqIdRef.current = 1;
    rotRef.current = 0;
    sumHitRef.current = 0;
    hitCntRef.current = 0;
    sumMissRef.current = 0;
    missCntRef.current = 0;
    originFetchRef.current = 0;
    logRef.current = [];
    setEdges([makeEdge(), makeEdge(), makeEdge()]);
    setOriginFetches(0);
    setAvgHit(null);
    setAvgMiss(null);
    setOriginFlash(false);
    setPurging(false);
    setLog([]);
  };

  const invalidate = () => {
    const invId = `I-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    edgesRef.current.forEach((e) => {
      e.gauge = 0;
      e.fillTick = tickRef.current;
    });
    pushLog(`> invalidation ${invId} completed: /* — 3 edge locations purged`, "magenta");
    setPurging(true);
    setTimeout(() => setPurging(false), 1000);
    flush();
  };

  const changeTtl = (v: number) => {
    ttlRef.current = v;
    expiryTicksRef.current = computeExpiryTicks(v);
    setTtl(v);
  };

  const totalHits = edges.reduce((a, e) => a + e.hits, 0);
  const totalMiss = edges.reduce((a, e) => a + e.misses, 0);
  const totalReq = totalHits + totalMiss;
  const ratio = totalReq > 0 ? `${Math.round((totalHits / totalReq) * 100)}%` : "—";
  const avgHitTxt = avgHit === null ? "—" : `${avgHit}ms`;
  const avgMissTxt = avgMiss === null ? "—" : `${avgMiss}ms`;
  const hitBarPct = avgHit !== null && avgMiss !== null && avgMiss > 0 ? Math.max(4, Math.round((avgHit / avgMiss) * 100)) : 0;
  const anyFetching = edges.some((e) => e.phase === "fetchOut" || e.phase === "fetchBack");
  const fmtTtl = (v: number) => (v >= 60 ? `${Math.round(v / 60)}m` : `${v}s`);

  return (
    <div
      className={
        immersive.active
          ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll"
          : "flex flex-col gap-4"
      }
    >
      {/* MODULE TABS — sits directly below the module title card */}
      <UseCaseTabs tabs={CF_TABS} active={tab} onChange={(t) => setTab(t as CfTabId)} label="CloudFront views" />

      {tab !== "GENERAL" && (
        <CfUseCases id={tab} immersiveActive={immersive.active} immersiveToggle={immersive.toggle} />
      )}

      {tab === "GENERAL" && (
        <>
      {/* MAIN GRID — flow view left, stats + controls + readout rail right */}
      <div className={`grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start ${immersive.active ? "flex-1" : ""}`}>
        <GlassPanel
          title="FLOW VIEW // EDGE CACHE RACE"
          subtitle="3 USERS → 600+ POP EDGES → S3 ORIGIN — HIT VS MISS"
          className="!p-0 overflow-hidden"
          delay={0.05}
          actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
        >
          <FlowCanvas
            className={immersive.active ? "h-[min(560px,58vh)]" : "h-[440px] sm:h-[540px] lg:h-[560px]"}
            ariaLabel="CloudFront edge cache hit versus miss race"
          >
            {/* HEADER CHIP */}
            <div className="absolute left-3 top-2.5 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 backdrop-blur-sm px-2 py-1">
              <CloudFrontIcon className="w-3 h-3 text-aws" />
              <span className="text-[7px] font-bold tracking-[0.2em] text-aws">CLOUDFRONT · E12345ABC</span>
              <span className="text-[7px] text-muted-foreground">TTL {fmtTtl(ttl)}</span>
            </div>

            {/* USER → EDGE LINKS (forward + response) */}
            {IN_D.map((d, i) => (
              <FlowLink
                key={`in-base-${i}`}
                d={d}
                status={edges[i].phase === "in" ? "flowing" : "idle"}
                dotDuration={0.6}
              />
            ))}
            {OUT_D.map((d, i) =>
              edges[i].phase === "out" ? (
                <FlowLink
                  key={`out-${edges[i].reqId}`}
                  d={d}
                  status="success"
                  dotDuration={0.6}
                />
              ) : null
            )}

            {/* EDGE ↔ ORIGIN LINKS */}
            {TO_ORIGIN_D.map((d, i) =>
              edges[i].phase === "fetchOut" ? (
                <FlowLink
                  key={`fo-${edges[i].reqId}`}
                  d={d}
                  status="error"
                  dotDuration={0.9}
                />
              ) : null
            )}
            {FROM_ORIGIN_D.map((d, i) =>
              edges[i].phase === "fetchBack" ? (
                <FlowLink
                  key={`fb-${edges[i].reqId}`}
                  d={d}
                  status="flowing"
                  dotDuration={0.9}
                />
              ) : null
            )}

            {/* USERS */}
            {USER_NAMES.map((name, i) => (
              <FlowNode
                key={name}
                x={8}
                y={USER_YS[i]}
                icon={<UserIcon className="w-3 h-3" />}
                label={name}
                sub="HTTPS/3"
                status={edges[i].phase === "in" || edges[i].phase === "out" ? "active" : "idle"}
                pulse={edges[i].phase === "in"}
                size="sm"
                delay={0.1 + i * 0.1}
              />
            ))}
            <FlowLabel x={22} y={9} tone="default">REQ</FlowLabel>
            <FlowLabel x={22} y={43} tone="default">REQ</FlowLabel>
            <FlowLabel x={22} y={77} tone="default">REQ</FlowLabel>

            {/* EDGE LOCATIONS */}
            {EDGE_NAMES.map((name, i) => (
              <EdgeNode
                key={name}
                name={name}
                x={42}
                y={USER_YS[i]}
                gauge={edges[i].gauge}
                hits={edges[i].hits}
                misses={edges[i].misses}
                phase={edges[i].phase}
                delay={0.3 + i * 0.1}
              />
            ))}
            <FlowLabel x={42} y={3} tone="aws">EDGE CACHE GAUGES</FlowLabel>

            {/* ORIGIN */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: "86%", top: "50%", width: "128px" }}
            >
              <div className={`glass cyber-cut p-2 ${originFlash ? "box-glow" : ""}`}>
                <div className="flex items-center gap-1.5 border-b border-aws/15 pb-1.5">
                  <S3Icon className="w-3.5 h-3.5 text-aws shrink-0" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[8px] font-bold tracking-[0.14em] text-aws">ORIGIN</span>
                    <span className="text-[6.5px] text-muted-foreground tracking-wider mt-0.5">s3://app-bucket</span>
                  </div>
                </div>
                <div className="pt-1.5 flex items-center justify-between">
                  <span className="text-[6.5px] uppercase tracking-wider text-muted-foreground">FETCHES</span>
                  <motion.span
                    key={originFetches}
                    initial={{ scale: 1.5, color: "#ff3355" }}
                    animate={{ scale: 1, color: "#ff9900" }}
                    className="text-[11px] font-extrabold"
                  >
                    {originFetches}
                  </motion.span>
                </div>
              </div>
            </motion.div>

            {/* CONDITIONAL LABELS */}
            <AnimatePresence>
              {anyFetching && (
                <motion.div
                  key="fetch"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute z-20"
                  style={{ left: "65%", top: "38%" }}
                >
                  <FlowLabel x={0} y={0} tone="danger">ORIGIN FETCH ~180ms</FlowLabel>
                </motion.div>
              )}
              {purging && (
                <motion.div
                  key="purge"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute z-20"
                  style={{ left: "65%", top: "62%" }}
                >
                  <FlowLabel x={0} y={0} tone="magenta">INVALIDATION WAVE</FlowLabel>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MAGENTA PURGE WAVE */}
            <AnimatePresence>
              {purging && (
                <motion.div
                  key="wave"
                  aria-hidden="true"
                  initial={{ x: "-40%" }}
                  animate={{ x: "160%" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                  className="absolute inset-y-0 w-1/4 z-20 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,45,120,0.35), rgba(255,45,120,0.12), transparent)",
                  }}
                />
              )}
            </AnimatePresence>
          </FlowCanvas>
        </GlassPanel>

        {/* RIGHT RAIL — LIVE STATS + CONTROLS + LATENCY READOUT */}
        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip label="CACHE HIT RATIO" value={ratio} tone="mint" />
              <StatChip label="AVG HIT" value={avgHitTxt} tone="mint" />
              <StatChip label="AVG MISS" value={avgMissTxt} tone="magenta" />
              <StatChip label="ORIGIN FETCHES" value={String(originFetches)} tone="aws" />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={() => setRunning((r) => !r)}
                onReset={reset}
                status={running ? "EDGE RACE LIVE — HIT vs MISS" : "EDGE IDLE — PRESS RUN"}
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">EDGE CACHE TTL</p>
              <div className="flex items-center gap-2 px-2 py-1 border border-foreground/25 bg-black/50 backdrop-blur-md cyber-cut-sm">
                <Timer className="w-3 h-3 text-muted-foreground shrink-0" />
                <input
                  type="range"
                  min={60}
                  max={3600}
                  step={60}
                  value={ttl}
                  onChange={(e) => changeTtl(Number(e.target.value))}
                  aria-label="Object TTL seconds at edge"
                  className="w-full h-1 cursor-pointer"
                  style={{ accentColor: "#ff9900" }}
                />
                <span className="text-[8px] font-bold text-aws tracking-wider whitespace-nowrap">
                  TTL {fmtTtl(ttl)}
                </span>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={invalidate}
                aria-label="Invalidate all edge caches"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border border-magenta/60 text-magenta bg-black/50 backdrop-blur-md cyber-cut-sm hover:bg-magenta/10"
              >
                <Trash2 className="w-3 h-3" />
                INVALIDATION /*
              </motion.button>
              <p className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold">
                LOWER TTL → OBJECTS EXPIRE SOONER → MORE MISS ROUND-TRIPS TO S3
              </p>
            </div>
          </GlassPanel>

          <GlassPanel title="LATENCY READOUT" className="!p-0" delay={0.15}>
            <div className="p-3 flex flex-col gap-3">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  AVG HIT LATENCY
                </p>
                <motion.span
                  key={`hit-${avgHitTxt}`}
                  initial={{ scale: 1.35, opacity: 0.4 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="text-2xl font-extrabold text-mint tracking-wider"
                >
                  {avgHitTxt}
                </motion.span>
                <div className="h-2 w-full bg-white/10 mt-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-mint shadow-[0_0_10px_rgba(0,255,163,0.6)]"
                    animate={{ width: `${hitBarPct}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 20 }}
                  />
                </div>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  AVG MISS LATENCY
                </p>
                <motion.span
                  key={`miss-${avgMissTxt}`}
                  initial={{ scale: 1.35, opacity: 0.4 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="text-2xl font-extrabold text-danger tracking-wider"
                >
                  {avgMissTxt}
                </motion.span>
                <div className="h-2 w-full bg-white/10 mt-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-danger shadow-[0_0_10px_rgba(255,51,85,0.6)]"
                    animate={{ width: "100%" }}
                    transition={{ type: "spring", stiffness: 80, damping: 20 }}
                  />
                </div>
              </div>
              <p className="text-[7px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-relaxed">
                THE RACE: {avgHitTxt} FROM EDGE CACHE vs {avgMissTxt} ROUND-TRIP TO S3 —{" "}
                {avgHit !== null && avgMiss !== null ? `${Math.round((avgMiss / avgHit) * 10) / 10}× SLOWER` : "ROLLING…"}
              </p>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* EDGE LOG — full width below the grid */}
      <GlassPanel title="EDGE LOG" className="!p-0" delay={0.18}>
        <div className="p-3">
          <AutoLog lines={log} emptyText="NO REQUESTS YET — PRESS RUN TO START THE RACE" />
        </div>
      </GlassPanel>

      {/* KNOWLEDGE */}
      <div className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}>
        <Callout type="tip" title="600+ edge PoPs serve content in ~10ms">
          CloudFront answers from 600+ Points of Presence spread across 90+ cities worldwide. Objects
          cached at the nearest PoP are served in single-digit-to-low-teens milliseconds — versus a
          multi-hundred-ms round-trip to origin on a miss, exactly the race simulated above.
        </Callout>
        <Callout type="exam" title="Cache keys + invalidation pricing">
          The default cache key is the URL path plus query string plus any headers/cookies you include —
          everything else is stripped. Changing the key changes your hit ratio. The first 1,000
          invalidation paths each month are free, then $0.005 per path — prefer versioned filenames
          (<span className="text-mint">app.v2.js</span>) over invalidations.
        </Callout>
        <Callout type="info" title="HTTP/3, Brotli compression, OAC for S3">
          CloudFront negotiates HTTP/3 (QUIC) with modern clients and auto-compresses text assets with
          Brotli and gzip. Origin Access Control (OAC) signs requests to <span className="text-aws">s3://</span>{" "}
          origins with SigV4 — the bucket can stay fully private, reachable only by the distribution.
        </Callout>
      </div>
        </>
      )}
    </div>
  );
}
