"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel, type NodeStatus } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { AutoLog, logTs } from "@/components/shared/auto-log";
import { StatChip } from "@/components/shared/typography";
import { FullscreenToggle } from "@/components/shared/fullscreen-toggle";
import { UseCaseTabs, type UcTabDef } from "@/components/shared/use-case";
import { Ec2UseCases } from "./ec2-usecases";
import { useImmersiveView } from "@/hooks/use-immersive";
import { EC2Icon, AWSIconTile, AWS_EXTRA_ICONS } from "@/components/aws-icons";
import {
  Coins,
  Cpu,
  Database,
  Disc,
  HardDrive,
  Layers,
  Play,
  Power,
  PowerOff,
  RotateCw,
  Skull,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* types + static data                                                 */
/* ------------------------------------------------------------------ */

type LifecycleState = "STOPPED" | "PENDING" | "RUNNING" | "STOPPING" | "TERMINATED";
type LinkKey = "start" | "boot" | "stop" | "halt" | "reboot" | "terminate" | "revive";
type LogTone = "aws" | "mint" | "neon" | "danger" | "muted";

interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
}

interface AsgInstance {
  id: string;
  phase: "init" | "inservice" | "terminating";
  ticks: number;
}

interface Family {
  id: string;
  name: string;
  role: string;
  vcpu: number;
  mem: number;
  extra: string | null;
  use: string;
  icon: LucideIcon;
}

const FAMILIES: Family[] = [
  { id: "t3", name: "T3", role: "GENERAL", vcpu: 2, mem: 4, extra: null, use: "BURSTABLE WEB APPS", icon: Zap },
  { id: "c6i", name: "C6I", role: "COMPUTE", vcpu: 8, mem: 16, extra: null, use: "HIGH-PERF WEBSERVERS", icon: Cpu },
  { id: "r6i", name: "R6I", role: "MEMORY", vcpu: 8, mem: 64, extra: null, use: "IN-MEMORY CACHE", icon: Database },
  { id: "m6i", name: "M6I", role: "BALANCED", vcpu: 4, mem: 16, extra: null, use: "GENERAL PURPOSE", icon: Layers },
  { id: "p4", name: "P4", role: "GPU", vcpu: 64, mem: 1152, extra: "8× A100", use: "ML TRAINING", icon: Sparkles },
  { id: "i4i", name: "I4I", role: "STORAGE", vcpu: 16, mem: 128, extra: "NVMe SSD", use: "LOCAL-STORE DATABASES", icon: HardDrive },
];

const TONE_CLS: Record<LogTone, string> = {
  aws: "text-aws",
  mint: "text-mint",
  neon: "text-neon",
  danger: "text-danger",
  muted: "text-muted-foreground",
};

const STATE_STATUS: Record<LifecycleState, NodeStatus> = {
  STOPPED: "idle",
  PENDING: "warn",
  RUNNING: "success",
  STOPPING: "warn",
  TERMINATED: "error",
};

const REVIVE_IDS = ["i-0cd4", "i-0ef7", "i-02a9", "i-0b81", "i-09f3"];

const freshAsg = (): AsgInstance[] => [
  { id: "i-0f11", phase: "inservice", ticks: 0 },
  { id: "i-0f12", phase: "inservice", ticks: 0 },
];

const BTN =
  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm disabled:opacity-35 disabled:cursor-not-allowed transition-colors";

const EC2_TABS = [
  { id: "GENERAL", label: "GENERAL", num: "01", icon: Cpu },
  { id: "AUTO_SCALING", label: "AUTO SCALING", num: "02", icon: TrendingUp },
  { id: "PRICING", label: "PRICING MODELS", num: "03", icon: Coins },
  { id: "GOLDEN_AMI", label: "GOLDEN AMI", num: "04", icon: Disc },
] as const satisfies readonly UcTabDef[];

type Ec2TabId = (typeof EC2_TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/* EC2 — CORE FORGE                                                    */
/* ------------------------------------------------------------------ */

export default function EC2Visualizer() {
  const immersive = useImmersiveView();
  const [tab, setTab] = useState<Ec2TabId>("GENERAL");
  /* ── PANEL A · lifecycle state machine ─────────────────────────── */
  const [state, setState] = useState<LifecycleState>("STOPPED");
  const [transition, setTransition] = useState<LinkKey | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [transitions, setTransitions] = useState(0);
  const [instanceId, setInstanceId] = useState("i-0ab3");
  const [simRunning, setSimRunning] = useState(false);

  const stateRef = useRef<LifecycleState>("STOPPED");
  const busyRef = useRef(false);
  const logIdRef = useRef(1);
  const transitionsRef = useRef(0);
  const instanceIdRef = useRef("i-0ab3");
  const reviveIdxRef = useRef(0);
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
    const ts = logTs();
    setLogs((prev) => [...prev.slice(-40), { id: logIdRef.current++, text: `[${ts}] ${text}`, tone }]);
  };

  const go = (link: LinkKey, to: LifecycleState, line: string, tone: LogTone, ms: number) => {
    busyRef.current = true;
    setTransition(link);
    pushLog(line, tone);
    transitionsRef.current += 1;
    setTransitions(transitionsRef.current);
    later(() => {
      stateRef.current = to;
      setState(to);
      setTransition(null);
      busyRef.current = false;
    }, ms);
  };

  const doStart = () => {
    if (busyRef.current || stateRef.current !== "STOPPED") return;
    go("start", "PENDING", `> instance ${instanceIdRef.current} :: STOPPED → PENDING (boot request — user-data script queued)`, "aws", 1500);
    later(() => {
      if (stateRef.current !== "PENDING") return;
      go("boot", "RUNNING", `> instance ${instanceIdRef.current} :: PENDING → RUNNING (boot complete, status checks 2/2)`, "mint", 1500);
    }, 1550);
  };

  const doStop = () => {
    if (busyRef.current || stateRef.current !== "RUNNING") return;
    go("stop", "STOPPING", `> instance ${instanceIdRef.current} :: RUNNING → STOPPING (graceful os-stop signal sent)`, "neon", 1500);
    later(() => {
      if (stateRef.current !== "STOPPING") return;
      go("halt", "STOPPED", `> instance ${instanceIdRef.current} :: STOPPING → STOPPED (halted — EBS volumes persist, billing paused)`, "muted", 1400);
    }, 1550);
  };

  const doReboot = () => {
    if (busyRef.current || stateRef.current !== "RUNNING") return;
    go("reboot", "RUNNING", `> instance ${instanceIdRef.current} :: RUNNING → RUNNING (reboot — public IP preserved, stays billed)`, "aws", 1300);
  };

  const doTerminate = () => {
    if (busyRef.current || stateRef.current !== "RUNNING") return;
    go("stop", "STOPPING", `> instance ${instanceIdRef.current} :: RUNNING → STOPPING (TERMINATE requested — shutting down)`, "danger", 1200);
    later(() => {
      if (stateRef.current !== "STOPPING") return;
      go(
        "terminate",
        "TERMINATED",
        `> instance ${instanceIdRef.current} :: STOPPING → TERMINATED (deleted — root EBS reclaimed, billing stopped)`,
        "danger",
        1300
      );
    }, 1250);
  };

  const doRevive = () => {
    if (busyRef.current || stateRef.current !== "TERMINATED") return;
    const nextId = REVIVE_IDS[reviveIdxRef.current % REVIVE_IDS.length];
    reviveIdxRef.current += 1;
    instanceIdRef.current = nextId;
    setInstanceId(nextId);
    go("revive", "STOPPED", `> instance ${nextId} :: TERMINATED → STOPPED (revived from AMI snapshot — new instance id)`, "mint", 1500);
  };

  const resetLifecycle = () => {
    setSimRunning(false);
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    busyRef.current = false;
    stateRef.current = "STOPPED";
    transitionsRef.current = 0;
    instanceIdRef.current = "i-0ab3";
    reviveIdxRef.current = 0;
    setState("STOPPED");
    setTransition(null);
    setLogs([]);
    setTransitions(0);
    setInstanceId("i-0ab3");
  };

  /* autopilot — drives the state machine while sim runs */
  useEffect(() => {
    if (!simRunning) return;
    const timer = window.setInterval(() => {
      const s = stateRef.current;
      if (s === "STOPPED") {
        doStart();
      } else if (s === "RUNNING") {
        const r = Math.random();
        if (r < 0.18) doStop();
        else if (r < 0.28) doReboot();
        else if (r < 0.5) pushLog(`> status check :: ${instanceIdRef.current} OK — 2/2 system + instance checks passed`, "muted");
      } else if (s === "TERMINATED" && !busyRef.current && Math.random() < 0.35) {
        pushLog("> auto-scaling :: replacement capacity pending — press REVIVE", "danger");
      }
    }, 1900);
    return () => window.clearInterval(timer);
  }, [simRunning]);

  /* ── PANEL B · auto scaling group ──────────────────────────────── */
  const [instances, setInstances] = useState<AsgInstance[]>(freshAsg);
  const [avgCpu, setAvgCpu] = useState(35);
  const [load, setLoad] = useState(55);
  const [asgRunning, setAsgRunning] = useState(false);
  const [asgEvent, setAsgEvent] = useState<string | null>(null);
  const [family, setFamily] = useState("m6i");

  const loadRef = useRef(55);
  const instancesRef = useRef<AsgInstance[]>(freshAsg());
  const asgIdRef = useRef(3);

  const asgTick = () => {
    const measured = Math.min(100, Math.max(1, Math.round(loadRef.current + (Math.random() * 24 - 12))));
    const list = instancesRef.current;

    /* reap chips marked terminating on the previous tick */
    let next = list.filter((i) => i.phase !== "terminating");

    /* pending chips boot after 2 ticks */
    next.forEach((i) => {
      if (i.phase === "init") {
        i.ticks -= 1;
        if (i.ticks <= 0) {
          i.phase = "inservice";
          setAsgEvent(`${i.id} passed status checks — IN-SERVICE`);
        }
      }
    });

    /* target-tracking policy */
    const inService = next.filter((i) => i.phase === "inservice").length;
    if (measured > 70 && next.length < 6) {
      const id = `i-0${asgIdRef.current.toString(16).padStart(4, "0")}`;
      asgIdRef.current += 1;
      next = [...next, { id, phase: "init", ticks: 2 }];
      setAsgEvent(`SCALE-OUT :: avg cpu ${measured}% > 70% — launching ${id} (INITIALIZING…)`);
    } else if (measured < 30 && inService > 1) {
      const victim = next.find((i) => i.phase === "inservice");
      if (victim) {
        victim.phase = "terminating";
        setAsgEvent(`SCALE-IN :: avg cpu ${measured}% < 30% — draining ${victim.id}`);
      }
    } else if (measured >= 30 && measured <= 70 && Math.random() < 0.3) {
      setAsgEvent(`STEADY :: avg cpu ${measured}% within band — no scaling action`);
    }

    instancesRef.current = next;
    setInstances([...next]);
    setAvgCpu(measured);
  };

  useEffect(() => {
    if (!asgRunning) return;
    const timer = window.setInterval(asgTick, 1000);
    return () => window.clearInterval(timer);
  }, [asgRunning]);

  const resetAsg = () => {
    setAsgRunning(false);
    instancesRef.current = freshAsg();
    setInstances(freshAsg());
    setAvgCpu(35);
    setAsgEvent(null);
  };

  const desired = instances.length;
  const actual = instances.filter((i) => i.phase === "inservice").length;
  const selectedFamily = FAMILIES.find((f) => f.id === family) ?? FAMILIES[3];

  const nodeStatus = (s: LifecycleState): NodeStatus => (state === s ? STATE_STATUS[s] : "idle");

  return (
    <div
      className={
        immersive.active
          ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll"
          : "flex flex-col gap-4"
      }
    >
      {/* MODULE TABS — sits directly below the module title card */}
      <UseCaseTabs tabs={EC2_TABS} active={tab} onChange={(t) => setTab(t as Ec2TabId)} label="EC2 views" />

      {tab !== "GENERAL" && (
        <Ec2UseCases id={tab} immersiveActive={immersive.active} immersiveToggle={immersive.toggle} />
      )}

      {tab === "GENERAL" && (
        <>
      {/* ══════════ PANEL A — LIFECYCLE STATE MACHINE ══════════ */}
      <GlassPanel
        title="LIFECYCLE STATE MACHINE"
        subtitle={`instance ${instanceId} :: t3.micro · us-east-1a · user-data armed`}
        className="!p-0"
        actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
      >
        {/* LIFECYCLE GRAPH + RIGHT RAIL */}
        <div className={`p-3 sm:p-4 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start ${immersive.active ? "flex-1" : ""}`}>
          <FlowCanvas
            className={immersive.active ? "h-[min(540px,58vh)]" : "h-[440px] sm:h-[540px]"}
            ariaLabel="EC2 instance lifecycle state machine"
          >
            {/* LINKS */}
            <FlowLink d="M19,48 L32,48" status={transition === "start" ? "flowing" : "idle"} dotDuration={1.2} />
            <FlowLink d="M41,48 L55,48" status={transition === "boot" ? "flowing" : "idle"} dotDuration={1.3} />
            <FlowLink d="M65,48 L79,48" status={transition === "stop" ? "flowing" : "idle"} dotDuration={1.2} />
            <FlowLink d="M84,53 C66,68 34,68 19,53" status={transition === "halt" ? "flowing" : "idle"} dotDuration={1.7} />
            <FlowLink d="M57,42 C53,30 67,30 63,42" status={transition === "reboot" ? "cyber" : "idle"} dotDuration={1.1} />
            <FlowLink d="M83,53 L82,77" status={transition === "terminate" ? "error" : "idle"} dotDuration={1.2} />
            <FlowLink
              d="M76,86 C48,93 20,74 14,55"
              status={transition === "revive" ? "success" : "idle"}
              dashed
              dot={transition === "revive"}
              dotDuration={1.7}
            />

            {/* STATE NODES */}
            <FlowNode x={14} y={48} icon={<Power className="w-3 h-3" />} label="STOPPED" sub="EBS KEPT" status={nodeStatus("STOPPED")} pulse={state === "STOPPED"} active={state === "STOPPED"} size="sm" delay={0.1} />
            <FlowNode x={36} y={48} icon={<Zap className="w-3 h-3" />} label="PENDING" sub="BOOTING" status={nodeStatus("PENDING")} pulse={state === "PENDING"} active={state === "PENDING"} size="sm" delay={0.2} />
            <FlowNode x={60} y={48} icon={<EC2Icon className="w-3 h-3" />} label="RUNNING" sub="BILLED" status={nodeStatus("RUNNING")} pulse={state === "RUNNING"} active={state === "RUNNING"} size="sm" delay={0.3} />
            <FlowNode x={84} y={48} icon={<PowerOff className="w-3 h-3" />} label="STOPPING" sub="SHUTDOWN" status={nodeStatus("STOPPING")} pulse={state === "STOPPING"} active={state === "STOPPING"} size="sm" delay={0.4} />
            <FlowNode x={82} y={86} icon={<Skull className="w-3 h-3" />} label="TERMINATED" sub="DELETED" status={state === "TERMINATED" ? "error" : "idle"} pulse={state === "TERMINATED"} active={state === "TERMINATED"} size="sm" delay={0.5} />

            {/* LABELS */}
            <FlowLabel x={25} y={40} tone="aws">START</FlowLabel>
            <FlowLabel x={48} y={40} tone="aws">BOOT</FlowLabel>
            <FlowLabel x={60} y={29} tone="magenta">REBOOT</FlowLabel>
            <FlowLabel x={50} y={64} tone="default">HALTED</FlowLabel>
            <FlowLabel x={87} y={66} tone="danger">TERMINATE</FlowLabel>
            <FlowLabel x={42} y={80} tone="mint">REVIVE</FlowLabel>
          </FlowCanvas>

          {/* RIGHT RAIL — lifecycle stats + controls */}
          <div className="flex flex-col gap-3 min-w-0">
            {/* LIFECYCLE STATS */}
            <div className="glass-inset p-3 grid grid-cols-2 gap-2">
              <StatChip label="STATE" value={state} tone={state === "RUNNING" ? "mint" : state === "TERMINATED" ? "magenta" : "aws"} />
              <StatChip label="TRANSITIONS" value={String(transitions)} tone="neutral" delay={0.05} />
              <StatChip label="AUTOPILOT" value={simRunning ? "ENGAGED" : "STANDBY"} delay={0.1} />
              <StatChip label="INSTANCE ID" value={instanceId} tone="neutral" delay={0.15} />
            </div>

            {/* CONTROLS — sim driver + lifecycle actions (moved out of the deleted header/strip) */}
            <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
              <div className="p-3 flex flex-col gap-2.5">
                <SimControls
                  running={simRunning}
                  onToggle={() => setSimRunning((r) => !r)}
                  onReset={resetLifecycle}
                  status={simRunning ? "AUTOPILOT ENGAGED — DRIVING TRANSITIONS" : "MANUAL CONTROL — PRESS RUN OR A BUTTON"}
                />
                <div className="flex flex-wrap gap-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={doStart}
                    disabled={state !== "STOPPED" || transition !== null}
                    className={`${BTN} border-mint/60 text-mint hover:bg-mint/10`}
                    aria-label="Start instance"
                  >
                    <Play className="w-3 h-3" />
                    START
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={doStop}
                    disabled={state !== "RUNNING" || transition !== null}
                    className={`${BTN} border-neon/60 text-neon hover:bg-neon/10`}
                    aria-label="Stop instance"
                  >
                    <Square className="w-3 h-3" />
                    STOP
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={doReboot}
                    disabled={state !== "RUNNING" || transition !== null}
                    className={`${BTN} border-aws/60 text-aws hover:bg-aws/10`}
                    aria-label="Reboot instance"
                  >
                    <RotateCw className="w-3 h-3" />
                    REBOOT
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={doTerminate}
                    disabled={state !== "RUNNING" || transition !== null}
                    className={`${BTN} border-danger/60 text-danger hover:bg-danger/10`}
                    aria-label="Terminate instance"
                  >
                    <Trash2 className="w-3 h-3" />
                    TERMINATE
                  </motion.button>
                  <AnimatePresence>
                    {state === "TERMINATED" && (
                      <motion.button
                        type="button"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={doRevive}
                        disabled={transition !== null}
                        className={`${BTN} border-mint bg-mint/15 text-mint shadow-[0_0_16px_rgba(0,255,163,0.3)]`}
                        aria-label="Revive terminated instance from AMI snapshot"
                      >
                        <Zap className="w-3 h-3" />
                        REVIVE INSTANCE
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      </GlassPanel>

      {/* ══════════ STATE LOG // LIVE (full-width bottom log — moved out of the rail) ══════════ */}
      <GlassPanel
        title="STATE LOG // LIVE"
        subtitle={`instance ${instanceId} :: lifecycle transitions`}
        className="!p-0"
        delay={0.12}
      >
        <div className="p-3">
          <AutoLog lines={logs} emptyText="// state log empty — press START or engage autopilot" tones={TONE_CLS} />
        </div>
      </GlassPanel>

      {/* ══════════ PANEL B — AUTO SCALING GROUP SIM ══════════ */}
      <GlassPanel
        title="AUTO SCALING GROUP SIM"
        subtitle={`launch template ${selectedFamily.name.toLowerCase()} · target tracking — scale-out > 70% · scale-in < 30%`}
        delay={0.1}
        className="!p-0"
        actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
      >
        {/* ASG VISUAL + RIGHT RAIL */}
        <div className="p-3 sm:p-4 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
          {/* ASG BOUNDARY + INSTANCE CHIPS */}
          <div className="relative border border-dashed border-aws/45 bg-aws/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-1 pb-2">
              <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-aws/85">
                <AWSIconTile src={AWS_EXTRA_ICONS.ec2AutoScaling} className="w-4 h-4 shrink-0" alt="" />
                ASG :: asg-core-forge
              </span>
              <span className="text-[8px] tracking-wider text-muted-foreground uppercase">MIN 1 · MAX 6 · DESIRED {desired}</span>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[46px]">
              <AnimatePresence>
                {instances.map((i) => (
                  <motion.div
                    key={i.id}
                    layout
                    initial={{ opacity: 0, scale: 0.5, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.4 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    className={`flex items-center gap-1.5 px-2 py-1.5 border text-[8px] font-bold tracking-wider uppercase ${
                      i.phase === "init"
                        ? "border-neon/60 bg-neon/10 text-neon"
                        : i.phase === "terminating"
                          ? "border-danger/60 bg-danger/10 text-danger"
                          : "border-mint/50 bg-mint/[0.07] text-mint"
                    }`}
                  >
                    <EC2Icon className="w-3 h-3" />
                    {i.id}
                    <span className="opacity-70">
                      {i.phase === "init" ? "INITIALIZING…" : i.phase === "terminating" ? "TERMINATING" : "IN-SERVICE"}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {instances.length === 0 && (
                <span className="text-[8px] text-muted-foreground/60 tracking-wider py-2">{"//"} scaling out…</span>
              )}
            </div>
          </div>

          {/* RIGHT RAIL — ASG stats + policy event ticker + family detail */}
          <div className="flex flex-col gap-3 min-w-0">
            {/* ASG STATS */}
            <div className="glass-inset p-3 grid grid-cols-2 gap-2">
              <StatChip label="INSTANCES" value={String(actual)} tone="mint" />
              <StatChip label="CPU LOAD" value={`${avgCpu}%`} tone={avgCpu > 70 ? "magenta" : "aws"} delay={0.05} />
              <StatChip label="DESIRED / ACTUAL" value={`${desired} / ${actual}`} delay={0.1} />
              <StatChip label="MIN / MAX" value="1 / 6" tone="neutral" delay={0.15} />
            </div>

            {/* CONTROLS — sim driver + cpu load + instance family (moved out of the deleted header/strip) */}
            <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
              <div className="p-3 flex flex-col gap-2.5">
                <SimControls
                  running={asgRunning}
                  onToggle={() => setAsgRunning((r) => !r)}
                  onReset={resetAsg}
                  status={asgRunning ? "ASG ONLINE — POLICY EVALUATING EVERY TICK" : "ASG IDLE — PRESS RUN"}
                />
                <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CPU LOAD DRIVER</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-3.5 h-3.5 shrink-0 text-aws" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={load}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        loadRef.current = v;
                        setLoad(v);
                      }}
                      className="w-full accent-[#ff9900] cursor-pointer"
                      aria-label="Simulated CPU load percentage"
                    />
                    <span className="w-12 text-right text-[10px] font-extrabold tracking-wider text-aws">{load}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 border border-aws/20 bg-black/60 overflow-hidden">
                      <motion.div
                        className={`h-full ${avgCpu > 70 ? "bg-danger" : avgCpu < 30 ? "bg-mint" : "bg-aws"}`}
                        animate={{ width: `${avgCpu}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className={`text-[9px] font-extrabold tracking-wider ${avgCpu > 70 ? "text-danger" : avgCpu < 30 ? "text-mint" : "text-aws"}`}>
                      AVG {avgCpu}%
                    </span>
                  </div>
                </div>
                <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">INSTANCE FAMILY</p>
                <div className="grid grid-cols-3 gap-2">
                  {FAMILIES.map((f) => {
                    const selected = f.id === family;
                    return (
                      <motion.button
                        key={f.id}
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setFamily(f.id)}
                        aria-label={`Select ${f.name} ${f.role.toLowerCase()} instance family`}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 border bg-black/50 backdrop-blur-md cyber-cut-sm transition-colors ${
                          selected ? "border-aws bg-aws/10 text-aws box-glow" : "border-foreground/20 text-foreground/70 hover:border-aws/40"
                        }`}
                      >
                        <f.icon className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-extrabold tracking-[0.14em]">{f.name}</span>
                        <span className="text-[6.5px] tracking-[0.16em] opacity-70">{f.role}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </GlassPanel>

            {/* LATEST POLICY EVENT */}
            <div className="min-h-[18px]">
              <AnimatePresence mode="wait">
                {asgEvent && (
                  <motion.p
                    key={asgEvent}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[9px] font-bold tracking-wider text-neon truncate"
                  >
                    {asgEvent}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* FAMILY DETAIL STRIP */}
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedFamily.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="glass-inset flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
              >
                <span className="text-[10px] font-extrabold tracking-[0.18em] text-aws">
                  {selectedFamily.name} <span className="text-muted-foreground">— {selectedFamily.role}</span>
                </span>
                <span className="text-[9px] font-bold tracking-wider text-foreground/80">{selectedFamily.vcpu} vCPU</span>
                <span className="text-[9px] font-bold tracking-wider text-foreground/80">{selectedFamily.mem} GB RAM</span>
                {selectedFamily.extra && <span className="text-[9px] font-bold tracking-wider text-magenta">{selectedFamily.extra}</span>}
                <span className="text-[9px] font-bold tracking-wider text-mint">{selectedFamily.use}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </GlassPanel>

      {/* ══════════ KNOWLEDGE — hidden in immersive fullscreen (essential data only) ══════════ */}
      <div className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}>
        <Callout type="tip" title="User data bootstraps on first boot">
          Scripts passed via user data run as root at launch — install packages, join clusters, pull config from S3.
          Combine with instance metadata (169.254.169.254) for zero-hardcoded-secret provisioning.
        </Callout>
        <Callout type="exam" title="Spot instances cost up to 90% less">
          Spot capacity is spare EC2 capacity at up to 90% off on-demand. The tradeoff: AWS can reclaim it with a
          2-minute interruption notice — perfect for fault-tolerant, interruptible workloads like batch and CI.
        </Callout>
        <Callout type="critical" title="IMDSv2 blocks SSRF credential theft">
          IMDSv2 requires session-based PUT tokens (hop-limit 1) instead of plain GET. A classic SSRF attack that
          reads role credentials from instance metadata dies against a token-enforcing endpoint.
        </Callout>
      </div>
        </>
      )}
    </div>
  );
}
