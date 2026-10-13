"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { AutoLog } from "@/components/shared/auto-log";
import { FullscreenToggle } from "@/components/shared/fullscreen-toggle";
import { useImmersiveView } from "@/hooks/use-immersive";
import {
  CloudWatchIcon,
  EC2Icon,
  ECRIcon,
  ECRImageIcon,
  ECRRegistryIcon,
  ECSIcon,
  ECSTaskIcon,
  EKSIcon,
  ELBIcon,
  FargateIcon,
  InternetIcon,
} from "@/components/aws-icons";
import { Container, Rocket, Skull, TrendingUp, Zap } from "lucide-react";

/* ------------------------------------------------------------------ */
/* CONTAINERS // ORCHESTRATOR — ECS + EKS + ECR                        */
/* image in ECR → scheduler pulls → tasks/pods placed on capacity      */
/* → ALB routes traffic → CloudWatch CPU → target-tracking scaling     */
/* → rolling deploy drains old version with zero downtime              */
/* ------------------------------------------------------------------ */

const MAX_LOG = 8;
const TICK_MS = 850;
const FLEET_MAX = 8;
const CPU_HIGH = 55;
const CPU_LOW = 25;
const PULL_LAYERS = 3;
const DESIRED_DEFAULT = 2;

type Orch = "ECS" | "EKS";
type LaunchType = "EC2" | "FARGATE";
type TaskState = "PENDING" | "RUNNING" | "DRAINING";
type DeployPhase = "none" | "PULLING" | "PROVISIONING" | "DRAINING";
type LogTone = "aws" | "mint" | "danger" | "magenta" | "neon" | "dim";

interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
}

interface Task {
  id: number;
  suffix: string; // stable 4-hex — EKS pod-name suffix
  ver: number;
  cpu: number;
  reqs: number;
  state: TaskState;
  node: "A" | "B" | "F";
  pendingTicks: number;
  waitTotal: number;
  isReplacement: boolean;
  replacesId: number;
  drainTicks: number;
}

interface Deploy {
  phase: "PULLING" | "PROVISIONING" | "DRAINING";
  ver: number;
  layer: number;
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const tstamp = (t: number) => `t${String(t).padStart(3, "0")}`;
const hex4 = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");

const taskName = (t: Task, orch: Orch) => (orch === "EKS" ? `api-${t.suffix}` : `task-${t.id}`);

const nodeLabelFor = (t: Task, launch: LaunchType, orch: Orch): string => {
  if (launch === "FARGATE") return orch === "EKS" ? "fargate profile" : "fargate sandbox";
  return orch === "EKS" ? (t.node === "A" ? "node-1" : "node-2") : `ec2-${t.node}`;
};

function seedTask(id: number): Task {
  const wait = 0;
  return {
    id,
    suffix: hex4(),
    ver: 1,
    cpu: 24 + Math.random() * 12,
    reqs: 0,
    state: "RUNNING",
    node: id % 2 === 0 ? "A" : "B",
    pendingTicks: wait,
    waitTotal: wait,
    isReplacement: false,
    replacesId: 0,
    drainTicks: 0,
  };
}

const SEED_FLEET: Task[] = [seedTask(1), seedTask(2)];

const BOOT_LINE: LogLine = {
  id: 1,
  text: "t000 ORCHESTRATOR ONLINE — ECS scheduler authoritative — api-svc desired 2 — image api:v1",
  tone: "dim",
};

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

/* ------------------------------------------------------------------ */
/* TASK CHIP — one ECS task / EKS pod in the cluster grid              */
/* ------------------------------------------------------------------ */

function TaskChip({ t, orch, activeVer }: { t: Task; orch: Orch; activeVer: number }) {
  const pending = t.state === "PENDING";
  const draining = t.state === "DRAINING";
  const isNew = t.ver >= activeVer;
  const cpuCls = t.cpu > 85 ? "bg-danger" : t.cpu > CPU_HIGH ? "bg-magenta" : "bg-mint";
  const cpuTxtCls = t.cpu > CPU_HIGH ? "text-magenta" : "text-mint";
  const stateCls = pending ? "text-magenta" : draining ? "text-neon" : "text-mint";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.6, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, x: 16 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
    >
      <div
        className={`border px-1 py-0.5 ${
          pending
            ? "border-magenta/70 bg-magenta/10 animate-pulse"
            : draining
              ? "border-neon/50 bg-neon/[0.06] opacity-60"
              : "border-aws/35 bg-aws/[0.05]"
        }`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <ECSTaskIcon
            className={`w-2 h-2 shrink-0 ${pending ? "text-magenta" : draining ? "text-neon" : "text-aws"}`}
          />
          <span className="truncate text-[6.5px] font-bold tracking-wider text-foreground/90">
            {taskName(t, orch)}
          </span>
          <span
            className={`ml-auto shrink-0 border px-0.5 text-[5.5px] font-extrabold leading-tight ${
              isNew ? "border-mint/50 text-mint" : "border-foreground/25 text-muted-foreground"
            }`}
          >
            v{t.ver}
          </span>
        </div>
        <div className="flex items-center gap-1 pt-0.5">
          <div className="h-[3px] flex-1 overflow-hidden bg-white/10">
            <motion.div
              className={`h-full ${cpuCls}`}
              animate={{ width: `${Math.round(t.cpu)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <span className={`w-[18px] shrink-0 text-right text-[5.5px] font-bold ${cpuTxtCls}`}>
            {Math.round(t.cpu)}%
          </span>
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className={`text-[5.5px] font-extrabold tracking-[0.12em] ${stateCls}`}>{t.state}</span>
          <span className="text-[5.5px] tracking-wider text-muted-foreground">{t.reqs} REQ</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* CONTAINERS — ORCHESTRATOR                                           */
/* ------------------------------------------------------------------ */

export default function Containers() {
  const immersive = useImmersiveView();
  /* control states */
  const [running, setRunning] = useState(false);
  const [orch, setOrch] = useState<Orch>("ECS");
  const [launch, setLaunch] = useState<LaunchType>("EC2");
  const [desired, setDesired] = useState(DESIRED_DEFAULT);
  const [asgOn, setAsgOn] = useState(true);

  /* render mirrors — flushed from refs */
  const [tasks, setTasks] = useState<Task[]>(SEED_FLEET);
  const [traffic, setTraffic] = useState(62);
  const [clusterCpu, setClusterCpu] = useState(31);
  const [target, setTarget] = useState(DESIRED_DEFAULT);
  const [pulls, setPulls] = useState(0);
  const [deploys, setDeploys] = useState(0);
  const [replacements, setReplacements] = useState(0);
  const [currentVer, setCurrentVer] = useState(1);
  const [deployPhase, setDeployPhase] = useState<DeployPhase>("none");
  const [deployVer, setDeployVer] = useState(0);
  const [deployLayer, setDeployLayer] = useState(0);
  const [scaleFired, setScaleFired] = useState(false);
  const [killFlash, setKillFlash] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const [log, setLog] = useState<LogLine[]>([BOOT_LINE]);

  /* refs — source of truth */
  const tasksRef = useRef<Task[]>(SEED_FLEET);
  const trafficRef = useRef(62);
  const cpuRef = useRef(31);
  const targetRef = useRef(DESIRED_DEFAULT);
  const currentVerRef = useRef(1);
  const pullsRef = useRef(0);
  const deploysRef = useRef(0);
  const replacementsRef = useRef(0);
  const deployRef = useRef<Deploy | null>(null);
  const idRef = useRef(3);
  const rrRef = useRef(0);
  const highRef = useRef(0);
  const lowRef = useRef(0);
  const spikeRef = useRef(0);
  const tickRef = useRef(0);
  const logIdRef = useRef(2);
  const logRef = useRef<LogLine[]>([BOOT_LINE]);

  const pushLog = useCallback((text: string, tone: LogTone = "aws") => {
    logIdRef.current += 1;
    logRef.current = [...logRef.current, { id: logIdRef.current, text, tone }].slice(-MAX_LOG);
  }, []);

  const spawnTask = useCallback(
    (ver: number, state: TaskState, isReplacement: boolean, replacesId: number): Task => {
      const id = idRef.current;
      idRef.current += 1;
      const aCount = tasksRef.current.filter((x) => x.node === "A" && x.state !== "DRAINING").length;
      const bCount = tasksRef.current.filter((x) => x.node === "B" && x.state !== "DRAINING").length;
      const node: Task["node"] = launch === "FARGATE" ? "F" : aCount <= bCount ? "A" : "B";
      const wait = 2 + Math.floor(Math.random() * 2); // RUNNING after 2-3 ticks
      const t: Task = {
        id,
        suffix: hex4(),
        ver,
        cpu: 0,
        reqs: 0,
        state,
        node,
        pendingTicks: state === "PENDING" ? wait : 0,
        waitTotal: wait,
        isReplacement,
        replacesId,
        drainTicks: 0,
      };
      tasksRef.current = [...tasksRef.current, t];
      return t;
    },
    [launch]
  );

  const flush = useCallback(() => {
    setTasks([...tasksRef.current]);
    setTraffic(Math.round(trafficRef.current));
    setClusterCpu(Math.round(cpuRef.current));
    setTarget(targetRef.current);
    setPulls(pullsRef.current);
    setDeploys(deploysRef.current);
    setReplacements(replacementsRef.current);
    setCurrentVer(currentVerRef.current);
    const d = deployRef.current;
    setDeployPhase(d ? d.phase : "none");
    setDeployVer(d ? d.ver : 0);
    setDeployLayer(d ? d.layer : 0);
    setTickCount(tickRef.current);
    setLog([...logRef.current]);
  }, []);

  /* ------------------------------- engine ------------------------------ */
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const tick = ++tickRef.current;
      const ts = tstamp(tick);
      const deploy = deployRef.current;

      /* 1. TRAFFIC — requests/sec random walk, spikes on INJECT */
      if (spikeRef.current > 0) {
        spikeRef.current -= 1;
        if (spikeRef.current === 0) pushLog(`${ts} traffic spike subsiding — targets cooling down`, "dim");
      }
      trafficRef.current = clamp(
        trafficRef.current + rand(-7, 9) + (spikeRef.current > 0 ? 26 : -1.5),
        24,
        240
      );

      /* 2. ROLLING DEPLOY STATE MACHINE — PULLING → PROVISIONING → DRAINING */
      if (deploy) {
        if (deploy.phase === "PULLING") {
          deploy.layer += 1;
          pushLog(`${ts} ECR: pulled api:v${deploy.ver} layer ${deploy.layer}/${PULL_LAYERS}`, "aws");
          if (deploy.layer >= PULL_LAYERS) {
            pullsRef.current += 1;
            pushLog(`${ts} ECR: digest sha256:${hex4()} — scan PASSED — api:v${deploy.ver} available`, "dim");
            deploy.phase = "PROVISIONING";
            const batch = Math.max(2, Math.ceil(targetRef.current / 2));
            for (let i = 0; i < batch; i += 1) spawnTask(deploy.ver, "PENDING", false, 0);
            pushLog(
              orch === "EKS"
                ? `${ts} EKS: replicaset api-${hex4()} — +${batch} pods (api:v${deploy.ver}) scheduled`
                : `${ts} ECS: service api-svc — +${batch} tasks (api:v${deploy.ver}) PENDING`,
              "magenta"
            );
          }
        } else if (deploy.phase === "PROVISIONING") {
          const newRunning = tasksRef.current.filter(
            (x) => x.ver === deploy.ver && x.state === "RUNNING"
          ).length;
          if (newRunning >= targetRef.current) {
            const old = tasksRef.current.filter(
              (x) => x.ver < deploy.ver && (x.state === "RUNNING" || x.state === "PENDING")
            );
            old.forEach((x) => {
              x.state = "DRAINING";
              x.drainTicks = 0;
            });
            if (old.length) {
              pushLog(
                `${ts} DRAINING: ${taskName(old[0], orch)}${
                  old.length > 1 ? ` +${old.length - 1} more` : ""
                } deregistered from ALB`,
                "magenta"
              );
            }
            deploy.phase = "DRAINING";
          }
        } else if (deploy.phase === "DRAINING") {
          /* safety sweep — stragglers spawned after the transition (e.g. a crash
             replacement of an old-version task) must drain too, or the rolling
             deploy can never converge */
          const stale = tasksRef.current.filter(
            (x) => x.ver < deploy.ver && (x.state === "RUNNING" || x.state === "PENDING")
          );
          if (stale.length) {
            stale.forEach((x) => {
              x.state = "DRAINING";
              x.drainTicks = 0;
            });
            pushLog(
              `${ts} DRAINING: ${taskName(stale[0], orch)}${
                stale.length > 1 ? ` +${stale.length - 1} more` : ""
              } deregistered from ALB`,
              "magenta"
            );
          }
          if (!tasksRef.current.some((x) => x.ver < deploy.ver)) {
            currentVerRef.current = deploy.ver;
            deploysRef.current += 1;
            pushLog(
              `${ts} DEPLOY COMPLETE — api:v${deploy.ver} LIVE — 0s downtime — deploys ${deploysRef.current}`,
              "mint"
            );
            deployRef.current = null;
          }
        }
      }

      /* 3. SCHEDULER — PENDING → RUNNING after 2-3 ticks; crashes rescheduled */
      tasksRef.current.forEach((x) => {
        if (x.state !== "PENDING") return;
        x.pendingTicks -= 1;
        if (x.pendingTicks > 0) return;
        x.state = "RUNNING";
        if (x.isReplacement) {
          replacementsRef.current += 1;
          pushLog(`${ts} REPLACED crashed task-${x.replacesId} in ${x.waitTotal} ticks`, "mint");
        } else {
          const nodeLabel = nodeLabelFor(x, launch, orch);
          const projectedCpu = Math.round(
            clamp((trafficRef.current * 0.85) / Math.max(1, targetRef.current), 3, 97)
          );
          pushLog(
            orch === "EKS"
              ? `${ts} EKS: pod api-${x.suffix} Ready — kubelet ${nodeLabel}`
              : `${ts} SCHEDULER: task-${x.id} PLACED on ${nodeLabel} (CPU ${projectedCpu}%)`,
            "aws"
          );
        }
      });
      const crashed = tasksRef.current.filter((x) => x.state === "RUNNING" && Math.random() < 0.012);
      crashed.forEach((x) => {
        tasksRef.current = tasksRef.current.filter((y) => y.id !== x.id);
        /* replacements join at the ACTIVE deploy version (service template already
           points at the new image) — spawning old versions mid-deploy stalls it */
        const rep = spawnTask(
          deployRef.current ? deployRef.current.ver : currentVerRef.current,
          "PENDING",
          true,
          x.id
        );
        pushLog(
          `${ts} CHAOS: ${taskName(x, orch)} CRASHED — exit 137 — rescheduling as ${taskName(rep, orch)}`,
          "danger"
        );
      });

      /* 4. RECONCILE — desired count (deferred while a deploy is rolling) */
      if (!deployRef.current) {
        const nonDraining = tasksRef.current.filter((x) => x.state !== "DRAINING").length;
        if (nonDraining < targetRef.current) {
          for (let i = nonDraining; i < targetRef.current; i += 1) {
            spawnTask(currentVerRef.current, "PENDING", false, 0);
          }
        } else if (nonDraining > targetRef.current) {
          const run = tasksRef.current.filter((x) => x.state === "RUNNING");
          const toDrain = run.slice(Math.max(0, run.length - (nonDraining - targetRef.current)));
          toDrain.forEach((x) => {
            x.state = "DRAINING";
            x.drainTicks = 0;
          });
          if (toDrain.length) {
            pushLog(
              `${ts} DRAINING: ${taskName(toDrain[0], orch)} deregistered from ALB — scaling down`,
              "magenta"
            );
          }
        }
      }

      /* 5. REAPER — DRAINING tasks lose their last connections, then terminate */
      tasksRef.current.forEach((x) => {
        if (x.state === "DRAINING") x.drainTicks += 1;
      });
      const ripe = tasksRef.current.filter((x) => x.state === "DRAINING" && x.drainTicks >= 2);
      if (ripe.length) {
        tasksRef.current = tasksRef.current.filter((x) => !(x.state === "DRAINING" && x.drainTicks >= 2));
        ripe.forEach((x) => pushLog(`${ts} ${taskName(x, orch)} terminated — connection drain complete`, "dim"));
      }

      /* 6. LOAD — ALB round-robin hits + per-task CPU = traffic / fleet size */
      const healthy = tasksRef.current.filter((x) => x.state === "RUNNING");
      const H = healthy.length;
      if (H > 0) {
        const hits = clamp(Math.round(trafficRef.current / 18), 1, 40);
        for (let k = 0; k < hits; k += 1) {
          healthy[rrRef.current % H].reqs += 1;
          rrRef.current += 1;
        }
      }
      let cpuSum = 0;
      tasksRef.current.forEach((x) => {
        if (x.state === "RUNNING") {
          x.cpu = clamp((trafficRef.current * 0.85) / H + rand(-7, 7), 2, 98);
          cpuSum += x.cpu;
        } else if (x.state === "DRAINING") {
          x.cpu *= 0.35;
        }
      });
      cpuRef.current = H > 0 ? clamp(cpuSum / H + rand(-2, 2), 1, 99) : 0;

      /* 7. AUTOSCALING — target tracking 55% (deferred while rolling) */
      if (asgOn && !deployRef.current) {
        const c = cpuRef.current;
        if (c > CPU_HIGH) {
          highRef.current += 1;
          lowRef.current = 0;
        } else if (c < CPU_LOW) {
          lowRef.current += 1;
          highRef.current = 0;
        } else {
          highRef.current = 0;
          lowRef.current = 0;
        }
        if (highRef.current >= 2 && targetRef.current < FLEET_MAX) {
          const prev = targetRef.current;
          targetRef.current = prev + 1;
          spawnTask(currentVerRef.current, "PENDING", false, 0);
          pushLog(`${ts} AS: target tracking ${CPU_HIGH}% → desired ${prev} → ${targetRef.current}`, "mint");
          setScaleFired(true);
          window.setTimeout(() => setScaleFired(false), 950);
          highRef.current = 0;
        } else if (lowRef.current >= 4 && targetRef.current > desired) {
          const prev = targetRef.current;
          targetRef.current = prev - 1;
          const run = tasksRef.current.filter((x) => x.state === "RUNNING");
          if (run.length) run[run.length - 1].state = "DRAINING";
          pushLog(
            `${ts} AS: CPU ${Math.round(c)}% < ${CPU_LOW}% ×4 ticks — scale-in ${prev} → ${targetRef.current}`,
            "dim"
          );
          lowRef.current = 0;
        }
      }

      /* 8. FLUSH refs → render state */
      flush();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, orch, launch, desired, asgOn, pushLog, flush, spawnTask]);

  /* ------------------------------ actions ------------------------------ */
  const reset = () => {
    setRunning(false);
    tickRef.current = 0;
    idRef.current = 3;
    rrRef.current = 0;
    trafficRef.current = 62;
    cpuRef.current = 31;
    targetRef.current = DESIRED_DEFAULT;
    currentVerRef.current = 1;
    pullsRef.current = 0;
    deploysRef.current = 0;
    replacementsRef.current = 0;
    deployRef.current = null;
    highRef.current = 0;
    lowRef.current = 0;
    spikeRef.current = 0;
    tasksRef.current = [seedTask(1), seedTask(2)];
    logRef.current = [BOOT_LINE];
    logIdRef.current = 2;
    setOrch("ECS");
    setLaunch("EC2");
    setDesired(DESIRED_DEFAULT);
    setAsgOn(true);
    setScaleFired(false);
    setKillFlash(false);
    flush();
  };

  const triggerDeploy = () => {
    if (deployRef.current) return;
    const nv = currentVerRef.current + 1;
    deployRef.current = { phase: "PULLING", ver: nv, layer: 0 };
    pushLog(
      `${tstamp(tickRef.current)} DEPLOY: api:v${nv} pushed to ECR — rolling update started (min healthy 100%)`,
      "neon"
    );
    flush();
  };

  const injectSpike = () => {
    spikeRef.current = 6;
    trafficRef.current = clamp(trafficRef.current + 40, 24, 240);
    pushLog(`${tstamp(tickRef.current)} INJECT: traffic spike ×3 — ALB targets heating up`, "neon");
    flush();
  };

  const killRandom = () => {
    const runners = tasksRef.current.filter((x) => x.state === "RUNNING");
    if (!runners.length) return;
    const victim = runners[Math.floor(Math.random() * runners.length)];
    tasksRef.current = tasksRef.current.filter((x) => x.id !== victim.id);
    spawnTask(currentVerRef.current, "PENDING", true, victim.id);
    pushLog(
      `${tstamp(tickRef.current)} CHAOS: ${taskName(victim, orch)} SIGKILL — target unhealthy — scheduler replacing`,
      "danger"
    );
    setKillFlash(true);
    window.setTimeout(() => setKillFlash(false), 700);
    flush();
  };

  const setOrchestrator = (o: Orch) => {
    if (o === orch) return;
    setOrch(o);
    pushLog(
      `${tstamp(tickRef.current)} CONFIG → orchestrator ${o} — ${
        o === "EKS"
          ? "kube-scheduler authoritative — pods reconciled via K8s API"
          : "ECS scheduler authoritative — tasks on container instances"
      }`,
      "magenta"
    );
    flush();
  };

  const toggleLaunch = () => {
    const next: LaunchType = launch === "EC2" ? "FARGATE" : "EC2";
    setLaunch(next);
    tasksRef.current.forEach((x, i) => {
      x.node = next === "FARGATE" ? "F" : i % 2 === 0 ? "A" : "B";
    });
    pushLog(
      `${tstamp(tickRef.current)} CONFIG → launch type ${next} — ${
        next === "FARGATE"
          ? "per-task sandboxes — no nodes to manage, per-task billing"
          : "2 EC2 container instances joined the cluster"
      }`,
      "magenta"
    );
    flush();
  };

  const applyDesired = (n: number) => {
    setDesired(n);
    targetRef.current = n;
    highRef.current = 0;
    lowRef.current = 0;
    pushLog(`${tstamp(tickRef.current)} CONFIG → desired count ${n} — service reconciling`, "magenta");
    flush();
  };

  const toggleAsg = () => {
    const v = !asgOn;
    setAsgOn(v);
    pushLog(
      `${tstamp(tickRef.current)} CONFIG → target-tracking autoscaling ${
        v ? `ENABLED (CPU ${CPU_HIGH}%)` : "DISABLED — fleet pinned to desired count"
      }`,
      "magenta"
    );
    flush();
  };

  /* ------------------------------ derived ------------------------------ */
  const healthyCount = tasks.filter((t) => t.state === "RUNNING").length;
  const pendingCount = tasks.filter((t) => t.state === "PENDING").length;
  const nodeACount = tasks.filter((t) => t.node === "A" && t.state !== "DRAINING").length;
  const nodeBCount = tasks.filter((t) => t.node === "B" && t.state !== "DRAINING").length;
  const sandboxTasks = tasks.filter((t) => t.state !== "DRAINING");
  const deployActive = deployPhase !== "none";
  const pullActive = deployPhase === "PULLING";
  const trafficActive = running && healthyCount > 0;
  const activeVer = Math.max(currentVer, deployActive ? deployVer : 0);

  const tagVers = deployActive ? [deployVer, currentVer] : [currentVer, currentVer - 1];
  const uniqueTags = Array.from(new Set(tagVers.filter((v) => v >= 1))).slice(0, 3);

  const clusterBorder = killFlash
    ? "border-danger/80 shadow-[0_0_22px_rgba(255,51,85,0.45)]"
    : deployActive
      ? "border-magenta/60 shadow-[0_0_18px_rgba(255,45,120,0.28)]"
      : running
        ? "border-aws/50 box-glow"
        : "border-foreground/25";

  const deployBadgeCls =
    deployPhase === "PULLING"
      ? "border-magenta/70 text-magenta bg-magenta/10"
      : deployPhase === "PROVISIONING"
        ? "border-neon/60 text-neon bg-neon/10"
        : deployPhase === "DRAINING"
          ? "border-neon/60 text-neon bg-neon/10"
          : "border-mint/50 text-mint bg-mint/10";

  const statusLine = !running
    ? "SYSTEM IDLE — PRESS RUN"
    : deployActive
      ? `ROLLING DEPLOY ${deployPhase} — api:v${deployVer} — ZERO DOWNTIME`
      : `ENGINE LIVE — ${orch} SCHEDULER — ${healthyCount}/${target} ${
          orch === "EKS" ? "PODS" : "TASKS"
        } UP`;

  return (
    <div
      className={
        immersive.active
          ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll"
          : "flex flex-col gap-4"
      }
    >
      {/* MAIN GRID — flow view left, live stats + controls rail right */}
      <div className={`grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start ${immersive.active ? "flex-1" : ""}`}>
        <GlassPanel
          title="FLOW VIEW // CONTAINER PIPELINE"
          subtitle="ECR → SCHEDULER → ALB → CLOUDWATCH TARGET TRACKING"
          className="!p-0 overflow-hidden"
          delay={0.05}
          actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
        >
          <FlowCanvas
            className={immersive.active ? "h-[min(560px,58vh)]" : "h-[440px] sm:h-[540px] lg:h-[560px]"}
            ariaLabel="ECS EKS ECR container orchestration flow diagram"
          >
            {/* HEADER CHIP */}
            <div className="absolute left-3 top-2.5 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 px-2 py-1 backdrop-blur-sm">
              <ECRIcon className="w-3 h-3 text-aws" />
              <span className="text-[7px] font-bold tracking-[0.2em] text-aws">ECS · EKS · ECR</span>
              <span className="text-[7px] text-muted-foreground">
                api-svc · {orch} AUTH · {launch}
              </span>
              {deployActive && (
                <span className="text-[7px] font-bold tracking-wider text-magenta">{deployPhase}</span>
              )}
            </div>

            {/* LINKS */}
            {/* users → ALB */}
            <FlowLink d="M14,19 C14,25 14,31 14,36" status={running ? "flowing" : "idle"} dotDuration={1.3} />
            {/* ALB → cluster tasks (round-robin) */}
            <FlowLink
              d="M18,44 C30,44 40,43 52,42"
              status={trafficActive ? "flowing" : "idle"}
              dotDuration={1.5}
              dotDelay={0.15}
            />
            {/* ECR → cluster (image pull) */}
            <FlowLink
              d="M16,71 C30,67 42,57 54,48"
              status={pullActive ? "cyber" : deployPhase === "PROVISIONING" ? "flowing" : "idle"}
              dotDuration={1.6}
              dashed={!pullActive}
            />
            {/* cluster → CloudWatch (metrics) */}
            <FlowLink d="M60,52 C70,58 78,68 84,79" status={running ? "flowing" : "idle"} dotDuration={1.8} />
            {/* CloudWatch → cluster (autoscaling feedback) */}
            <FlowLink d="M83,82 C74,78 68,66 62,56" status={scaleFired ? "success" : "idle"} dotDuration={1.5} />
            {/* EKS control plane → cluster (cyber link, EKS mode only) */}
            {orch === "EKS" && <FlowLink d="M64,11 C64,15 64,20 64,26" status="cyber" dotDuration={1.4} />}

            {/* LABELS */}
            <FlowLabel x={24} y={27} tone="aws">HTTPS :443</FlowLabel>
            <FlowLabel x={35} y={37} tone="aws">ROUND-ROBIN</FlowLabel>
            <FlowLabel x={31} y={58} tone={pullActive ? "magenta" : "default"}>IMAGE PULL</FlowLabel>
            <FlowLabel x={78} y={66} tone="default">CW METRICS</FlowLabel>
            <FlowLabel x={71} y={76} tone={scaleFired ? "mint" : "default"}>TARGET TRACKING</FlowLabel>
            {orch === "EKS" && <FlowLabel x={76} y={16} tone="magenta">K8S API :6443 — WATCH</FlowLabel>}
            <FlowLabel x={38} y={96} tone="default">MIN-HEALTHY 100% · DEREGISTRATION DELAY 30S</FlowLabel>

            {/* USERS */}
            <FlowNode
              x={14}
              y={16}
              icon={<InternetIcon className="w-3 h-3" />}
              label="USERS"
              sub={`${traffic} REQ/S`}
              status={running ? "active" : "idle"}
              pulse={running}
              size="sm"
              delay={0.05}
            />

            {/* ALB */}
            <FlowNode
              x={14}
              y={44}
              icon={<ELBIcon className="w-3 h-3" />}
              label="ALB"
              sub={`${healthyCount} HEALTHY TG`}
              status={trafficActive ? "active" : "idle"}
              pulse={trafficActive}
              size="sm"
              delay={0.15}
            />

            {/* EKS CONTROL PLANE — authoritative in EKS mode, ghosted in ECS mode */}
            <FlowNode
              x={64}
              y={7}
              icon={<EKSIcon className="w-3 h-3" />}
              label="EKS CONTROL PLANE"
              sub={orch === "EKS" ? "K8S API — RECONCILING" : "NOT IN USE"}
              status={orch === "EKS" ? "cyber" : "idle"}
              pulse={orch === "EKS" && running}
              size="sm"
              delay={0.35}
              className={orch === "EKS" ? "" : "opacity-40"}
            />

            {/* CLOUDWATCH */}
            <FlowNode
              x={86}
              y={84}
              icon={<CloudWatchIcon className="w-3 h-3" />}
              label="CLOUDWATCH"
              sub={`CLUSTER CPU ${clusterCpu}%`}
              status={clusterCpu > CPU_HIGH ? "cyber" : running ? "active" : "idle"}
              pulse={running}
              size="sm"
              delay={0.5}
            />

            {/* ECR REGISTRY BLOCK */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="absolute z-10"
              style={{ left: "3%", top: "63%" }}
            >
              <div
                className={`glass cyber-cut-sm w-[132px] p-1.5 sm:w-[150px] ${
                  pullActive
                    ? "border border-magenta/70 shadow-[0_0_16px_rgba(255,45,120,0.35)]"
                    : "border border-aws/40"
                }`}
              >
                <div className="flex items-center justify-between gap-1 border-b border-aws/15 pb-1">
                  <span className="flex min-w-0 items-center gap-1 text-[7px] font-bold tracking-[0.12em] text-aws">
                    <ECRRegistryIcon className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">ECR REGISTRY</span>
                  </span>
                  <motion.span
                    key={pulls}
                    initial={{ scale: 1.4, color: "#00ffa3" }}
                    animate={{ scale: 1, color: "#ff9900" }}
                    className="text-[9px] font-extrabold"
                    aria-label={`${pulls} image pulls`}
                  >
                    {pulls}
                  </motion.span>
                </div>
                <div className="pt-1">
                  <span className="text-[5.5px] font-bold tracking-[0.16em] text-muted-foreground">
                    IMAGE TAGS
                  </span>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    <AnimatePresence initial={false}>
                      {uniqueTags.map((v) => {
                        const pulling = pullActive && v === deployVer;
                        const fresh = deployActive && v === deployVer && !pulling;
                        const active = !deployActive && v === currentVer;
                        return (
                          <motion.span
                            key={`tag-${v}`}
                            layout
                            initial={{ opacity: 0, scale: 0.6, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ type: "spring", stiffness: 420, damping: 30 }}
                            className={`flex items-center gap-0.5 border px-1 py-0.5 text-[6px] font-bold leading-tight ${
                              pulling
                                ? "border-magenta/70 text-magenta"
                                : fresh || active
                                  ? "border-mint/50 text-mint"
                                  : "border-foreground/25 text-muted-foreground"
                            }`}
                          >
                            <ECRImageIcon className="w-1.5 h-1.5 shrink-0" />
                            api:v{v}
                            {pulling ? ` L${deployLayer}/3` : ""}
                          </motion.span>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
                {pullActive ? (
                  <div className="pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[5.5px] font-bold tracking-wider text-magenta">
                        PULLING api:v{deployVer}
                      </span>
                      <span className="text-[5.5px] font-bold text-magenta">
                        L{deployLayer}/3
                      </span>
                    </div>
                    <div className="mt-0.5 h-[3px] w-full overflow-hidden bg-white/10">
                      <motion.div
                        className="h-full bg-magenta shadow-[0_0_8px_rgba(255,45,120,0.7)]"
                        animate={{ width: `${(deployLayer / PULL_LAYERS) * 100}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[5.5px] tracking-wider text-muted-foreground">SCAN: PASSED</span>
                    <span className="text-[5.5px] font-bold tracking-wider text-mint">IMMUTABLE</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ECS / EKS CLUSTER BOUNDARY */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute z-10 -translate-x-1/2"
              style={{ left: "62%", top: "24%" }}
            >
              <div className={`glass cyber-cut w-[200px] p-2 sm:w-[240px] ${clusterBorder}`}>
                {/* header */}
                <div className="flex items-center justify-between gap-1 pb-1">
                  <span className="flex min-w-0 items-center gap-1 text-[7.5px] font-extrabold tracking-[0.12em] text-aws">
                    {orch === "ECS" ? (
                      <ECSIcon className="w-3 h-3 shrink-0" />
                    ) : (
                      <EKSIcon className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate">{orch} CLUSTER {"//"} api-svc</span>
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={deployActive ? deployPhase : "up"}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.18 }}
                      className={`shrink-0 border px-1 py-0.5 text-[6px] font-extrabold uppercase tracking-[0.12em] ${
                        deployActive ? deployBadgeCls : "border-mint/50 bg-mint/10 text-mint"
                      }`}
                    >
                      {deployActive ? deployPhase : `${healthyCount}/${target} UP`}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[5.5px] font-bold tracking-[0.16em] text-muted-foreground">
                    {orch === "ECS" ? "ECS SCHEDULER — BINPACK + SPREAD" : "KUBE-SCHEDULER — LEAST-REQUEST"}
                  </span>
                  <span className="text-[5.5px] font-bold tracking-wider text-muted-foreground">
                    {pendingCount > 0 ? `${pendingCount} PENDING` : `T${String(tickCount).padStart(3, "0")}`}
                  </span>
                </div>

                {/* task grid */}
                <div className="grid grid-cols-2 gap-1 border-t border-aws/15 pt-1.5">
                  <AnimatePresence initial={false}>
                    {tasks.map((t) => (
                      <TaskChip key={t.id} t={t} orch={orch} activeVer={activeVer} />
                    ))}
                  </AnimatePresence>
                  {tasks.length === 0 && (
                    <p className="col-span-2 py-2 text-center text-[6.5px] uppercase tracking-wider text-muted-foreground/60">
                      NO TASKS — SCHEDULER RECONCILING
                      <span className="blink-cursor">_</span>
                    </p>
                  )}
                </div>

                {/* capacity layer */}
                <div className="mt-1.5 border-t border-aws/15 pt-1.5">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={launch}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.28 }}
                    >
                      {launch === "EC2" ? (
                        <div className="grid grid-cols-2 gap-1">
                          {(["A", "B"] as const).map((n) => {
                            const cnt = n === "A" ? nodeACount : nodeBCount;
                            return (
                              <div key={n} className="border border-foreground/20 bg-black/40 px-1.5 py-1">
                                <div className="flex items-center gap-1">
                                  <EC2Icon className="w-2.5 h-2.5 shrink-0 text-aws" />
                                  <span className="text-[6.5px] font-bold text-aws">
                                    {orch === "EKS" ? `node-${n === "A" ? 1 : 2}` : `ec2-${n}`}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-[5.5px] font-bold tracking-wider text-muted-foreground">
                                    {orch === "EKS" ? "NODE: kubelet" : "AGENT: ECS"}
                                  </span>
                                  <span className="text-[6.5px] font-extrabold text-mint">
                                    {cnt} {orch === "EKS" ? "PODS" : "TASKS"}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex gap-px" aria-hidden="true">
                                  {Array.from({ length: 4 }, (_, i) => (
                                    <span
                                      key={i}
                                      className={`h-1 w-2 ${i < Math.min(4, cnt) ? "bg-aws" : "bg-white/10"}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="border border-mint/30 bg-black/40 px-1.5 py-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1 text-[6.5px] font-bold text-mint">
                              <FargateIcon className="w-2.5 h-2.5 shrink-0" />
                              FARGATE
                            </span>
                            <span className="text-[5.5px] font-bold tracking-wider text-muted-foreground">
                              PER-TASK BILLING — 0 NODES
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            <AnimatePresence initial={false}>
                              {sandboxTasks.map((t) => (
                                <motion.span
                                  key={`sb-${t.id}`}
                                  layout
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.5 }}
                                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                                  className={`h-2.5 w-4 border ${
                                    t.state === "PENDING"
                                      ? "animate-pulse border-magenta/60 bg-magenta/20"
                                      : "border-mint/50 bg-mint/20"
                                  }`}
                                  aria-label={`Fargate sandbox for ${taskName(t, orch)}`}
                                />
                              ))}
                            </AnimatePresence>
                            {sandboxTasks.length === 0 && (
                              <span className="text-[5.5px] uppercase tracking-wider text-muted-foreground/60">
                                IDLE — AWAITING TASKS
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </FlowCanvas>
        </GlassPanel>

        {/* RIGHT RAIL — live stats + controls */}
        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip
                label={`${orch === "EKS" ? "PODS" : "TASKS"} RUNNING`}
                value={`${healthyCount}/${target}`}
                tone={healthyCount === target && healthyCount > 0 ? "mint" : "aws"}
              />
              <StatChip
                label="CLUSTER CPU"
                value={`${clusterCpu}%`}
                tone={clusterCpu > CPU_HIGH ? "magenta" : "mint"}
              />
              <StatChip
                label="IMAGE"
                value={deployActive ? `v${currentVer}→v${deployVer}` : `api:v${currentVer}`}
              />
              <StatChip label="DEPLOYS" value={`${deploys}`} tone="mint" />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={() => setRunning((r) => !r)}
                onReset={reset}
                status={statusLine}
              />

              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                ORCHESTRATOR
              </p>
              <div
                role="group"
                aria-label="Orchestrator"
                className="flex w-full items-center gap-1.5 border border-foreground/25 bg-black/50 px-2 py-1 backdrop-blur-md cyber-cut-sm"
              >
                {(["ECS", "EKS"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOrchestrator(o)}
                    aria-pressed={orch === o}
                    aria-label={`Switch orchestrator to ${o}`}
                    className={`flex items-center gap-1 border px-2 py-0.5 text-[9px] font-bold ${
                      orch === o
                        ? o === "EKS"
                          ? "border-magenta/70 bg-magenta/10 text-magenta"
                          : "border-aws/70 bg-aws/10 text-aws"
                        : "border-foreground/25 text-muted-foreground hover:text-aws"
                    }`}
                  >
                    {o === "ECS" ? <ECSIcon className="w-2.5 h-2.5" /> : <EKSIcon className="w-2.5 h-2.5" />}
                    {o}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleLaunch}
                aria-pressed={launch === "FARGATE"}
                aria-label="Toggle launch type between EC2 and Fargate"
                className={`${BTN_BASE} ${launch === "FARGATE" ? "border-mint/60 text-mint" : "border-aws/50 text-aws"}`}
              >
                <Container className="w-3 h-3" />
                LAUNCH: {launch}
              </button>

              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                DESIRED COUNT
              </p>
              <div
                role="group"
                aria-label="Desired task count"
                className="grid w-full grid-cols-3 gap-1.5 border border-foreground/25 bg-black/50 px-2 py-1 backdrop-blur-md cyber-cut-sm"
              >
                {[2, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => applyDesired(n)}
                    aria-pressed={desired === n}
                    aria-label={`Set desired count to ${n}`}
                    className={`border px-2 py-0.5 text-[9px] font-bold ${
                      desired === n
                        ? "border-aws/70 bg-aws/10 text-aws"
                        : "border-foreground/25 text-muted-foreground hover:text-aws"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleAsg}
                aria-pressed={asgOn}
                aria-label="Toggle target-tracking autoscaling"
                className={`${BTN_BASE} ${
                  asgOn ? "border-mint/60 text-mint" : "border-foreground/20 text-muted-foreground"
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                AUTOSCALING {asgOn ? "ON" : "OFF"}
              </button>

              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                CHAOS & DEPLOY
              </p>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={triggerDeploy}
                  disabled={deployActive}
                  aria-label="Deploy a new image version with a rolling update"
                  className={`${BTN_BASE} border-neon/60 text-neon hover:bg-neon/10 disabled:opacity-40`}
                >
                  <Rocket className="w-3 h-3" />
                  {deployActive ? `DEPLOYING v${deployVer}` : "DEPLOY NEW IMAGE"}
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={injectSpike}
                  aria-label="Inject a traffic spike"
                  className={`${BTN_BASE} border-magenta/60 text-magenta hover:bg-magenta/10`}
                >
                  <Zap className="w-3 h-3" />
                  TRAFFIC SPIKE
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={killRandom}
                  aria-label="Kill a random running task"
                  className={`${BTN_BASE} border-danger/60 text-danger hover:bg-danger/10`}
                >
                  <Skull className="w-3 h-3" />
                  KILL TASK
                </motion.button>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* ORCHESTRATOR LOG — full width below the main grid */}
      <GlassPanel
        title="ORCHESTRATOR LOG // LIVE"
        subtitle={`${orch} · ${launch} · TICK ${String(tickCount).padStart(3, "0")}`}
        className="!p-0"
        delay={0.18}
      >
        <div className="p-3">
          <AutoLog
            lines={log}
            emptyText="NO EVENTS YET — PRESS RUN TO START THE SCHEDULER"
            tones={LOG_TONE_CLS}
          />
        </div>
      </GlassPanel>

      {/* KNOWLEDGE */}
      <div className={immersive.active ? "hidden" : "grid gap-3 md:grid-cols-3"}>
        <Callout type="exam" title="ECS vs EKS vs Fargate" delay={0.1}>
          Three ways to run containers, one decision matrix. ECS is the simplest — AWS-native, tight IAM
          and ALB integration, no control plane to run. EKS is upstream Kubernetes — maximum portability
          and ecosystem (Helm, operators, K8s tooling) at the cost of operating a cluster. Fargate is a
          launch type for either: serverless capacity with per-task billing and zero nodes to patch.
        </Callout>
        <Callout type="critical" title="Rolling deploys & immutable tags" delay={0.2}>
          Zero-downtime deploys depend on minimumHealthyPercent keeping old tasks serving while new ones
          start, and deregistrationDelay letting the ALB drain in-flight connections before a task is
          killed — exactly the DRAINING state simulated above. And never deploy :latest — it is mutable,
          so rollback becomes impossible. Pin immutable tags or digests in ECR.
        </Callout>
        <Callout type="tip" title="ECR hygiene & Container Insights" delay={0.3}>
          Put a lifecycle policy on every ECR repo to expire untagged images (they still cost storage
          money), enable ECR image scanning on push to catch CVEs before deploy, and turn on Container
          Insights in CloudWatch for per-task/pod CPU, memory and network metrics — the cluster CPU
          signal driving target tracking here.
        </Callout>
      </div>
    </div>
  );
}
