"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Gauge, Plus, Siren, Zap } from "lucide-react";
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
  type UcTone,
} from "@/components/shared/use-case";
import {
  CloudWatchIcon,
  CWAlarmIcon,
  EmailNotificationIcon,
  SNSIcon,
  ServerIcon,
} from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES + HELPERS                                              */
/* ================================================================== */

export type CwUseCaseId = "ALARM_ACTION" | "DASHBOARD" | "ANOMALY";

interface CwUseCasesProps {
  id: CwUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

type UcLine = { id: number; text: string; tone?: string };

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const tstamp = (t: number) => `t${String(t).padStart(3, "0")}`;

const TONE_HEX: Record<UcTone, string> = {
  aws: "#ff9900",
  mint: "#00ffa3",
  magenta: "#ff2d78",
  neon: "#ffb347",
  danger: "#ff3355",
  neutral: "#e8e6e3",
};

/* Hoisted slider (never define components inside components) */
function CwSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className="text-[8px] font-extrabold tabular-nums text-aws">
          {value}
          {suffix}
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
/* TAB 02 — ALARM → ACTION                                             */
/* ================================================================== */

const AL_WINDOW = 48;
const AL_W = 300;
const AL_H = 120;

function seedMetric(): number[] {
  const out: number[] = [];
  let v = 38;
  for (let i = 0; i < AL_WINDOW; i += 1) {
    v = clamp(v + rand(-3.5, 3.5) - 0.4, 22, 55);
    out.push(r1(v));
  }
  return out;
}

const alX = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * AL_W);
const alY = (v: number) => AL_H * (1 - clamp(v, 0, 100) / 100);

function AlarmActionUseCase({ immersiveActive, immersiveToggle }: CwUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [threshold, setThreshold] = useState(60);
  const [series, setSeries] = useState<number[]>(seedMetric);
  const [alarm, setAlarm] = useState<"OK" | "ALARM">("OK");
  const [fleet, setFleet] = useState(2);
  const [notif, setNotif] = useState(0);
  const [scaled, setScaled] = useState(0);
  const [snsFired, setSnsFired] = useState(false);
  const [scaleFired, setScaleFired] = useState(false);
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "deny" } | null>(null);
  const [lines, setLines] = useState<UcLine[]>([]);

  const seriesRef = useRef<number[]>(series);
  const alarmRef = useRef<"OK" | "ALARM">("OK");
  const breachRef = useRef(0);
  const okRef = useRef(0);
  const fleetRef = useRef(2);
  const notifRef = useRef(0);
  const scaledRef = useRef(0);
  const stormRef = useRef(0);
  const tickRef = useRef(0);
  const idRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  /* metric stream + alarm state machine — evaluated inside the interval callback */
  useTicker(running, () => {
    tickRef.current += 1;
    const tick = tickRef.current;

    /* 1. LOAD — random walk; synthetic storms ramp, quiet periods recover */
    let base = seriesRef.current[seriesRef.current.length - 1] ?? 38;
    if (stormRef.current > 0) {
      stormRef.current -= 1;
      base += rand(4.5, 8.5);
    } else {
      base += rand(-3.5, 3.5) - 1.4;
      if (Math.random() < 0.055) stormRef.current = 6 + Math.floor(rand(0, 4));
    }
    const cpu = r1(clamp(base, 15, 99));
    seriesRef.current = [...seriesRef.current.slice(-(AL_WINDOW - 1)), cpu];

    /* 2. EVALUATION — 2 consecutive breaching datapoints flip the state */
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
      const prevFleet = fleetRef.current;
      fleetRef.current = Math.min(8, prevFleet + 1);
      notifRef.current += 1;
      scaledRef.current += 1;
      setSnsFired(true);
      setScaleFired(true);
      push(`${tstamp(tick)} ALARM: CPUUtilization > ${threshold}% — 2/2 datapoints breaching`, "danger");
      push(`${tstamp(tick)} SNS: published → topic ops-alerts — email + https endpoints notified`, "magenta");
      push(`${tstamp(tick)} ASG: scale-out policy — fleet ${prevFleet} → ${fleetRef.current} instances (+1)`, "mint");
      push(`${tstamp(tick)} ALARM → action executed in 1.2s`, "neon");
      setFlash({ text: "ALARM — ACTIONS FIRED", tone: "deny" });
    } else if (prev === "ALARM" && okRef.current >= 2) {
      alarmRef.current = "OK";
      push(`${tstamp(tick)} OK: recovered — 2 datapoints below ${threshold}% — alarm state OK`, "mint");
      setFlash({ text: "OK — RECOVERED", tone: "ok" });
    }

    /* flash + pulse timeouts — stored in refs, cleared on unmount */
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 2100);
    if (pulseT.current) clearTimeout(pulseT.current);
    pulseT.current = setTimeout(() => {
      setSnsFired(false);
      setScaleFired(false);
    }, 2300);

    setSeries([...seriesRef.current]);
    setAlarm(alarmRef.current);
    setFleet(fleetRef.current);
    setNotif(notifRef.current);
    setScaled(scaledRef.current);
  }, 850);

  useEffect(() => () => {
    if (flashT.current) clearTimeout(flashT.current);
    if (pulseT.current) clearTimeout(pulseT.current);
  }, []);

  const reset = () => {
    setRunning(false);
    seriesRef.current = seedMetric();
    setSeries([...seriesRef.current]);
    alarmRef.current = "OK";
    breachRef.current = 0;
    okRef.current = 0;
    fleetRef.current = 2;
    notifRef.current = 0;
    scaledRef.current = 0;
    stormRef.current = 0;
    tickRef.current = 0;
    setAlarm("OK");
    setFleet(2);
    setNotif(0);
    setScaled(0);
    setSnsFired(false);
    setScaleFired(false);
    setFlash(null);
    setLines([]);
  };

  /* derived (render-safe — from state only) */
  const cpuNow = series[series.length - 1] ?? 0;
  const thrY = alY(threshold);
  const cpuPts = series.map((v, i) => `${alX(i, series.length).toFixed(1)},${alY(v).toFixed(1)}`).join(" ");
  const areaPts = `${cpuPts} ${AL_W},${AL_H} 0,${AL_H}`;
  const lastX = alX(series.length - 1, series.length);
  const lastY = alY(cpuNow);
  const lastBreach = cpuNow > threshold;
  const breachRun = (() => {
    let n = 0;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if (series[i] > threshold) n += 1;
      else break;
    }
    return n;
  })();
  const breachSegs: string[] = [];
  let start = -1;
  for (let i = 0; i <= series.length; i += 1) {
    const b = i < series.length && series[i] > threshold;
    if (b && start < 0) start = i;
    if (!b && start >= 0) {
      const from = start > 0 ? start - 1 : start;
      breachSegs.push(
        series.slice(from, Math.min(i, series.length - 1) + 1)
          .map((v, k) => `${alX(from + k, series.length).toFixed(1)},${alY(v).toFixed(1)}`)
          .join(" ")
      );
      start = -1;
    }
  }

  return (
    <UseCaseShell
      title="USE CASE // ALARM → ACTION"
      subtitle="METRIC BREACHES THRESHOLD → ALARM STATE → SNS + AUTO SCALING FIRE AUTOMATICALLY"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="METRIC VALUE" value={`${Math.round(cpuNow)}%`} tone={lastBreach ? "danger" : "mint"} />
          <UCStat label="THRESHOLD" value={`${threshold}%`} tone="aws" />
          <UCStat label="ALARM STATE" value={alarm} tone={alarm === "ALARM" ? "danger" : "mint"} />
          <UCStat label="ACTIONS FIRED" value={notif + scaled} tone="magenta" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "METRIC STREAM LIVE — EVALUATING 2/2 DATAPPOINTS" : "ENGINE IDLE — PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">ALARM THRESHOLD</p>
          <CwSlider
            label="CPUUtilization >"
            value={threshold}
            min={40}
            max={90}
            step={5}
            suffix="%"
            onChange={setThreshold}
            ariaLabel="Set alarm threshold between 40 and 90 percent"
          />
          <p className="text-[7px] tracking-wider uppercase text-muted-foreground/70">
            STATIC THRESHOLDS PAGE YOU AT 3AM. SET IT HIGH ENOUGH TO IGNORE NOISE, LOW ENOUGH TO CATCH REAL PAIN.
          </p>
        </>
      }
      logLines={lines}
      logTitle="ALARM ACTION LOG // LIVE"
      logEmpty="PRESS RUN — THE METRIC WILL BREACH ON ITS OWN (OR LOWER THE THRESHOLD)"
    >
      <FlowCanvas ariaLabel="CloudWatch alarm to action use case diagram" className="h-full">
        {/* core → action links */}
        <FlowLink d="M57,26 C64,26 66,22 72,22" status={snsFired ? "cyber" : "idle"} dotDuration={1.3} />
        <FlowLink d="M57,40 C64,40 66,48 72,48" status={scaleFired ? "success" : "idle"} dotDuration={1.3} dotDelay={0.15} />

        {/* METRIC STREAM CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[52%] max-w-[350px]"
          style={{ left: "30%", top: "42%" }}
        >
          <div
            className={`glass cyber-cut p-2.5 transition-shadow ${
              alarm === "ALARM"
                ? "border-danger/70 shadow-[0_0_24px_rgba(255,51,85,0.45)]"
                : "box-glow border-aws/40"
            }`}
          >
            <div className="flex items-center justify-between gap-1 pb-1.5">
              <span className="flex min-w-0 items-center gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-aws">
                <CloudWatchIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">METRIC STREAM // AWS/EC2 CPU</span>
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={alarm}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                  aria-label={`Alarm state ${alarm}`}
                  className={`flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.12em] ${
                    alarm === "ALARM"
                      ? "border-danger/70 text-danger bg-danger/15"
                      : "border-mint/60 text-mint bg-mint/10"
                  }`}
                >
                  <CWAlarmIcon className="h-2.5 w-2.5 shrink-0" />
                  {alarm}
                  {alarm === "ALARM" && <span className="blink-cursor">_</span>}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="relative border-t border-aws/15 pt-1.5">
              <svg
                viewBox={`0 0 ${AL_W} ${AL_H}`}
                preserveAspectRatio="none"
                className="block h-[100px] w-full"
                role="img"
                aria-label="Rolling CPU metric line with threshold"
              >
                <polygon points={areaPts} fill="#ff9900" fillOpacity={0.08} />
                <polyline
                  points={cpuPts}
                  fill="none"
                  stroke="#ff9900"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={0}
                  y1={thrY}
                  x2={AL_W}
                  y2={thrY}
                  stroke="#ff3355"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.9}
                  vectorEffect="non-scaling-stroke"
                />
                {breachSegs.map((p, i) => (
                  <polyline
                    key={`al-breach-${i}`}
                    points={p}
                    fill="none"
                    stroke="#ff3355"
                    strokeWidth={2.4}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <motion.circle
                  key={`ring-${series.length}`}
                  cx={lastX}
                  cy={lastY}
                  fill="none"
                  stroke={lastBreach ? "#ff3355" : "#ff9900"}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  initial={{ r: 3, opacity: 0.8 }}
                  animate={{ r: 12, opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
                <motion.circle
                  fill={lastBreach ? "#ff3355" : "#ff9900"}
                  r={3.2}
                  initial={false}
                  animate={{ cx: lastX, cy: lastY }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                />
              </svg>
              <span
                className="absolute right-0 -translate-y-1/2 bg-black/60 px-0.5 text-[6px] font-extrabold tracking-[0.14em] text-danger"
                style={{ top: `${100 - threshold}%` }}
              >
                THR {threshold}%
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-aws/15 pt-1.5">
              <span className="text-[6px] font-bold tracking-[0.18em] text-muted-foreground">PERIOD 10S × EVAL 2</span>
              <span className="text-[6px] font-bold tracking-[0.18em] text-aws/80">WINDOW {AL_WINDOW} PTS</span>
            </div>
          </div>
        </motion.div>

        {/* +1 INSTANCE chip floats to the ASG node on scale-out */}
        <AnimatePresence>
          {scaleFired && (
            <motion.div
              key={`plus-${fleet}`}
              initial={{ opacity: 0, y: -12, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="absolute z-20 -translate-x-1/2"
              style={{ left: "82%", top: "38%" }}
            >
              <span className="border border-mint/70 bg-black/80 px-1.5 py-0.5 text-[7px] font-extrabold tracking-[0.15em] text-mint box-glow">
                +1 INSTANCE
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACTION TARGETS */}
        <FlowNode
          x={84}
          y={22}
          size="sm"
          delay={0.35}
          icon={<SNSIcon className="h-3 w-3" />}
          label="SNS TOPIC"
          sub={`${notif} PUBLISHED`}
          status={snsFired ? "cyber" : "idle"}
          pulse={snsFired}
        />
        <FlowNode
          x={84}
          y={50}
          size="sm"
          delay={0.45}
          icon={<ServerIcon className="h-3 w-3" />}
          label="AUTO SCALING"
          sub={`FLEET ${fleet} INSTANCES`}
          status={scaleFired ? "success" : "idle"}
          pulse={scaleFired}
        />
        <FlowNode
          x={84}
          y={76}
          size="sm"
          delay={0.55}
          icon={<EmailNotificationIcon className="h-3 w-3" />}
          label="OPS EMAIL"
          sub="ON-CALL PAGER"
          status={snsFired ? "cyber" : "idle"}
          pulse={snsFired}
        />

        {/* fired action chips */}
        <div className="absolute inset-x-0 bottom-2.5 z-20 flex justify-center gap-2 px-3">
          <AnimatePresence>
            {snsFired && (
              <motion.span
                key="al-chip-sns"
                initial={{ opacity: 0, y: 14, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className="border border-magenta/70 bg-black/85 px-2 py-1 text-[7.5px] font-extrabold uppercase tracking-[0.18em] text-magenta shadow-[0_0_16px_rgba(255,45,120,0.35)]"
              >
                <Bell className="mr-1 inline h-2.5 w-2.5" /> SNS NOTIFY — PUBLISHED 1.2S
              </motion.span>
            )}
            {scaleFired && (
              <motion.span
                key="al-chip-asg"
                initial={{ opacity: 0, y: 14, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 400, damping: 24, delay: 0.08 }}
                className="border border-mint/70 bg-black/85 px-2 py-1 text-[7.5px] font-extrabold uppercase tracking-[0.18em] text-mint shadow-[0_0_16px_rgba(0,255,163,0.3)]"
              >
                <Zap className="mr-1 inline h-2.5 w-2.5" /> ASG SCALE-OUT — +1 INSTANCE (FLEET {fleet})
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <FlowLabel x={68} y={12} tone="magenta">PUBLISH → PAGER</FlowLabel>
        <FlowLabel x={68} y={62} tone="mint">SCALE-OUT POLICY</FlowLabel>
        <VerdictFlash show={!!flash} text={flash?.text ?? ""} tone={flash?.tone ?? "ok"} />
        <StepBadge
          step={Math.min(2, breachRun)}
          total={2}
          text={alarm === "ALARM" ? "ALARM — ACTIONS FIRING" : breachRun >= 1 ? "BREACH 1/2 — EVALUATING" : "EVALUATING DATAPPOINTS"}
        />
      </FlowCanvas>

      <UseCaseNote>
        ALARM → SNS PAGER AND ALARM → AUTO SCALING: NO HUMAN IN THE LOOP — THE METRIC IS THE ON-CALL
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — CUSTOM DASHBOARD                                           */
/* ================================================================== */

type WidgetKey = "cpu" | "mem" | "req" | "err" | "net" | "disk";

interface WidgetDef {
  title: string;
  ns: string;
  unit: string;
  max: number;
  tone: UcTone;
  seed: number;
  gen: (v: number) => number;
}

const DW_POINTS = 40;
const DW_POOL: WidgetKey[] = ["cpu", "mem", "req", "err", "net", "disk"];

const WIDGET_DEFS: Record<WidgetKey, WidgetDef> = {
  cpu: { title: "CPU UTILIZATION", ns: "AWS/EC2", unit: "%", max: 100, tone: "aws", seed: 42, gen: (v) => clamp(v + rand(-6, 6), 12, 96) },
  mem: { title: "MEMORY USED", ns: "CWAGENT", unit: "%", max: 100, tone: "mint", seed: 61, gen: (v) => clamp(v + rand(-4, 5), 30, 92) },
  req: { title: "REQUESTS", ns: "AWS/APPLICATIONELB", unit: "RPS", max: 400, tone: "neon", seed: 180, gen: (v) => clamp(v + rand(-38, 42), 60, 380) },
  err: { title: "ERRORS 5XX", ns: "AWS/APPLICATIONELB", unit: "/MIN", max: 40, tone: "magenta", seed: 3, gen: (v) => clamp(v + rand(-2.4, 2.8), 0, 38) },
  net: { title: "NETWORK IN", ns: "AWS/EC2", unit: "MB/S", max: 120, tone: "neon", seed: 44, gen: (v) => clamp(v + rand(-12, 13), 4, 115) },
  disk: { title: "DISK WRITE OPS", ns: "CWAGENT", unit: "OP/S", max: 260, tone: "aws", seed: 90, gen: (v) => clamp(v + rand(-24, 26), 10, 250) },
};

function seedWidgetData(): Record<WidgetKey, number[]> {
  const out = {} as Record<WidgetKey, number[]>;
  DW_POOL.forEach((k) => {
    const def = WIDGET_DEFS[k];
    const arr: number[] = [];
    let v = def.seed;
    for (let i = 0; i < DW_POINTS; i += 1) {
      v = def.gen(v);
      arr.push(v);
    }
    out[k] = arr;
  });
  return out;
}

function Sparkline({ values, max, stroke }: { values: number[]; max: number; stroke: string }) {
  const n = values.length;
  const pts = values
    .map((v, i) => `${(n <= 1 ? 0 : (i / (n - 1)) * 100).toFixed(1)},${(25 - (clamp(v, 0, max) / max) * 22).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="block h-[34px] w-full" role="img" aria-label="widget sparkline trend">
      <polygon points={`${pts} 100,26 0,26`} fill={stroke} fillOpacity={0.1} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function WidgetCard({
  def,
  values,
  running,
  delay,
}: {
  def: WidgetDef;
  values: number[];
  running: boolean;
  delay: number;
}) {
  const cur = values[values.length - 1] ?? def.seed;
  const prev = values[values.length - 2] ?? cur;
  const delta = r1(cur - prev);
  const up = delta > 0;
  const flat = Math.abs(delta) < 0.1;
  const hex = TONE_HEX[def.tone];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.35 }}
      className={`glass cyber-cut-sm flex min-h-0 flex-col justify-between gap-1 border p-2 ${
        running ? "border-aws/25" : "border-foreground/15"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1 text-[7.5px] font-extrabold uppercase tracking-[0.15em] text-foreground/90">
          {running && <span className="h-1 w-1 shrink-0 animate-pulse" style={{ background: hex }} aria-hidden="true" />}
          <span className="truncate">{def.title}</span>
        </span>
        <span className="shrink-0 text-[5.5px] tracking-[0.14em] text-muted-foreground">{def.ns}</span>
      </div>
      <Sparkline values={values} max={def.max} stroke={hex} />
      <div className="flex items-end justify-between gap-1">
        <span className="text-[13px] font-extrabold leading-none tabular-nums" style={{ color: hex }}>
          {Math.round(cur)}
          <span className="ml-0.5 text-[6px] font-bold tracking-wider text-muted-foreground">{def.unit}</span>
        </span>
        <span
          className={`border px-1 py-0.5 text-[6.5px] font-extrabold tabular-nums ${
            flat ? "border-foreground/20 text-muted-foreground" : up ? "border-mint/40 text-mint" : "border-danger/40 text-danger"
          }`}
        >
          {flat ? "— FLAT" : up ? `▲ +${delta}` : `▼ ${delta}`}
        </span>
      </div>
    </motion.div>
  );
}

function DashboardUseCase({ immersiveActive, immersiveToggle }: CwUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [widgets, setWidgets] = useState<WidgetKey[]>(["cpu", "mem", "req"]);
  const [data, setData] = useState<Record<WidgetKey, number[]>>(seedWidgetData);
  const [lines, setLines] = useState<UcLine[]>([]);

  const widgetsRef = useRef<WidgetKey[]>(widgets);
  const dataRef = useRef<Record<WidgetKey, number[]>>(data);
  const ingestRef = useRef(0);
  const tickRef = useRef(0);
  const idRef = useRef(1);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  /* every tick each widget ingests one datapoint into its rolling window */
  useTicker(running, () => {
    tickRef.current += 1;
    let ingested = 0;
    widgetsRef.current.forEach((k) => {
      const def = WIDGET_DEFS[k];
      const arr = dataRef.current[k];
      const next = def.gen(arr[arr.length - 1] ?? def.seed);
      dataRef.current = { ...dataRef.current, [k]: [...arr.slice(-(DW_POINTS - 1)), next] };
      ingested += 1;
    });
    ingestRef.current += ingested;
    setData({ ...dataRef.current });
    if (tickRef.current % 3 === 0) {
      const k = widgetsRef.current[Math.floor(Math.random() * widgetsRef.current.length)];
      const def = WIDGET_DEFS[k];
      push(
        `PUT METRIC DATA — ${def.ns} ${def.title} ${Math.round(dataRef.current[k][dataRef.current[k].length - 1])}${def.unit} — stored (std resolution)`,
        "aws"
      );
    }
  }, 800);

  const addWidget = () => {
    if (widgets.length >= DW_POOL.length) return;
    const nextKey = DW_POOL[widgets.length];
    const def = WIDGET_DEFS[nextKey];
    setWidgets((w) => [...w, nextKey]);
    push(`CONSOLE: widget added — ${def.title} (${def.ns}) — dashboard saved`, "magenta");
  };

  const reset = () => {
    setRunning(false);
    dataRef.current = seedWidgetData();
    setData({ ...dataRef.current });
    setWidgets(["cpu", "mem", "req"]);
    ingestRef.current = 0;
    tickRef.current = 0;
    setLines([]);
  };

  const namespaces = new Set(widgets.map((k) => WIDGET_DEFS[k].ns)).size;
  const maxed = widgets.length >= DW_POOL.length;

  return (
    <UseCaseShell
      title="USE CASE // CUSTOM DASHBOARD"
      subtitle="CROSS-SERVICE WIDGETS ON ONE PANE OF GLASS — SHARED WITH THE TEAM, ON EVERY TV"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="WIDGETS" value={`${widgets.length}/6`} tone="aws" />
          <UCStat label="INGEST POINTS/S" value={(widgets.length / 0.8).toFixed(1)} tone="neon" />
          <UCStat label="NAMESPACE COUNT" value={namespaces} tone="magenta" />
          <UCStat label="REFRESH" value="800MS" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `DASHBOARD LIVE — ${widgets.length} WIDGETS STREAMING` : "DASHBOARD IDLE — PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">WIDGET LIBRARY</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={addWidget} disabled={maxed} ariaLabel="Add a widget to the dashboard">
              <Plus className="h-3 w-3" /> {maxed ? "MAX 6 WIDGETS" : "ADD WIDGET"}
            </UCButton>
          </div>
          <p className="text-[7px] tracking-wider uppercase text-muted-foreground/70">
            NEXT UP: {maxed ? "LIBRARY EMPTY — 6/6 PLACED" : `${WIDGET_DEFS[DW_POOL[widgets.length]].title} · ${WIDGET_DEFS[DW_POOL[widgets.length]].ns}`}
          </p>
        </>
      }
      logLines={lines}
      logTitle="DASHBOARD INGEST LOG // LIVE"
      logEmpty="PRESS RUN — WIDGETS START STREAMING FROM THEIR NAMESPACES"
    >
      <FlowCanvas ariaLabel="CloudWatch custom dashboard use case" className="h-full">
        <div className="absolute inset-0 grid grid-cols-2 auto-rows-fr gap-2 p-2.5 pt-9">
          {widgets.map((k, i) => (
            <WidgetCard key={k} def={WIDGET_DEFS[k]} values={data[k] ?? []} running={running} delay={0.1 + i * 0.06} />
          ))}
        </div>
        <FlowLabel x={50} y={5.5} tone="aws">CLOUDWATCH DASHBOARD — LIVE WIDGETS · AUTO-REFRESH 800MS</FlowLabel>
        <StepBadge step={widgets.length} total={6} text={running ? "WIDGETS STREAMING" : "WIDGETS IDLE"} />
      </FlowCanvas>

      <UseCaseNote>
        ONE DASHBOARD, EVERY SERVICE: CPU NEXT TO LAMBDA ERRORS NEXT TO BILLING — 70+ NAMESPACES, ZERO INFRA
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — LOG ANOMALY DETECTION                                      */
/* ================================================================== */

const AN_BUCKETS = 24;
const AN_BAR_MAX = 46;

const AN_PATHS = ["/api/orders", "/api/checkout", "/api/users", "/api/search", "/api/cart", "/health"];

function mkAnLine(forceErr: boolean): { text: string; err: boolean } {
  const p = AN_PATHS[Math.floor(rand(0, AN_PATHS.length))];
  if (forceErr || Math.random() < 0.06) {
    const code = Math.random() < 0.7 ? "500" : "503";
    return { text: `ERROR ${p} ${code} ${Math.round(rand(400, 2400))}ms upstream_timeout`, err: true };
  }
  return { text: `INFO  ${p} 200 ${Math.round(rand(6, 90))}ms ${Math.round(rand(4, 40))}kB`, err: false };
}

function AnomalyUseCase({ immersiveActive, immersiveToggle }: CwUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [buckets, setBuckets] = useState<number[]>([]);
  const [stageLines, setStageLines] = useState<{ id: number; text: string; err: boolean }[]>([]);
  const [linesScanned, setLinesScanned] = useState(0);
  const [errRate, setErrRate] = useState(0);
  const [anomalies, setAnomalies] = useState(0);
  const [winCount, setWinCount] = useState({ normal: 0, anomaly: 0 });
  const [detector, setDetector] = useState<"IDLE" | "SCANNING" | "ANOMALY">("IDLE");
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "deny" } | null>(null);
  const [logLines, setLogLines] = useState<UcLine[]>([]);

  const bucketsRef = useRef<number[]>([]);
  const winLinesRef = useRef<number[]>([]);
  const scanRef = useRef(0);
  const errRef = useRef(0);
  const injectRef = useRef(0);
  const anomalyTicksRef = useRef(0);
  const tickRef = useRef(0);
  const anomaliesRef = useRef(0);
  const normalWinRef = useRef(0);
  const anomWinRef = useRef(0);
  const startedRef = useRef(false);
  const idRef = useRef(1);
  const logIdRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const push = (text: string, tone?: string) =>
    setLogLines((prev) => [...prev.slice(-40), { id: logIdRef.current++, text, tone }]);

  /* auto-scroll the on-stage log stream */
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [stageLines]);

  /* one scan window per tick: emit lines, close the window, evaluate vs p50 band */
  useTicker(running, () => {
    tickRef.current += 1;
    const tick = tickRef.current;

    /* 1. evaluate the PREVIOUS window against the trained baseline */
    if (startedRef.current) {
      const errs = errRef.current;
      const base = [...bucketsRef.current];
      const sorted = [...base].sort((a, b) => a - b);
      const p50 = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      const upper = Math.max(p50 + 2, Math.ceil(p50 * 2.5));
      bucketsRef.current = [...base, errs].slice(-AN_BUCKETS);
      winLinesRef.current = [...winLinesRef.current, scanRef.current].slice(-AN_BUCKETS);
      if (errs > upper) {
        anomWinRef.current += 1;
        anomaliesRef.current += 1;
        anomalyTicksRef.current = 3;
        const ratio = Math.max(2, Math.round(errs / Math.max(1, p50)));
        push(`${tstamp(tick)} ANOMALY — window ${tstamp(Math.max(0, tick - 1))}: ${errs} errors vs p50 ${p50} (band ≤ ${upper})`, "danger");
        push(`anomaly detector: ${ratio}x error rate for 2m`, "danger");
        setFlash({ text: `ANOMALY — ${ratio}X BASELINE`, tone: "deny" });
        if (flashT.current) clearTimeout(flashT.current);
        flashT.current = setTimeout(() => setFlash(null), 2200);
      } else {
        normalWinRef.current += 1;
        if (tick % 5 === 0) push(`${tstamp(tick)} scan — window within expected band (p50 ${p50}, ≤ ${upper}) — no anomaly`, "dim");
      }
      setBuckets([...bucketsRef.current]);
      setWinCount({ normal: normalWinRef.current, anomaly: anomWinRef.current });
      setAnomalies(anomaliesRef.current);
    }
    startedRef.current = true;

    /* 2. emit fresh log lines for the next window */
    const injected = injectRef.current > 0;
    if (injected) injectRef.current -= 1;
    const sorted = [...bucketsRef.current].sort((a, b) => a - b);
    const p50 = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 1;
    const errCount = injected ? Math.max(40, Math.round(Math.max(1, p50)) * 40) : Math.random() < 0.25 ? 1 : 0;
    const count = injected ? errCount + 2 + Math.floor(rand(0, 3)) : 3 + Math.floor(rand(0, 3));
    const errIdx = new Set<number>();
    while (errIdx.size < errCount) errIdx.add(Math.floor(rand(0, count)));
    const fresh: { id: number; text: string; err: boolean }[] = [];
    for (let i = 0; i < count; i += 1) {
      const l = mkAnLine(errIdx.has(i));
      fresh.push({ id: idRef.current++, text: l.text, err: l.err });
    }
    setStageLines((prev) => [...prev.slice(-80), ...fresh]);
    scanRef.current = count;
    errRef.current = errCount;
    setLinesScanned((n) => n + count);

    /* error rate over the last 10 windows */
    const wE = bucketsRef.current.slice(-10);
    const wN = winLinesRef.current.slice(-10);
    const sumE = wE.reduce((a, b) => a + b, 0);
    const sumN = wN.reduce((a, b) => a + b, 0);
    setErrRate(sumN > 0 ? (sumE / sumN) * 100 : 0);

    if (anomalyTicksRef.current > 0) anomalyTicksRef.current -= 1;
    setDetector(anomalyTicksRef.current > 0 ? "ANOMALY" : "SCANNING");
  }, 900);

  useEffect(() => () => {
    if (flashT.current) clearTimeout(flashT.current);
  }, []);

  const injectSpike = () => {
    if (!running) setRunning(true);
    injectRef.current = 2;
    push("INJECT → error spike queued — upstream dependency failing ×2 windows", "neon");
  };

  const reset = () => {
    setRunning(false);
    bucketsRef.current = [];
    winLinesRef.current = [];
    scanRef.current = 0;
    errRef.current = 0;
    injectRef.current = 0;
    anomalyTicksRef.current = 0;
    tickRef.current = 0;
    anomaliesRef.current = 0;
    normalWinRef.current = 0;
    anomWinRef.current = 0;
    startedRef.current = false;
    setBuckets([]);
    setStageLines([]);
    setLogLines([]);
    setLinesScanned(0);
    setErrRate(0);
    setAnomalies(0);
    setWinCount({ normal: 0, anomaly: 0 });
    setDetector("IDLE");
    setFlash(null);
  };

  /* band geometry — computed from state snapshot */
  const sorted = [...buckets].sort((a, b) => a - b);
  const p50 = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const upper = Math.max(p50 + 2, Math.ceil(p50 * 2.5));
  const lower = Math.max(0, p50 - Math.ceil(p50 * 0.8) - 1);
  const bandTop = 100 - (Math.min(upper, AN_BAR_MAX) / AN_BAR_MAX) * 100;
  const bandBottom = 100 - (Math.min(lower, AN_BAR_MAX) / AN_BAR_MAX) * 100;
  const p50Top = 100 - (Math.min(p50, AN_BAR_MAX) / AN_BAR_MAX) * 100;
  const alarmActive = detector === "ANOMALY";

  return (
    <UseCaseShell
      title="USE CASE // LOG ANOMALY DETECTION"
      subtitle="NO THRESHOLD TO TUNE — ML LEARNS THE P50 BAND AND PAGES WHEN LOGS BREAK OUT OF IT"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="LINES SCANNED" value={linesScanned} tone="aws" />
          <UCStat label="ERROR RATE %" value={`${errRate.toFixed(1)}%`} tone={errRate > 10 ? "danger" : "mint"} />
          <UCStat label="ANOMALIES DETECTED" value={anomalies} tone={anomalies > 0 ? "magenta" : "neutral"} />
          <UCStat label="DETECTOR STATE" value={detector} tone={alarmActive ? "danger" : running ? "neon" : "neutral"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? (alarmActive ? "ANOMALY ALARM — ERROR RATE OUT OF BAND" : "SCANNING — LOGS WITHIN EXPECTED BAND") : "DETECTOR IDLE — PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CHAOS INJECTION</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={injectSpike} tone="danger" ariaLabel="Inject an error spike into the log stream">
              <Siren className="h-3 w-3" /> INJECT ERROR SPIKE
            </UCButton>
          </div>
          <p className="text-[7px] tracking-wider uppercase text-muted-foreground/70">
            THE DETECTOR TRAINS ON THE LIVE STREAM — INJECT A SPIKE AND WATCH THE BAND CATCH IT.
          </p>
        </>
      }
      logLines={logLines}
      logTitle="DETECTOR LOG // LIVE"
      logEmpty="PRESS RUN — THE DETECTOR STARTS SCANNING THE LOG GROUP"
    >
      <FlowCanvas ariaLabel="CloudWatch logs anomaly detection use case" className="h-full">
        {/* LEFT — scrolling log stream */}
        <div
          className={`absolute bottom-[10%] left-[3%] top-[13%] flex w-[44%] flex-col border bg-black/60 cyber-cut-sm transition-shadow ${
            alarmActive ? "border-danger/70 shadow-[0_0_18px_rgba(255,51,85,0.35)]" : "border-foreground/20"
          }`}
        >
          <div className="flex items-center justify-between border-b border-foreground/15 px-2 py-1">
            <span className="text-[7px] font-extrabold tracking-[0.18em] text-aws">LOG GROUP /aws/api/app</span>
            <span className={`text-[6px] tracking-[0.14em] ${running ? "text-mint" : "text-muted-foreground"}`}>
              {running ? "STREAMING" : "PAUSED"}
            </span>
          </div>
          <div ref={streamRef} className="cyber-scroll flex flex-1 flex-col gap-px overflow-y-auto px-2 py-1">
            {stageLines.map((l) => (
              <p
                key={l.id}
                className={`truncate font-mono text-[7px] leading-[10px] tracking-wide ${l.err ? "font-bold text-danger" : "text-foreground/50"}`}
              >
                {l.text}
              </p>
            ))}
            {stageLines.length === 0 && (
              <p className="py-1 text-[7px] uppercase tracking-wider text-muted-foreground/50">NO LINES — PRESS RUN</p>
            )}
          </div>
        </div>

        {/* RIGHT — detector band chart */}
        <div className="absolute bottom-[10%] right-[3%] top-[13%] flex w-[47%] flex-col border border-aws/30 bg-black/50 cyber-cut-sm p-2">
          <div className="flex items-center justify-between pb-1">
            <span className="flex items-center gap-1 text-[7.5px] font-extrabold uppercase tracking-[0.15em] text-aws">
              <Gauge className="h-3 w-3" /> ERROR COUNT / WINDOW
            </span>
            <span
              className={`border px-1 py-0.5 text-[6px] font-extrabold uppercase tracking-[0.14em] ${
                alarmActive ? "border-danger/70 text-danger animate-pulse" : running ? "border-neon/50 text-neon" : "border-foreground/25 text-muted-foreground"
              }`}
            >
              {detector}
            </span>
          </div>
          <div className="relative flex-1 border border-foreground/10 bg-black/40">
            {/* expected band around the p50 line */}
            {buckets.length > 1 && (
              <div
                className="absolute inset-x-0 border-y border-magenta/40 bg-magenta/10"
                style={{ top: `${Math.min(bandTop, bandBottom)}%`, bottom: `${100 - Math.max(bandTop, bandBottom)}%` }}
                aria-hidden="true"
              />
            )}
            {/* p50 line */}
            <div className="absolute inset-x-0 border-t border-dashed border-aws" style={{ top: `${p50Top}%` }}>
              <span className="absolute -top-2 right-0.5 bg-black/70 px-0.5 text-[6px] font-extrabold tracking-[0.12em] text-aws">
                P50 {p50}
              </span>
            </div>
            {/* upper band line */}
            <div className="absolute inset-x-0 border-t border-dashed border-danger/80" style={{ top: `${bandTop}%` }}>
              <span className="absolute -top-2 left-0.5 bg-black/70 px-0.5 text-[6px] font-extrabold tracking-[0.12em] text-danger">
                BAND ≤ {upper}
              </span>
            </div>
            {/* window bars */}
            <div className="absolute inset-0 flex items-end gap-px px-px pb-px">
              {buckets.map((v, i) => {
                const h = (clamp(v, 0, AN_BAR_MAX) / AN_BAR_MAX) * 100;
                const hot = v > upper;
                return (
                  <motion.div
                    key={`${i}-${v}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(2, h)}%` }}
                    transition={{ duration: 0.35 }}
                    className={`flex-1 ${hot ? "bg-danger shadow-[0_0_8px_rgba(255,51,85,0.6)]" : "bg-aws/60"}`}
                    aria-label={`window ${i + 1}: ${v} errors${hot ? " — anomalous" : ""}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1.5">
            <span className="border border-mint/40 px-1.5 py-0.5 text-[6.5px] font-extrabold tracking-[0.14em] text-mint">
              NORMAL {winCount.normal}
            </span>
            <span
              className={`border px-1.5 py-0.5 text-[6.5px] font-extrabold tracking-[0.14em] ${
                winCount.anomaly > 0 ? "border-danger/60 text-danger" : "border-foreground/20 text-muted-foreground"
              }`}
            >
              ANOMALY {winCount.anomaly}
            </span>
            <span className="ml-auto text-[6px] tracking-[0.14em] text-muted-foreground">WINDOW 900MS · RETAIN {AN_BUCKETS}</span>
          </div>
        </div>

        <FlowLabel x={50} y={6.5} tone="aws">CLOUDWATCH LOGS → ANOMALY DETECTOR — P50 BAND, NOT A STATIC THRESHOLD</FlowLabel>
        <VerdictFlash show={!!flash} text={flash?.text ?? ""} tone={flash?.tone ?? "ok"} />
      </FlowCanvas>

      <UseCaseNote>
        NO THRESHOLD TO TUNE: THE ML MODEL LEARNS NORMAL ERROR RHYTHM AND PAGES ONLY ON REAL BREAKOUTS — 40X SPIKES CAUGHT IN ONE WINDOW
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function CwUseCases({ id, immersiveActive, immersiveToggle }: CwUseCasesProps) {
  if (id === "ALARM_ACTION") return <AlarmActionUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "DASHBOARD") return <DashboardUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <AnomalyUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
