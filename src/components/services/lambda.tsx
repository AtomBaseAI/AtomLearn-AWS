"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { AutoLog, logTs } from "@/components/shared/auto-log";
import { APIGatewayIcon, LambdaIcon, S3Icon, SQSIcon, CloudWatchIcon } from "@/components/aws-icons";
import { Flame, Gauge, Skull, Snowflake, Timer, Zap } from "lucide-react";

/* ------------------------------------------------------------------ */
/* types + static data                                                 */
/* ------------------------------------------------------------------ */

type SourceId = "api" | "s3" | "sqs" | "bridge";
type Phase = "IDLE" | "INBOUND" | "PROVISIONING" | "EXECUTING";
type LogTone = "aws" | "mint" | "danger" | "magenta" | "muted";

interface Exec {
  id: number;
  req: string;
  src: SourceId;
  startedAt: number;
  flyMs: number;
  provMs: number;
  execMs: number;
  cold: boolean;
  failed: boolean;
  latency: number;
  containerId: string;
}

interface Container {
  id: string;
  busy: boolean;
  cold: boolean;
}

interface OutputDot {
  id: number;
  ok: boolean;
  expireAt: number;
}

interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
}

const SOURCES: { id: SourceId; label: string; sub: string; y: number }[] = [
  { id: "api", label: "API GATEWAY", sub: "POST /ORDER", y: 16 },
  { id: "s3", label: "S3 EVENT", sub: "PUT OBJECT", y: 39 },
  { id: "sqs", label: "SQS BATCH", sub: "×10 MSGS", y: 62 },
  { id: "bridge", label: "EVENTBRIDGE", sub: "CRON 5 MIN", y: 85 },
];

const SRC_LABEL: Record<SourceId, string> = {
  api: "API-GW",
  s3: "S3",
  sqs: "SQS",
  bridge: "EVENTBRIDGE",
};

const SRC_ICON: Record<SourceId, React.ReactNode> = {
  api: <APIGatewayIcon className="w-3 h-3" />,
  s3: <S3Icon className="w-3 h-3" />,
  sqs: <SQSIcon className="w-3 h-3" />,
  bridge: <Timer className="w-3 h-3" />,
};

const SRC_LINK: Record<SourceId, string> = {
  api: "M19,16 C28,16 30,33 38,37",
  s3: "M19,39 C26,39 30,41 38,42",
  sqs: "M19,62 C26,62 30,50 38,47",
  bridge: "M19,85 C28,85 30,56 38,49",
};

const TONE_CLS: Record<LogTone, string> = {
  aws: "text-aws",
  mint: "text-mint",
  danger: "text-danger",
  magenta: "text-magenta",
  muted: "text-muted-foreground",
};

const BTN =
  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm disabled:opacity-35 disabled:cursor-not-allowed transition-colors";

/* ------------------------------------------------------------------ */
/* LAMBDA — PHANTOM COMPUTE                                            */
/* ------------------------------------------------------------------ */

export default function LambdaVisualizer() {
  const [execs, setExecs] = useState<Exec[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [outputDots, setOutputDots] = useState<OutputDot[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [invokes, setInvokes] = useState(0);
  const [errors, setErrors] = useState(0);
  const [throttles, setThrottles] = useState(0);
  const [coldStarts, setColdStarts] = useState(0);
  const [p50, setP50] = useState<number | null>(null);
  const [coldMode, setColdMode] = useState(true);
  const [memory, setMemory] = useState(1024);
  const [throttleFlash, setThrottleFlash] = useState(false);
  const [outLogFlash, setOutLogFlash] = useState(false);
  const [outDlqFlash, setOutDlqFlash] = useState(false);
  const [srcFlash, setSrcFlash] = useState<Record<SourceId, boolean>>({ api: false, s3: false, sqs: false, bridge: false });
  const [running, setRunning] = useState(false);

  const execsRef = useRef<Exec[]>([]);
  const containersRef = useRef<Container[]>([]);
  const outputDotsRef = useRef<OutputDot[]>([]);
  const latenciesRef = useRef<number[]>([]);
  const invokesRef = useRef(0);
  const errorsRef = useRef(0);
  const throttlesRef = useRef(0);
  const coldStartsRef = useRef(0);
  const nextFireRef = useRef(0);
  const runningRef = useRef(false);
  const coldRef = useRef(true);
  const memRef = useRef(1024);
  const reqIdRef = useRef(1);
  const containerIdRef = useRef(1);
  const logIdRef = useRef(1);
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  const pushLog = (text: string, tone: LogTone) => {
    setLogs((prev) => [...prev.slice(-36), { id: logIdRef.current++, text: `[${logTs()}] ${text}`, tone }]);
  };

  /* fire a single invocation (click a source, burst, or autopilot) */
  const fire = (src: SourceId) => {
    const now = Date.now();
    const inFlight = execsRef.current.filter((e) => now - e.startedAt >= e.flyMs).length;
    const n = reqIdRef.current++;
    const req = `req-${String(n).padStart(3, "0")}`;

    /* concurrency guard — 4 slots, extras get 429 */
    if (inFlight >= 4) {
      throttlesRef.current += 1;
      setThrottles(throttlesRef.current);
      pushLog(`> ${req} ${SRC_LABEL[src]} :: THROTTLED — RateExceeded 429 (concurrency ${inFlight})`, "danger");
      setThrottleFlash(true);
      later(() => setThrottleFlash(false), 700);
      return;
    }

    /* container pool — cold provisions fresh, warm reuses idle */
    const cold = coldRef.current;
    let container = cold ? undefined : containersRef.current.find((c) => !c.busy);
    if (!container) {
      container = { id: `c-${containerIdRef.current.toString(16).padStart(3, "0")}`, busy: true, cold };
      containerIdRef.current += 1;
      containersRef.current = [...containersRef.current, container].slice(-12);
      if (cold) {
        coldStartsRef.current += 1;
        setColdStarts(coldStartsRef.current);
      }
    } else {
      container.busy = true;
    }

    /* memory scales duration inversely (more GB = faster CPU) */
    const memFactor = Math.sqrt(256 / memRef.current);
    const execMs = Math.max(140, Math.round((cold ? 820 : 320) * memFactor));
    const latency = Math.max(
      20,
      Math.round((cold ? 850 + Math.random() * 220 : 62 + Math.random() * 46) * Math.min(1.6, Math.max(0.55, memFactor)))
    );

    setSrcFlash((prev) => ({ ...prev, [src]: true }));
    later(() => setSrcFlash((prev) => ({ ...prev, [src]: false })), 550);

    execsRef.current = [
      ...execsRef.current,
      { id: n, req, src, startedAt: now, flyMs: 520, provMs: cold ? 1800 : 0, execMs, cold, failed: Math.random() < 0.08, latency, containerId: container.id },
    ];
    setExecs([...execsRef.current]);
  };

  /* engine loop — advances phases, completes invokes, autopilot fires */
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      const still: Exec[] = [];

      for (const e of execsRef.current) {
        if (now - e.startedAt >= e.flyMs + e.provMs + e.execMs) {
          invokesRef.current += 1;
          const c = containersRef.current.find((ct) => ct.id === e.containerId);
          if (c) c.busy = false;
          latenciesRef.current = [...latenciesRef.current.slice(-11), e.latency];
          if (e.failed) errorsRef.current += 1;
          outputDotsRef.current = [...outputDotsRef.current, { id: e.id, ok: !e.failed, expireAt: now + 850 }];
          if (e.failed) {
            setOutDlqFlash(true);
            later(() => setOutDlqFlash(false), 600);
            pushLog(`> ${e.req} ${SRC_LABEL[e.src]} :: ERROR — unhandled exception, payload shipped to DLQ`, "danger");
          } else {
            setOutLogFlash(true);
            later(() => setOutLogFlash(false), 600);
            pushLog(`> ${e.req} ${SRC_LABEL[e.src]} :: OK ${e.latency}ms ${e.cold ? "(cold)" : "(warm)"} → CLOUDWATCH LOGS`, "mint");
          }
          changed = true;
        } else {
          still.push(e);
        }
      }
      execsRef.current = still;

      /* autopilot — random event source every ~900ms */
      if (runningRef.current && now >= nextFireRef.current) {
        nextFireRef.current = now + 900;
        fire(SOURCES[Math.floor(Math.random() * SOURCES.length)].id);
      }

      const aliveDots = outputDotsRef.current.filter((d) => d.expireAt > now);
      if (aliveDots.length !== outputDotsRef.current.length) {
        outputDotsRef.current = aliveDots;
        changed = true;
      }

      if (changed || execsRef.current.length > 0) {
        setExecs([...execsRef.current]);
        setContainers([...containersRef.current]);
        setOutputDots([...outputDotsRef.current]);
        setInvokes(invokesRef.current);
        setErrors(errorsRef.current);
        const lat = [...latenciesRef.current].sort((a, b) => a - b);
        setP50(lat.length > 0 ? lat[Math.floor(lat.length / 2)] : null);
      }
    }, 110);
    return () => window.clearInterval(timer);
  }, []);

  const toggleRun = () => {
    const v = !runningRef.current;
    runningRef.current = v;
    setRunning(v);
    nextFireRef.current = Date.now() + 400;
  };

  const reset = () => {
    runningRef.current = false;
    setRunning(false);
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    execsRef.current = [];
    containersRef.current = [];
    outputDotsRef.current = [];
    latenciesRef.current = [];
    invokesRef.current = 0;
    errorsRef.current = 0;
    throttlesRef.current = 0;
    coldStartsRef.current = 0;
    setExecs([]);
    setContainers([]);
    setOutputDots([]);
    setLogs([]);
    setInvokes(0);
    setErrors(0);
    setThrottles(0);
    setColdStarts(0);
    setP50(null);
    setThrottleFlash(false);
    setOutLogFlash(false);
    setOutDlqFlash(false);
    setSrcFlash({ api: false, s3: false, sqs: false, bridge: false });
  };

  const burst = () => {
    for (let i = 0; i < 6; i++) {
      later(() => fire(SOURCES[i % SOURCES.length].id), i * 110);
    }
  };

  /* render-time phase of the most recent execution */
  const now = Date.now();
  const current = execs.length > 0 ? execs[execs.length - 1] : null;
  let phase: Phase = "IDLE";
  let progress = 0;
  if (current) {
    const t = now - current.startedAt;
    if (t < current.flyMs) {
      phase = "INBOUND";
      progress = (t / current.flyMs) * 100;
    } else if (t < current.flyMs + current.provMs) {
      phase = "PROVISIONING";
      progress = ((t - current.flyMs) / current.provMs) * 100;
    } else {
      phase = "EXECUTING";
      progress = ((t - current.flyMs - current.provMs) / current.execMs) * 100;
    }
  }
  const executing = phase === "EXECUTING" || phase === "PROVISIONING";
  const inFlight = execs.filter((e) => now - e.startedAt >= e.flyMs).length;
  const phaseKey = throttleFlash ? "THROTTLED" : phase;

  return (
    <div className="flex flex-col gap-4">
      {/* MAIN GRID — flow view left, stats + controls rail right */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <GlassPanel
          title="FLOW VIEW // INVOCATION PIPELINE"
          subtitle="4 EVENT SOURCES → λ EXECUTION → CLOUDWATCH / DLQ"
          className="!p-0 overflow-hidden"
          delay={0.05}
        >
          <FlowCanvas className="h-[440px] sm:h-[540px] lg:h-[560px]" ariaLabel="Lambda event-driven invocation flow diagram">
            {/* LINKS — EVENT SOURCES → LAMBDA */}
            {SOURCES.map((s) => (
              <FlowLink
                key={s.id}
                d={SRC_LINK[s.id]}
                status={srcFlash[s.id] ? "flowing" : "idle"}
                dot={srcFlash[s.id]}
                dotDuration={0.9}
              />
            ))}

            {/* LINKS — LAMBDA → OUTPUTS */}
            <FlowLink d="M63,37 C70,33 74,29 78,26" status={outLogFlash ? "success" : "idle"} dot={outLogFlash} dotDuration={1.0} />
            <FlowLink d="M63,47 C70,52 74,58 78,65" status={outDlqFlash ? "error" : "idle"} dot={outDlqFlash} dotDuration={1.0} dashed />

            {/* EVENT SOURCES */}
            {SOURCES.map((s, i) => (
              <FlowNode
                key={s.id}
                x={14}
                y={s.y}
                icon={SRC_ICON[s.id]}
                label={s.label}
                sub={s.sub}
                status={srcFlash[s.id] ? "active" : "idle"}
                pulse={srcFlash[s.id]}
                onClick={() => fire(s.id)}
                size="sm"
                delay={0.1 + i * 0.09}
              />
            ))}

            {/* LAMBDA CORE */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: "50%", top: "42%" }}
            >
              <div
                className={`glass cyber-cut w-[188px] sm:w-[210px] p-2.5 ${
                  throttleFlash
                    ? "border border-danger/70 shadow-[0_0_22px_rgba(255,51,85,0.55)]"
                    : executing
                      ? "box-glow"
                      : ""
                }`}
              >
                <div className="flex items-center justify-between px-0.5 pb-1">
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                    <LambdaIcon className="w-3.5 h-3.5" />
                    LAMBDA
                  </span>
                  {executing && <span className="h-1.5 w-1.5 bg-mint ping-ring" aria-hidden="true" />}
                </div>
                <p className="px-0.5 text-[6.5px] font-bold tracking-[0.16em] text-muted-foreground uppercase">fn :: order-processor</p>
                <div className="flex flex-wrap gap-1 px-0.5 py-1.5">
                  <span className="border border-aws/40 bg-aws/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-aws">nodejs20.x</span>
                  <span className="border border-neon/40 bg-neon/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-neon">{memory} MB</span>
                  <span className="border border-magenta/40 bg-magenta/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-magenta">
                    {coldMode ? "COLD" : "WARM"}
                  </span>
                </div>
                <div className="min-h-[16px] px-0.5">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={phaseKey}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`text-[7px] font-bold uppercase tracking-[0.14em] ${
                        throttleFlash ? "text-danger" : phase === "PROVISIONING" ? "text-magenta" : phase === "EXECUTING" ? "text-mint" : phase === "INBOUND" ? "text-aws" : "text-muted-foreground/70"
                      }`}
                    >
                      {throttleFlash
                        ? "THROTTLED — 429 RATE EXCEEDED"
                        : phase === "INBOUND"
                          ? "EVENT INBOUND…"
                          : phase === "PROVISIONING"
                            ? "PROVISIONING CONTAINER…"
                            : phase === "EXECUTING"
                              ? "EXECUTING handler.run"
                              : "IDLE — AWAITING EVENTS"}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <div className="mx-0.5 h-1.5 border border-aws/20 bg-black/60">
                  <motion.div
                    className={`h-full ${phase === "PROVISIONING" ? "bg-magenta" : phase === "EXECUTING" ? "bg-mint" : "bg-aws"}`}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.12, ease: "linear" }}
                  />
                </div>
                {/* CONTAINER POOL */}
                <div className="flex flex-wrap items-center gap-1 px-0.5 pt-1.5">
                  <span className="text-[6px] font-bold tracking-[0.2em] text-muted-foreground">POOL</span>
                  {containers.slice(-5).map((c) => (
                    <motion.span
                      key={c.id}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`border px-1 py-0.5 text-[6px] font-bold tracking-wider ${
                        c.busy ? "border-aws/60 bg-aws/10 text-aws" : "border-foreground/20 text-muted-foreground"
                      }`}
                    >
                      {c.id}
                      <span className="opacity-70">{c.cold ? "·C" : "·W"}</span>
                    </motion.span>
                  ))}
                  {containers.length > 5 && <span className="text-[6px] font-bold text-muted-foreground">+{containers.length - 5}</span>}
                  {containers.length === 0 && <span className="text-[6px] text-muted-foreground/60 tracking-wider">EMPTY</span>}
                </div>
                <p className="px-0.5 pt-1.5 text-[6.5px] font-bold tracking-[0.14em] text-muted-foreground/80 uppercase">
                  est latency ~{coldMode ? "950" : "85"} MS · cold starts {coldStarts}
                </p>
              </div>
            </motion.div>

            {/* OUTPUT NODES */}
            <FlowNode
              x={83}
              y={24}
              icon={<CloudWatchIcon className="w-3 h-3" />}
              label="CLOUDWATCH"
              sub={`${invokes} LOG STREAMS`}
              status={outLogFlash ? "success" : "idle"}
              pulse={outLogFlash}
              size="sm"
              delay={0.55}
            />
            <FlowNode
              x={83}
              y={72}
              icon={<Skull className="w-3 h-3" />}
              label="DLQ"
              sub={`${errors} FAILED PAYLOADS`}
              status={errors > 0 ? "error" : "idle"}
              pulse={outDlqFlash}
              size="sm"
              delay={0.65}
            />

            <FlowLabel x={50} y={12} tone="aws">CLICK A SOURCE TO INVOKE</FlowLabel>
            <FlowLabel x={50} y={74} tone="default">8% FAULT INJECTION</FlowLabel>

            {/* OUTPUT DOTS */}
            {outputDots.map((d) => (
              <motion.span
                key={d.id}
                className={`absolute z-20 h-1.5 w-1.5 ${
                  d.ok ? "bg-mint shadow-[0_0_8px_rgba(0,255,163,0.9)]" : "bg-danger shadow-[0_0_8px_rgba(255,51,85,0.9)]"
                }`}
                initial={{ left: "56%", top: "42%" }}
                animate={{ left: "80%", top: d.ok ? "24%" : "72%" }}
                transition={{ duration: 0.65, ease: "easeOut" }}
              />
            ))}
          </FlowCanvas>
        </GlassPanel>

        {/* RIGHT RAIL — LIVE STATS + CONTROLS */}
        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip label="INVOKES" value={String(invokes)} />
              <StatChip label="ERRORS" value={String(errors)} tone="magenta" delay={0.05} />
              <StatChip label="P50 DURATION" value={p50 === null ? "—" : `~${p50} MS`} tone="mint" delay={0.1} />
              <StatChip label="THROTTLES" value={String(throttles)} tone={throttles > 0 ? "magenta" : "neutral"} delay={0.15} />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={toggleRun}
                onReset={reset}
                status={running ? "LIVE — RANDOM EVENTS EVERY ~900MS" : "IDLE — PRESS RUN OR CLICK A SOURCE"}
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">INVOCATION MODE</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const v = !coldRef.current;
                    coldRef.current = v;
                    setColdMode(v);
                  }}
                  aria-label="Toggle cold start mode"
                  className={`flex items-center gap-1.5 ${BTN} ${coldMode ? "border-magenta/60 text-magenta" : "border-mint/60 text-mint"}`}
                >
                  {coldMode ? <Snowflake className="w-3 h-3" /> : <Flame className="w-3 h-3" />}
                  {coldMode ? "COLD STARTS: ON" : "WARM POOL: REUSE"}
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={burst}
                  className={`${BTN} border-danger/60 text-danger hover:bg-danger/10`}
                  aria-label="Fire a burst of six concurrent invocations"
                >
                  <Zap className="w-3 h-3" />
                  BURST ×6
                </motion.button>
              </div>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">MEMORY SIZE</p>
              <div className="flex items-center gap-2 w-full border border-foreground/20 bg-black/50 px-2.5 py-1.5 backdrop-blur-md cyber-cut-sm">
                <span className="text-[8px] font-bold tracking-[0.18em] text-muted-foreground">MEM</span>
                <input
                  type="range"
                  min={128}
                  max={3008}
                  step={64}
                  value={memory}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    memRef.current = v;
                    setMemory(v);
                  }}
                  className="w-full flex-1 cursor-pointer accent-[#ff9900]"
                  aria-label="Lambda memory size in megabytes"
                />
                <span className="text-[9px] font-extrabold tracking-wider text-aws">{memory} MB</span>
              </div>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">RESERVED CONCURRENCY</p>
              <div className="flex items-center gap-1.5 w-full border border-foreground/20 bg-black/50 px-2.5 py-1.5 backdrop-blur-md cyber-cut-sm">
                <Gauge className="w-3 h-3 text-aws" />
                <span className="text-[8px] font-bold tracking-[0.18em] text-muted-foreground">CONCURRENCY</span>
                <span className="flex items-center gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-3.5 w-2.5 ${i < inFlight ? "bg-aws shadow-[0_0_6px_rgba(255,153,0,0.8)]" : "bg-foreground/15"}`}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className={`text-[9px] font-extrabold ${inFlight >= 4 ? "text-danger" : "text-aws"}`}>{inFlight}/4</span>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* EXECUTION LOG — full width below the grid */}
      <GlassPanel title="EXECUTION LOG" className="!p-0" delay={0.18}>
        <div className="p-3">
          <AutoLog lines={logs} tones={TONE_CLS} emptyText="// execution log empty — invoke something" />
        </div>
      </GlassPanel>

      {/* ══════════ KNOWLEDGE ══════════ */}
      <div className="grid md:grid-cols-3 gap-3">
        <Callout type="critical" title="15-minute hard execution cap">
          A Lambda function can never run longer than 900 seconds. Anything longer — ETL jobs, video encoding, huge
          batch runs — must be split with Step Functions or moved to containers on ECS/Fargate.
        </Callout>
        <Callout type="tip" title="Provisioned concurrency kills cold starts">
          Pre-warming N execution environments removes the init phase entirely — the function is at ~85ms latency the
          instant traffic arrives. Use it with Application Auto Scaling on latency-critical APIs.
        </Callout>
        <Callout type="exam" title="Lambda is stateless — pay per use">
          Never write local state to disk: persist to DynamoDB or S3. Billing is per request + GB-second of memory,
          with zero charge when idle. Memory (128MB–10GB) also scales CPU proportionally — more memory often costs less.
        </Callout>
      </div>
    </div>
  );
}
