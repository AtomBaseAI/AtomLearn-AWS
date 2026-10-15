"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { FullscreenToggle } from "@/components/shared/fullscreen-toggle";
import { UseCaseTabs, type UcTabDef } from "@/components/shared/use-case";
import { S3UseCases } from "./s3-usecases";
import { useImmersiveView } from "@/hooks/use-immersive";
import { S3Icon } from "@/components/aws-icons";
import { CloudUpload, Layers, Package, Snowflake, Archive, Copy, Boxes, Database, History, Globe, FileJson, Recycle } from "lucide-react";

/* ------------------------------------------------------------------ */
/* S3 — INFINITE VAULT: lifecycle + replication simulator               */
/* ------------------------------------------------------------------ */

type Tier = "STANDARD" | "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE";

interface S3Obj {
  id: number;
  key: string;
  ver: number;
  tier: Tier;
  age: number; // days since upload
}

const KEY_BASES = ["IMG", "VID", "LOG", "DOC", "BAK", "CFG", "ZIP", "PDF"];
const MAX_SHOW = 8;
const MAX_OBJECTS = 60;
const MAX_REPLICA = 30;

const TIER_ORDER: Tier[] = ["STANDARD", "STANDARD_IA", "GLACIER", "DEEP_ARCHIVE"];
const TIER_COST: Record<Tier, number> = {
  STANDARD: 0.023,
  STANDARD_IA: 0.0125,
  GLACIER: 0.004,
  DEEP_ARCHIVE: 0.00099,
};
const TIER_META: Record<Tier, { icon: React.ReactNode; cls: string; bar: string }> = {
  STANDARD: { icon: <Layers className="w-3 h-3" />, cls: "text-aws", bar: "bg-aws" },
  STANDARD_IA: { icon: <Package className="w-3 h-3" />, cls: "text-neon", bar: "bg-neon" },
  GLACIER: { icon: <Snowflake className="w-3 h-3" />, cls: "text-mint", bar: "bg-mint" },
  DEEP_ARCHIVE: { icon: <Archive className="w-3 h-3" />, cls: "text-magenta", bar: "bg-magenta" },
};

function randomKey(): string {
  const base = KEY_BASES[Math.floor(Math.random() * KEY_BASES.length)];
  return `${base}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

const TIER_Y: Record<Tier, number> = {
  STANDARD: 47,
  STANDARD_IA: 59.5,
  GLACIER: 72,
  DEEP_ARCHIVE: 84.5,
};

const S3_TABS = [
  { id: "GENERAL", label: "GENERAL", num: "01", icon: Boxes },
  { id: "DATA_LAKE", label: "DATA LAKE USE CASE", num: "02", icon: Database },
  { id: "VERSIONING", label: "VERSIONING", num: "03", icon: History },
  { id: "HOSTING", label: "STATIC HOSTING", num: "04", icon: Globe },
  { id: "POLICY", label: "BUCKET POLICY", num: "05", icon: FileJson },
  { id: "LIFECYCLE", label: "LIFECYCLE", num: "06", icon: Recycle },
] as const satisfies readonly UcTabDef[];

type S3TabId = (typeof S3_TABS)[number]["id"];

export default function S3Visualizer() {
  const immersive = useImmersiveView();
  const [tab, setTab] = useState<S3TabId>("GENERAL");
  const [objects, setObjects] = useState<S3Obj[]>([]);
  const [replica, setReplica] = useState<S3Obj[]>([]);
  const [days, setDays] = useState(0);
  const [versioning, setVersioning] = useState(true);
  const [replication, setReplication] = useState(true);
  const [running, setRunning] = useState(false);
  const [prodActive, setProdActive] = useState(false);
  const [replActive, setReplActive] = useState(false);
  const [overwriteFlash, setOverwriteFlash] = useState(false);
  const [tierFlash, setTierFlash] = useState<Tier | null>(null);

  // refs-as-truth: interval mutates refs, flush once per tick
  const idRef = useRef(1);
  const objectsRef = useRef<S3Obj[]>([]);
  const replicaRef = useRef<S3Obj[]>([]);
  const daysRef = useRef(0);
  const versioningRef = useRef(true);
  const replicationRef = useRef(true);

  const flush = useCallback(() => {
    setObjects([...objectsRef.current]);
    setReplica([...replicaRef.current]);
    setDays(daysRef.current);
  }, []);

  const flashTier = useCallback((t: Tier) => {
    setTierFlash(t);
    setTimeout(() => setTierFlash((cur) => (cur === t ? null : cur)), 700);
  }, []);

  const putObject = useCallback(() => {
    const reuse = objectsRef.current.length > 0 && Math.random() < 0.35;
    let created: S3Obj | null = null;
    let overwrote = false;
    if (reuse) {
      const target = objectsRef.current[Math.floor(Math.random() * objectsRef.current.length)];
      const sameKey = objectsRef.current.filter((o) => o.key === target.key);
      if (versioningRef.current) {
        created = {
          id: idRef.current++,
          key: target.key,
          ver: Math.max(...sameKey.map((o) => o.ver)) + 1,
          tier: "STANDARD",
          age: 0,
        };
        objectsRef.current = [...objectsRef.current, created];
      } else {
        // versioning suspended → same-key PUT silently overwrites, count does not grow
        const idx = objectsRef.current.findIndex((o) => o.key === target.key);
        created = { ...objectsRef.current[idx], id: idRef.current++, tier: "STANDARD", age: 0 };
        objectsRef.current = objectsRef.current.map((o, i) => (i === idx ? created ?? o : o));
        overwrote = true;
        setOverwriteFlash(true);
        setTimeout(() => setOverwriteFlash(false), 800);
      }
    } else {
      created = { id: idRef.current++, key: randomKey(), ver: 1, tier: "STANDARD", age: 0 };
      objectsRef.current = [...objectsRef.current, created];
    }
    if (!overwrote && created && replicationRef.current) {
      replicaRef.current = [...replicaRef.current, { ...created, id: idRef.current++ }].slice(-MAX_REPLICA);
      setReplActive(true);
      setTimeout(() => setReplActive(false), 800);
    }
    if (objectsRef.current.length > MAX_OBJECTS) {
      objectsRef.current = objectsRef.current.slice(-MAX_OBJECTS);
    }
    setProdActive(true);
    setTimeout(() => setProdActive(false), 500);
    flush();
  }, [flush]);

  const tick = useCallback(() => {
    daysRef.current += 30;
    // 1. PRODUCE — upstream apps PUT objects
    if (Math.random() < 0.7) {
      const n = Math.random() < 0.3 ? 2 : 1;
      for (let k = 0; k < n; k++) putObject();
    }
    // 2. LIFECYCLE — age every object, transition tiers per rule thresholds
    let next = objectsRef.current.map((o) => ({ ...o, age: o.age + 30 }));
    next = next.map((o) => {
      if (o.tier === "STANDARD" && o.age >= 90) {
        flashTier("STANDARD_IA");
        return { ...o, tier: "STANDARD_IA" as Tier };
      }
      if (o.tier === "STANDARD_IA" && o.age >= 180) {
        flashTier("GLACIER");
        return { ...o, tier: "GLACIER" as Tier };
      }
      if (o.tier === "GLACIER" && o.age >= 365) {
        flashTier("DEEP_ARCHIVE");
        return { ...o, tier: "DEEP_ARCHIVE" as Tier };
      }
      return o;
    });
    objectsRef.current = next;
    flush();
  }, [flush, putObject, flashTier]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(tick, 900);
    return () => clearInterval(timer);
  }, [running, tick]);

  const reset = () => {
    setRunning(false);
    objectsRef.current = [];
    replicaRef.current = [];
    daysRef.current = 0;
    setProdActive(false);
    setReplActive(false);
    setOverwriteFlash(false);
    setTierFlash(null);
    flush();
  };

  const toggleVersioning = () => {
    setVersioning((v) => {
      versioningRef.current = !v;
      return !v;
    });
  };

  const toggleReplication = () => {
    setReplication((v) => {
      replicationRef.current = !v;
      return !v;
    });
  };

  const totalCost = objects.reduce((s, o) => s + TIER_COST[o.tier], 0);
  const avgCost = objects.length ? totalCost / objects.length : 0;
  const shown = objects.slice(-MAX_SHOW);

  return (
    <div
      className={
        immersive.active
          ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll"
          : "flex flex-col gap-4"
      }
    >
      {/* MODULE TABS — sits directly below the module title card */}
      <UseCaseTabs tabs={S3_TABS} active={tab} onChange={(t) => setTab(t as S3TabId)} label="S3 views" />

      {tab !== "GENERAL" && (
        <S3UseCases id={tab} immersiveActive={immersive.active} immersiveToggle={immersive.toggle} />
      )}

      {tab === "GENERAL" && (
        <>
      {/* MAIN GRID — animation left, rail right */}
      <div className={`grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start ${immersive.active ? "flex-1" : ""}`}>
        <GlassPanel
          title="FLOW VIEW // OBJECT LIFECYCLE"
          subtitle="UPLOADS → TIERING → CROSS-REGION REPLICATION"
          className="!p-0 overflow-hidden"
          delay={0.05}
          actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
        >
          <FlowCanvas
            className={immersive.active ? "h-[min(560px,58vh)]" : "h-[440px] sm:h-[540px] lg:h-[560px]"}
            ariaLabel="S3 lifecycle and replication flow diagram"
          >
            {/* LINKS */}
            <FlowLink d="M14,11 C22,11 24,15 29,19" status={prodActive ? "flowing" : "idle"} dotDuration={1.2} />
            <FlowLink d="M50,21 C62,21 63,21 74,21" dashed status={replActive ? "flowing" : "idle"} dotDuration={1.4} />
            <FlowLink d="M27,42.8 L17.9,42.8 Q17,42.8 17,43.7 L17,45.2" status={prodActive ? "flowing" : "idle"} dotDuration={1.6} dotDelay={0.3} strokeWidth={1.4} showArrow />
            <FlowLink d="M17,51 L7.1,51 Q6,51 6,52.1 L6,54.3 Q6,55.5 7.2,55.5 L15.8,55.5 Q17,55.5 17,56.7 L17,57.4" status={tierFlash === "STANDARD_IA" ? "flowing" : "idle"} dotDuration={0.9} strokeWidth={1.4} showArrow />
            <FlowLink d="M17,63.5 L7.1,63.5 Q6,63.5 6,64.6 L6,66.8 Q6,68 7.2,68 L15.8,68 Q17,68 17,69.2 L17,69.9" status={tierFlash === "GLACIER" ? "flowing" : "idle"} dotDuration={0.9} strokeWidth={1.4} showArrow />
            <FlowLink d="M17,76 L7.1,76 Q6,76 6,77.1 L6,79.3 Q6,80.5 7.2,80.5 L15.8,80.5 Q17,80.5 17,81.7 L17,82.4" status={tierFlash === "DEEP_ARCHIVE" ? "flowing" : "idle"} dotDuration={0.9} strokeWidth={1.4} showArrow />

            {/* UPLOADS PRODUCER */}
            <FlowNode
              x={10}
              y={9}
              icon={<CloudUpload className="w-3 h-3" />}
              label="UPLOADS"
              sub="S3 PUT / COPY"
              status={prodActive ? "active" : "idle"}
              pulse={prodActive}
              onClick={putObject}
              size="sm"
              delay={0.1}
            />

            {/* PRIMARY BUCKET */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: "39%", top: "21%" }}
            >
              <div className="glass box-glow cyber-cut p-2 w-[186px] sm:w-[210px]">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                    <S3Icon className="w-3 h-3" /> BUCKET
                  </span>
                  <motion.span
                    key={objects.length}
                    initial={{ scale: 1.4, color: "#00ffa3" }}
                    animate={{ scale: 1, color: "#ff9900" }}
                    className="text-[10px] font-extrabold"
                  >
                    {objects.length}
                  </motion.span>
                </div>
                <div className="flex flex-col gap-[2px] min-h-[100px] border-t border-aws/15 pt-1.5">
                  <AnimatePresence initial={false}>
                    {shown.map((o) => (
                      <motion.div
                        key={o.id}
                        layout
                        initial={{ opacity: 0, x: -18, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className={`h-[10px] flex items-center px-1 text-[6px] font-bold tracking-wider border ${TIER_META[o.tier].cls}`}
                      >
                        <span className="border-current/40 bg-current/10 border w-full h-full flex items-center px-1 justify-between">
                          <span>{o.key}</span>
                          <span>v{o.ver}</span>
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {objects.length === 0 && (
                    <span className="text-[6.5px] text-muted-foreground/60 px-1 uppercase tracking-wider">EMPTY — AWAITING PUT…</span>
                  )}
                </div>
                {objects.length > MAX_SHOW && (
                  <div className="px-1 pt-1 text-[6.5px] text-muted-foreground">+{objects.length - MAX_SHOW} MORE OBJECTS IN BUCKET</div>
                )}
                <div className="border-t border-aws/15 mt-1 pt-1 px-1 flex items-center justify-between">
                  <span className="text-[6px] uppercase tracking-wider text-muted-foreground">
                    VERSIONING {versioning ? "ENABLED" : "SUSPENDED"}
                  </span>
                  <span className={`text-[6px] uppercase tracking-wider font-bold ${avgCost <= 0.008 ? "text-mint" : "text-aws"}`}>
                    ${avgCost.toFixed(4)}/GB
                  </span>
                </div>
                <AnimatePresence>
                  {overwriteFlash && (
                    <motion.span
                      initial={{ opacity: 0, scale: 1.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-extrabold uppercase tracking-[0.3em] text-danger"
                    >
                      OVERWRITE
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* REPLICA BUCKET */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: "84%", top: "21%" }}
            >
              <div className="glass cyber-cut p-2 w-[118px]">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <span className="text-[7.5px] font-bold uppercase tracking-[0.12em] text-magenta">REPLICA</span>
                  <motion.span
                    key={replica.length}
                    initial={{ scale: 1.4, color: "#00ffa3" }}
                    animate={{ scale: 1, color: "#ff2d78" }}
                    className="text-[10px] font-extrabold"
                  >
                    {replica.length}
                  </motion.span>
                </div>
                <div className="flex flex-col gap-[3px] border-t border-magenta/20 pt-1.5 min-h-[46px]">
                  <AnimatePresence initial={false}>
                    {replica.slice(-3).map((o) => (
                      <motion.div
                        key={o.id}
                        layout
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className={`h-[11px] flex items-center px-1 text-[6px] font-bold tracking-wider border ${TIER_META[o.tier].cls}`}
                      >
                        <span className="border-current/40 bg-current/10 border w-full h-full flex items-center px-1 justify-between">
                          <span>{o.key}</span>
                          <span>v{o.ver}</span>
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {replica.length === 0 && (
                    <span className="text-[6px] text-muted-foreground/60 px-1 uppercase tracking-wider">NO REPLICAS YET</span>
                  )}
                </div>
                <div className="border-t border-magenta/20 mt-1 pt-1 px-1">
                  <span className="text-[6px] uppercase tracking-wider text-muted-foreground">CRR {replication ? "ACTIVE" : "PAUSED"}</span>
                </div>
              </div>
            </motion.div>

            <FlowLabel x={62} y={12.5} tone="magenta">CROSS-REGION REPLICATION</FlowLabel>

            {/* LIFECYCLE TIER STACK */}
            <FlowLabel x={23.5} y={39.5} tone="aws">STORAGE CLASS LIFECYCLE</FlowLabel>
            {TIER_ORDER.map((t, idx) => {
              const inTier = objects.filter((o) => o.tier === t);
              const meta = TIER_META[t];
              return (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{ left: "23.5%", top: `${TIER_Y[t]}%` }}
                >
                  <div
                    className={`glass-inset cyber-cut-sm px-2 h-[28px] w-[160px] sm:w-[190px] flex items-center gap-1.5 ${
                      tierFlash === t ? "box-glow border border-mint/60" : ""
                    }`}
                  >
                    <span className={meta.cls}>{meta.icon}</span>
                    <span className="flex flex-col leading-none min-w-0">
                      <span className={`text-[7px] font-bold tracking-wider ${meta.cls}`}>{t}</span>
                      <span className="text-[6px] text-muted-foreground tracking-wider">${TIER_COST[t].toFixed(5)}/GB</span>
                    </span>
                    <span className="ml-auto flex items-center gap-1 min-w-0">
                      {inTier.slice(-2).map((o) => (
                        <motion.span
                          key={o.id}
                          layout
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`text-[6px] font-bold border border-current/40 px-0.5 ${meta.cls}`}
                        >
                          {o.key.slice(0, 7)}
                        </motion.span>
                      ))}
                      <span className={`text-[8px] font-extrabold ${meta.cls}`}>{inTier.length}</span>
                    </span>
                  </div>
                </motion.div>
              );
            })}
            <FlowLabel x={37} y={52.5} tone="default">{"≥ 90 DAYS"}</FlowLabel>
            <FlowLabel x={37} y={65} tone="default">{"≥ 180 DAYS"}</FlowLabel>
            <FlowLabel x={37} y={77.5} tone="default">{"≥ 365 DAYS"}</FlowLabel>

            {/* STORAGE CLASS PRICING — in-canvas HUD card (bottom-right empty quadrant) */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-[6] pointer-events-none"
              style={{ left: "73.5%", top: "55%" }}
            >
              <div className="glass-inset cyber-cut-sm p-2 sm:p-2.5 w-[170px] sm:w-[224px]">
                <p className="text-[7.5px] sm:text-[9px] font-bold uppercase tracking-[0.14em] text-aws leading-tight">
                  STORAGE CLASS PRICING
                  <span className="block text-[6.5px] sm:text-[8px] text-muted-foreground tracking-[0.18em] mt-0.5">{"// $ PER GB-MONTH"}</span>
                </p>
                <div className="mt-1.5 sm:mt-2 flex flex-col gap-1 sm:gap-1.5">
                  {TIER_ORDER.map((t) => (
                    <div key={t} className="flex items-center gap-1.5 sm:gap-2">
                      <span className={`text-[8px] sm:text-[9px] font-bold w-[64px] sm:w-[84px] shrink-0 tracking-wider ${TIER_META[t].cls}`}>{t}</span>
                      <div className="flex-1 h-2 sm:h-2.5 bg-black/50 border border-foreground/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(TIER_COST[t] / TIER_COST.STANDARD) * 100}%` }}
                          transition={{ duration: 1, delay: 1 }}
                          className={`h-full ${TIER_META[t].bar} opacity-80`}
                        />
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-extrabold text-foreground/80 w-[40px] sm:w-[52px] text-right tabular-nums">
                        ${TIER_COST[t].toFixed(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </FlowCanvas>
        </GlassPanel>

        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip label="OBJECTS" value={String(objects.length)} />
              <StatChip label="DAYS ELAPSED" value={String(days)} tone="neutral" />
              <StatChip label="REPLICA OBJECTS" value={String(replica.length)} tone="magenta" />
              <StatChip label="EST $/GB-MO" value={`$${avgCost.toFixed(4)}`} tone={avgCost <= 0.008 && objects.length > 0 ? "mint" : "aws"} />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={() => setRunning((r) => !r)}
                onReset={reset}
                status={running ? `BUCKET ONLINE — DAY ${days} — OBJECTS FLOWING` : "VAULT IDLE — PRESS RUN"}
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">BUCKET CONFIG</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleVersioning}
                  aria-label="Toggle S3 bucket versioning"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                    versioning ? "border-mint/60 text-mint" : "border-danger/60 text-danger"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  VERSIONING {versioning ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={toggleReplication}
                  aria-label="Toggle cross-region replication"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                    replication ? "border-magenta/60 text-magenta" : "border-foreground/25 text-muted-foreground"
                  }`}
                >
                  <Copy className="w-3 h-3" />
                  REPLICATION {replication ? "ON" : "OFF"}
                </button>
              </div>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">OBJECT ACTIONS</p>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={putObject}
                  aria-label="Manually upload an object to the bucket"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border border-aws/60 text-aws bg-black/50 backdrop-blur-md cyber-cut-sm hover:bg-aws/10"
                >
                  <CloudUpload className="w-3 h-3" />
                  PUT OBJECT
                </motion.button>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="RECENT OBJECTS" className="!p-0" delay={0.15}>
            <div className="p-3">
              <div className="glass-inset p-2.5 max-h-40 overflow-y-auto cyber-scroll flex flex-col gap-1">
                {objects.slice(-8).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-1.5 border border-foreground/10 bg-black/30 px-1.5 py-1 text-[7.5px] font-bold tracking-wider"
                  >
                    <span className={`w-1.5 h-1.5 shrink-0 ${TIER_META[o.tier].bar}`} aria-hidden="true" />
                    <span className="truncate text-foreground/85">{o.key}</span>
                    <span className="text-muted-foreground">v{o.ver}</span>
                    <span className={`ml-auto text-[6.5px] ${TIER_META[o.tier].cls}`}>{o.tier}</span>
                  </div>
                ))}
                {objects.length === 0 && (
                  <p className="text-[7.5px] uppercase tracking-wider text-muted-foreground">NO OBJECTS — PRESS PUT OBJECT</p>
                )}
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* KNOWLEDGE — hidden in immersive fullscreen (essential data only) */}
      <div className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}>
        <Callout type="info" title="11 nines of durability">
          S3 stores every object redundantly across <span className="text-aws">≥ 3 Availability Zones</span>, delivering
          99.999999999% (11 nines) durability — you would need to lose 10,000,000 objects for 10,000 years to expect a
          single loss. Standard tier carries a 99.99% availability SLA.
        </Callout>
        <Callout type="exam" title="Bucket names are globally unique">
          A bucket name is unique across <span className="text-magenta">all AWS accounts worldwide</span>, not just yours:
          3-63 chars, lowercase a-z / 0-9 / hyphens, no underscores, must not look like an IP. Choose names you will not
          regret — rename means re-upload everything.
        </Callout>
        <Callout type="tip" title="Lifecycle policies are free money">
          Rules that transition cold data STANDARD → GLACIER / DEEP_ARCHIVE cut storage cost{" "}
          <span className="text-mint">~83% to ~96%</span>. Balance it against retrieval fees and minimum storage durations
          (e.g. 90 days for Glacier, 180 for Deep Archive) before moving hot data down.
        </Callout>
      </div>
        </>
      )}
    </div>
  );
}
