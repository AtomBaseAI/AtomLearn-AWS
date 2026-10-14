"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Database,
  HardDrive,
  History,
  Plus,
  Server,
  ZapOff,
} from "lucide-react";
import { FlowCanvas, FlowLabel, FlowLink, FlowNode } from "@/components/shared/flow";
import { SimControls } from "@/components/shared/sim-controls";
import {
  StepBadge,
  UCButton,
  UCStat,
  UseCaseNote,
  UseCaseShell,
  VerdictFlash,
  useTicker,
} from "@/components/shared/use-case";
import { RDSInstanceIcon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES                                                        */
/* ================================================================== */

export type RdsUseCaseId = "MULTI_AZ" | "READ_REPLICAS" | "PITR";

interface RdsUseCasesProps {
  id: RdsUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

interface UcLine {
  id: number;
  text: string;
  tone?: string;
}

/* ================================================================== */
/* TAB 02 — MULTI-AZ FAILOVER: KILL PRIMARY, WATCH THE SWARM RECOVER   */
/* ================================================================== */

type FaPhase = "healthy" | "detecting" | "flipping" | "promoted" | "rebuilding";

const FA_STEP_TEXT = [
  "HEALTHY — SYNC REPLICATION",
  "DETECTING AZ-A FAILURE",
  "DNS FAILOVER — CNAME FLIP",
  "STANDBY PROMOTED — APP RECONNECTING",
  "REBUILDING OLD PRIMARY AS STANDBY",
];

function MultiAzUseCase({ immersiveActive, immersiveToggle }: RdsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<FaPhase>("healthy");
  const [detectLeft, setDetectLeft] = useState(15);
  const [downtime, setDowntime] = useState(0);
  const [failovers, setFailovers] = useState(0);
  const [writes, setWrites] = useState(0);
  const [lastDowntime, setLastDowntime] = useState<number | null>(null);
  const [primaryIsA, setPrimaryIsA] = useState(true);
  const [rebuildPct, setRebuildPct] = useState(0);
  const [flash, setFlash] = useState<null | "ok" | "deny">(null);
  const [lines, setLines] = useState<UcLine[]>([]);

  const idRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTicksRef = useRef(0);
  const rebuildPctRef = useRef(0);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const doFlash = (f: "ok" | "deny") => {
    setFlash(f);
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1800);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  // healthy heartbeat — writes hit the primary, standby ACKs the sync beam
  useTicker(phase === "healthy" && running, () => {
    setWrites((w) => w + 1 + Math.floor(Math.random() * 2));
    if (Math.random() < 0.5) {
      push(`WRITE committed — fsync ${(1.8 + Math.random()).toFixed(1)}ms — standby ACK (sync · AZ-B)`, "aws");
    }
  }, 1500);

  // detection countdown — 15s window, compressed 0.5s per tick
  useTicker(phase === "detecting", () => {
    const dl = Math.max(0, detectLeft - 0.5);
    const dt = downtime + 0.5;
    setDetectLeft(dl);
    setDowntime(dt);
    if (dl > 0 && Math.abs(dl % 5) < 0.01) {
      push(`health check FAILED — AZ-A unreachable — ${dl.toFixed(1)}s to detection timeout (downtime ${dt.toFixed(1)}s)`, "danger");
    }
    if (dl <= 0) {
      setPhase("flipping");
      push("DETECTION TIMEOUT — automatic failover triggered (RDS-EVENT-0049)", "magenta");
    }
  }, 130);

  // one-shot DNS flip — standby promotes, endpoint string never changes
  useTicker(phase === "flipping", () => {
    setPrimaryIsA(false);
    setFailovers((f) => f + 1);
    setPhase("promoted");
    reconnectTicksRef.current = 0;
    push("DNS CNAME FLIPPED — nexus-db.cluster-xxx → AZ-B — standby promoted to PRIMARY", "mint");
    doFlash("ok");
  }, 900);

  // app reconnect — downtime ticker climbs until ~25s, then stops
  useTicker(phase === "promoted", () => {
    const dt = Math.min(25, downtime + 0.5);
    setDowntime(dt);
    reconnectTicksRef.current += 1;
    if (reconnectTicksRef.current % 8 === 0 && dt < 25) {
      push(`app retrying writer endpoint… downtime ${dt.toFixed(1)}s`, "dim");
    }
    if (dt >= 25) {
      setLastDowntime(25);
      setPhase("rebuilding");
      rebuildPctRef.current = 0;
      setRebuildPct(0);
      push("APP RECONNECTED — writes resumed — total downtime 25.0s — endpoint unchanged", "mint");
    }
  }, 130);

  // old primary rebuilds as the new standby
  useTicker(phase === "rebuilding", () => {
    const np = Math.min(100, rebuildPctRef.current + 12);
    rebuildPctRef.current = np;
    setRebuildPct(np);
    if (np >= 100) {
      setPhase("healthy");
      push("old AZ-A rebuilt as NEW MULTI-AZ STANDBY — sync replication restored", "mint");
    }
  }, 420);

  const killPrimary = () => {
    if (phase !== "healthy") return;
    setPhase("detecting");
    setDetectLeft(15);
    setDowntime(0);
    setLastDowntime(null);
    doFlash("deny");
    push("INJECT — KILL PRIMARY — db.instance-nexus-az-a storage volume failure", "danger");
    push("RDS health monitors failing — detection window 15s — Multi-AZ auto-failover armed", "aws");
  };

  const reset = () => {
    setRunning(false);
    setPhase("healthy");
    setDetectLeft(15);
    setDowntime(0);
    setFailovers(0);
    setWrites(0);
    setLastDowntime(null);
    setPrimaryIsA(true);
    rebuildPctRef.current = 0;
    setRebuildPct(0);
    setFlash(null);
    setLines([]);
  };

  const phaseIdx = phase === "healthy" ? 0 : phase === "detecting" ? 1 : phase === "flipping" ? 2 : phase === "promoted" ? 3 : 4;
  const appFlowing = running && (primaryIsA ? phase === "healthy" || phase === "rebuilding" : phase === "promoted" || phase === "rebuilding");
  const beamFlowing = primaryIsA && running && phase === "healthy";

  return (
    <UseCaseShell
      title="USE CASE // MULTI-AZ FAILOVER"
      subtitle="KILL THE PRIMARY — DETECT 15s · FLIP DNS · PROMOTE STANDBY · RECONNECT AT ~25s"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="PRIMARY NODE" value={`nexus-db-az-${primaryIsA ? "a" : "b"}`} tone="aws" />
          <UCStat
            label="STANDBY STATE"
            value={primaryIsA ? "SYNCED · AZ-B" : phase === "rebuilding" ? `REBUILD ${rebuildPct}%` : "STALE → SYNCING"}
            tone={primaryIsA ? "mint" : "magenta"}
          />
          <UCStat label="FAILOVERS" value={failovers} tone={failovers > 0 ? "magenta" : "neutral"} />
          <UCStat label="LAST DOWNTIME S" value={lastDowntime !== null ? `${lastDowntime.toFixed(1)}s` : "—"} tone="danger" />
          <UCStat label="DETECTION" value={phase === "detecting" ? `${detectLeft.toFixed(1)}s` : "—"} tone={phase === "detecting" ? "danger" : "neutral"} />
          <UCStat label="WRITES COMMITTED" value={writes} tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={
              !running
                ? "IDLE — PRESS RUN, THEN KILL PRIMARY"
                : phase === "healthy"
                  ? "MULTI-AZ LIVE — SYNC BEAM FLOWING"
                  : phase === "detecting"
                    ? `AZ-A DOWN — DETECTING… ${detectLeft.toFixed(1)}s`
                    : phase === "flipping"
                      ? "DNS FAILOVER — FLIPPING CNAME"
                      : phase === "promoted"
                        ? `APP RECONNECTING — DOWNTIME ${downtime.toFixed(1)}s`
                        : `REBUILDING STANDBY — ${rebuildPct}%`
            }
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CHAOS INJECTION</p>
          <UCButton onClick={killPrimary} tone="danger" disabled={phase !== "healthy"} ariaLabel="Kill the primary instance to trigger automatic failover">
            <ZapOff className="w-3 h-3" /> KILL PRIMARY
          </UCButton>
          <p className="text-[7px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-relaxed">
            AUTOMATIC ≠ INSTANT: DETECTION 15-30s + CNAME FLIP ⇒ BUDGET A ~60-120s BLIP AND PUT RETRY + BACKOFF ON EVERY CONNECTION
          </p>
        </>
      }
      logLines={lines}
      logTitle="FAILOVER LOG // LIVE"
      logEmpty="PRESS RUN — THEN HIT KILL PRIMARY TO START THE SCENARIO"
    >
      <FlowCanvas ariaLabel="RDS Multi-AZ failover scenario diagram" className="h-full">
        {/* app → writer link (bends to the promoted node after the flip) */}
        <FlowLink
          d={primaryIsA ? "M17,24 C24,24 32,24 46,24" : "M17,27 C26,36 34,60 46,70"}
          status={appFlowing ? "flowing" : phase === "detecting" || phase === "flipping" ? "error" : "idle"}
          dotDuration={1.2}
        />
        {/* sync replication beam */}
        <FlowLink d="M54,31 C54,44 54,56 54,69" dashed status={beamFlowing ? "cyber" : "idle"} dotDuration={1.4} />

        <FlowNode
          x={12}
          y={24}
          size="sm"
          delay={0.1}
          icon={<Server className="w-3 h-3" />}
          label="APP TIER"
          sub="nexus-api · writer endpoint"
          status={phase === "detecting" || phase === "flipping" ? "error" : appFlowing ? "active" : "idle"}
          pulse={appFlowing}
        />
        <FlowNode
          x={54}
          y={24}
          size="sm"
          delay={0.25}
          icon={<RDSInstanceIcon className="w-3 h-3" />}
          label={primaryIsA ? "PRIMARY · AZ-A" : "STANDBY · AZ-A"}
          sub={primaryIsA ? "db.r6g.2xl · WRITER" : phase === "rebuilding" ? `REBUILDING ${rebuildPct}%` : "OFFLINE → REBUILD"}
          status={primaryIsA ? (phase === "healthy" ? "active" : phase === "rebuilding" ? "warn" : "error") : phase === "rebuilding" ? "warn" : "error"}
          pulse={primaryIsA && phase === "detecting"}
        />
        <FlowNode
          x={54}
          y={76}
          size="sm"
          delay={0.35}
          icon={<RDSInstanceIcon className="w-3 h-3" />}
          label={primaryIsA ? "STANDBY · AZ-B" : "PRIMARY · AZ-B"}
          sub={primaryIsA ? "db.r6g.2xl · SYNC REPLICA" : phase === "rebuilding" ? "WRITER · NO STANDBY YET" : "PROMOTED · WRITER"}
          status={primaryIsA ? "success" : "active"}
          pulse={!primaryIsA}
        />

        <FlowLabel x={54} y={50} tone="magenta">SYNC REPLICATION · &lt;1ms</FlowLabel>
        <FlowLabel x={22} y={70} tone="default">SAME VPC · DIFFERENT AZ</FlowLabel>

        <AnimatePresence>
          {primaryIsA && (phase === "detecting" || phase === "flipping") && (
            <motion.div
              key="kill"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute z-20"
              style={{ left: "54%", top: "12%" }}
            >
              <FlowLabel x={0} y={0} tone="danger">✕ KILLED — HARDWARE FAILURE</FlowLabel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* phase overlay — countdown / flip / reconnect / rebuild */}
        <div className="absolute left-[14%] right-[30%] top-[38%] z-10">
          {phase === "detecting" && (
            <div className="border border-danger/60 bg-black/70 px-2.5 py-2 backdrop-blur-sm">
              <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-danger">FAILURE DETECTION COUNTDOWN</p>
              <p className="text-xl font-extrabold tabular-nums text-danger leading-tight">{detectLeft.toFixed(1)}s</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden bg-white/10">
                <div className="h-full bg-danger" style={{ width: `${((15 - detectLeft) / 15) * 100}%` }} />
              </div>
              <p className="mt-1 text-[6.5px] uppercase tracking-wider text-muted-foreground">DOWNTIME {downtime.toFixed(1)}s — WRITES QUEUEING</p>
            </div>
          )}
          {phase === "flipping" && (
            <div className="border border-magenta/60 bg-black/70 px-2.5 py-2 backdrop-blur-sm box-glow">
              <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-magenta">DNS FAILOVER — FLIPPING CNAME…</p>
            </div>
          )}
          {phase === "promoted" && (
            <div className="border border-neon/60 bg-black/70 px-2.5 py-2 backdrop-blur-sm">
              <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-neon">APP RECONNECTING TO NEW WRITER</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden bg-white/10">
                <div className="h-full bg-neon" style={{ width: `${(downtime / 25) * 100}%` }} />
              </div>
              <p className="mt-1 text-[6.5px] uppercase tracking-wider text-muted-foreground">DOWNTIME {downtime.toFixed(1)}s / ~25s</p>
            </div>
          )}
          {phase === "rebuilding" && (
            <div className="border border-aws/50 bg-black/70 px-2.5 py-2 backdrop-blur-sm">
              <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-aws">REBUILDING OLD PRIMARY AS NEW STANDBY</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden bg-white/10">
                <div className="h-full bg-aws" style={{ width: `${rebuildPct}%` }} />
              </div>
              <p className="mt-1 text-[6.5px] uppercase tracking-wider text-muted-foreground">{rebuildPct}% — PROTECTION RESTORED AT 100%</p>
            </div>
          )}
        </div>

        <StepBadge step={phaseIdx} total={5} text={FA_STEP_TEXT[phaseIdx]} />
      </FlowCanvas>

      <VerdictFlash show={flash === "ok"} text="FAILOVER COMPLETE" tone="ok" />
      <VerdictFlash show={flash === "deny"} text="PRIMARY DOWN" tone="deny" />
      <UseCaseNote>
        ONE CLICK TO SURVIVE AN AZ OUTAGE: SYNC STANDBY + AUTOMATIC CNAME FLIP — THE APP ONLY SEES A ~25s BLIP, NEVER A RE-POINT
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — READ REPLICAS: WRITE ONCE, READ N WIDE                     */
/* ================================================================== */

const REPLICA_POS = [
  { x: 62, y: 14 },
  { x: 70, y: 32 },
  { x: 75, y: 50 },
  { x: 70, y: 68 },
  { x: 62, y: 86 },
];

const REPLICA_LINK_D = [
  "M16,50 C28,50 40,14 55,14",
  "M16,50 C28,50 42,32 62,32",
  "M16,50 C30,50 46,50 67,50",
  "M16,50 C28,50 42,68 62,68",
  "M16,50 C28,50 40,86 55,86",
];

const SELECT_KEYS = ["orders", "users", "carts", "invoices", "sessions"];

function ReadReplicasUseCase({ immersiveActive, immersiveToggle }: RdsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [n, setN] = useState(2);
  const [lags, setLags] = useState<number[]>([38, 42, 35, 40, 36]);
  const [writesRps, setWritesRps] = useState(980);
  const [readsRps, setReadsRps] = useState(8000);
  const [lines, setLines] = useState<UcLine[]>([]);

  const idRef = useRef(1);
  const nRef = useRef(2);
  const lagsRef = useRef<number[]>([38, 42, 35, 40, 36]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const addReplica = () => {
    if (nRef.current >= 5) {
      push("demo caps at 5 — real RDS allows up to 15 replicas per source instance", "dim");
      return;
    }
    const next = nRef.current + 1;
    nRef.current = next;
    setN(next);
    const nl = [...lagsRef.current];
    nl[next - 1] = 600; // fresh replica starts deep in catch-up replay
    lagsRef.current = nl;
    setLags(nl);
    push(`replica-${next} provisioning from writer snapshot — async replay catching up (lag 600ms)`, "aws");
  };

  // replica lag jitters + drains toward steady state
  useTicker(running, () => {
    const nl = lagsRef.current.map((l, i) => (i < nRef.current ? Math.max(6, Math.round(l * 0.75 + Math.random() * 30)) : l));
    lagsRef.current = nl;
    setLags(nl);
  }, 950);

  // write load — every write ships async to every replica
  useTicker(running, () => {
    const wr = 900 + Math.floor(Math.random() * 260);
    setWritesRps(wr);
    if (Math.random() < 0.5) {
      const i = Math.floor(Math.random() * nRef.current);
      push(`INSERT INTO orders — ship WAL → replica-${i + 1} (lag ${lagsRef.current[i]}ms)`, "aws");
    }
  }, 1100);

  // read load — SELECTs round-robin across the fleet
  useTicker(running, () => {
    setReadsRps(nRef.current * (3600 + Math.floor(Math.random() * 700)));
    const i = Math.floor(Math.random() * nRef.current);
    const key = SELECT_KEYS[Math.floor(Math.random() * SELECT_KEYS.length)];
    const lag = lagsRef.current[i];
    push(`SELECT * FROM ${key} → replica-${i + 1} (lag ${lag}ms${lag > 300 ? " — STALE RISK" : ""})`, lag > 300 ? "danger" : "neon");
  }, 1400);

  const reset = () => {
    setRunning(false);
    nRef.current = 2;
    setN(2);
    lagsRef.current = [38, 42, 35, 40, 36];
    setLags([38, 42, 35, 40, 36]);
    setWritesRps(980);
    setReadsRps(8000);
    setLines([]);
  };

  const avgLag = Math.round(
    lags.slice(0, n).reduce((a, l) => a + l, 0) / Math.max(1, n)
  );

  return (
    <UseCaseShell
      title="USE CASE // READ REPLICAS — READ SCALING"
      subtitle="ONE WRITER TAKES WRITES — N ASYNC REPLICAS FAN OUT THE SELECTS (LAG IS THE CONTRACT)"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="WRITES/S" value={writesRps} tone="aws" />
          <UCStat label="READS/S" value={readsRps} tone="neon" />
          <UCStat label="REPLICAS N" value={`${n} / 5`} tone="mint" />
          <UCStat label="LAG MS" value={avgLag} tone={avgLag > 300 ? "danger" : "magenta"} />
          <UCStat label="READ CAPACITY" value={`${n * 20}%`} tone="mint" />
          <UCStat label="CONSISTENCY" value="EVENTUAL" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `FLEET LIVE — ${n} REPLICAS SERVING READS` : "FLEET IDLE — PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">FLEET CONFIG</p>
          <UCButton onClick={addReplica} tone="mint" disabled={n >= 5} ariaLabel="Add a read replica">
            <Plus className="w-3 h-3" /> ADD REPLICA {n >= 5 ? "(MAX 5)" : `(${5 - n} LEFT)`}
          </UCButton>
          <p className="text-[7px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-relaxed">
            NEW REPLICAS START AT 600ms LAG AND DRAIN TO STEADY STATE — READS THEY SERVE MEANWHILE RISK STALE DATA
          </p>
        </>
      }
      logLines={lines}
      logTitle="REPLICATION LOG // LIVE"
      logEmpty="PRESS RUN — WRITES SHIP OUT, READS FAN BACK IN"
    >
      <FlowCanvas ariaLabel="RDS read replicas fan-out diagram" className="h-full">
        {/* writer → replica async links */}
        {REPLICA_POS.map((p, i) => (
          <FlowLink
            key={`rl-${i}`}
            d={REPLICA_LINK_D[i]}
            dashed
            status={running && i < n ? "flowing" : "idle"}
            dotDuration={1.6}
            dotDelay={i * 0.18}
          />
        ))}

        <FlowNode
          x={10}
          y={50}
          size="sm"
          delay={0.1}
          icon={<RDSInstanceIcon className="w-3 h-3" />}
          label="WRITER · AZ-A"
          sub={`${writesRps} W/S · INSERT/UPDATE`}
          status={running ? "active" : "idle"}
          pulse={running}
        />

        {REPLICA_POS.map((p, i) => (
          <FlowNode
            key={`rn-${i}`}
            x={p.x}
            y={p.y}
            size="xs"
            delay={0.25 + i * 0.08}
            icon={<Database className="w-3 h-3" />}
            label={`REPLICA-${i + 1}`}
            sub={i < n ? `LAG ${lags[i]}ms · ${lags[i] > 300 ? "CATCHING UP" : "SYNCED"}` : "NOT PROVISIONED"}
            status={i < n ? (lags[i] > 300 ? "warn" : "success") : "idle"}
            pulse={running && i < n}
          />
        ))}

        <FlowLabel x={50} y={6} tone="aws">ONE WRITER — N READERS · ASYNC · EVENTUAL CONSISTENCY</FlowLabel>
        <FlowLabel x={38} y={50} tone="magenta">ASYNC WAL SHIP →</FlowLabel>

        {/* read throughput capacity bar — grows with every replica */}
        <div className="absolute bottom-[7%] left-[12%] right-[24%] z-10 border border-foreground/20 bg-black/60 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">READ THROUGHPUT CAPACITY</span>
            <span className="text-[8px] font-extrabold tabular-nums text-mint">{n} × ~4K READS/S</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden bg-white/10">
            <motion.div
              className="h-full bg-mint shadow-[0_0_10px_rgba(0,255,163,0.6)]"
              animate={{ width: `${n * 20}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
            />
          </div>
        </div>

        <StepBadge step={n - 1} total={5} text={`REPLICA FLEET — ${n} ACTIVE`} />
      </FlowCanvas>

      <UseCaseNote>
        READ-HEAVY APPS: OFFLOAD 90%+ OF TRAFFIC TO REPLICAS — PROMOTABLE, CROSS-REGION, AND THE WRITER STAYS BORED
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — BACKUP & PITR: REWIND THE DATABASE TO ANY SECOND           */
/* ================================================================== */

const PITR_WINDOW = 60; // seconds visible on the timeline
const PITR_BASE = 43200; // 12:00:00

const fmtClock = (t: number) => {
  const total = PITR_BASE + t;
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(Math.floor(total / 3600) % 24)}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
};

interface RestoreJob {
  point: number;
  lost: number;
}

function PitrUseCase({ immersiveActive, immersiveToggle }: RdsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [clock, setClock] = useState(0);
  const [walTicks, setWalTicks] = useState<number[]>([]);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  const [restoreBack, setRestoreBack] = useState(10);
  const [restoring, setRestoring] = useState(false);
  const [restorePct, setRestorePct] = useState(0);
  const [restoreJob, setRestoreJob] = useState<RestoreJob | null>(null);
  const [lastRestore, setLastRestore] = useState<{ point: string; lost: number; took: string } | null>(null);
  const [flash, setFlash] = useState<null | "ok" | "deny">(null);
  const [lines, setLines] = useState<UcLine[]>([]);

  const idRef = useRef(1);
  const clockRef = useRef(0);
  const failedAtRef = useRef<number | null>(null);
  const restorePctRef = useRef(0);
  const walRef = useRef<number[]>([]);
  const pendingRef = useRef<RestoreJob | null>(null);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const doFlash = (f: "ok" | "deny") => {
    setFlash(f);
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1800);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  // sim clock — WAL segments stream to the backup every second
  useTicker(running, () => {
    const nc = clockRef.current + 1;
    clockRef.current = nc;
    setClock(nc);
    if (failedAtRef.current === null) {
      walRef.current = [...walRef.current.slice(-64), nc];
      setWalTicks(walRef.current);
      if (nc % 5 === 0) {
        push(`WAL segment ${String(nc).padStart(4, "0")} archived — RPO ~1s — retained 35d`, "neon");
      }
    }
  }, 600);

  // restore progress — snapshot + WAL replay onto a fresh instance
  useTicker(restoring, () => {
    const np = restorePctRef.current + 4;
    if (np >= 100) {
      restorePctRef.current = 0;
      setRestorePct(100);
      const job = pendingRef.current;
      setRestoring(false);
      failedAtRef.current = null;
      setFailedAt(null);
      setRestoreJob(null);
      if (job) {
        setLastRestore({ point: fmtClock(job.point), lost: job.lost, took: "1.6s" });
        push(`restored to ${fmtClock(job.point)} — lost only ${job.lost}s of data`, "mint");
        push("new instance promoted — app reconnects — endpoint unchanged", "mint");
        doFlash("ok");
      }
    } else {
      restorePctRef.current = np;
      setRestorePct(np);
    }
  }, 65);

  const injectFailure = () => {
    if (failedAtRef.current !== null || restoring) return;
    const t = clockRef.current;
    failedAtRef.current = t;
    setFailedAt(t);
    doFlash("deny");
    push(`INJECT FAILURE — storage corruption at ${fmtClock(t)} — APP DOWN`, "danger");
    push("WAL replay window open — every second before failure is restorable", "aws");
  };

  const startRestore = () => {
    if (failedAt === null || restoring) return;
    const lost = Math.min(restoreBack, clockRef.current);
    const point = Math.max(0, clockRef.current - lost);
    const job = { point, lost };
    pendingRef.current = job;
    restorePctRef.current = 0;
    setRestorePct(0);
    setRestoreJob(job);
    setRestoring(true);
    push(`RESTORE — launching replacement instance — replaying WAL to ${fmtClock(point)} (T-${lost}s)…`, "magenta");
  };

  const reset = () => {
    setRunning(false);
    clockRef.current = 0;
    failedAtRef.current = null;
    restorePctRef.current = 0;
    walRef.current = [];
    pendingRef.current = null;
    setClock(0);
    setWalTicks([]);
    setFailedAt(null);
    setRestoreBack(10);
    setRestoring(false);
    setRestorePct(0);
    setRestoreJob(null);
    setLastRestore(null);
    setFlash(null);
    setLines([]);
  };

  const appDown = failedAt !== null;
  const previewPoint = failedAt !== null ? Math.max(0, failedAt - Math.min(restoreBack, failedAt)) : null;
  const previewLost = failedAt !== null && previewPoint !== null ? failedAt - previewPoint : 0;
  const winStart = Math.max(0, clock - PITR_WINDOW);
  const posPct = (t: number) => ((t - winStart) / PITR_WINDOW) * 100;

  const step = restoring ? 2 : appDown ? 1 : 0;
  const stepText = restoring ? `RESTORING — ${restorePct}%` : appDown ? "APP DOWN — PICK A RESTORE POINT" : "APP LIVE — WAL STREAMING";

  return (
    <UseCaseShell
      title="USE CASE // AUTOMATED BACKUP & PITR"
      subtitle="CONTINUOUS WAL BACKUP — REWIND THE DATABASE TO ANY SECOND IN A 35-DAY WINDOW"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="RETENTION" value="35D" tone="aws" />
          <UCStat label="RPO" value="~1S" tone="mint" />
          <UCStat label="RESTORE TIME" value={lastRestore ? lastRestore.took : "—"} tone="magenta" />
          <UCStat label="POINT PICKED" value={lastRestore ? lastRestore.point : "—"} tone="mint" />
          <UCStat label="SIM CLOCK" value={fmtClock(clock)} tone="neutral" />
          <UCStat
            label="DATA LOSS"
            value={lastRestore ? `${lastRestore.lost}s` : appDown ? `${previewLost}s PENDING` : "—"}
            tone={appDown && !restoring ? "danger" : "neutral"}
          />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={
              restoring
                ? `RESTORING — ${restorePct}%`
                : appDown
                  ? "APP DOWN — CHOOSE A POINT AND RESTORE"
                  : running
                    ? `LIVE — WAL ARCHIVED TO ${fmtClock(clock)}`
                    : "IDLE — PRESS RUN TO START THE CLOCK"
            }
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CHAOS + RECOVERY</p>
          <UCButton onClick={injectFailure} tone="danger" disabled={appDown || restoring} ariaLabel="Inject a storage failure at the current time">
            <AlertTriangle className="w-3 h-3" /> INJECT FAILURE
          </UCButton>
          <Slider
            label="RESTORE POINT — SECONDS BEFORE FAILURE"
            value={restoreBack}
            min={1}
            max={60}
            onChange={(v) => setRestoreBack(v)}
            ariaLabel="Seconds before failure to restore to"
            suffix="s"
          />
          <UCButton onClick={startRestore} tone="mint" disabled={!appDown || restoring} ariaLabel="Restore the database to the chosen point in time">
            <History className="w-3 h-3" /> RESTORE TO T-{restoreBack}S
          </UCButton>
        </>
      }
      logLines={lines}
      logTitle="BACKUP / RESTORE LOG // LIVE"
      logEmpty="PRESS RUN — THE WAL STARTS ARCHIVING EVERY SECOND"
    >
      <FlowCanvas ariaLabel="RDS backup and point-in-time recovery timeline diagram" className="h-full">
        {/* WAL stream instance → backup */}
        <FlowLink d="M88,26 C88,30 88,33 88,37" status={running && !appDown ? "flowing" : "idle"} dotDuration={0.7} />
        <FlowNode
          x={88}
          y={18}
          size="xs"
          delay={0.15}
          icon={<Database className="w-3 h-3" />}
          label="DB · NEXUS-PROD"
          sub={appDown ? (restoring ? `RESTORING ${restorePct}%` : "DOWN") : "LIVE · WAL ✓"}
          status={appDown ? (restoring ? "warn" : "error") : running ? "success" : "idle"}
          pulse={appDown && !restoring}
        />

        <FlowLabel x={44} y={12} tone="aws">
          <span className="inline-flex items-center gap-1"><HardDrive className="h-3 w-3" /> CONTINUOUS WAL BACKUP — 35-DAY RETENTION · RPO ~1s</span>
        </FlowLabel>

        {/* WAL timeline band — last 60s window */}
        <div className="absolute left-[6%] right-[6%] top-[32%] h-[104px] border border-foreground/15 bg-black/30">
          <p className="absolute left-1.5 top-1 text-[6.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            WAL SEGMENT TIMELINE — VIEW: LAST 60S · FULL WINDOW: 35 DAYS
          </p>
          {/* WAL segment dots */}
          {walTicks.map((t) => {
            const left = posPct(t);
            if (left < 0 || left > 100) return null;
            return (
              <span
                key={t}
                className="absolute h-[5px] w-[5px] border border-aws/60 bg-aws/40"
                style={{ left: `${left}%`, top: `${26 + ((t * 13) % 52)}%` }}
                aria-hidden="true"
              />
            );
          })}
          {/* failure marker */}
          {failedAt !== null && posPct(failedAt) <= 100 && (
            <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-danger" style={{ left: `${Math.max(0, posPct(failedAt))}%` }}>
              <span className="absolute -top-4 left-1 whitespace-nowrap text-[6.5px] font-extrabold tracking-[0.15em] text-danger">
                T — FAILURE {fmtClock(failedAt)}
              </span>
            </div>
          )}
          {/* restore point marker (preview or committed) */}
          {(restoring || appDown) && previewPoint !== null && posPct(previewPoint) >= -2 && (
            <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-mint" style={{ left: `${Math.max(0, posPct(previewPoint))}%` }}>
              <span className="absolute -bottom-4 left-1 whitespace-nowrap text-[6.5px] font-extrabold tracking-[0.15em] text-mint">
                RESTORE POINT {fmtClock(previewPoint)} (T-{previewLost}s)
              </span>
            </div>
          )}
          <span className="absolute bottom-1 right-1.5 text-[6.5px] font-bold uppercase tracking-[0.2em] text-aws">NOW {fmtClock(clock)}</span>
        </div>

        {/* app status / restore progress overlay */}
        <div className="absolute left-[16%] right-[30%] top-[62%] z-10">
          {restoring ? (
            <div className="border border-mint/60 bg-black/70 px-2.5 py-2 backdrop-blur-sm box-glow">
              <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-mint">RESTORING — SNAPSHOT + WAL REPLAY</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden bg-white/10">
                <div className="h-full bg-mint" style={{ width: `${restorePct}%` }} />
              </div>
              <p className="mt-1 text-[6.5px] uppercase tracking-wider text-muted-foreground">
                TARGET {restoreJob ? fmtClock(restoreJob.point) : "—"} — {restorePct}%
              </p>
            </div>
          ) : appDown ? (
            <div className="border border-danger/60 bg-black/70 px-2.5 py-2 backdrop-blur-sm">
              <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-danger">APP DOWN — STORAGE CORRUPTION</p>
              <p className="mt-0.5 text-[6.5px] uppercase tracking-wider text-muted-foreground">
                FAILED AT {fmtClock(failedAt ?? 0)} — SLIDE THE RESTORE POINT + HIT RESTORE TO T-{restoreBack}S
              </p>
            </div>
          ) : running ? (
            <div className="border border-mint/40 bg-black/60 px-2.5 py-2 backdrop-blur-sm">
              <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-mint">APP LIVE — WAL ARCHIVING EVERY SECOND</p>
              <p className="mt-0.5 text-[6.5px] uppercase tracking-wider text-muted-foreground">INJECT FAILURE TO OPEN THE PITR WINDOW</p>
            </div>
          ) : (
            <div className="border border-foreground/15 bg-black/50 px-2.5 py-2 backdrop-blur-sm">
              <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">PITR ARMED — PRESS RUN TO START THE CLOCK</p>
            </div>
          )}
        </div>

        <StepBadge step={step} total={3} text={stepText} />
      </FlowCanvas>

      <VerdictFlash show={flash === "ok"} text="RESTORE COMPLETE" tone="ok" />
      <VerdictFlash show={flash === "deny"} text="APP DOWN" tone="deny" />
      <UseCaseNote>
        AUTOMATED BACKUPS + WAL = TIME MACHINE: RESTORE TO ANY SECOND IN 35 DAYS — WORST CASE IS ~1s OF LOST WRITES, NOT THE DATABASE
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* shared slider — hoisted to module scope (no nested components)      */
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

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function RdsUseCases({ id, immersiveActive, immersiveToggle }: RdsUseCasesProps) {
  if (id === "MULTI_AZ") return <MultiAzUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "READ_REPLICAS") return <ReadReplicasUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <PitrUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
