"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Container,
  GitCommit,
  Rocket,
  Wrench,
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
  useScenarioRunner,
  useTicker,
} from "@/components/shared/use-case";
import {
  ECRIcon,
  ECSIcon,
  ECSTaskIcon,
  EKSIcon,
  ELBIcon,
} from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES + HELPERS                                              */
/* ================================================================== */

export type ContainersUseCaseId = "ROLLING_DEPLOY" | "SERVICE_SCALING" | "EKS_HPA";

interface ContainersUseCasesProps {
  id: ContainersUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

type UcLine = { id: number; text: string; tone?: string };

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const tstamp = (t: number) => `t${String(t).padStart(3, "0")}`;
const hex = (n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

/* Hoisted slider (never define components inside components) */
function CtrSlider({
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
/* TAB 02 — CI/CD ROLLING DEPLOY                                       */
/* ================================================================== */

type RdState = "RUNNING" | "STARTING" | "DRAINING";

interface RdTask {
  id: number;
  ver: number;
  state: RdState;
}

const RD_STEPS = 13; // push → build ×2 → ECR → 4×(drain+start, health) → done
const RD_TASKS = 4;

function seedRdTasks(): RdTask[] {
  return Array.from({ length: RD_TASKS }, (_, i) => ({ id: i + 1, ver: 1, state: "RUNNING" as const }));
}

function RdChip({ t }: { t: RdTask }) {
  const starting = t.state === "STARTING";
  const draining = t.state === "DRAINING";
  const isNew = t.ver >= 2;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, x: 14 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`border px-1.5 py-1 ${
        starting
          ? "border-magenta/70 bg-magenta/10 animate-pulse"
          : draining
            ? "border-neon/50 bg-neon/[0.06] opacity-60"
            : isNew
              ? "border-mint/60 bg-mint/[0.07]"
              : "border-foreground/20 bg-white/[0.03]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-1">
        <ECSTaskIcon
          className={`h-2.5 w-2.5 shrink-0 ${starting ? "text-magenta" : draining ? "text-neon" : "text-aws"}`}
        />
        <span className="truncate text-[7px] font-bold tracking-wider text-foreground/90">task-{t.id}</span>
        <span
          className={`ml-auto shrink-0 border px-0.5 text-[5.5px] font-extrabold ${
            isNew ? "border-mint/50 text-mint" : "border-foreground/25 text-muted-foreground"
          }`}
        >
          v{t.ver}
        </span>
      </div>
      <p
        className={`pt-0.5 text-[5.5px] font-extrabold tracking-[0.14em] ${
          starting ? "text-magenta" : draining ? "text-neon" : "text-mint"
        }`}
      >
        {t.state === "RUNNING" ? "RUNNING · 200 OK" : t.state}
      </p>
    </motion.div>
  );
}

function RollingDeployUseCase({ immersiveActive, immersiveToggle }: ContainersUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [armed, setArmed] = useState(false);
  const [tasks, setTasks] = useState<RdTask[]>(seedRdTasks);
  const [currentVer, setCurrentVer] = useState(1);
  const [deploys, setDeploys] = useState(0);
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "deny" | "aws" } | null>(null);
  const [lines, setLines] = useState<UcLine[]>([]);

  const tasksRef = useRef<RdTask[]>(tasks);
  const idRef = useRef(RD_TASKS + 1);
  const verRef = useRef(1);
  const logIdRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const pushLog = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logIdRef.current++, text, tone }]);

  /* pipeline step machine — actions fire inside the interval callback */
  const { step, reset: resetStep } = useScenarioRunner(RD_STEPS, running && armed, 850, (s) => {
    const nextVer = verRef.current + 1;
    if (s === 0) {
      pushLog(`git push origin main — commit ${hex(7)} — pipeline triggered`, "aws");
    } else if (s === 1) {
      pushLog(`docker build — layer 1/3 — node:20-alpine pulled (12s)`, "aws");
    } else if (s === 2) {
      pushLog(`docker build — layers 2-3 cached — tag api:v${nextVer} — image 84MB`, "aws");
    } else if (s === 3) {
      pushLog(`docker push → ECR nexus/api — digest sha256:${hex(12)}… — scan PASSED — v${nextVer} live in registry`, "magenta");
    } else if (s >= 4 && s <= 11) {
      const drainPhase = (s - 4) % 2 === 0;
      if (drainPhase) {
        const victim = tasksRef.current
          .filter((t) => t.ver < nextVer && t.state === "RUNNING")
          .sort((a, b) => a.id - b.id)[0];
        if (victim) {
          const newId = idRef.current;
          idRef.current += 1;
          tasksRef.current = [
            ...tasksRef.current.map((t) => (t.id === victim.id ? { ...t, state: "DRAINING" as const } : t)),
            { id: newId, ver: nextVer, state: "STARTING" as const },
          ];
          pushLog(`ECS: task-${victim.id} (v${victim.ver}) → DRAINING — ALB deregistering, in-flight requests finishing`, "neon");
          pushLog(`ECS: task-${newId} (v${nextVer}) STARTING — pulling api:v${nextVer} — health check pending`, "magenta");
          setTasks([...tasksRef.current]);
        }
      } else {
        const starter = tasksRef.current.find((t) => t.ver === nextVer && t.state === "STARTING");
        const drained = tasksRef.current.filter((t) => t.state === "DRAINING");
        tasksRef.current = tasksRef.current
          .map((t) => (starter && t.id === starter.id ? { ...t, state: "RUNNING" as const } : t))
          .filter((t) => t.state !== "DRAINING");
        if (starter) pushLog(`task task-${starter.id} replaced — health 200 — serving traffic`, "mint");
        drained.forEach((d) => pushLog(`ECS: task-${d.id} terminated — deregistration delay elapsed`, "dim"));
        setTasks([...tasksRef.current]);
      }
    } else if (s === 12) {
      verRef.current = nextVer;
      setCurrentVer(nextVer);
      setDeploys((d) => d + 1);
      pushLog(`DEPLOY COMPLETE — ${RD_TASKS}/${RD_TASKS} tasks on api:v${nextVer} — downtime 0s — 0 dropped connections`, "mint");
      setFlash({ text: "DEPLOY COMPLETE — 0s DOWNTIME", tone: "ok" });
      if (flashT.current) clearTimeout(flashT.current);
      flashT.current = setTimeout(() => setFlash(null), 2400);
      setArmed(false);
    }
  });

  useEffect(() => () => {
    if (flashT.current) clearTimeout(flashT.current);
  }, []);

  const startDeploy = () => {
    if (armed) return;
    resetStep();
    setArmed(true);
    if (!running) setRunning(true);
    pushLog(`pipeline: deploy queued — api:v${verRef.current + 1} — rolling, min healthy 100% · batch 1`, "magenta");
  };

  const reset = () => {
    setRunning(false);
    setArmed(false);
    resetStep();
    tasksRef.current = seedRdTasks();
    setTasks([...tasksRef.current]);
    idRef.current = RD_TASKS + 1;
    verRef.current = 1;
    setCurrentVer(1);
    setDeploys(0);
    setFlash(null);
    setLines([]);
    logIdRef.current = 1;
  };

  const nextVer = currentVer + 1;
  const vOld = tasks.filter((t) => t.ver <= currentVer).length;
  const vNew = tasks.filter((t) => t.ver > currentVer).length;
  const replaced = tasks.filter((t) => t.ver > currentVer && t.state === "RUNNING").length;
  const phaseText =
    step >= 12
      ? "DEPLOY COMPLETE — 0S DOWNTIME"
      : step >= 4
        ? `ROLLING — REPLACING ${Math.min(RD_TASKS, Math.floor((step - 2) / 2))}/${RD_TASKS}`
        : step >= 3
          ? "IMAGE IN ECR — ROLLING NEXT"
          : step >= 1
            ? "DOCKER BUILD"
            : "CODE PUSH";

  return (
    <UseCaseShell
      title="USE CASE // CI/CD ROLLING DEPLOY"
      subtitle="GIT PUSH → DOCKER → ECR → ECS REPLACES TASKS ONE-BY-ONE — OLD TASKS DRAIN, ZERO DOWNTIME"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label={`TASKS v${currentVer}`} value={vOld} tone={vOld > 0 ? "neutral" : "mint"} />
          <UCStat label={`TASKS v${nextVer}`} value={vNew} tone={vNew > 0 ? "mint" : "neutral"} />
          <UCStat label="DOWNTIME" value="0s" tone="mint" />
          <UCStat label="DEPLOYS" value={deploys} tone="aws" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={armed ? `PIPELINE RUNNING — ${phaseText}` : running ? "SERVICE LIVE — PRESS DEPLOY TO SHIP" : "IDLE — PRESS RUN OR DEPLOY"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">PIPELINE</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={startDeploy} disabled={armed} ariaLabel="Start a rolling deploy of a new image version">
              <Rocket className="h-3 w-3" /> DEPLOY v{nextVer}
            </UCButton>
          </div>
          <p className="text-[7px] tracking-wider uppercase text-muted-foreground/70">
            ONE TASK AT A TIME: NEW TASK PASSES HEALTH 200 BEFORE THE OLD ONE IS TERMINATED.
          </p>
        </>
      }
      logLines={lines}
      logTitle="PIPELINE LOG // LIVE"
      logEmpty="PRESS DEPLOY — WATCH THE PIPELINE SHIP v2 WITH ZERO DOWNTIME"
    >
      <FlowCanvas ariaLabel="CI/CD rolling deploy use case diagram" className="h-full">
        {/* pipeline links */}
        <FlowLink d="M20,13 C24,13 27,13 31,13" status={step >= 1 ? "success" : armed && step === 0 ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M44,13 C48,13 51,13 55,13" status={step >= 3 ? "success" : step >= 1 && step < 3 ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M68,13 C72,13 75,13 79,13" status={step >= 4 ? "success" : step === 3 ? "flowing" : "idle"} dotDuration={1.1} />

        {/* pipeline nodes */}
        <FlowNode
          x={13}
          y={13}
          size="sm"
          delay={0.1}
          icon={<GitCommit className="h-3 w-3" />}
          label="CODE PUSH"
          sub={step >= 1 ? "COMMIT MAIN" : "WAITING"}
          status={step >= 1 ? "success" : armed && step === 0 ? "active" : "idle"}
          pulse={armed && step === 0}
        />
        <FlowNode
          x={37}
          y={13}
          size="sm"
          delay={0.2}
          icon={<Wrench className="h-3 w-3" />}
          label="DOCKER BUILD"
          sub={step >= 3 ? "API:V" + nextVer : step >= 1 ? "LAYERS 1-3" : "WAITING"}
          status={step >= 3 ? "success" : step >= 1 && step < 3 ? "active" : "idle"}
          pulse={step >= 1 && step < 3}
        />
        <FlowNode
          x={61}
          y={13}
          size="sm"
          delay={0.3}
          icon={<ECRIcon className="h-3 w-3" />}
          label="PUSH ECR"
          sub={step >= 4 ? "SCAN PASSED" : step === 3 ? "PUSHING" : "WAITING"}
          status={step >= 4 ? "success" : step === 3 ? "active" : "idle"}
          pulse={step === 3}
        />
        <FlowNode
          x={85}
          y={13}
          size="sm"
          delay={0.4}
          icon={<ECSIcon className="h-3 w-3" />}
          label="ECS ROLLING"
          sub={step >= 12 ? "V" + nextVer + " LIVE" : step >= 4 ? "REPLACING 1-BY-1" : "WAITING"}
          status={step >= 12 ? "success" : step >= 4 ? "active" : "idle"}
          pulse={step >= 4 && step < 12}
        />

        {/* SERVICE CARD — task chips */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.45 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[50%] max-w-[330px]"
          style={{ left: "28%", top: "58%" }}
        >
          <div className="glass cyber-cut p-2.5 border-aws/30">
            <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-aws/15">
              <span className="flex min-w-0 items-center gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-aws">
                <ECSIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">ECS SERVICE api-svc</span>
              </span>
              <span className="shrink-0 border border-foreground/25 px-1 py-0.5 text-[6px] font-extrabold tracking-[0.12em] text-muted-foreground">
                DESIRED {RD_TASKS}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1.5">
              <AnimatePresence initial={false}>
                {tasks.map((t) => (
                  <RdChip key={t.id} t={t} />
                ))}
              </AnimatePresence>
            </div>
            <p className="pt-1.5 mt-1.5 border-t border-aws/15 text-[6px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
              MIN HEALTHY 100% · BATCH 1 · DEREGISTRATION DELAY 30S
            </p>
          </div>
        </motion.div>

        {/* DEPLOY STATE CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, duration: 0.45 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[30%] max-w-[190px]"
          style={{ left: "78%", top: "58%" }}
        >
          <div className={`glass cyber-cut p-2 ${armed ? "border-magenta/50 shadow-[0_0_16px_rgba(255,45,120,0.25)]" : "border-foreground/15"}`}>
            <p className="text-[7px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">DEPLOY STATE</p>
            <div className="flex items-center justify-center gap-1.5 py-1.5">
              <span className="border border-foreground/25 px-1.5 py-0.5 text-[8px] font-extrabold text-foreground/80">v{currentVer}</span>
              <span className="text-[8px] font-extrabold text-aws">→</span>
              <span className={`border px-1.5 py-0.5 text-[8px] font-extrabold ${armed ? "border-mint/60 text-mint box-glow" : "border-foreground/25 text-muted-foreground"}`}>
                v{nextVer}
              </span>
            </div>
            <div className="flex flex-col gap-1 border-t border-foreground/10 pt-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[6px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Replaced</span>
                <span className="text-[8px] font-extrabold tabular-nums text-aws">{armed ? replaced : RD_TASKS}/{RD_TASKS}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[6px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Downtime</span>
                <span className="text-[9px] font-extrabold tabular-nums text-mint">0s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[6px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Dropped reqs</span>
                <span className="text-[9px] font-extrabold tabular-nums text-mint">0</span>
              </div>
            </div>
          </div>
        </motion.div>

        <FlowLabel x={50} y={30} tone="aws">OLD TASKS DRAIN — NEW TASKS SERVE — REQUESTS NEVER DROP</FlowLabel>
        <StepBadge step={Math.min(step + 1, RD_STEPS)} total={RD_STEPS} text={phaseText} />
        <VerdictFlash show={!!flash} text={flash?.text ?? ""} tone={flash?.tone ?? "ok"} />
      </FlowCanvas>

      <UseCaseNote>
        DEPLOY 10×/DAY, NOT 10×/YEAR: MIN-HEALTHY 100% + DRAINING MEANS USERS NEVER SEE A 502 DURING A SHIP
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — SERVICE AUTOSCALING                                        */
/* ================================================================== */

interface ScTask {
  id: number;
  cpu: number;
}

const SC_MAX = 8;
const SC_MIN = 2;

function seedScTasks(): ScTask[] {
  return [
    { id: 1, cpu: 42 },
    { id: 2, cpu: 38 },
  ];
}

function ScChip({ t }: { t: ScTask }) {
  const hot = t.cpu > 70;
  const warm = t.cpu > 50;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, x: 14 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`w-[74px] border px-1.5 py-1 ${hot ? "border-danger/50" : warm ? "border-aws/40" : "border-mint/40"}`}
    >
      <div className="flex items-center gap-1">
        <ECSTaskIcon className={`h-2 w-2 shrink-0 ${hot ? "text-danger" : warm ? "text-aws" : "text-mint"}`} />
        <span className="truncate text-[6.5px] font-bold tracking-wider text-foreground/90">task-{t.id}</span>
        <span className="ml-auto text-[6px] font-extrabold tabular-nums text-muted-foreground">{Math.round(t.cpu)}%</span>
      </div>
      <div className="mt-0.5 h-[3px] w-full overflow-hidden bg-white/10">
        <motion.div
          className={`h-full ${hot ? "bg-danger" : warm ? "bg-aws" : "bg-mint"}`}
          animate={{ width: `${Math.round(clamp(t.cpu, 0, 100))}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </motion.div>
  );
}

function ServiceScalingUseCase({ immersiveActive, immersiveToggle }: ContainersUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [load, setLoad] = useState(40);
  const [tasks, setTasks] = useState<ScTask[]>(seedScTasks);
  const [cpuAvg, setCpuAvg] = useState(42);
  const [scaleEvents, setScaleEvents] = useState(0);
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "deny" | "aws" } | null>(null);
  const [lines, setLines] = useState<UcLine[]>([]);

  const tasksRef = useRef<ScTask[]>(tasks);
  const loadRef = useRef(load);
  const highRef = useRef(0);
  const lowRef = useRef(0);
  const idRef = useRef(3);
  const tickRef = useRef(0);
  const logIdRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logIdRef.current++, text, tone }]);

  /* target-tracking loop — CPU follows LOAD, policy scales on 2/3 evals */
  useTicker(running, () => {
    tickRef.current += 1;
    const tick = tickRef.current;
    const n = tasksRef.current.length;
    const cpu = Math.round(clamp((loadRef.current * 2.1) / n + rand(-6, 6), 4, 99));
    tasksRef.current = tasksRef.current.map((t) => ({ ...t, cpu: clamp(cpu + rand(-9, 9), 2, 100) }));
    setTasks([...tasksRef.current]);
    setCpuAvg(cpu);

    if (cpu > 55) {
      highRef.current += 1;
      lowRef.current = 0;
    } else if (cpu < 45) {
      lowRef.current += 1;
      highRef.current = 0;
    } else {
      highRef.current = 0;
      lowRef.current = 0;
    }

    if (highRef.current >= 2 && n < SC_MAX) {
      const newId = idRef.current;
      idRef.current += 1;
      tasksRef.current = [...tasksRef.current, { id: newId, cpu: cpu * 0.6 }];
      setTasks([...tasksRef.current]);
      setScaleEvents((e) => e + 1);
      highRef.current = 0;
      push(`${tstamp(tick)} target-tracking: CPU ${cpu}% > 50% for 2 evals — scale out ${n} → ${n + 1} tasks`, "mint");
      setFlash({ text: `SCALE OUT — ${n} → ${n + 1} TASKS`, tone: "ok" });
      if (flashT.current) clearTimeout(flashT.current);
      flashT.current = setTimeout(() => setFlash(null), 1800);
    } else if (lowRef.current >= 3 && n > SC_MIN) {
      const victim = tasksRef.current[tasksRef.current.length - 1];
      tasksRef.current = tasksRef.current.slice(0, -1);
      setTasks([...tasksRef.current]);
      setScaleEvents((e) => e + 1);
      lowRef.current = 0;
      push(`${tstamp(tick)} target-tracking: CPU ${cpu}% < 50% — scale in ${n} → ${n - 1} tasks — task-${victim.id} draining`, "neon");
      setFlash({ text: `SCALE IN — ${n} → ${n - 1} TASKS`, tone: "aws" });
      if (flashT.current) clearTimeout(flashT.current);
      flashT.current = setTimeout(() => setFlash(null), 1800);
    }

    if (tick % 4 === 0) {
      push(`${tstamp(tick)} CW METRICS: ECS CPUUtilization ${cpu}% avg — ${Math.round(loadRef.current * 9)} req/s via ALB`, "aws");
    }
  }, 1000);

  useEffect(() => () => {
    if (flashT.current) clearTimeout(flashT.current);
  }, []);

  const reset = () => {
    setRunning(false);
    tasksRef.current = seedScTasks();
    setTasks([...tasksRef.current]);
    setCpuAvg(42);
    setScaleEvents(0);
    setLoad(40);
    loadRef.current = 40;
    highRef.current = 0;
    lowRef.current = 0;
    idRef.current = 3;
    tickRef.current = 0;
    setFlash(null);
    setLines([]);
    logIdRef.current = 1;
  };

  const hot = cpuAvg > 55;
  const cold = cpuAvg < 45;

  return (
    <UseCaseShell
      title="USE CASE // SERVICE AUTOSCALING"
      subtitle="TARGET TRACKING AT 50% CPU — ECS ADDS TASKS UNDER LOAD, REMOVES THEM WHEN IT DROPS"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="LOAD" value={`${load}%`} tone="aws" />
          <UCStat label="CPU AVG" value={`${cpuAvg}%`} tone={hot ? "danger" : cold ? "neon" : "mint"} />
          <UCStat label="DESIRED TASKS" value={`${tasks.length}/${SC_MAX}`} tone="magenta" />
          <UCStat label="SCALE EVENTS" value={scaleEvents} tone="mint" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? (hot ? "CPU ABOVE TARGET — SCALING OUT" : cold ? "CPU BELOW TARGET — COOLING" : "CPU ON TARGET — STEADY") : "IDLE — PRESS RUN AND DRIVE THE LOAD SLIDER"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">TRAFFIC LOAD</p>
          <CtrSlider
            label="ALB LOAD"
            value={load}
            min={10}
            max={100}
            step={5}
            suffix="%"
            onChange={setLoad}
            ariaLabel="Set simulated traffic load between 10 and 100 percent"
          />
          <p className="text-[7px] tracking-wider uppercase text-muted-foreground/70">
            TARGET-TRACKING POLICY: KEEP SERVICE CPU ≈ 50% — ADD A TASK EVERY 2 HOT EVALS, REMOVE AFTER 3 COLD.
          </p>
        </>
      }
      logLines={lines}
      logTitle="SCALING LOG // LIVE"
      logEmpty="PRESS RUN — PUSH LOAD PAST 50% CPU AND WATCH TASKS APPEAR"
    >
      <FlowCanvas ariaLabel="ECS service autoscaling use case diagram" className="h-full">
        <FlowLink d="M17,26 C24,26 27,30 32,34" status={running ? "flowing" : "idle"} dotDuration={1.2} />
        <FlowLink d="M55,34 C62,34 64,28 70,26" status={running && hot ? "flowing" : "idle"} dotDuration={1.4} dotDelay={0.2} />

        {/* TRAFFIC SOURCE */}
        <FlowNode
          x={12}
          y={26}
          size="sm"
          delay={0.1}
          icon={<ELBIcon className="h-3 w-3" />}
          label="ALB"
          sub={`${Math.round(load * 9)} REQ/S`}
          status={running ? "active" : "idle"}
          pulse={running}
        />

        {/* SERVICE CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[46%] max-w-[300px]"
          style={{ left: "40%", top: "44%" }}
        >
          <div className={`glass cyber-cut p-2.5 ${hot ? "border-danger/50 shadow-[0_0_18px_rgba(255,51,85,0.3)]" : "border-aws/35"}`}>
            <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-aws/15">
              <span className="flex min-w-0 items-center gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-aws">
                <ECSIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">ECS SERVICE api-svc</span>
              </span>
              <span className={`shrink-0 border px-1 py-0.5 text-[6px] font-extrabold tracking-[0.12em] ${hot ? "border-danger/60 text-danger" : cold ? "border-neon/50 text-neon" : "border-mint/50 text-mint"}`}>
                CPU {cpuAvg}%
              </span>
            </div>
            <div className="pt-1.5">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[6px] font-bold tracking-[0.16em] text-muted-foreground uppercase">CPU AVG</span>
                <span className="text-[6px] font-bold tracking-[0.16em] text-mint uppercase">TARGET 50%</span>
              </div>
              <div className="relative h-3 w-full border border-foreground/20 bg-white/10">
                <motion.div
                  className={`h-full ${hot ? "bg-danger" : cold ? "bg-neon" : "bg-aws"}`}
                  animate={{ width: `${cpuAvg}%` }}
                  transition={{ duration: 0.6 }}
                />
                <div className="absolute inset-y-0 border-l-2 border-dashed border-mint" style={{ left: "50%" }} aria-hidden="true" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
              <AnimatePresence initial={false}>
                {tasks.map((t) => (
                  <ScChip key={t.id} t={t} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* POLICY CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.45 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[26%] max-w-[170px]"
          style={{ left: "84%", top: "30%" }}
        >
          <div className="glass cyber-cut border-mint/30 p-2">
            <p className="text-[7px] font-extrabold uppercase tracking-[0.16em] text-mint">TARGET TRACKING</p>
            <p className="pt-1 text-[6px] leading-relaxed tracking-wider text-muted-foreground uppercase">
              ecs:service:CPUUtilization — avg 50% — scale on 2 hot evals / 3 cold
            </p>
            <div className="flex items-center justify-between border-t border-foreground/10 pt-1.5 mt-1.5">
              <span className="text-[6px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Desired</span>
              <span className="text-[9px] font-extrabold tabular-nums text-aws">{tasks.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[6px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Events</span>
              <span className="text-[9px] font-extrabold tabular-nums text-mint">{scaleEvents}</span>
            </div>
          </div>
        </motion.div>

        <FlowLabel x={40} y={78} tone="aws">CAPACITY LANDS IN ~60S (SIM 1S) — SCALE-OUT NEVER DROPS A REQUEST</FlowLabel>
        <FlowLabel x={76} y={62} tone="magenta">CLOUDWATCH ALARM → ECS POLICY</FlowLabel>
        <StepBadge
          step={Math.min(SC_MAX, tasks.length)}
          total={SC_MAX}
          text={hot ? "SCALING OUT" : cold ? "SCALING IN" : "ON TARGET — 50% CPU"}
        />
        <VerdictFlash show={!!flash} text={flash?.text ?? ""} tone={flash?.tone ?? "ok"} />
      </FlowCanvas>

      <UseCaseNote>
        TARGET TRACKING = CRUISE CONTROL: SET 50% CPU ONCE — ECS ADDS TASKS AT LUNCH RUSH, REMOVES THEM AT 3AM, BILL FOLLOWS TRAFFIC
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — EKS PODS HPA                                               */
/* ================================================================== */

interface EkPod {
  id: number;
  name: string;
  node: number;
  cpu: number;
}

const EK_NODES = [1, 2, 3];
const EK_CAPACITY = 1000; // mCPU per node
const EK_POD_REQ = 200; // mCPU per pod
const EK_TARGET = 70; // HPA target %
const EK_MIN = 2;
const EK_MAX = 10;

const EK_NODE_META: Record<number, { name: string; ip: string }> = {
  1: { name: "node-1", ip: "ip-10-0-1-41" },
  2: { name: "node-2", ip: "ip-10-0-1-87" },
  3: { name: "node-3", ip: "ip-10-0-2-14" },
};

function seedEkPods(): EkPod[] {
  return [
    { id: 1, name: `api-${hex(5)}`, node: 1, cpu: 44 },
    { id: 2, name: `api-${hex(5)}`, node: 2, cpu: 41 },
  ];
}

function EkPodChip({ p }: { p: EkPod }) {
  const hot = p.cpu > 80;
  const warm = p.cpu > 60;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ type: "spring", stiffness: 480, damping: 30 }}
      className={`border px-1 py-0.5 ${hot ? "border-danger/50" : warm ? "border-aws/40" : "border-mint/40"}`}
    >
      <div className="flex min-w-0 items-center gap-1">
        <span className={`h-1 w-1 shrink-0 ${hot ? "bg-danger" : warm ? "bg-aws" : "bg-mint"}`} aria-hidden="true" />
        <span className="truncate text-[6px] font-bold tracking-wider text-foreground/85">{p.name}</span>
        <span className="ml-auto shrink-0 text-[5.5px] font-extrabold tabular-nums text-muted-foreground">{Math.round(p.cpu)}%</span>
      </div>
      <div className="mt-0.5 h-[2px] w-full overflow-hidden bg-white/10">
        <motion.div
          className={`h-full ${hot ? "bg-danger" : warm ? "bg-aws" : "bg-mint"}`}
          animate={{ width: `${Math.round(clamp(p.cpu, 0, 100))}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </motion.div>
  );
}

function EksHpaUseCase({ immersiveActive, immersiveToggle }: ContainersUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [pods, setPods] = useState<EkPod[]>(seedEkPods);
  const [cpu, setCpu] = useState(44);
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "deny" | "aws" } | null>(null);
  const [lines, setLines] = useState<UcLine[]>([]);

  const podsRef = useRef<EkPod[]>(pods);
  const cpuRef = useRef(44);
  const phaseRef = useRef<"climb" | "drop">("climb");
  const phaseTicksRef = useRef(9);
  const idRef = useRef(3);
  const tickRef = useRef(0);
  const logIdRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    podsRef.current = pods;
  }, [pods]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logIdRef.current++, text, tone }]);

  const freeOf = (node: number) => EK_CAPACITY - podsRef.current.filter((p) => p.node === node).length * EK_POD_REQ;

  const setScaleFlashSafe = () => {
    setFlash({ text: "HPA RECONCILED", tone: "aws" });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1500);
  };

  /* HPA loop — load waves climb/drop, HPA reconciles replicas every 2nd tick */
  useTicker(running, () => {
    tickRef.current += 1;
    const tick = tickRef.current;

    /* 1. LOAD WAVE — climbs to ~97%, collapses, repeats */
    if (phaseRef.current === "climb") {
      cpuRef.current = clamp(cpuRef.current + rand(2.5, 5.5), 20, 97);
      phaseTicksRef.current -= 1;
      if (phaseTicksRef.current <= 0) {
        phaseRef.current = "drop";
        phaseTicksRef.current = 5;
      }
    } else {
      cpuRef.current = clamp(cpuRef.current - rand(6, 11), 22, 97);
      phaseTicksRef.current -= 1;
      if (phaseTicksRef.current <= 0) {
        phaseRef.current = "climb";
        phaseTicksRef.current = 9;
      }
    }
    const cpuNow = Math.round(cpuRef.current);

    /* 2. HPA RECONCILE — desiredReplicas = ceil(replicas × cpu / target) */
    if (tick % 2 === 0) {
      const n = podsRef.current.length;
      const desired = clamp(Math.ceil((n * cpuNow) / EK_TARGET), EK_MIN, EK_MAX);
      if (desired > n) {
        const spawned: EkPod[] = [];
        for (let i = n; i < desired; i += 1) {
          const node = EK_NODES.reduce((best, nd) => (freeOf(nd) > freeOf(best) ? nd : best), 1);
          const pod: EkPod = { id: idRef.current, name: `api-${hex(5)}`, node, cpu: cpuNow * 0.7 };
          idRef.current += 1;
          podsRef.current = [...podsRef.current, pod];
          spawned.push(pod);
        }
        setPods([...podsRef.current]);
        setScaleFlashSafe();
        push(`${tstamp(tick)} hpa: cpu ${cpuNow}% / target ${EK_TARGET}% — replicas ${n} → ${desired} — scaling up`, "neon");
        spawned.forEach((p) =>
          push(`${tstamp(tick)} sched: pod ${p.name} (${EK_POD_REQ}m) → ${EK_NODE_META[p.node].name} — ${freeOf(p.node)}m free (bin-pack)`, "aws")
        );
      } else if (desired < n) {
        const removed = podsRef.current.slice(desired - n);
        podsRef.current = podsRef.current.slice(0, desired);
        setPods([...podsRef.current]);
        setScaleFlashSafe();
        push(`${tstamp(tick)} hpa: load dropped — cpu ${cpuNow}% — replicas ${n} → ${desired} — scaling down`, "mint");
        removed.forEach((p) => push(`${tstamp(tick)} kubelet: pod ${p.name} terminated — node-${p.node} freed ${EK_POD_REQ}m`, "dim"));
      }
      podsRef.current = podsRef.current.map((p) => ({ ...p, cpu: clamp(cpuRef.current + rand(-10, 10), 4, 100) }));
      setPods([...podsRef.current]);
    }
    setCpu(cpuNow);
  }, 1000);

  useEffect(() => () => {
    if (flashT.current) clearTimeout(flashT.current);
  }, []);

  const reset = () => {
    setRunning(false);
    podsRef.current = seedEkPods();
    setPods([...podsRef.current]);
    cpuRef.current = 44;
    setCpu(44);
    phaseRef.current = "climb";
    phaseTicksRef.current = 9;
    idRef.current = 3;
    tickRef.current = 0;
    setFlash(null);
    setLines([]);
    logIdRef.current = 1;
  };

  /* node fill meters — from state snapshot */
  const fills = EK_NODES.map((nd) => {
    const used = pods.filter((p) => p.node === nd).length * EK_POD_REQ;
    return { node: nd, used, pct: Math.round((used / EK_CAPACITY) * 100) };
  });
  const avgFill = Math.round(fills.reduce((a, f) => a + f.pct, 0) / EK_NODES.length);
  const hot = cpu > EK_TARGET;

  return (
    <UseCaseShell
      title="USE CASE // EKS PODS HPA"
      subtitle="HORIZONTAL POD AUTOSCALER — CPU PASSES 70% → PODS 2→10 SPREAD ACROSS NODES BY BIN-PACK SCHEDULER"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="PODS" value={`${pods.length}/${EK_MAX}`} tone={pods.length >= EK_MAX ? "danger" : "aws"} />
          <UCStat label="NODES" value={EK_NODES.length} tone="neutral" />
          <UCStat label="HPA TARGET" value={`${EK_TARGET}%`} tone="mint" />
          <UCStat label="NODE FILL %" value={`${avgFill}%`} tone={avgFill > 80 ? "danger" : avgFill > 50 ? "aws" : "mint"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? (hot ? `CPU ${cpu}% > ${EK_TARGET}% — HPA SCALING UP` : `CPU ${cpu}% — HPA HOLDING / SCALING IN`) : "IDLE — PRESS RUN TO START THE LOAD WAVE"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">HPA SPEC</p>
          <div className="glass-inset cyber-cut-sm p-2">
            <p className="text-[6.5px] leading-relaxed tracking-wider text-muted-foreground uppercase">
              kind: HorizontalPodAutoscaler · target: Deployment/api · metric: cpu · targetAverageUtilization: {EK_TARGET}% · min {EK_MIN} · max {EK_MAX} · behavior: scaleDown stabilization 30s
            </p>
          </div>
          <p className="text-[7px] tracking-wider uppercase text-muted-foreground/70">
            HPA TOUCHES PODS, NOT NODES — OVERPROVISION NODES OR RUN CLUSTER AUTOSCALER BESIDE IT.
          </p>
        </>
      }
      logLines={lines}
      logTitle="K8S EVENT LOG // LIVE"
      logEmpty="PRESS RUN — THE LOAD WAVE DRIVES THE HPA"
    >
      <FlowCanvas ariaLabel="EKS pods HPA use case diagram" className="h-full">
        {/* HPA CONTROL PLANE CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[46%] max-w-[300px]"
          style={{ left: "50%", top: "21%" }}
        >
          <div className={`glass cyber-cut p-2 ${hot ? "border-neon/60 shadow-[0_0_16px_rgba(255,179,71,0.3)]" : "border-aws/35"}`}>
            <div className="flex items-center justify-between gap-1 pb-1">
              <span className="flex min-w-0 items-center gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-aws">
                <EKSIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">HPA — deployment/api</span>
              </span>
              <span className={`shrink-0 border px-1 py-0.5 text-[6px] font-extrabold tracking-[0.12em] ${hot ? "border-danger/60 text-danger" : "border-mint/50 text-mint"}`}>
                {pods.length}/{EK_MAX} PODS
              </span>
            </div>
            <div className="relative h-3 w-full border border-foreground/20 bg-white/10">
              <motion.div
                className={`h-full ${hot ? "bg-danger" : "bg-aws"}`}
                animate={{ width: `${cpu}%` }}
                transition={{ duration: 0.6 }}
              />
              <div className="absolute inset-y-0 border-l-2 border-dashed border-mint" style={{ left: `${EK_TARGET}%` }} aria-hidden="true" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[6px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                POD CPU AVG {cpu}%
              </span>
              <span className="text-[6px] font-bold tracking-[0.14em] text-mint uppercase">TARGET {EK_TARGET}%</span>
            </div>
          </div>
        </motion.div>

        {/* NODE BOXES — bin-packing grid */}
        {fills.map((f, i) => {
          const nodePods = pods.filter((p) => p.node === f.node);
          const meterCls = f.pct > 80 ? "bg-danger" : f.pct > 50 ? "bg-aws" : "bg-mint";
          return (
            <motion.div
              key={f.node}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
              className="absolute border border-foreground/20 bg-black/40 cyber-cut-sm p-1.5 flex flex-col gap-1"
              style={{ left: `${3.5 + i * 31.5}%`, width: "29.5%", top: "38%", bottom: "10%" }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="flex min-w-0 items-center gap-1 text-[7px] font-extrabold tracking-[0.14em] text-aws">
                  <Container className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{EK_NODE_META[f.node].name}</span>
                </span>
                <span className="shrink-0 text-[5.5px] tracking-wider text-muted-foreground">{EK_NODE_META[f.node].ip}</span>
              </div>
              <div>
                <div className="flex items-center justify-between pb-0.5">
                  <span className="text-[5.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">FILL {f.used}m/{EK_CAPACITY}m</span>
                  <span className={`text-[6.5px] font-extrabold tabular-nums ${f.pct > 80 ? "text-danger" : f.pct > 50 ? "text-aws" : "text-mint"}`}>
                    {f.pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden bg-white/10">
                  <motion.div className={`h-full ${meterCls}`} animate={{ width: `${f.pct}%` }} transition={{ duration: 0.5 }} />
                </div>
              </div>
              <div className="flex flex-1 flex-wrap content-start gap-1 overflow-hidden">
                <AnimatePresence initial={false}>
                  {nodePods.map((p) => (
                    <EkPodChip key={p.id} p={p} />
                  ))}
                </AnimatePresence>
                {nodePods.length === 0 && (
                  <p className="text-[6px] uppercase tracking-wider text-muted-foreground/50">NO PODS SCHEDULED</p>
                )}
              </div>
            </motion.div>
          );
        })}

        <FlowLabel x={16} y={32} tone="magenta">SCHEDULER: MOST-FREE-CPU FIRST</FlowLabel>
        <FlowLabel x={83} y={32} tone="mint">SCALE-IN ON STABILIZATION WINDOW</FlowLabel>
        <StepBadge step={pods.length} total={EK_MAX} text={hot ? `HPA UP — CPU ${cpu}%` : `HPA HOLDING — CPU ${cpu}%`} />
        <VerdictFlash show={!!flash} text={flash?.text ?? ""} tone={flash?.tone ?? "aws"} />
      </FlowCanvas>

      <UseCaseNote>
        HPA ADDS PODS IN ~10S — CLUSTER AUTOSCALER ADDS NODES IN MINUTES: BIN-PACK ONTO EXISTING NODES FIRST, BURST CAPACITY SECOND
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function ContainersUseCases({ id, immersiveActive, immersiveToggle }: ContainersUseCasesProps) {
  if (id === "ROLLING_DEPLOY") return <RollingDeployUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "SERVICE_SCALING") return <ServiceScalingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <EksHpaUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
