"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import {
  CloudWatchIcon,
  CWAlarmIcon,
  EC2Icon,
  ELBIcon,
  EmailNotificationIcon,
  LambdaIcon,
  SNSIcon,
  ServerIcon,
} from "@/components/aws-icons";
import { Bell, Skull, TrendingUp, Zap } from "lucide-react";

/* ------------------------------------------------------------------ */
/* SIGNAL SCOPE — CloudWatch metrics → alarm state machine → actions   */
/* ------------------------------------------------------------------ */

const WINDOW = 44; // rolling datapoints per metric
const TIMELINE = 24; // datapoint cells in the eval timeline strip
const MAX_HISTORY = 8; // log lines kept in alarm history
const TICK_MS = 850;

const CHART_W = 300;
const CHART_H = 110;
const ERR_AXIS_MAX = 15; // second axis for 5xx errors (0-15)

const AWS = "#ff9900";
const DANGER = "#ff3355";
const MAGENTA = "#ff2d78";

type AlarmState = "OK" | "ALARM" | "INSUFFICIENT_DATA";
type LogTone = "aws" | "mint" | "danger" | "magenta" | "neon" | "dim";

interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

const chartX = (i: number, len: number) => (len <= 1 ? 0 : (i / (len - 1)) * CHART_W);
const cpuY = (v: number) => CHART_H * (1 - clamp(v, 0, 100) / 100);
const errY = (v: number) => CHART_H * (1 - clamp(v, 0, ERR_AXIS_MAX) / ERR_AXIS_MAX);

const tstamp = (tick: number) => `t${String(tick).padStart(3, "0")}`;

function seedCpu(): number[] {
  const out: number[] = [];
  let v = 34;
  for (let i = 0; i < WINDOW; i += 1) {
    v = clamp(v + (Math.random() - 0.48) * 9, 24, 52);
    out.push(round1(v));
  }
  return out;
}

function seedErr(): number[] {
  return Array.from({ length: WINDOW }, () => Math.round(Math.random() * 2));
}

const SEED_CPU = seedCpu();
const SEED_ERR = seedErr();
const SEED_IDS = SEED_CPU.map((_, i) => i + 1);
const SEED_BASE = SEED_CPU[SEED_CPU.length - 1];

const BOOT_LINE: LogLine = {
  id: 1,
  text: "t000 ALARM CREATED — AWS/EC2 CPUUtilization · state INSUFFICIENT_DATA",
  tone: "dim",
};

/** Contiguous runs of breaching datapoints as polyline point strings,
 *  with one point of lead-in/lead-out so the segment crosses the threshold. */
function breachSegments(series: number[], threshold: number): string[] {
  const n = series.length;
  const segs: string[] = [];
  let start = -1;
  for (let i = 0; i <= n; i += 1) {
    const breaching = i < n && series[i] > threshold;
    if (breaching && start < 0) start = i;
    if (!breaching && start >= 0) {
      const from = start > 0 ? start - 1 : start;
      const to = Math.min(i, n - 1);
      const pts: string[] = [];
      for (let k = from; k <= to; k += 1) {
        pts.push(`${chartX(k, n).toFixed(1)},${cpuY(series[k]).toFixed(1)}`);
      }
      segs.push(pts.join(" "));
      start = -1;
    }
  }
  return segs;
}

const LOG_TONE_CLS: Record<LogTone, string> = {
  aws: "text-aws",
  mint: "text-mint",
  danger: "text-danger",
  magenta: "text-magenta",
  neon: "text-neon",
  dim: "text-muted-foreground",
};

const BTN =
  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm";

interface SourceDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  y: number;
  d: string;
}

const SOURCES: SourceDef[] = [
  {
    key: "ec2",
    label: "EC2 FLEET",
    icon: <EC2Icon className="w-3 h-3" />,
    y: 20,
    d: "M22,20 C27,20 27,32 32,32",
  },
  {
    key: "lambda",
    label: "AWS LAMBDA",
    icon: <LambdaIcon className="w-3 h-3" />,
    y: 46,
    d: "M22,46 C27,46 27,38 32,38",
  },
  {
    key: "elb",
    label: "APP ELB",
    icon: <ELBIcon className="w-3 h-3" />,
    y: 72,
    d: "M22,72 C27,72 27,44 32,44",
  },
];

const LINK_SNS = "M56,34 C62,34 62,20 77,20";
const LINK_ASG = "M56,42 C62,42 62,46 77,46";
const LINK_EMAIL = "M56,44 C61,44 61,72 77,72";

export default function CloudWatchVisualizer() {
  /* controls */
  const [running, setRunning] = useState(false);
  const [threshold, setThreshold] = useState(75);
  const [snsOn, setSnsOn] = useState(true);
  const [scalingOn, setScalingOn] = useState(true);

  /* render state — flushed from refs */
  const [cpuSeries, setCpuSeries] = useState<number[]>(SEED_CPU);
  const [errSeries, setErrSeries] = useState<number[]>(SEED_ERR);
  const [pointIds, setPointIds] = useState<number[]>(SEED_IDS);
  const [fleetSize, setFleetSize] = useState(2);
  const [alarmState, setAlarmState] = useState<AlarmState>("INSUFFICIENT_DATA");
  const [notifications, setNotifications] = useState(0);
  const [scaleOuts, setScaleOuts] = useState(0);
  const [tickCount, setTickCount] = useState(0);
  const [history, setHistory] = useState<LogLine[]>([BOOT_LINE]);
  const [lastEmit, setLastEmit] = useState<boolean[]>([false, false, false]);
  const [snsFired, setSnsFired] = useState(false);
  const [scaleFired, setScaleFired] = useState(false);

  /* refs — source of truth */
  const cpuRef = useRef<number[]>(SEED_CPU);
  const errRef = useRef<number[]>(SEED_ERR);
  const idsRef = useRef<number[]>(SEED_IDS);
  const pointIdRef = useRef(WINDOW + 1);
  const logIdRef = useRef(2);
  const baseRef = useRef<number>(SEED_BASE);
  const fleetRef = useRef(2);
  const alarmRef = useRef<AlarmState>("INSUFFICIENT_DATA");
  const breachRef = useRef(0);
  const okRef = useRef(0);
  const notifRef = useRef(0);
  const scaleRef = useRef(0);
  const stormRef = useRef(0);
  const errBurstRef = useRef(0);
  const tickRef = useRef(0);
  const histRef = useRef<LogLine[]>([BOOT_LINE]);
  const histBoxRef = useRef<HTMLDivElement | null>(null);

  const pushLog = useCallback((text: string, tone: LogTone = "aws") => {
    logIdRef.current += 1;
    histRef.current = [...histRef.current, { id: logIdRef.current, text, tone }].slice(-MAX_HISTORY);
  }, []);

  const flush = useCallback(() => {
    setCpuSeries([...cpuRef.current]);
    setErrSeries([...errRef.current]);
    setPointIds([...idsRef.current]);
    setFleetSize(fleetRef.current);
    setAlarmState(alarmRef.current);
    setNotifications(notifRef.current);
    setScaleOuts(scaleRef.current);
    setTickCount(tickRef.current);
    setHistory([...histRef.current]);
  }, []);

  /* ------------------------------- engine ------------------------------ */
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      tickRef.current += 1;

      /* 1. LOAD — base load random walk; storm injects, fleet absorbs */
      baseRef.current = clamp(
        baseRef.current +
          rand(-4, 4) +
          (stormRef.current > 0 ? 5 : -1.2) -
          scaleRef.current * 0.35,
        18,
        95
      );
      if (stormRef.current > 0) stormRef.current -= 1;
      const cpu = round1(baseRef.current * (2 / fleetRef.current));

      /* 2. ERRORS — baseline chatter or dependency burst */
      const err = errBurstRef.current > 0 ? Math.round(rand(8, 14)) : Math.round(rand(0, 3));
      if (errBurstRef.current > 0) errBurstRef.current -= 1;

      /* 3. EMISSION — each source publishes a datapoint (occasional late batch) */
      const emitted: [boolean, boolean, boolean] = [
        true,
        Math.random() < 0.85,
        Math.random() < 0.85,
      ];
      const pid = pointIdRef.current;
      pointIdRef.current += 1;
      cpuRef.current = [...cpuRef.current, cpu].slice(-WINDOW);
      const lastErr = errRef.current[errRef.current.length - 1] ?? 0;
      errRef.current = [...errRef.current, emitted[1] || emitted[2] ? err : lastErr].slice(-WINDOW);
      idsRef.current = [...idsRef.current, pid].slice(-WINDOW);

      /* 4. ALARM EVALUATION — N consecutive breaching datapoints flip state */
      if (cpu > threshold) {
        breachRef.current += 1;
        okRef.current = 0;
      } else {
        okRef.current += 1;
        breachRef.current = 0;
      }
      const prev = alarmRef.current;
      if (prev !== "ALARM" && breachRef.current >= 2) {
        alarmRef.current = "ALARM";
        pushLog(`${tstamp(tickRef.current)} ALARM: CPUUtilization > ${threshold}% — 2/2 datapoints breaching`, "danger");
        if (snsOn) {
          notifRef.current += 1;
          setSnsFired(true);
          pushLog(`${tstamp(tickRef.current)} NOTIFY → SNS topic ops-alerts (email+https)`, "magenta");
        }
        if (scalingOn) {
          scaleRef.current += 1;
          const next = Math.min(8, fleetRef.current + 1);
          const prevFleet = fleetRef.current;
          fleetRef.current = next;
          setScaleFired(true);
          pushLog(
            `${tstamp(tickRef.current)} SCALE-OUT: target tracking → fleet ${prevFleet} → ${next}${next === 8 && prevFleet === 8 ? " (MAX)" : ""}`,
            "mint"
          );
        }
        if (!snsOn && !scalingOn) {
          pushLog(`${tstamp(tickRef.current)} NO ACTIONS CONFIGURED — alarm fires silently`, "neon");
        }
      } else if (prev === "ALARM" && okRef.current >= 2) {
        alarmRef.current = "OK";
        pushLog(`${tstamp(tickRef.current)} OK: recovered — 2 datapoints below threshold`, "mint");
      } else if (prev === "INSUFFICIENT_DATA" && okRef.current >= 2) {
        alarmRef.current = "OK";
        pushLog(`${tstamp(tickRef.current)} OK: 2/2 datapoints below ${threshold}% — monitoring healthy`, "mint");
      }

      /* pulse clears (unconditional — resetting false→false is a no-op) */
      setLastEmit(emitted);
      window.setTimeout(() => setLastEmit([false, false, false]), 640);
      window.setTimeout(() => {
        setSnsFired(false);
        setScaleFired(false);
      }, 780);

      /* 5. FLUSH */
      flush();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, threshold, snsOn, scalingOn, pushLog, flush]);

  /* auto-scroll alarm history */
  useEffect(() => {
    const el = histBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  /* ------------------------------ actions ------------------------------ */
  const reset = () => {
    setRunning(false);
    tickRef.current = 0;
    pointIdRef.current = WINDOW + 1;
    logIdRef.current = 2;
    baseRef.current = SEED_BASE;
    fleetRef.current = 2;
    alarmRef.current = "INSUFFICIENT_DATA";
    breachRef.current = 0;
    okRef.current = 0;
    notifRef.current = 0;
    scaleRef.current = 0;
    stormRef.current = 0;
    errBurstRef.current = 0;
    cpuRef.current = seedCpu();
    errRef.current = seedErr();
    idsRef.current = SEED_IDS;
    histRef.current = [BOOT_LINE];
    setLastEmit([false, false, false]);
    setSnsFired(false);
    setScaleFired(false);
    flush();
  };

  const injectCpuStorm = () => {
    stormRef.current = 8;
    baseRef.current = clamp(baseRef.current + 34, 18, 95);
    const cpu = round1(baseRef.current * (2 / fleetRef.current));
    const pid = pointIdRef.current;
    pointIdRef.current += 1;
    cpuRef.current = [...cpuRef.current, cpu].slice(-WINDOW);
    errRef.current = [...errRef.current, errRef.current[errRef.current.length - 1] ?? 0].slice(-WINDOW);
    idsRef.current = [...idsRef.current, pid].slice(-WINDOW);
    pushLog(`${tstamp(tickRef.current)} INJECT → CPU SPIKE +34% — synthetic storm ×8 ticks`, "neon");
    flush();
  };

  const injectErrBurst = () => {
    errBurstRef.current = 5;
    const pid = pointIdRef.current;
    pointIdRef.current += 1;
    errRef.current = [...errRef.current, Math.round(rand(8, 14))].slice(-WINDOW);
    cpuRef.current = [...cpuRef.current, cpuRef.current[cpuRef.current.length - 1] ?? 0].slice(-WINDOW);
    idsRef.current = [...idsRef.current, pid].slice(-WINDOW);
    pushLog(`${tstamp(tickRef.current)} INJECT → 5XX BURST — upstream dependency failing ×5 ticks`, "danger");
    flush();
  };

  const applyThreshold = (t: number) => {
    setThreshold(t);
    pushLog(`${tstamp(tickRef.current)} CONFIG → ALARM THRESHOLD ${t}% — re-evaluating datapoints`, "magenta");
    flush();
  };

  const toggleSns = () => {
    const v = !snsOn;
    setSnsOn(v);
    pushLog(`${tstamp(tickRef.current)} CONFIG → SNS NOTIFY ${v ? "ENABLED" : "DISABLED"}`, "magenta");
    flush();
  };

  const toggleScaling = () => {
    const v = !scalingOn;
    setScalingOn(v);
    pushLog(`${tstamp(tickRef.current)} CONFIG → SCALING ACTION ${v ? "ENABLED" : "DISABLED"}`, "magenta");
    flush();
  };

  /* ------------------------------ derived ------------------------------ */
  const cpuNow = cpuSeries.length > 0 ? cpuSeries[cpuSeries.length - 1] : 0;
  const errNow = errSeries.length > 0 ? errSeries[errSeries.length - 1] : 0;
  const lastBreach = cpuNow > threshold;

  const cpuPts = cpuSeries
    .map((v, i) => `${chartX(i, cpuSeries.length).toFixed(1)},${cpuY(v).toFixed(1)}`)
    .join(" ");
  const areaPts = `${cpuPts} ${CHART_W},${CHART_H} 0,${CHART_H}`;
  const errPts = errSeries
    .map((v, i) => `${chartX(i, errSeries.length).toFixed(1)},${errY(v).toFixed(1)}`)
    .join(" ");
  const breachPts = breachSegments(cpuSeries, threshold);
  const lastX = chartX(cpuSeries.length - 1, cpuSeries.length);
  const lastY = cpuY(cpuNow);
  const thrY = cpuY(threshold);

  const badgeCls =
    alarmState === "ALARM"
      ? "border-danger/70 text-danger bg-danger/15 shadow-[0_0_14px_rgba(255,51,85,0.35)]"
      : alarmState === "OK"
        ? "border-mint/60 text-mint bg-mint/10"
        : "border-foreground/25 text-muted-foreground bg-white/[0.04]";

  return (
    <div className="flex flex-col gap-4">
      {/* CONTROL DECK */}
      <GlassPanel
        title="SIGNAL SCOPE // LIVE"
        subtitle="CLOUDWATCH METRICS → ALARM STATE MACHINE → SNS + AUTO SCALING"
        actions={
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "ALARM ENGINE LIVE — EVALUATING EVERY 10S" : "ENGINE IDLE — PRESS RUN"}
          />
        }
      >
        <div className="p-3 sm:p-4 flex flex-col gap-3">
          <FlowCanvas
            className="h-[440px] sm:h-[540px]"
            ariaLabel="CloudWatch metrics alarm and actions flow diagram"
          >
            {/* SOURCE → CORE LINKS */}
            {SOURCES.map((s, i) => (
              <FlowLink
                key={s.key}
                d={s.d}
                status={lastEmit[i] ? "flowing" : "idle"}
                dotDuration={1.6}
                dotDelay={i * 0.25}
              />
            ))}

            {/* CORE → ACTION LINKS */}
            <FlowLink d={LINK_SNS} status={snsFired ? "cyber" : "idle"} dotDuration={1.5} />
            <FlowLink d={LINK_ASG} status={scaleFired ? "success" : "idle"} dotDuration={1.5} />
            <FlowLink d={LINK_EMAIL} status={snsFired ? "cyber" : "idle"} dotDuration={1.7} dotDelay={0.2} />

            {/* METRIC SOURCES */}
            {SOURCES.map((s, i) => (
              <FlowNode
                key={s.key}
                x={13}
                y={s.y}
                icon={s.icon}
                label={s.label}
                sub={
                  i === 0
                    ? `CPU ${Math.round(cpuNow)}%`
                    : i === 1
                      ? `ERRORS ${errNow}`
                      : `5XX ${errNow}`
                }
                status={lastEmit[i] ? "active" : "idle"}
                pulse={lastEmit[i]}
                size="sm"
                delay={0.1 + i * 0.1}
              />
            ))}

            {/* CLOUDWATCH CORE */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: "44%", top: "38%" }}
            >
              <div className="glass box-glow cyber-cut p-2 w-[200px] sm:w-[240px]">
                <div className="flex items-center justify-between gap-1 pb-1.5">
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-aws min-w-0">
                    <CloudWatchIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{`METRIC STREAM // LIVE`}</span>
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={alarmState}
                      initial={{ opacity: 0, scale: 0.7, y: 3 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.7, y: -3 }}
                      transition={{ duration: 0.18 }}
                      aria-label={`Alarm state ${alarmState}`}
                      className={`flex items-center gap-1 border px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.12em] shrink-0 ${badgeCls}`}
                    >
                      <CWAlarmIcon className="w-2.5 h-2.5 shrink-0" />
                      <span>{alarmState === "INSUFFICIENT_DATA" ? "NO DATA" : alarmState}</span>
                      {alarmState === "ALARM" && <span className="blink-cursor">_</span>}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* LIVE CHART */}
                <div className="relative border-t border-aws/15 pt-1.5">
                  <svg
                    viewBox="0 0 300 110"
                    preserveAspectRatio="none"
                    className="block w-full h-[92px]"
                    role="img"
                    aria-label="Rolling CPUUtilization metric chart with alarm threshold"
                  >
                    <polygon points={areaPts} fill={AWS} fillOpacity={0.08} />
                    <polyline
                      points={errPts}
                      fill="none"
                      stroke={MAGENTA}
                      strokeWidth={1}
                      opacity={0.7}
                      vectorEffect="non-scaling-stroke"
                    />
                    <polyline
                      points={cpuPts}
                      fill="none"
                      stroke={AWS}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={0}
                      y1={thrY}
                      x2={CHART_W}
                      y2={thrY}
                      stroke={DANGER}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      opacity={0.9}
                      vectorEffect="non-scaling-stroke"
                    />
                    {breachPts.map((p, i) => (
                      <polyline
                        key={`breach-${i}`}
                        points={p}
                        fill="none"
                        stroke={DANGER}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    <motion.circle
                      key={`ring-${pointIds[pointIds.length - 1] ?? 0}`}
                      cx={lastX}
                      cy={lastY}
                      fill="none"
                      stroke={lastBreach ? DANGER : AWS}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      initial={{ r: 3, opacity: 0.8 }}
                      animate={{ r: 11, opacity: 0 }}
                      transition={{ duration: 1.3, ease: "easeOut" }}
                    />
                    <motion.circle
                      fill={lastBreach ? DANGER : AWS}
                      r={3.2}
                      initial={false}
                      animate={{ cx: lastX, cy: lastY }}
                      transition={{ type: "spring", stiffness: 280, damping: 24 }}
                    />
                  </svg>
                  <span
                    className="absolute right-0 -translate-y-1/2 text-[6px] font-extrabold tracking-[0.14em] text-danger bg-black/60 px-0.5"
                    style={{ top: `${100 - threshold}%` }}
                  >
                    {`THR ${threshold}%`}
                  </span>
                </div>

                {/* ALARM STATE TIMELINE — last 24 datapoints */}
                <div className="flex items-center gap-px mt-1.5 pt-1.5 border-t border-aws/15 overflow-hidden">
                  {cpuSeries.slice(-TIMELINE).map((v, i) => {
                    const id = pointIds[pointIds.length - TIMELINE + i] ?? i;
                    return (
                      <motion.span
                        key={id}
                        layout
                        initial={{ opacity: 0, scaleY: 0.3 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        transition={{ type: "spring", stiffness: 520, damping: 34 }}
                        className={`w-1.5 h-2 shrink-0 origin-bottom ${v > threshold ? "bg-danger" : "bg-mint"}`}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-aws/15">
                  <span className="text-[6px] font-bold tracking-[0.18em] text-muted-foreground">
                    {"PERIOD 10S × EVAL 2"}
                  </span>
                  <span className="text-[6px] font-bold tracking-[0.18em] text-aws/80">
                    {`WINDOW ${WINDOW} PTS`}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* LINK LABELS */}
            <FlowLabel x={67} y={26} tone="magenta">
              PUBLISH
            </FlowLabel>
            <FlowLabel x={68} y={52} tone="mint">
              SCALE-OUT POLICY
            </FlowLabel>

            {/* ACTION TARGETS */}
            <FlowNode
              x={84}
              y={20}
              icon={<SNSIcon className="w-3 h-3" />}
              label="SNS TOPIC"
              sub={`${notifications} SENT`}
              status={snsFired ? "cyber" : "idle"}
              pulse={snsFired}
              size="sm"
              delay={0.4}
            />
            <FlowNode
              x={84}
              y={46}
              icon={<ServerIcon className="w-3 h-3" />}
              label="AUTO SCALING"
              sub={`FLEET ${fleetSize} INSTANCES`}
              status={scaleFired ? "success" : "idle"}
              pulse={scaleFired}
              size="sm"
              delay={0.5}
            />
            <FlowNode
              x={84}
              y={72}
              icon={<EmailNotificationIcon className="w-3 h-3" />}
              label="OPS EMAIL"
              sub="ON-CALL"
              status={snsFired ? "cyber" : "idle"}
              pulse={snsFired}
              size="sm"
              delay={0.6}
            />
          </FlowCanvas>

          {/* STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip
              label="CPU NOW"
              value={`${Math.round(cpuNow)}%`}
              tone={cpuNow > threshold ? "magenta" : "mint"}
            />
            <StatChip
              label="ALARM STATE"
              value={alarmState}
              tone={alarmState === "ALARM" ? "magenta" : alarmState === "OK" ? "mint" : "neutral"}
            />
            <StatChip label="NOTIFICATIONS" value={String(notifications)} tone="magenta" />
            <StatChip label="SCALE-OUTS" value={String(scaleOuts)} tone="mint" />
          </div>

          {/* CONTROLS */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground mr-0.5">
                THRESHOLD
              </span>
              {[60, 75, 90].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyThreshold(t)}
                  aria-pressed={threshold === t}
                  aria-label={`Set alarm threshold to ${t} percent`}
                  className={`${BTN} ${
                    threshold === t
                      ? "border-aws/60 text-aws bg-aws/10"
                      : "border-foreground/20 text-muted-foreground hover:border-aws/40"
                  }`}
                >
                  {t}%
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleSns}
              aria-pressed={snsOn}
              aria-label="Toggle SNS notification action"
              className={`${BTN} ${
                snsOn ? "border-magenta/60 text-magenta" : "border-foreground/20 text-muted-foreground"
              }`}
            >
              <Bell className="w-3 h-3" />
              SNS NOTIFY {snsOn ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={toggleScaling}
              aria-pressed={scalingOn}
              aria-label="Toggle Auto Scaling action"
              className={`${BTN} ${
                scalingOn ? "border-mint/60 text-mint" : "border-foreground/20 text-muted-foreground"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              SCALING ACTION {scalingOn ? "ON" : "OFF"}
            </button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={injectCpuStorm}
              aria-label="Inject a CPU spike into the fleet"
              className={`${BTN} border-neon/60 text-neon hover:bg-neon/10`}
            >
              <Zap className="w-3 h-3" />
              INJECT CPU SPIKE
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={injectErrBurst}
              aria-label="Inject a 5xx error burst"
              className={`${BTN} border-danger/60 text-danger hover:bg-danger/10`}
            >
              <Skull className="w-3 h-3" />
              INJECT 5XX BURST
            </motion.button>
          </div>

          {/* ALARM HISTORY TERMINAL */}
          <div className="glass-inset p-2">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-aws">
                {"ALARM HISTORY // LIVE"}
              </span>
              <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                AWS/EC2 · CPUUtilization
              </span>
            </div>
            <div
              ref={histBoxRef}
              className="max-h-36 overflow-y-auto cyber-scroll px-1 flex flex-col gap-0.5"
            >
              <AnimatePresence initial={false}>
                {history.map((l) => (
                  <motion.p
                    key={l.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`text-[8px] leading-snug tracking-wider font-bold whitespace-pre-wrap ${LOG_TONE_CLS[l.tone]}`}
                  >
                    {l.text}
                  </motion.p>
                ))}
              </AnimatePresence>
              {history.length === 0 && (
                <p className="text-[8px] uppercase tracking-wider text-muted-foreground/60 py-2">
                  NO EVENTS — PRESS RUN TO START THE METRIC STREAM
                </p>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* KNOWLEDGE */}
      <div className="grid md:grid-cols-3 gap-3">
        <Callout type="exam" title="Alarm states & evaluation">
          Every alarm lives in one of three states — OK, ALARM or INSUFFICIENT_DATA. Transitioning
          takes Period × Evaluation Periods of breaching datapoints (default 3 of 3 — this sim uses
          2 of 2 for pace). Standard resolution is 1-minute; high-resolution alarms evaluate every
          1-second at higher cost. Missing datapoints follow the missing-data config:
          notBreaching, breaching, ignore or missing.
        </Callout>
        <Callout type="critical" title="Composite alarms & flapping">
          A single-metric alarm flaps under bursty load — every dip below the threshold resets the
          evaluation streak. Use composite alarms (AND/OR of other alarms) or M-of-N evaluation
          (e.g. 3 of 5 datapoints) to dampen noise. And never assume a missing datapoint is zero —
          misconfigured missing-data handling silently disarms your alerting.
        </Callout>
        <Callout type="tip" title="Wire alarms to actions">
          An alarm is only useful when something reacts: publish to SNS (email, HTTPS, pager), fire
          Auto Scaling target-tracking policies, recover or reboot EC2 instances, or invoke Lambda.
          The classic first alarm for every account: a billing alarm on the Total Estimated Spend
          metric.
        </Callout>
      </div>
    </div>
  );
}
