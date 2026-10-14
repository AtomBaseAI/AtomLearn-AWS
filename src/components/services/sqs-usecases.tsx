"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownWideNarrow, Gauge, Recycle, ServerCog, Skull } from "lucide-react";
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
import { EC2Icon, SNSIcon, SQSIcon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES + HELPERS                                              */
/* ================================================================== */

export type SqsUseCaseId = "BUFFER" | "WORKER_SCALING" | "REDRIVE";

interface SqsUseCasesProps {
  id: SqsUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

interface UCLine {
  id: number;
  text: string;
  tone?: string;
}

interface QMsg {
  id: number;
  poison: boolean;
  tries: number;
}

const pad3 = (n: number) => String(n).padStart(3, "0");

const QUEUE_MAX = 200;
const RISK_LINE = 150;
const DRAIN_RATE = 10;
const TARGET_DEPTH = 10;
const WORKER_RATE = 5;
const PRODUCER_RATE = 25;

/* ================================================================== */
/* TAB 02 — BUFFER & THROTTLE (BURSTY PRODUCER VS FIXED CONSUMER)      */
/* ================================================================== */

function DepthBar({ depth }: { depth: number }) {
  const pct = Math.min(100, (depth / QUEUE_MAX) * 100);
  const cls = depth >= QUEUE_MAX ? "bg-danger/80" : depth > RISK_LINE ? "bg-danger/60" : depth > QUEUE_MAX * 0.375 ? "bg-neon/60" : "bg-aws/60";
  return (
    <div className="relative h-3.5 border border-foreground/20 bg-black/60">
      <motion.div className={`h-full ${cls}`} animate={{ width: `${pct}%` }} transition={{ duration: 0.45, ease: "easeOut" }} />
      <span className="absolute top-0 bottom-0 left-[75%] border-l border-dashed border-danger/70" aria-hidden="true" />
      <span className="absolute -bottom-3.5 left-0 text-[6px] font-bold tracking-wider text-muted-foreground">0</span>
      <span className="absolute -bottom-3.5 right-[23%] text-[6px] font-bold tracking-wider text-danger/80">RISK@{RISK_LINE}</span>
      <span className="absolute -bottom-3.5 right-0 text-[6px] font-bold tracking-wider text-muted-foreground">{QUEUE_MAX}</span>
    </div>
  );
}

function ThruBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "aws" | "mint" }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[6.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground truncate">{label}</span>
        <span className={`text-[8px] font-extrabold tabular-nums ${tone === "aws" ? "text-aws" : "text-mint"}`}>{value}/S</span>
      </div>
      <div className="h-2 border border-foreground/20 bg-black/60">
        <motion.div className={`h-full ${tone === "aws" ? "bg-aws/60" : "bg-mint/60"}`} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
      </div>
    </div>
  );
}

function BurstSlider({ value, onChange, ariaLabel }: { value: number; onChange: (v: number) => void; ariaLabel: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">PRODUCER BURST</span>
        <span className="text-[8px] font-extrabold tabular-nums text-aws">{value}/S</span>
      </div>
      <input
        type="range"
        min={1}
        max={50}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label={ariaLabel}
        className="w-full h-1.5 accent-[#ff9900] cursor-pointer bg-black/60 border border-foreground/20"
      />
    </div>
  );
}

function BufferUseCase({ immersiveActive, immersiveToggle }: SqsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [burst, setBurst] = useState(24);
  const [depth, setDepth] = useState(0);
  const [age, setAge] = useState(0);
  const [flash, setFlash] = useState(false);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const tickRef = useRef(0);
  const depthRef = useRef(0);
  const ageRef = useRef(0);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  useEffect(() => {
    depthRef.current = depth;
  }, [depth]);
  useEffect(() => {
    ageRef.current = age;
  }, [age]);

  // 1s clock — producer burst lands in the buffer, consumers drain a fixed 10/s
  useTicker(running, () => {
    tickRef.current += 1;
    const d0 = depthRef.current;
    const next = Math.min(QUEUE_MAX, Math.max(0, d0 + burst - DRAIN_RATE));
    depthRef.current = next;
    setDepth(next);
    if (next > 0) {
      ageRef.current += 1;
      setAge(ageRef.current);
    } else {
      ageRef.current = 0;
      setAge(0);
    }
    if (d0 < RISK_LINE && next >= RISK_LINE)
      push(`DEPTH ${next} — OVERFLOW RISK — producers are outpacing the fixed ${DRAIN_RATE}/s drain`, "danger");
    if (d0 < QUEUE_MAX && next === QUEUE_MAX) {
      push("QUEUE FULL — SQS is throttling SendMessage — producers must back off", "danger");
      setFlash(true);
      if (flashT.current) clearTimeout(flashT.current);
      flashT.current = setTimeout(() => setFlash(false), 2200);
    }
    if (d0 >= RISK_LINE && next < RISK_LINE) push("recovered — depth back under the 150 risk line", "mint");
    if (d0 > 0 && next === 0) push("buffer drained — consumers caught up with the burst", "mint");
    if (tickRef.current % 6 === 0)
      push(`depth ${next} · in ${burst}/s · out ${DRAIN_RATE}/s · oldest msg ${next > 0 ? ageRef.current : 0}s`, "dim");
  }, 1000);

  useEffect(
    () => () => {
      if (flashT.current) clearTimeout(flashT.current);
    },
    []
  );

  const reset = () => {
    setRunning(false);
    tickRef.current = 0;
    depthRef.current = 0;
    ageRef.current = 0;
    setDepth(0);
    setAge(0);
    setFlash(false);
    setLines([]);
  };

  const statusTone = depth >= QUEUE_MAX ? "danger" : depth > RISK_LINE ? "danger" : depth > QUEUE_MAX * 0.375 ? "neon" : "mint";
  const statusText = depth >= QUEUE_MAX ? "FULL · THROTTLED" : depth > RISK_LINE ? "OVERFLOW RISK" : depth > 0 ? "BUFFERING" : "EMPTY";
  const badgeIdx = depth >= QUEUE_MAX ? 3 : depth > RISK_LINE ? 2 : depth > 0 ? 1 : 0;
  const badgeText = ["EMPTY", "BUFFERING", "RISK > 150", "FULL — THROTTLING"][badgeIdx];

  return (
    <UseCaseShell
      title="USE CASE // BUFFER & THROTTLE — DECOUPLE BURSTY PRODUCERS"
      subtitle={`PRODUCER BURST (1–50/S) → SQS BUFFER (MAX ${QUEUE_MAX}) → FIXED ${DRAIN_RATE}/S CONSUMER`}
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="DEPTH" value={`${depth}/${QUEUE_MAX}`} tone={statusTone} />
          <UCStat label="PRODUCED/S" value={burst} tone="aws" />
          <UCStat label="CONSUMED/S" value={DRAIN_RATE} tone="mint" />
          <UCStat label="OLDEST MSG AGE" value={`${age}s`} tone={age > 20 ? "neon" : "neutral"} />
          <UCStat label="HEADROOM" value={QUEUE_MAX - depth} tone={QUEUE_MAX - depth < 50 ? "danger" : "neutral"} />
          <UCStat label="STATUS" value={statusText} tone={statusTone} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `BUFFER LIVE — IN ${burst}/S · OUT ${DRAIN_RATE}/S` : "IDLE — PRESS RUN AND PUSH THE SLIDER"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">PRODUCER LOAD</p>
          <BurstSlider
            value={burst}
            onChange={(v) => {
              setBurst(v);
              push(`producer burst → ${v} msg/s (consumer stays fixed at ${DRAIN_RATE}/s)`, "aws");
            }}
            ariaLabel="Producer burst rate in messages per second"
          />
          <p className="text-[7.5px] leading-relaxed tracking-wider uppercase text-muted-foreground/80">
            slide past 10/s and the depth bar climbs — cross 150 for the overflow warning, hit 200 to get throttled
          </p>
        </>
      }
      logLines={lines}
      logTitle="BUFFER LOG // LIVE"
      logEmpty="PRESS RUN — THEN DRAG THE BURST SLIDER AGAINST THE FIXED DRAIN"
    >
      <FlowCanvas ariaLabel="SQS buffer and throttle use case diagram" className="h-full">
        <FlowLink d="M17,30 C23,30 26,31 30,32" status={running ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M60,34 C70,34 76,31 81,30" status={running && depth > 0 ? "success" : "idle"} dotDuration={1.3} dotDelay={0.2} />

        <FlowNode
          x={11}
          y={30}
          size="sm"
          delay={0.1}
          icon={<SNSIcon className="w-3 h-3" />}
          label="PRODUCERS"
          sub={`${burst} MSG/S BURST`}
          status={running ? "active" : "idle"}
          pulse={running}
        />
        <FlowNode
          x={87}
          y={30}
          size="sm"
          delay={0.3}
          icon={<EC2Icon className="w-3 h-3" />}
          label="WORKER POOL"
          sub={`FIXED DRAIN ${DRAIN_RATE}/S`}
          status={running && depth > 0 ? "success" : "idle"}
          pulse={running && depth > 0}
        />

        {/* QUEUE CORE — animated depth bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[190px] sm:w-[224px]"
          style={{ left: "45%", top: "33%" }}
        >
          <div className={`glass box-glow cyber-cut p-2 ${depth > RISK_LINE ? "shadow-[0_0_18px_rgba(255,51,85,0.3)]" : ""}`}>
            <div className="flex items-center justify-between pb-1 border-b border-aws/15">
              <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                <SQSIcon className="w-3 h-3" /> ORDERS-QUEUE
              </span>
              <motion.span
                key={depth}
                initial={{ scale: 1.35, color: depth > RISK_LINE ? "#ff3355" : "#00ffa3" }}
                animate={{ scale: 1, color: depth > RISK_LINE ? "#ff3355" : "#ff9900" }}
                className="text-[12px] font-extrabold tabular-nums"
              >
                {depth}
              </motion.span>
            </div>
            <div className="pt-2 pb-3.5">
              <DepthBar depth={depth} />
            </div>
            <p className="text-[6px] uppercase tracking-wider text-muted-foreground">SQS BUFFER — ABSORBS BURSTS, DRAIN STAYS FLAT</p>
          </div>
        </motion.div>

        {/* throughput bars */}
        <div className="absolute left-[12%] right-[12%] bottom-[12%] z-10 flex gap-5">
          <ThruBar label={`PRODUCED · IN`} value={burst} max={50} tone="aws" />
          <ThruBar label={`CONSUMED · OUT`} value={Math.min(DRAIN_RATE, depth > 0 || !running ? DRAIN_RATE : 0)} max={50} tone="mint" />
        </div>

        <FlowLabel x={45} y={10} tone="aws">PRODUCERS ≠ CONSUMERS — THE QUEUE IS THE SHOCK ABSORBER</FlowLabel>
        {depth > RISK_LINE && depth < QUEUE_MAX && (
          <FlowLabel x={45} y={58} tone="danger">⚠ OVERFLOW RISK — DEPTH &gt; {RISK_LINE}</FlowLabel>
        )}
        {depth >= QUEUE_MAX && <FlowLabel x={45} y={58} tone="danger">✕ SENDMESSAGE THROTTLED — QUEUE AT {QUEUE_MAX}/{QUEUE_MAX}</FlowLabel>}
        <StepBadge step={badgeIdx} total={4} text={badgeText} />
      </FlowCanvas>

      <VerdictFlash show={flash} text={`THROTTLED — QUEUE AT ${QUEUE_MAX}/${QUEUE_MAX}`} tone="deny" />
      <UseCaseNote>
        FLASH SALE? 50× NORMAL LOAD? SQS absorbs the whole burst and consumers drain at their own fixed pace — no producer ever blocks, no consumer ever drowns
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — WORKER AUTOSCALING (ASG TARGET TRACKING ON DEPTH)          */
/* ================================================================== */

function WorkerChips({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={`px-1.5 py-1 border text-[7px] font-bold tracking-wider tabular-nums ${
            i < count ? "border-mint/70 bg-mint/10 text-mint box-glow" : "border-dashed border-foreground/20 text-muted-foreground/40"
          }`}
        >
          W{i + 1}
        </span>
      ))}
    </div>
  );
}

function DepthCurve({ history, target, max }: { history: number[]; target: number; max: number }) {
  return (
    <div className="relative h-full border border-foreground/15 bg-black/50 overflow-hidden">
      <div className="absolute inset-x-0 border-t border-dashed border-aws/50" style={{ bottom: `${(target / max) * 100}%` }}>
        <span className="absolute right-1 -top-3 text-[6px] font-bold tracking-wider text-aws">TARGET {target}</span>
      </div>
      <div className="absolute inset-0 flex items-end gap-[2px] px-1 pb-0.5">
        {history.map((d, i) => (
          <div
            key={i}
            className={`flex-1 ${d >= 40 ? "bg-danger/70" : d >= target ? "bg-neon/60" : "bg-mint/50"}`}
            style={{ height: `${Math.max(2, Math.min(100, (d / max) * 100))}%` }}
          />
        ))}
      </div>
      <span className="absolute left-1.5 top-1 text-[6px] font-bold uppercase tracking-wider text-muted-foreground">
        QUEUE DEPTH — LAST {history.length}S · SPIKES → SCALE-OUT → FLATTENS
      </span>
    </div>
  );
}

const WS_STEPS = ["MIN 2 WORKERS", "SCALE-OUT ZONE", "CONVERGING", "TARGET LOCKED"];

function WorkerScalingUseCase({ immersiveActive, immersiveToggle }: SqsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [workers, setWorkers] = useState(2);
  const [depth, setDepth] = useState(28);
  const [events, setEvents] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [flash, setFlash] = useState<null | { text: string; tone: "ok" | "aws" }>(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const tickRef = useRef(0);
  const depthRef = useRef(28);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  useEffect(() => {
    depthRef.current = depth;
  }, [depth]);

  // 1s clock — constant producer load, ASG reacts to depth vs target
  useTicker(running, () => {
    tickRef.current += 1;
    const next = Math.max(0, depthRef.current + PRODUCER_RATE - workers * WORKER_RATE);
    depthRef.current = next;
    setDepth(next);
    setHistory((h) => [...h.slice(-26), next]);
    if (tickRef.current % 2 === 0) {
      if (next > TARGET_DEPTH && workers < 6) {
        const w = workers + 1;
        setWorkers(w);
        setEvents((e) => e + 1);
        push(`ALARM: depth ${next} > target ${TARGET_DEPTH} — ASG SCALE OUT → ${w} workers (drain ${w * WORKER_RATE}/s)`, "aws");
        setFlash({ text: `SCALE OUT → ${w} WORKERS`, tone: "aws" });
        if (flashT.current) clearTimeout(flashT.current);
        flashT.current = setTimeout(() => setFlash(null), 1800);
      } else if (next < 5 && workers > 2) {
        const w = workers - 1;
        setWorkers(w);
        setEvents((e) => e + 1);
        push(`depth ${next} below floor 5 — ASG SCALE IN → ${w} workers (drain ${w * WORKER_RATE}/s — $ saved)`, "magenta");
        setFlash({ text: `SCALE IN → ${w} WORKERS`, tone: "ok" });
        if (flashT.current) clearTimeout(flashT.current);
        flashT.current = setTimeout(() => setFlash(null), 1800);
      } else if (tickRef.current % 10 === 0) {
        push(`steady — depth ${next} · workers ${workers} · drain ${workers * WORKER_RATE}/s · target ${TARGET_DEPTH}`, "dim");
      }
    }
  }, 1000);

  useEffect(
    () => () => {
      if (flashT.current) clearTimeout(flashT.current);
    },
    []
  );

  const reset = () => {
    setRunning(false);
    tickRef.current = 0;
    depthRef.current = 28;
    setWorkers(2);
    setDepth(28);
    setEvents(0);
    setHistory([]);
    setFlash(null);
    setLines([]);
  };

  const badgeIdx = workers <= 2 ? 0 : workers === 3 ? 1 : workers === 4 ? 2 : 3;

  return (
    <UseCaseShell
      title="USE CASE // WORKER AUTOSCALING — QUEUE-DRIVEN ASG"
      subtitle={`CLOUDWATCH ALARM ON DEPTH — > ${TARGET_DEPTH} SCALE OUT (MAX 6) · < 5 SCALE IN (MIN 2) — DRAIN = WORKERS × ${WORKER_RATE}/S`}
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="WORKERS" value={`${workers}/6`} tone="mint" />
          <UCStat label="DEPTH" value={depth} tone={depth > TARGET_DEPTH ? "neon" : "aws"} />
          <UCStat label="DRAIN RATE" value={`${workers * WORKER_RATE}/S`} tone="mint" />
          <UCStat label="SCALE EVENTS" value={events} tone="magenta" />
          <UCStat label="TARGET" value={TARGET_DEPTH} tone="aws" />
          <UCStat label="PRODUCER" value={`${PRODUCER_RATE}/S`} tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `ASG LIVE — ${workers} WORKERS DRAINING ${workers * WORKER_RATE}/S` : "IDLE — PRESS RUN, WATCH THE ASG FIGHT THE BACKLOG"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">SCALING POLICY</p>
          <div className="glass-inset cyber-cut-sm px-2.5 py-2 flex flex-col gap-1">
            <span className="text-[7px] font-bold tracking-wider text-muted-foreground uppercase">target tracking · queue depth</span>
            <span className="text-[8px] font-extrabold tracking-wider text-aws uppercase">
              OUT &gt; {TARGET_DEPTH} · IN &lt; 5 · MIN 2 · MAX 6
            </span>
          </div>
          <p className="text-[7.5px] leading-relaxed tracking-wider uppercase text-muted-foreground/80">
            constant 25/s load + 28 backlog: the ASG adds workers until drain ≈ production and the curve flattens
          </p>
        </>
      }
      logLines={lines}
      logTitle="ASG LOG // LIVE"
      logEmpty="PRESS RUN — WATCH ALARMS FIRE, WORKERS SPAWN, THE CURVE FLATTEN"
    >
      <FlowCanvas ariaLabel="SQS worker autoscaling use case diagram" className="h-full">
        <FlowLink d="M16,42 C20,42 23,41 27,40" status={running ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M44,40 C50,40 53,40 57,40" status={running && depth > 0 ? "success" : "idle"} dotDuration={1.2} dotDelay={0.2} />

        <FlowNode
          x={10}
          y={42}
          size="sm"
          delay={0.1}
          icon={<SNSIcon className="w-3 h-3" />}
          label="PRODUCERS"
          sub={`STEADY ${PRODUCER_RATE}/S`}
          status={running ? "active" : "idle"}
          pulse={running}
        />

        {/* QUEUE CORE */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[132px] sm:w-[150px]"
          style={{ left: "36%", top: "40%" }}
        >
          <div className="glass box-glow cyber-cut p-2">
            <div className="flex items-center justify-between pb-1 border-b border-aws/15">
              <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                <SQSIcon className="w-3 h-3" /> QUEUE
              </span>
              <motion.span
                key={depth}
                initial={{ scale: 1.35, color: depth > TARGET_DEPTH ? "#ffb347" : "#00ffa3" }}
                animate={{ scale: 1, color: depth > TARGET_DEPTH ? "#ff9900" : "#ff9900" }}
                className="text-[12px] font-extrabold tabular-nums"
              >
                {depth}
              </motion.span>
            </div>
            <p className="pt-1.5 text-[6.5px] uppercase tracking-wider text-muted-foreground">
              DRAIN <span className="text-mint font-bold">{workers * WORKER_RATE}/S</span> · TARGET {TARGET_DEPTH}
            </p>
          </div>
        </motion.div>

        {/* ASG WORKERS CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[168px] sm:w-[190px]"
          style={{ left: "68%", top: "40%" }}
        >
          <div className="glass cyber-cut p-2">
            <div className="flex items-center justify-between pb-1 border-b border-mint/15">
              <span className="flex items-center gap-1 text-[7.5px] font-bold uppercase tracking-[0.15em] text-mint">
                <ServerCog className="w-3 h-3" /> AUTO SCALING GROUP
              </span>
              <motion.span key={workers} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-[10px] font-extrabold tabular-nums text-mint">
                {workers}
              </motion.span>
            </div>
            <div className="pt-1.5">
              <WorkerChips count={workers} />
            </div>
            <p className="pt-1.5 text-[6px] uppercase tracking-wider text-muted-foreground">OUT &gt;{TARGET_DEPTH} · IN &lt;5 · EC2 INSTANCES</p>
          </div>
        </motion.div>

        {/* depth history curve */}
        <div className="absolute left-[8%] right-[8%] bottom-[6%] h-[16%] z-10">
          <DepthCurve history={history} target={TARGET_DEPTH} max={120} />
        </div>

        <FlowLabel x={45} y={9} tone="aws">CLOUDWATCH ALARM → ASG TARGET TRACKING ON QUEUE DEPTH</FlowLabel>
        <FlowLabel x={52} y={26} tone="default">{workers * WORKER_RATE}/S vs {PRODUCER_RATE}/S — THE GAP IS THE BACKLOG</FlowLabel>
        <StepBadge step={badgeIdx} total={4} text={WS_STEPS[badgeIdx]} />
      </FlowCanvas>

      <VerdictFlash show={flash?.tone === "aws"} text={flash?.text ?? ""} tone="aws" />
      <VerdictFlash show={flash?.tone === "ok"} text={flash?.text ?? ""} tone="ok" />
      <UseCaseNote>
        QUEUE DEPTH IS THE SCALING SIGNAL: backlog grows → alarm → ASG adds workers → drain catches up → curve flattens → scale back in and stop paying
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — DLQ REDRIVE (POISON PILL → MAXRECEIVECOUNT → REPLAY)       */
/* ================================================================== */

const RD_STEPS = ["MESSAGES FLOWING", "DELIVERED + DELETED", "POISON RETRY LOOP", "PARKED IN DLQ"];

function RedriveUseCase({ immersiveActive, immersiveToggle }: SqsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [fixPoison, setFixPoison] = useState(false);
  const [msgs, setMsgs] = useState<QMsg[]>([]);
  const [received, setReceived] = useState(0);
  const [poisonCaught, setPoisonCaught] = useState(0);
  const [dlqCount, setDlqCount] = useState(0);
  const [redrives, setRedrives] = useState(0);
  const [prodFlash, setProdFlash] = useState(false);
  const [consumerFlash, setConsumerFlash] = useState(false);
  const [dlqPulse, setDlqPulse] = useState(false);
  const [redrivePulse, setRedrivePulse] = useState(false);
  const [flash, setFlash] = useState<null | "ok" | "deny">(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const seqRef = useRef(0);
  const msgsRef = useRef<QMsg[]>([]);
  const dlqRef = useRef<{ id: number; tries: number }[]>([]);
  const receivedRef = useRef(0);
  const poisonRef = useRef(0);
  const pendT = useRef<ReturnType<typeof setTimeout>[]>([]);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    pendT.current.push(t);
  };

  // 950ms clock — produce, receive one message, let poison cycle toward the DLQ
  useTicker(running, () => {
    const mq = msgsRef.current;
    if (Math.random() < 0.85) {
      const n = Math.random() < 0.3 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        seqRef.current += 1;
        mq.push({ id: seqRef.current, poison: seqRef.current % 5 === 0, tries: 0 });
      }
      setProdFlash(true);
      later(() => setProdFlash(false), 480);
      if (seqRef.current % 5 === 0)
        push(`MSG-${pad3(seqRef.current)} enqueued — payload malformed (POISON, 1-in-5)`, "magenta");
    }

    const m = mq.shift();
    if (m) {
      receivedRef.current += 1;
      setReceived(receivedRef.current);
      if (!m.poison) {
        setConsumerFlash(true);
        later(() => setConsumerFlash(false), 520);
        if (receivedRef.current % 4 === 0) push(`MSG-${pad3(m.id)} — processed + deleted ✓ (at-least-once done right)`, "dim");
      } else {
        const tries = m.tries + 1;
        if (tries >= 3) {
          dlqRef.current.push({ id: m.id, tries });
          setDlqCount(dlqRef.current.length);
          poisonRef.current += 1;
          setPoisonCaught(poisonRef.current);
          setDlqPulse(true);
          later(() => setDlqPulse(false), 850);
          push(`MSG-${pad3(m.id)} — receive ×3 = maxReceiveCount → MOVED TO DLQ (poison contained)`, "danger");
        } else {
          mq.push({ ...m, tries });
          push(`MSG-${pad3(m.id)} — receive ×${tries}/3 — poison — visible again after visibility timeout`, "neon");
        }
      }
    }
    setMsgs([...mq]);
  }, 950);

  useEffect(() => {
    return () => {
      pendT.current.forEach((t) => clearTimeout(t));
      if (flashT.current) clearTimeout(flashT.current);
    };
  }, []);

  const inspectRedrive = () => {
    const n = dlqRef.current.length;
    if (n === 0) {
      push("DLQ EMPTY — nothing to inspect — poison either processed or still cycling", "dim");
      return;
    }
    const ids = dlqRef.current.map((m) => `MSG-${pad3(m.id)}`).join(" · ");
    setRedrives((v) => v + 1);
    setRedrivePulse(true);
    later(() => setRedrivePulse(false), 1200);
    if (fixPoison) {
      dlqRef.current = [];
      setDlqCount(0);
      push(`INSPECT ${ids} — root cause: payload schema drift — FIX POISON patch applied`, "mint");
      push(`REDRIVE OK — ${n} message(s) replayed → main queue → delivered ✓ — DLQ drained`, "mint");
      setFlash("ok");
    } else {
      dlqRef.current.forEach((m) => msgsRef.current.push({ id: m.id, poison: true, tries: 0 }));
      dlqRef.current = [];
      setDlqCount(0);
      push(`INSPECT ${ids} — still malformed — FIX POISON toggle is OFF`, "danger");
      push(`REDRIVE — ${n} message(s) replayed UNFIXED — they will dead-letter again`, "danger");
      setFlash("deny");
    }
    setMsgs([...msgsRef.current]);
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 2200);
  };

  const reset = () => {
    setRunning(false);
    pendT.current.forEach((t) => clearTimeout(t));
    pendT.current = [];
    if (flashT.current) clearTimeout(flashT.current);
    msgsRef.current = [];
    dlqRef.current = [];
    receivedRef.current = 0;
    poisonRef.current = 0;
    setMsgs([]);
    setReceived(0);
    setPoisonCaught(0);
    setDlqCount(0);
    setRedrives(0);
    setProdFlash(false);
    setConsumerFlash(false);
    setDlqPulse(false);
    setRedrivePulse(false);
    setFlash(null);
    setLines([]);
  };

  const shown = msgs.slice(-5).reverse();
  const badgeIdx = redrivePulse ? 3 : dlqPulse ? 2 : consumerFlash ? 1 : 0;

  return (
    <UseCaseShell
      title="USE CASE // DLQ REDRIVE — POISON PILL DRILL"
      subtitle="1 IN 5 MESSAGES IS POISON → 3 RECEIVE ATTEMPTS (MAXRECEIVECOUNT=3) → DLQ → INSPECT + REDRIVE"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="RECEIVED" value={received} tone="aws" />
          <UCStat label="POISON CAUGHT" value={poisonCaught} tone="magenta" />
          <UCStat label="DLQ DEPTH" value={dlqCount} tone={dlqCount > 0 ? "danger" : "neutral"} />
          <UCStat label="REDRIVES" value={redrives} tone="neon" />
          <UCStat label="POISON RATE" value="1 IN 5" tone="neutral" />
          <UCStat label="FIX POISON" value={fixPoison ? "PATCHED" : "BROKEN"} tone={fixPoison ? "mint" : "danger"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "QUEUE LIVE — POISON CYCLING TOWARD THE DLQ" : "IDLE — PRESS RUN TO FEED THE QUEUE"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">REDRIVE CONSOLE</p>
          <UCToggle on={fixPoison} onClick={() => setFixPoison((v) => !v)} accent="magenta" ariaLabel="Toggle the poison fix patch on or off">
            <Recycle className="w-3 h-3" /> FIX POISON {fixPoison ? "ON" : "OFF"}
          </UCToggle>
          <UCButton onClick={inspectRedrive} tone={dlqCount > 0 ? "aws" : "neutral"} ariaLabel="Inspect the DLQ batch and redrive it to the main queue">
            <Skull className="w-3 h-3" /> INSPECT + REDRIVE {dlqCount > 0 ? `(${dlqCount})` : ""}
          </UCButton>
          <p className="text-[7.5px] leading-relaxed tracking-wider uppercase text-muted-foreground/80">
            redrive replays messages — flip FIX POISON ON first or the batch dead-letters all over again
          </p>
        </>
      }
      logLines={lines}
      logTitle="POISON / REDRIVE LOG // LIVE"
      logEmpty="PRESS RUN — MAGENTA CHIPS ARE POISON, WATCH THEM TICK ×1 → ×2 → ×3"
    >
      <FlowCanvas ariaLabel="SQS DLQ redrive use case diagram" className="h-full">
        <FlowLink d="M17,20 C25,20 28,28 31,33" status={running && prodFlash ? "flowing" : "idle"} dotDuration={0.9} />
        <FlowLink d="M48,32 C60,26 68,22 77,20" status={consumerFlash ? "success" : "idle"} dotDuration={0.8} />
        <FlowLink d="M42,50 C42,60 42,66 42,74" dashed status={dlqPulse ? "error" : "idle"} dotDuration={1} />
        <FlowLink d="M33,74 C29,64 29,52 32,45" dashed status={redrivePulse ? "cyber" : "idle"} dotDuration={1} />

        <FlowNode
          x={12}
          y={16}
          size="sm"
          delay={0.1}
          icon={<SNSIcon className="w-3 h-3" />}
          label="PRODUCERS"
          sub="API EVENTS"
          status={prodFlash ? "active" : "idle"}
          pulse={prodFlash}
        />
        <FlowNode
          x={85}
          y={20}
          size="sm"
          delay={0.25}
          icon={<EC2Icon className="w-3 h-3" />}
          label="CONSUMER"
          sub={consumerFlash ? "PROCESSING ✓" : "POLLING…"}
          status={consumerFlash ? "success" : "idle"}
          pulse={consumerFlash}
        />
        <FlowNode
          x={38}
          y={80}
          size="sm"
          delay={0.45}
          icon={<Skull className="w-3 h-3" />}
          label={`DLQ [${dlqCount}]`}
          sub="POISON GRAVEYARD"
          status={dlqCount > 0 ? "error" : "idle"}
          pulse={dlqPulse || redrivePulse}
        />

        {/* QUEUE CORE — message chips w/ receive-attempt ticks */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[190px] sm:w-[220px]"
          style={{ left: "39%", top: "38%" }}
        >
          <div className="glass box-glow cyber-cut p-2">
            <div className="flex items-center justify-between pb-1 border-b border-aws/15">
              <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                <SQSIcon className="w-3 h-3" /> ORDERS-QUEUE
              </span>
              <motion.span key={msgs.length} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="text-[10px] font-extrabold tabular-nums text-aws">
                {msgs.length}
              </motion.span>
            </div>
            <div className="flex flex-col gap-[3px] pt-1.5 min-h-[74px]">
              {shown.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`h-4 flex items-center px-1 text-[6.5px] font-bold tracking-wider border ${
                    m.poison
                      ? "border-magenta/70 bg-magenta/15 text-magenta"
                      : m.tries > 0
                        ? "border-neon/50 bg-neon/10 text-neon"
                        : "border-aws/40 bg-aws/10 text-aws"
                  }`}
                >
                  {m.poison && <Skull className="w-2 h-2 mr-1" />}
                  MSG-{pad3(m.id)}
                  {m.tries > 0 && <span className="ml-auto">×{m.tries}/3</span>}
                </motion.div>
              ))}
              {msgs.length === 0 && (
                <span className="text-[6.5px] text-muted-foreground/60 px-1 uppercase tracking-wider">EMPTY — POLLING…</span>
              )}
            </div>
            <p className="pt-1.5 text-[6px] uppercase tracking-wider text-muted-foreground border-t border-aws/10 mt-1">
              MAXRECEIVECOUNT = <span className="text-magenta font-bold">3</span> → REDRIVE POLICY
            </p>
          </div>
        </motion.div>

        <FlowLabel x={45} y={7} tone="aws">POISON PILL DRILL — 1 IN 5 MESSAGES FAILS PROCESSING</FlowLabel>
        <FlowLabel x={68} y={62} tone="magenta">RECEIVE ATTEMPTS TICK ON EACH CHIP (×N/3)</FlowLabel>
        <FlowLabel x={70} y={90} tone="danger">REDRIVE = REPLAY — FIX THE BUG OR IT FAILS AGAIN</FlowLabel>
        <StepBadge step={badgeIdx} total={4} text={RD_STEPS[badgeIdx]} />
      </FlowCanvas>

      <VerdictFlash show={flash === "ok"} text="REDRIVE OK — DLQ DRAINED" tone="ok" />
      <VerdictFlash show={flash === "deny"} text="UNFIXED POISON — IT WILL FAIL AGAIN" tone="deny" />
      <UseCaseNote>
        maxReceiveCount=3 QUARANTINES POISON AUTOMATICALLY: the main queue never stalls — inspect the DLQ, patch the bug, redrive the batch, delete the noise
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function SqsUseCases({ id, immersiveActive, immersiveToggle }: SqsUseCasesProps) {
  if (id === "BUFFER") return <BufferUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "WORKER_SCALING") return <WorkerScalingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <RedriveUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
