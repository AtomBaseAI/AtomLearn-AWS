"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { EC2Icon, RDSIcon, RDSInstanceIcon, RDSProxyIcon } from "@/components/aws-icons";
import { Layers, Gauge, Zap, ZapOff, Power } from "lucide-react";

type LogTone = "aws" | "mint" | "danger" | "magenta" | "neon" | "dim";
type FailoverPhase = "none" | "down" | "promoting" | "rebuilding";

interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
}

const MAX_LOG = 8;
const TICK_MS = 850;
const POOL_CAP = 12;
const STORM_TICKS = 8;

const LOG_TONE_CLS: Record<LogTone, string> = {
  aws: "text-aws",
  mint: "text-mint",
  danger: "text-danger",
  magenta: "text-magenta",
  neon: "text-neon",
  dim: "text-muted-foreground",
};

const BTN_BASE =
  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm";

const fmtTick = (t: number) => `t${String(t).padStart(3, "0")}`;

/* ------------------------------------------------------------------ */
/* DB CORE BLOCK — writer / standby glass block (role-swappable)       */
/* ------------------------------------------------------------------ */

interface DbBlockProps {
  az: "A" | "B";
  isWriter: boolean;
  writerDown: boolean;
  traffic: boolean;
  writes: number;
  conns: number;
  storagePct: number;
  pending: number;
  syncActive: boolean;
  rebuildPct: number | null;
  flashDanger: boolean;
  promoteGlow: boolean;
  delay: number;
}

function DbBlock({
  az,
  isWriter,
  writerDown,
  traffic,
  writes,
  conns,
  storagePct,
  pending,
  syncActive,
  rebuildPct,
  flashDanger,
  promoteGlow,
  delay,
}: DbBlockProps) {
  const rebuilding = rebuildPct !== null;

  let border = "border-foreground/25";
  let glow = "";
  if (isWriter) {
    if (writerDown || flashDanger) {
      border = "border-danger/70";
      glow = "shadow-[0_0_20px_rgba(255,51,85,0.4)]";
    } else if (promoteGlow) {
      border = "border-mint/70";
      glow = "shadow-[0_0_20px_rgba(0,255,163,0.4)]";
    } else if (traffic) {
      border = "border-aws/70";
      glow = "box-glow";
    }
  } else if (rebuilding) {
    border = "border-magenta/60";
    glow = "shadow-[0_0_16px_rgba(255,45,120,0.3)]";
  } else if (syncActive) {
    border = "border-aws/70";
    glow = "box-glow";
  } else {
    border = "border-mint/50";
  }

  const statusText = isWriter
    ? writerDown
      ? "UNREACHABLE"
      : "ONLINE"
    : rebuilding
      ? "REBUILDING"
      : syncActive
        ? "REPLICATING"
        : "IN SYNC";
  const statusCls = isWriter
    ? writerDown
      ? "text-danger"
      : "text-mint"
    : rebuilding
      ? "text-magenta"
      : syncActive
        ? "text-aws"
        : "text-mint";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: "42%", top: az === "A" ? "26%" : "70%" }}
    >
      <div className={`glass cyber-cut relative w-[150px] p-2 ${border} ${glow}`}>
        <div className="flex items-center gap-1 border-b border-aws/15 pb-1">
          <RDSInstanceIcon className="w-3 h-3 shrink-0 text-aws" />
          <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-aws whitespace-nowrap">
            {isWriter ? (
              <>DB-WRITER {"//"} AZ-{az}</>
            ) : rebuildPct !== null ? (
              <>DB-STANDBY {"//"} REBUILDING {rebuildPct}%</>
            ) : (
              <>DB-STANDBY {"//"} AZ-{az}</>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className={`flex items-center gap-1 text-[6px] font-bold tracking-[0.16em] ${statusCls}`}>
            <span
              className={`w-1 h-1 bg-current ${writerDown || rebuilding ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
            {statusText}
          </span>
          <span className="text-[6px] tracking-wider text-muted-foreground">PG 16.4</span>
        </div>

        {isWriter ? (
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[6.5px] uppercase tracking-wider text-muted-foreground">WRITES</span>
              <motion.span
                key={writes}
                initial={{ scale: 1.35, color: "#00ffa3" }}
                animate={{ scale: 1, color: "#ff9900" }}
                className="text-[10px] font-extrabold"
              >
                {writes}
              </motion.span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-[6.5px] uppercase tracking-wider text-muted-foreground">CONNS</span>
              <div className="flex items-center gap-[2px]" aria-label={`Connection pool ${conns} of ${POOL_CAP}`}>
                {Array.from({ length: POOL_CAP }, (_, i) => (
                  <span key={i} className={`w-1 h-2 ${i < conns ? (flashDanger ? "bg-danger" : "bg-aws") : "bg-white/15"}`} />
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[6.5px] uppercase tracking-wider text-muted-foreground">STORAGE</span>
                <span className="text-[6.5px] font-bold text-aws">{storagePct}%</span>
              </div>
              <div className="mt-0.5 h-1 w-full overflow-hidden bg-white/10">
                <motion.div
                  className="h-full bg-aws"
                  animate={{ width: `${storagePct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[6.5px] uppercase tracking-wider text-muted-foreground">SYNC REPLICATION</span>
              <span className={`text-[7px] font-bold ${syncActive ? "text-aws" : "text-mint"}`}>
                {syncActive ? "LIVE" : "ZERO LAG"}
              </span>
            </div>
            {rebuildPct !== null && (
              <div className="h-1 w-full overflow-hidden bg-white/10">
                <motion.div
                  className="h-full bg-magenta shadow-[0_0_8px_rgba(255,45,120,0.7)]"
                  animate={{ width: `${rebuildPct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            )}
          </div>
        )}

        {writerDown && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5 border border-danger/60 bg-danger/15 backdrop-blur-[1px]">
            <p className="text-[8px] font-extrabold tracking-[0.16em] text-danger">PRIMARY UNREACHABLE</p>
            <p className="text-[6.5px] font-bold tracking-[0.14em] text-danger/85">QUEUE {pending} WRITES</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* READ REPLICA BLOCK                                                  */
/* ------------------------------------------------------------------ */

interface ReplicaBlockProps {
  idx: number;
  x: number;
  y: number;
  lag: number;
  applied: number;
  stale: boolean;
  delay: number;
}

function ReplicaBlock({ idx, x, y, lag, applied, stale, delay }: ReplicaBlockProps) {
  const hot = lag > 500;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, x: 16 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.7, x: 16 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div
        className={`glass cyber-cut-sm w-[108px] p-1.5 ${
          stale
            ? "border-neon/70 shadow-[0_0_14px_rgba(255,179,71,0.4)]"
            : hot
              ? "border-magenta/60 shadow-[0_0_12px_rgba(255,45,120,0.25)]"
              : "border-foreground/25"
        }`}
      >
        <div className="flex items-center gap-1 border-b border-aws/15 pb-1">
          <RDSInstanceIcon className="w-2.5 h-2.5 shrink-0 text-aws" />
          <span className="text-[7px] font-bold tracking-[0.1em] text-aws">READ REPLICA-{idx + 1}</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-[6.5px] font-bold tracking-wider">
          <span className={hot ? "text-magenta" : "text-mint"}>LAG {lag}MS</span>
          <span className="text-aws">APPLIED {applied}</span>
        </div>
        <div className="mt-1 h-[3px] w-full overflow-hidden bg-white/10">
          <motion.div
            className={`h-full ${hot ? "bg-magenta" : "bg-mint"}`}
            animate={{ width: `${Math.min(100, Math.round(lag / 8))}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* RDS — SYNC SHADOW                                                   */
/* ------------------------------------------------------------------ */

export default function RDSVisualizer() {
  /* control states (read by the tick via closure deps) */
  const [running, setRunning] = useState(false);
  const [multiAZ, setMultiAZ] = useState(true);
  const [proxyOn, setProxyOn] = useState(true);
  const [replicaCount, setReplicaCount] = useState(2);

  /* render mirrors */
  const [writesTotal, setWritesTotal] = useState(0);
  const [readsTotal, setReadsTotal] = useState(0);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [failovers, setFailovers] = useState(0);
  const [downtimeTicks, setDowntimeTicks] = useState(0);
  const [outageTicks, setOutageTicks] = useState(0);
  const [replicaLag, setReplicaLag] = useState<number[]>([0, 0]);
  const [replicaApplied, setReplicaApplied] = useState<number[]>([0, 0]);
  const [conns, setConns] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [staleReads, setStaleReads] = useState(0);
  const [rebuildPct, setRebuildPct] = useState(0);
  const [failoverPhase, setFailoverPhase] = useState<FailoverPhase>("none");
  const [primaryIsA, setPrimaryIsA] = useState(true);
  const [log, setLog] = useState<LogLine[]>([]);
  const [syncActive, setSyncActive] = useState(false);
  const [appActive, setAppActive] = useState(false);
  const [lastReadTarget, setLastReadTarget] = useState(-1);
  const [staleIdx, setStaleIdx] = useState(-1);
  const [primaryFlash, setPrimaryFlash] = useState(false);
  const [promoteFlash, setPromoteFlash] = useState(false);

  /* refs — source of truth */
  const writesTotalRef = useRef(0);
  const readsTotalRef = useRef(0);
  const pendingWritesRef = useRef(0);
  const failoversRef = useRef(0);
  const downtimeTicksRef = useRef(0);
  const outageTicksRef = useRef(0);
  const replicaLagRef = useRef<number[]>([0, 0]);
  const replicaAppliedRef = useRef<number[]>([0, 0]);
  const connsRef = useRef(0);
  const rejectedRef = useRef(0);
  const staleReadsRef = useRef(0);
  const stormTicksRef = useRef(0);
  const failoverPhaseRef = useRef<FailoverPhase>("none");
  const rebuildPctRef = useRef(0);
  const phaseAgeRef = useRef(0);
  const primaryIsARef = useRef(true);
  const tickRef = useRef(0);
  const readRRRef = useRef(0);
  const lastReadTargetRef = useRef(-1);
  const logRef = useRef<LogLine[]>([]);
  const logIdRef = useRef(1);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const pushLog = useCallback((text: string, tone: LogTone = "aws") => {
    logRef.current = [...logRef.current, { id: logIdRef.current++, text, tone }].slice(-MAX_LOG);
  }, []);

  const flush = useCallback((syncNow: boolean, staleIdxNow: number, appActiveNow: boolean) => {
    setWritesTotal(writesTotalRef.current);
    setReadsTotal(readsTotalRef.current);
    setPendingWrites(pendingWritesRef.current);
    setFailovers(failoversRef.current);
    setDowntimeTicks(downtimeTicksRef.current);
    setOutageTicks(outageTicksRef.current);
    setReplicaLag([...replicaLagRef.current]);
    setReplicaApplied([...replicaAppliedRef.current]);
    setConns(connsRef.current);
    setRejected(rejectedRef.current);
    setStaleReads(staleReadsRef.current);
    setRebuildPct(failoverPhaseRef.current === "rebuilding" ? rebuildPctRef.current : 0);
    setFailoverPhase(failoverPhaseRef.current);
    setPrimaryIsA(primaryIsARef.current);
    setLog([...logRef.current]);
    setSyncActive(syncNow);
    setAppActive(appActiveNow);
    setLastReadTarget(lastReadTargetRef.current);
    setStaleIdx(staleIdxNow);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const tick = ++tickRef.current;

      /* 1. FAILOVER STATE MACHINE — progress phases */
      const phaseAtStart = failoverPhaseRef.current;
      if (phaseAtStart === "down") {
        outageTicksRef.current++;
        if (multiAZ) {
          phaseAgeRef.current++;
          if (phaseAgeRef.current >= 1) {
            primaryIsARef.current = false;
            pushLog(`> ${fmtTick(tick)} FAILOVER: standby promoted — DNS switched`, "mint");
            setPromoteFlash(true);
            window.setTimeout(() => setPromoteFlash(false), 1100);
            failoverPhaseRef.current = "promoting";
            phaseAgeRef.current = 0;
          }
        } else {
          downtimeTicksRef.current++;
          if (tick % 3 === 0) {
            pushLog(
              `> ${fmtTick(tick)} OUTAGE — NO STANDBY // MULTI-AZ OFF — downtime ${downtimeTicksRef.current} ticks`,
              "danger"
            );
          }
        }
      } else if (phaseAtStart === "promoting") {
        failoversRef.current++;
        failoverPhaseRef.current = "rebuilding";
        rebuildPctRef.current = 0;
        pushLog(`> ${fmtTick(tick)} FAILOVER: new writer accepting writes — failover #${failoversRef.current}`, "mint");
      } else if (phaseAtStart === "rebuilding") {
        rebuildPctRef.current = Math.min(100, rebuildPctRef.current + 25);
        pushLog(`> ${fmtTick(tick)} REBUILDING REPLICA IN AZ-A ${rebuildPctRef.current}%`, "aws");
        if (rebuildPctRef.current >= 100) {
          failoverPhaseRef.current = "none";
          pushLog(`> ${fmtTick(tick)} REBUILD COMPLETE — sync replication restored`, "mint");
        }
      }
      const phase = failoverPhaseRef.current;

      /* 2. CONNECTION DECAY — pool connections release between ticks */
      connsRef.current = Math.max(0, connsRef.current - 2);

      /* 3. WRITES ARRIVE — baseline or storm */
      let writesN = 0;
      if (stormTicksRef.current > 0) {
        writesN = 4 + Math.floor(Math.random() * 3);
        stormTicksRef.current--;
        if (stormTicksRef.current === 0) {
          pushLog(`> ${fmtTick(tick)} write storm subsided — traffic normalized`, "dim");
        }
      } else if (Math.random() < 0.5) {
        writesN = 1 + (Math.random() < 0.5 ? 1 : 0);
      }

      /* 4. READS ARRIVE */
      let readsN = 0;
      if (Math.random() < 0.6) readsN = 1 + Math.floor(Math.random() * 3);
      const incoming = writesN + readsN;

      /* 5. CONNECTION POOL — proxy queues overflow, direct connections reject it */
      if (incoming > 0) {
        if (proxyOn) {
          connsRef.current = Math.min(POOL_CAP, connsRef.current + incoming);
        } else {
          const want = connsRef.current + incoming;
          if (want > POOL_CAP) {
            const overflow = want - POOL_CAP;
            rejectedRef.current += overflow;
            connsRef.current = POOL_CAP;
            pushLog(
              `> ${fmtTick(tick)} TOO MANY CONNECTIONS — REJECTED ${overflow} (max_connections exhausted)`,
              "danger"
            );
            setPrimaryFlash(true);
            window.setTimeout(() => setPrimaryFlash(false), 600);
          } else {
            connsRef.current = want;
          }
        }
      }

      /* 6. WRITE PATH — commit at primary or queue during failover */
      let staleIdxNow = -1;
      if (writesN > 0) {
        if (phase === "none") {
          writesTotalRef.current += writesN;
          if (multiAZ && Math.random() < 0.4) {
            pushLog(
              `> ${fmtTick(tick)} WRITE committed — fsync ${(2 + Math.random() * 3).toFixed(1)}ms — standby ack`,
              "aws"
            );
          } else if (!multiAZ && Math.random() < 0.25) {
            pushLog(`> ${fmtTick(tick)} WRITE committed — fsync ${(2 + Math.random() * 3).toFixed(1)}ms`, "aws");
          }
          for (let i = 0; i < replicaCount; i++) {
            replicaLagRef.current[i] += writesN * 45 + Math.floor(Math.random() * 30);
            replicaAppliedRef.current[i] += writesN;
          }
          if (replicaCount > 0 && Math.random() < 0.35) {
            const i = Math.floor(Math.random() * replicaCount);
            pushLog(`> ${fmtTick(tick)} ASYNC ship → replica-${i + 1} (lag ${replicaLagRef.current[i]}ms)`, "dim");
          }
        } else {
          pendingWritesRef.current += writesN;
          if (Math.random() < 0.6) {
            pushLog(`> ${fmtTick(tick)} WRITE QUEUED — WRITER UNAVAILABLE (+${writesN})`, "danger");
          }
        }
      }

      /* 7. ASYNC LAG DECAY — replicas drain their apply backlog */
      for (let i = 0; i < 2; i++) {
        replicaLagRef.current[i] = Math.max(0, Math.floor(replicaLagRef.current[i] * 0.65));
      }

      /* 8. READ PATH — round-robin over replicas, stale window check */
      if (readsN > 0) {
        readsTotalRef.current += readsN;
        if (replicaCount > 0) {
          const target = readRRRef.current % replicaCount;
          readRRRef.current++;
          lastReadTargetRef.current = target;
          if (replicaLagRef.current[target] > 500) {
            staleReadsRef.current++;
            staleIdxNow = target;
            pushLog(
              `> ${fmtTick(tick)} STALE READ → replica-${target + 1} lag ${replicaLagRef.current[target]}ms — eventual consistency hit`,
              "neon"
            );
          }
        } else {
          lastReadTargetRef.current = -1;
          if (phase === "down" && Math.random() < 0.5) {
            pushLog(`> ${fmtTick(tick)} READ FAILED — no writer, no replicas`, "danger");
          }
        }
      } else {
        lastReadTargetRef.current = -1;
      }

      /* 9. QUEUE FLUSH — new writer drains queued writes over next ticks */
      let flushed = 0;
      if (pendingWritesRef.current > 0 && (phase === "rebuilding" || phase === "none")) {
        flushed = Math.min(2, pendingWritesRef.current);
        pendingWritesRef.current -= flushed;
        writesTotalRef.current += flushed;
        pushLog(`> ${fmtTick(tick)} ${flushed} queued writes flushed to new writer`, "aws");
      }

      /* flush refs to render state */
      flush((writesN > 0 && phase === "none") || flushed > 0, staleIdxNow, incoming > 0);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, multiAZ, proxyOn, replicaCount, pushLog, flush]);

  /* auto-scroll the engine log */
  useEffect(() => {
    const el = logBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const reset = () => {
    setRunning(false);
    writesTotalRef.current = 0;
    readsTotalRef.current = 0;
    pendingWritesRef.current = 0;
    failoversRef.current = 0;
    downtimeTicksRef.current = 0;
    outageTicksRef.current = 0;
    setOutageTicks(0);
    replicaLagRef.current = [0, 0];
    replicaAppliedRef.current = [0, 0];
    connsRef.current = 0;
    rejectedRef.current = 0;
    staleReadsRef.current = 0;
    stormTicksRef.current = 0;
    failoverPhaseRef.current = "none";
    rebuildPctRef.current = 0;
    phaseAgeRef.current = 0;
    primaryIsARef.current = true;
    tickRef.current = 0;
    readRRRef.current = 0;
    lastReadTargetRef.current = -1;
    logRef.current = [];
    setMultiAZ(true);
    setProxyOn(true);
    setReplicaCount(2);
    setWritesTotal(0);
    setReadsTotal(0);
    setPendingWrites(0);
    setFailovers(0);
    setDowntimeTicks(0);
    setReplicaLag([0, 0]);
    setReplicaApplied([0, 0]);
    setConns(0);
    setRejected(0);
    setStaleReads(0);
    setRebuildPct(0);
    setFailoverPhase("none");
    setPrimaryIsA(true);
    setLog([]);
    setSyncActive(false);
    setAppActive(false);
    setLastReadTarget(-1);
    setStaleIdx(-1);
    setPrimaryFlash(false);
    setPromoteFlash(false);
  };

  const triggerFailover = () => {
    if (failoverPhaseRef.current !== "none") return;
    failoverPhaseRef.current = "down";
    phaseAgeRef.current = 0;
    pushLog(`> ${fmtTick(tickRef.current)} FAILOVER TRIGGERED — primary stopped — links down`, "danger");
    flush(false, -1, false);
  };

  const restoreWriter = () => {
    if (failoverPhaseRef.current !== "down") return;
    failoverPhaseRef.current = "promoting";
    phaseAgeRef.current = 0;
    pushLog(`> ${fmtTick(tickRef.current)} RESTORE WRITER — manual recovery initiated`, "mint");
    flush(false, -1, false);
  };

  const injectStorm = () => {
    stormTicksRef.current = STORM_TICKS;
    pushLog(`> ${fmtTick(tickRef.current)} WRITE STORM injected — ${STORM_TICKS} ticks at 4-6 writes/tick`, "neon");
    flush(false, -1, false);
  };

  const toggleMultiAZ = () => {
    const next = !multiAZ;
    setMultiAZ(next);
    if (!next) {
      primaryIsARef.current = true;
      setPrimaryIsA(true);
      pushLog(`> ${fmtTick(tickRef.current)} MULTI-AZ disabled — single-AZ deployment — failover now manual`, "magenta");
    } else {
      pushLog(`> ${fmtTick(tickRef.current)} MULTI-AZ enabled — sync standby provisioned in AZ-B`, "magenta");
    }
    flush(false, -1, false);
  };

  const toggleProxy = () => {
    const next = !proxyOn;
    setProxyOn(next);
    pushLog(
      next
        ? `> ${fmtTick(tickRef.current)} RDS Proxy attached — pool cap ${POOL_CAP} — multiplexing on`
        : `> ${fmtTick(tickRef.current)} RDS Proxy removed — direct connections — overflow will be rejected`,
      "mint"
    );
    flush(false, -1, false);
  };

  const changeReplicas = (n: number) => {
    setReplicaCount(n);
    pushLog(`> ${fmtTick(tickRef.current)} read replicas set to ${n} — async ship targets updated`, "dim");
    flush(false, -1, false);
  };

  /* derived render values */
  const writerDown = failoverPhase === "down";
  const outageActive = !multiAZ && writerDown;
  const storagePct = Math.min(96, 34 + Math.round(writesTotal * 0.1));
  const maxLag = replicaCount > 0 ? Math.max(...replicaLag.slice(0, replicaCount)) : null;

  const syncLinkStatus =
    failoverPhase === "down"
      ? "idle"
      : failoverPhase === "rebuilding"
        ? "cyber"
        : syncActive
          ? "flowing"
          : "success";
  const shipStatus = failoverPhase === "down" ? "idle" : syncActive ? "flowing" : "idle";

  const SYNC_D = primaryIsA ? "M42,35 C42,44 42,53 42,61" : "M42,61 C42,53 42,44 42,35";
  const ASYNC_D = primaryIsA
    ? ["M48,23 C60,20 68,17 76,16", "M48,30 C60,33 68,40 76,43"]
    : ["M48,67 C62,60 70,26 76,17", "M48,69 C62,66 70,52 76,45"];
  const READ_D = proxyOn
    ? ["M17,56 C40,50 58,20 76,15", "M17,60 C40,56 58,46 76,43"]
    : ["M17,20 C40,10 58,11 76,15", "M17,24 C40,18 58,34 76,42"];
  const PROXY_WRITER_D = primaryIsA ? "M17,58 C28,56 28,40 33,31" : "M17,62 C27,63 28,66 33,68";
  const APP_WRITER_D = primaryIsA ? "M17,23 C26,23 27,26 33,27" : "M17,24 C28,32 28,54 33,63";

  const statusLine = !running
    ? "SYSTEM IDLE — PRESS RUN"
    : writerDown
      ? outageActive
        ? `OUTAGE — WRITER DOWN ${outageTicks} TICKS — RESTORE REQUIRED`
        : `FAILOVER ACTIVE — DOWN ${outageTicks} TICKS — STANDBY TAKING OVER`
      : failoverPhase === "promoting"
        ? "PROMOTING STANDBY — DNS CNAME SWITCH"
        : failoverPhase === "rebuilding"
          ? `REBUILDING STANDBY — ${rebuildPct}%`
          : "ENGINE LIVE — SYNC REPLICATION FLOWING";

  return (
    <div className="flex flex-col gap-4">
      {/* CONTROL DECK */}
      <GlassPanel
        title="SYNC SHADOW // LIVE"
        subtitle={`RDS POSTGRES 16.4 · ${multiAZ ? "MULTI-AZ SYNC STANDBY" : "SINGLE-AZ — NO STANDBY"} · ${replicaCount} READ REPLICA${replicaCount === 1 ? "" : "S"}`}
        actions={
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={statusLine}
          />
        }
      >
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <FlowCanvas className="h-[440px] sm:h-[540px]" ariaLabel="RDS multi-AZ failover and read replica flow diagram">
            {/* HEADER CHIP */}
            <div className="absolute left-3 top-2.5 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 px-2 py-1 backdrop-blur-sm">
              <RDSIcon className="w-3 h-3 text-aws" />
              <span className="text-[7px] font-bold tracking-[0.2em] text-aws">RDS · DB-CLUSTER</span>
              <span className="text-[7px] text-muted-foreground">
                {multiAZ ? "MULTI-AZ" : "SINGLE-AZ"} · {replicaCount} RR
              </span>
              {failoverPhase !== "none" && (
                <span className="text-[7px] font-bold tracking-wider text-magenta">{failoverPhase.toUpperCase()}</span>
              )}
            </div>

            {/* LINKS — app to proxy or direct to writer */}
            {proxyOn ? (
              <FlowLink d="M13,26 C13,34 13,48 13,56" status={appActive ? "flowing" : "idle"} dotDuration={1.3} />
            ) : (
              <FlowLink d={APP_WRITER_D} status={appActive ? "flowing" : "idle"} dotDuration={1.3} />
            )}
            {proxyOn && <FlowLink d={PROXY_WRITER_D} status={appActive ? "flowing" : "idle"} dotDuration={1.5} dotDelay={0.15} />}

            {/* SYNC REPLICATION — writer to standby (vertical) */}
            {multiAZ && (
              <FlowLink d={SYNC_D} status={syncLinkStatus} dotDuration={1.1} />
            )}

            {/* ASYNC SHIP — writer to read replicas (dashed) */}
            {replicaCount > 0 && (
              <FlowLink d={ASYNC_D[0]} status={shipStatus} dashed dotDuration={1.7} />
            )}
            {replicaCount > 1 && (
              <FlowLink d={ASYNC_D[1]} status={shipStatus} dashed dotDuration={1.9} dotDelay={0.25} />
            )}

            {/* READ ROUTES — proxy or app curving to replicas */}
            {replicaCount > 0 && (
              <FlowLink d={READ_D[0]} status={lastReadTarget === 0 ? "success" : "idle"} dotDuration={1.4} />
            )}
            {replicaCount > 1 && (
              <FlowLink d={READ_D[1]} status={lastReadTarget === 1 ? "success" : "idle"} dotDuration={1.6} dotDelay={0.2} />
            )}

            {/* APP TIER */}
            <FlowNode
              x={13}
              y={22}
              icon={<EC2Icon className="w-3 h-3" />}
              label="APP TIER"
              sub="PROD APPS"
              status={appActive ? "active" : "idle"}
              pulse={appActive}
              size="sm"
              delay={0.1}
            />

            {/* RDS PROXY — ghosted when off */}
            <FlowNode
              x={13}
              y={62}
              icon={<RDSProxyIcon className="w-3 h-3" />}
              label="RDS PROXY"
              sub="CONNECTION POOL"
              status={proxyOn ? (appActive ? "active" : "idle") : "idle"}
              pulse={proxyOn && appActive}
              size="sm"
              delay={0.2}
              className={proxyOn ? "" : "opacity-40"}
            />

            {/* DB CORE BLOCKS — roles swap via primaryIsA */}
            <DbBlock
              az="A"
              isWriter={primaryIsA}
              writerDown={writerDown && primaryIsA}
              traffic={appActive && primaryIsA}
              writes={writesTotal}
              conns={conns}
              storagePct={storagePct}
              pending={pendingWrites}
              syncActive={syncActive}
              rebuildPct={!primaryIsA && failoverPhase === "rebuilding" ? rebuildPct : null}
              flashDanger={primaryFlash}
              promoteGlow={promoteFlash}
              delay={0.3}
            />
            <AnimatePresence>
              {multiAZ && (
                <DbBlock
                  key="db-b"
                  az="B"
                  isWriter={!primaryIsA}
                  writerDown={writerDown && !primaryIsA}
                  traffic={appActive && !primaryIsA}
                  writes={writesTotal}
                  conns={conns}
                  storagePct={storagePct}
                  pending={pendingWrites}
                  syncActive={syncActive}
                  rebuildPct={primaryIsA && failoverPhase === "rebuilding" ? rebuildPct : null}
                  flashDanger={primaryFlash}
                  promoteGlow={promoteFlash}
                  delay={0.45}
                />
              )}
            </AnimatePresence>

            {/* READ REPLICA BLOCKS */}
            <AnimatePresence>
              {replicaCount > 0 && (
                <ReplicaBlock
                  key="rr-1"
                  idx={0}
                  x={82}
                  y={16}
                  lag={replicaLag[0]}
                  applied={replicaApplied[0]}
                  stale={staleIdx === 0}
                  delay={0.55}
                />
              )}
              {replicaCount > 1 && (
                <ReplicaBlock
                  key="rr-2"
                  idx={1}
                  x={82}
                  y={44}
                  lag={replicaLag[1]}
                  applied={replicaApplied[1]}
                  stale={staleIdx === 1}
                  delay={0.65}
                />
              )}
            </AnimatePresence>

            {/* LABELS */}
            <FlowLabel x={42} y={48} tone="mint">SYNCHRONOUS — ZERO REPLICATION LAG</FlowLabel>
            {replicaCount > 0 && <FlowLabel x={62} y={10} tone="magenta">ASYNC SHIP</FlowLabel>}
            {replicaCount > 1 && <FlowLabel x={62} y={52} tone="magenta">ASYNC SHIP</FlowLabel>}
            {replicaCount === 0 && <FlowLabel x={62} y={9} tone="danger">NO REPLICAS — ALL LOAD ON WRITER</FlowLabel>}

            {/* PROMOTION MINT FLASH */}
            <AnimatePresence>
              {promoteFlash && (
                <div key="promote" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="border border-mint/70 bg-black/85 px-3 py-1.5 shadow-[0_0_26px_rgba(0,255,163,0.45)]"
                  >
                    <p className="text-[9px] font-extrabold tracking-[0.2em] text-mint">
                      {multiAZ ? "STANDBY PROMOTED — DNS CNAME SWITCHED" : "WRITER RESTORED — DNS REPOINTED"}
                    </p>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* SINGLE-AZ OUTAGE OVERLAY */}
            <AnimatePresence>
              {outageActive && (
                <motion.div
                  key="outage"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.75, 1, 0.75] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-danger/[0.07]"
                >
                  <div className="border border-danger/60 bg-black/85 px-4 py-2 text-center backdrop-blur-sm">
                    <p className="text-[10px] font-extrabold tracking-[0.22em] text-danger">
                      OUTAGE — NO STANDBY {"//"} MULTI-AZ OFF
                    </p>
                    <p className="mt-1 text-[8px] tracking-[0.18em] text-danger/80">
                      DOWNTIME {downtimeTicks} TICKS — PRESS RESTORE WRITER TO RECOVER
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </FlowCanvas>

          {/* STATS */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatChip label="WRITES" value={String(writesTotal)} />
            <StatChip label="READS" value={String(readsTotal)} />
            <StatChip
              label="MAX REPLICA LAG"
              value={maxLag === null ? "—" : `${maxLag}MS`}
              tone={maxLag !== null && maxLag > 500 ? "magenta" : "aws"}
            />
            <StatChip label="FAILOVERS" value={String(failovers)} tone="mint" />
          </div>

          {/* CONTROLS */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={toggleMultiAZ}
              aria-pressed={multiAZ}
              aria-label="Toggle Multi-AZ deployment"
              className={`${BTN_BASE} ${multiAZ ? "border-magenta/60 text-magenta" : "border-aws/50 text-aws"}`}
            >
              <Layers className="w-3 h-3" />
              MULTI-AZ {multiAZ ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={toggleProxy}
              aria-pressed={proxyOn}
              aria-label="Toggle RDS Proxy connection pooling"
              className={`${BTN_BASE} ${proxyOn ? "border-mint/60 text-mint" : "border-aws/50 text-aws"}`}
            >
              <Gauge className="w-3 h-3" />
              RDS PROXY {proxyOn ? "ON" : "OFF"}
            </button>
            <div
              role="group"
              aria-label="Read replica count"
              className="flex items-center gap-1.5 border border-foreground/25 bg-black/50 px-2 py-1 backdrop-blur-md cyber-cut-sm"
            >
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">REPLICAS</span>
              {[0, 1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => changeReplicas(n)}
                  aria-pressed={replicaCount === n}
                  aria-label={`Set read replicas to ${n}`}
                  className={`border px-2 py-0.5 text-[9px] font-bold ${
                    replicaCount === n
                      ? "border-aws/70 bg-aws/10 text-aws"
                      : "border-foreground/25 text-muted-foreground hover:text-aws"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={injectStorm}
              aria-label="Inject a write storm burst"
              className={`${BTN_BASE} border-neon/60 text-neon hover:bg-neon/10`}
            >
              <Zap className="w-3 h-3" />
              WRITE STORM
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={triggerFailover}
              disabled={failoverPhase !== "none"}
              aria-label="Trigger automatic failover"
              className={`${BTN_BASE} border-danger/60 text-danger hover:bg-danger/10 disabled:opacity-40`}
            >
              <ZapOff className="w-3 h-3" />
              {failoverPhase === "none" ? "FAILOVER" : `FAILOVER — ${failoverPhase.toUpperCase()}`}
            </motion.button>
            <AnimatePresence>
              {outageActive && (
                <motion.button
                  key="restore"
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={restoreWriter}
                  aria-label="Restore the writer instance"
                  className={`${BTN_BASE} border-mint/60 text-mint hover:bg-mint/10`}
                >
                  <Power className="w-3 h-3" />
                  RESTORE WRITER
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* ENGINE LOG */}
          <div className="glass-inset p-2">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-aws">ENGINE LOG {"//"} LIVE</span>
              <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                {multiAZ ? "SYNC STANDBY" : "NO STANDBY"} · {TICK_MS}MS TICK
              </span>
            </div>
            <div
              ref={logBoxRef}
              className="cyber-scroll flex max-h-40 flex-col gap-0.5 overflow-y-auto p-2"
            >
              <AnimatePresence initial={false}>
                {log.map((l) => (
                  <motion.p
                    key={l.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`whitespace-pre-wrap font-mono text-[8px] font-bold leading-snug tracking-wider ${LOG_TONE_CLS[l.tone]}`}
                  >
                    {l.text}
                  </motion.p>
                ))}
              </AnimatePresence>
              {log.length === 0 && (
                <p className="py-1 text-[8px] uppercase tracking-wider text-muted-foreground/60">
                  NO EVENTS YET — PRESS RUN TO START THE ENGINE
                </p>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* KNOWLEDGE */}
      <div className="grid gap-3 md:grid-cols-3">
        <Callout type="exam" title="Multi-AZ vs Read Replicas" delay={0.1}>
          Multi-AZ is about availability: a synchronous standby in another AZ, automatic failover in
          roughly 60-120 seconds — the DNS endpoint switches, apps never re-point. Read Replicas are
          about read scaling: asynchronous replication (eventual consistency), manual promotion, up to
          15 per source instance, and they can live in another region entirely.
        </Callout>
        <Callout type="critical" title="Failover still blips" delay={0.2}>
          Automatic does not mean invisible: expect a brief 60-120 second writer outage while RDS
          detects the failure, promotes the standby and flips the CNAME — put retry with exponential
          backoff on every connection. Single-AZ failover takes many minutes, and a Multi-AZ standby
          cannot serve reads — that is what read replicas are for.
        </Callout>
        <Callout type="tip" title="RDS Proxy saves Lambda backends" delay={0.3}>
          Serverless functions open a new database connection per concurrent invocation and can
          exhaust max_connections long before CPU does. RDS Proxy multiplexes and pools those
          connections (plus IAM auth and Secrets Manager rotation) — exactly the overflow-queued vs
          rejected behavior simulated above.
        </Callout>
      </div>
    </div>
  );
}
