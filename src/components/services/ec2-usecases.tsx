"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Cpu,
  Layers,
  Package,
  Rocket,
  ShieldCheck,
  Timer,
  Waves,
  Wrench,
  Zap,
} from "lucide-react";
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
import { EC2Icon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES                                                        */
/* ================================================================== */

export type Ec2UseCaseId = "AUTO_SCALING" | "PRICING" | "GOLDEN_AMI";

interface Ec2UseCasesProps {
  id: Ec2UseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

interface LogLine {
  id: number;
  text: string;
  tone?: string;
}

type FlashTone = "ok" | "deny" | "aws";

/* flash timer pattern: setTimeout stored in a ref, cleared in cleanup */
function useFlash() {
  const [flash, setFlash] = useState<{ text: string; tone: FlashTone } | null>(null);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = (text: string, tone: FlashTone) => {
    setFlash({ text, tone });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1500);
  };
  useEffect(
    () => () => {
      if (flashT.current) clearTimeout(flashT.current);
    },
    []
  );
  return { flash, fire };
}

/* ================================================================== */
/* TAB 02 — AUTO SCALING: LOAD WAVE → ALARM → FLEET 2→8                */
/* ================================================================== */

interface AsgChip {
  id: string;
  phase: "boot" | "in-service" | "terminating";
  ticks: number;
  cpu: number;
}

const ASG_ON_DEMAND_HR = 0.0464;

const freshAsgFleet = (): AsgChip[] => [
  { id: "i-0ab31", phase: "in-service", ticks: 0, cpu: 42 },
  { id: "i-0cf72", phase: "in-service", ticks: 0, cpu: 38 },
];

const ASG_CHIP_CLS: Record<AsgChip["phase"], string> = {
  boot: "border-neon/60 bg-neon/10 text-neon",
  "in-service": "border-mint/50 bg-mint/[0.07] text-mint",
  terminating: "border-danger/60 bg-danger/10 text-danger",
};

const ASG_CHIP_LABEL: Record<AsgChip["phase"], string> = {
  boot: "INITIALIZING…",
  "in-service": "IN-SERVICE",
  terminating: "TERMINATING",
};

function AsgChipCard({ chip }: { chip: AsgChip }) {
  const bar = chip.phase === "boot" ? "bg-neon" : chip.phase === "terminating" ? "bg-danger" : chip.cpu > 70 ? "bg-danger" : "bg-aws";
  const width = chip.phase === "boot" ? 14 : chip.phase === "terminating" ? chip.cpu : chip.cpu;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={`flex flex-col gap-1 px-2 py-1.5 border ${ASG_CHIP_CLS[chip.phase]}`}
    >
      <div className="flex items-center gap-1.5 text-[8px] font-bold tracking-wider uppercase whitespace-nowrap">
        <EC2Icon className="w-3 h-3 shrink-0" />
        {chip.id}
        <span className="opacity-70">{ASG_CHIP_LABEL[chip.phase]}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-1 w-16 border border-foreground/20 bg-black/60 overflow-hidden">
          <motion.div className={`h-full ${bar}`} animate={{ width: `${width}%` }} transition={{ duration: 0.5 }} />
        </div>
        <span className="text-[6.5px] tabular-nums opacity-80">{chip.phase === "boot" ? "BOOT" : `${chip.cpu}%`}</span>
      </div>
    </motion.div>
  );
}

function LoadSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Cpu className="w-3 h-3 text-aws" /> LOAD WAVE DRIVER
        </span>
        <span className="text-[8px] font-extrabold tabular-nums text-aws">{value}%</span>
      </div>
      <input
        type="range"
        min={10}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label="Simulated incoming load percentage"
        className="w-full h-1.5 accent-[#ff9900] cursor-pointer bg-black/60 border border-foreground/20"
      />
      <div className="flex justify-between text-[6px] tracking-[0.15em] text-muted-foreground/60 uppercase">
        <span>10 · NIGHT LULL</span>
        <span>100 · FLASH SALE</span>
      </div>
    </div>
  );
}

function AutoScalingUseCase({ immersiveActive, immersiveToggle }: Ec2UseCasesProps) {
  const [running, setRunning] = useState(false);
  const [load, setLoad] = useState(40);
  const [avgCpu, setAvgCpu] = useState(38);
  const [fleet, setFleet] = useState<AsgChip[]>(freshAsgFleet);
  const [scaleEvents, setScaleEvents] = useState(0);
  const [lines, setLines] = useState<LogLine[]>([]);
  const { flash, fire } = useFlash();

  const loadRef = useRef(40);
  const fleetRef = useRef<AsgChip[]>(freshAsgFleet());
  const idRef = useRef(3);
  const scaleRef = useRef(0);
  const logId = useRef(1);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logId.current++, text, tone }]);

  /* load wave → avg CPU → alarm → policy (all inside the interval callback) */
  useTicker(running, () => {
    const measured = Math.min(100, Math.max(1, Math.round(loadRef.current + (Math.random() * 26 - 13))));
    const list = fleetRef.current.filter((c) => c.phase !== "terminating");

    list.forEach((c) => {
      if (c.phase === "boot") {
        c.ticks -= 1;
        if (c.ticks <= 0) {
          c.phase = "in-service";
          push(`${c.id} status checks 2/2 — IN-SERVICE (joined rotation)`, "mint");
        }
      } else {
        c.cpu = Math.min(100, Math.max(4, Math.round(measured + (Math.random() * 18 - 9))));
      }
    });

    const inService = list.filter((c) => c.phase === "in-service").length;
    if (measured > 70 && list.length < 8) {
      const id = `i-0${idRef.current.toString(16).padStart(4, "0")}`;
      idRef.current += 1;
      list.push({ id, phase: "boot", ticks: 2, cpu: 0 });
      scaleRef.current += 1;
      setScaleEvents(scaleRef.current);
      push(`ALARM :: avg cpu ${measured}% > 70% — launching ${id} (${list.length - 1} → ${list.length})`, "danger");
      fire("ALARM — SCALE-OUT", "deny");
    } else if (measured > 70) {
      push(`ALARM :: avg cpu ${measured}% — MAX capacity 8/8 reached`, "danger");
    } else if (measured < 30 && inService > 2) {
      const victim = list.find((c) => c.phase === "in-service");
      if (victim) {
        victim.phase = "terminating";
        scaleRef.current += 1;
        setScaleEvents(scaleRef.current);
        push(`SCALE-IN :: avg cpu ${measured}% < 30% — draining ${victim.id} (${list.length} → ${list.length - 1})`, "neon");
        fire("SCALE-IN — DRAINING", "ok");
      }
    } else if (measured >= 30 && measured <= 70) {
      push(`OK :: avg cpu ${measured}% inside band 30–70% — steady state`, "dim");
    }

    fleetRef.current = list;
    setFleet([...list]);
    setAvgCpu(measured);
  }, 1000);

  const reset = () => {
    setRunning(false);
    fleetRef.current = freshAsgFleet();
    idRef.current = 3;
    scaleRef.current = 0;
    setFleet(freshAsgFleet());
    setAvgCpu(38);
    setLoad(40);
    loadRef.current = 40;
    setScaleEvents(0);
    setLines([]);
  };

  const alarm = avgCpu > 70;
  const estHr = `$${(fleet.length * ASG_ON_DEMAND_HR).toFixed(3)}`;

  return (
    <UseCaseShell
      title="USE CASE // AUTO SCALING — ELASTIC BY DEFAULT"
      subtitle="LOAD WAVE → CLOUDWATCH ALARM → ASG SCALES 2 → 8 → SCALES BACK IN"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="LOAD % (DRIVER)" value={load} />
          <UCStat label="CPU AVG" value={`${avgCpu}%`} tone={alarm ? "danger" : avgCpu < 30 ? "mint" : "aws"} />
          <UCStat label="DESIRED INSTANCES" value={fleet.length} tone="neon" />
          <UCStat label="ALARM STATE" value={alarm ? "ALARM" : "OK"} tone={alarm ? "danger" : "mint"} />
          <UCStat label="EST $/HR" value={estHr} tone="magenta" />
          <UCStat label="SCALE EVENTS" value={scaleEvents} tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "ASG ONLINE — TARGET-TRACKING POLICY EVALUATING" : "ASG IDLE — PRESS RUN, THEN DRIVE THE LOAD SLIDER"}
          />
          <LoadSlider
            value={load}
            onChange={(v) => {
              loadRef.current = v;
              setLoad(v);
            }}
          />
          <p className="text-[7px] tracking-[0.15em] text-muted-foreground uppercase">
            policy: target-tracking avg-cpu 50 · min 2 · max 8 · scale-out &gt; 70% · scale-in &lt; 30%
          </p>
        </>
      }
      logLines={lines}
      logTitle="ASG POLICY LOG // LIVE"
      logEmpty="PRESS RUN — THEN PUSH THE LOAD SLIDER PAST 70% TO TRIP THE ALARM"
    >
      <FlowCanvas ariaLabel="EC2 auto scaling use case diagram" className="h-full">
        {/* links */}
        <FlowLink d="M17,52 C22,52 25,52 29,52" status={running ? "flowing" : "idle"} dotDuration={1.2} />
        <FlowLink d="M19,80 C23,74 26,68 29,64" status={alarm ? "error" : "idle"} dashed dotDuration={1.7} />

        <FlowNode
          x={10}
          y={52}
          size="sm"
          delay={0.1}
          icon={<Waves className="w-3 h-3" />}
          label="LOAD WAVE"
          sub={`DRIVER · ${load}%`}
          status={running ? "active" : "idle"}
          pulse={running}
        />
        <FlowNode
          x={13}
          y={86}
          size="xs"
          delay={0.2}
          icon={<Bell className="w-3 h-3" />}
          label="CW ALARM"
          sub="AVG CPU > 70%"
          status={alarm ? "error" : "success"}
          pulse={alarm}
        />

        {/* ASG boundary + chips */}
        <div className="absolute border border-dashed border-aws/45 bg-aws/[0.03] p-2.5" style={{ left: "31%", right: "3%", top: "17%", bottom: "24%" }}>
          <div className="flex flex-wrap items-center justify-between gap-1 pb-2">
            <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-aws/85">
              <EC2Icon className="w-3.5 h-3.5 shrink-0" />
              ASG :: nexus-web-asg
            </span>
            <span className="text-[7.5px] tracking-wider text-muted-foreground uppercase">MIN 2 · MAX 8 · DESIRED {fleet.length}</span>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[52px]">
            <AnimatePresence>
              {fleet.map((c) => (
                <AsgChipCard key={c.id} chip={c} />
              ))}
            </AnimatePresence>
            {fleet.length === 0 && (
              <span className="text-[8px] text-muted-foreground/60 tracking-wider py-2">{"//"} scaling out…</span>
            )}
          </div>
        </div>

        <FlowLabel x={52} y={8} tone="aws">TARGET TRACKING — SCALE-OUT &gt; 70% · SCALE-IN &lt; 30%</FlowLabel>
        <FlowLabel x={64} y={82} tone="default">NEW CHIPS BOOT ~2 TICKS — THEN JOIN THE ROTATION</FlowLabel>
        <FlowLabel x={30} y={94} tone={alarm ? "danger" : "mint"}>
          {alarm ? "ALARM IN ALARM STATE — ADDING CAPACITY" : "ALARM OK — RIGHT-SIZED"}
        </FlowLabel>

        <VerdictFlash show={flash !== null} text={flash?.text ?? ""} tone={flash?.tone ?? "aws"} />
      </FlowCanvas>

      <UseCaseNote>
        traffic doubles at 3AM? the ALARM fires, ASG adds chips in ~90s and drains them when the wave passes — you pay
        only for the capacity the wave actually needs
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — PRICING MODELS: ON-DEMAND vs SPOT vs RESERVED              */
/* ================================================================== */

const OD_RATE = 0.0464;
const SPOT_RATE = 0.0139;
const RI_RATE = 0.021;

type SpotPhase = "run" | "drain" | "checkpoint" | "migrate" | "boot";

const SPOT_PHASE_CLS: Record<SpotPhase, { box: string; text: string; label: string }> = {
  run: { box: "border-mint/40 bg-mint/[0.05]", text: "text-mint", label: "RUNNING" },
  drain: { box: "border-danger/60 bg-danger/10", text: "text-danger", label: "DRAINING 2:00" },
  checkpoint: { box: "border-magenta/60 bg-magenta/10", text: "text-magenta", label: "CHECKPOINT" },
  migrate: { box: "border-aws/60 bg-aws/10", text: "text-aws", label: "MIGRATING" },
  boot: { box: "border-neon/60 bg-neon/10", text: "text-neon", label: "BOOTING" },
};

const PRICING_TIMELINE: { key: string; label: string; phase: SpotPhase | "resume" }[] = [
  { key: "notice", label: "2-MIN NOTICE", phase: "drain" },
  { key: "checkpoint", label: "CHECKPOINT", phase: "checkpoint" },
  { key: "migrate", label: "MIGRATE", phase: "migrate" },
  { key: "resume", label: "RESUME", phase: "resume" },
];

function PricingLane({
  name,
  rate,
  cost,
  best,
  tone,
  chip,
  meta,
}: {
  name: string;
  rate: string;
  cost: number;
  best: boolean;
  tone: "aws" | "magenta" | "mint";
  chip: React.ReactNode;
  meta: string;
}) {
  const border = tone === "aws" ? "border-aws/40" : tone === "magenta" ? "border-magenta/40" : "border-mint/40";
  const text = tone === "aws" ? "text-aws" : tone === "magenta" ? "text-magenta" : "text-mint";
  return (
    <div className={`relative border bg-black/40 p-2 pt-3 flex flex-col gap-1.5 min-h-0 ${best ? `${border} box-glow` : "border-foreground/15"}`}>
      {best && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap border border-mint bg-black px-1.5 py-0.5 text-[6.5px] font-extrabold tracking-[0.25em] text-mint box-glow">
          BEST FIT
        </span>
      )}
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[8px] font-extrabold tracking-[0.15em] ${text}`}>{name}</span>
        <span className="text-[7px] tracking-wider text-muted-foreground tabular-nums">${rate}/HR</span>
      </div>
      <motion.p key={cost.toFixed(2)} initial={{ scale: 1.12 }} animate={{ scale: 1 }} className={`text-base leading-none font-extrabold tabular-nums ${text}`}>
        ${cost.toFixed(2)}
      </motion.p>
      <p className="text-[6px] uppercase tracking-[0.2em] text-muted-foreground">30-DAY COST TICKER</p>
      {chip}
      <p className="mt-auto text-[6px] uppercase tracking-[0.12em] text-muted-foreground/80 leading-relaxed">{meta}</p>
    </div>
  );
}

function PricingUseCase({ immersiveActive, immersiveToggle }: Ec2UseCasesProps) {
  const [running, setRunning] = useState(false);
  const [bursty, setBursty] = useState(false);
  const [cost, setCost] = useState({ od: 0, spot: 0, ri: 0 });
  const [days, setDays] = useState(0);
  const [month, setMonth] = useState(1);
  const [interruptions, setInterruptions] = useState(0);
  const [spotPhase, setSpotPhase] = useState<SpotPhase>("run");
  const [spotGen, setSpotGen] = useState(1);
  const [spotBusy, setSpotBusy] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const { flash, fire } = useFlash();

  const workloadRef = useRef(false);
  const costRef = useRef({ od: 0, spot: 0, ri: 0 });
  const daysRef = useRef(0);
  const monthRef = useRef(1);
  const logId = useRef(1);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logId.current++, text, tone }]);

  /* 1 sim day per tick — a 30-day window closes, then the next month starts */
  useTicker(running, () => {
    const util = workloadRef.current ? 0.55 : 1;
    const rerun = workloadRef.current ? 0.1 : 2.2; // spot re-run overhead (checkpoint + state re-warm)
    const next = {
      od: costRef.current.od + OD_RATE * 24 * util,
      spot: costRef.current.spot + SPOT_RATE * 24 * util * (1 + rerun),
      ri: costRef.current.ri + RI_RATE * 24, // commitment bills 24/7 whether used or not
    };
    const d = daysRef.current + 1;
    costRef.current = next;
    daysRef.current = d;
    setCost(next);
    setDays(d);
    if (d >= 30) {
      push(
        `MONTH ${monthRef.current} CLOSED — on-demand $${next.od.toFixed(2)} · spot $${next.spot.toFixed(2)} · reserved $${next.ri.toFixed(2)}`,
        "aws"
      );
      costRef.current = { od: 0, spot: 0, ri: 0 };
      daysRef.current = 0;
      monthRef.current += 1;
      setCost({ od: 0, spot: 0, ri: 0 });
      setDays(0);
      setMonth(monthRef.current);
    }
  }, 850);

  /* spot interruption — the 2-minute drain compressed to a 5-step sequence */
  const { step: spotStep, reset: resetSpotSeq } = useScenarioRunner(5, spotBusy, 800, (s) => {
    if (s === 0) {
      setSpotPhase("drain");
      push("EC2 SPOT RECLAMATION — 2-MINUTE INTERRUPTION NOTICE received", "danger");
      push("DRAINING — no new work accepted · in-flight work finishing", "neon");
    } else if (s === 1) {
      setSpotPhase("checkpoint");
      push("CHECKPOINT — job state flushed to s3://nexus-checkpoints/job-881 (812MB)", "magenta");
    } else if (s === 2) {
      setSpotPhase("migrate");
      push("MIGRATE — fleet requests replacement capacity from a new spot pool", "aws");
    } else if (s === 3) {
      setSpotGen((g) => g + 1);
      setSpotPhase("boot");
      push("RESUME — replacement i-0s* booting — checkpoint restores in 4.1s", "mint");
    } else {
      setSpotPhase("run");
      setSpotBusy(false);
      setInterruptions((n) => n + 1);
      push("SPOT LANE BACK AT 100% — total customer impact: ZERO (job never restarted from scratch)", "mint");
      fire("MIGRATED — ZERO DOWNTIME", "ok");
    }
  });

  const reset = () => {
    setRunning(false);
    resetSpotSeq();
    workloadRef.current = false;
    costRef.current = { od: 0, spot: 0, ri: 0 };
    daysRef.current = 0;
    monthRef.current = 1;
    setBursty(false);
    setCost({ od: 0, spot: 0, ri: 0 });
    setDays(0);
    setMonth(1);
    setInterruptions(0);
    setSpotPhase("run");
    setSpotGen(1);
    setSpotBusy(false);
    setLines([]);
  };

  const savings = cost.od > 0 ? Math.max(0, Math.round((1 - cost.spot / cost.od) * 100)) : 0;
  const bestFit = bursty ? "SPOT" : "RESERVED";
  const tlActive = PRICING_TIMELINE.findIndex((p) => p.phase === spotPhase);

  return (
    <UseCaseShell
      title="USE CASE // PRICING MODELS — PAY 10x LESS FOR THE SAME INSTANCE"
      subtitle="ON-DEMAND $0.0464 · SPOT $0.0139 · RESERVED $0.021 — PER vCPU-HR CLASS WORKLOAD"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="ON-DEMAND 30-DAY" value={`$${cost.od.toFixed(2)}`} tone="aws" />
          <UCStat label="SPOT 30-DAY" value={`$${cost.spot.toFixed(2)}`} tone="magenta" />
          <UCStat label="RESERVED 30-DAY" value={`$${cost.ri.toFixed(2)}`} tone="mint" />
          <UCStat label="SAVINGS (SPOT vs OD)" value={`${savings}%`} tone={savings >= 40 ? "mint" : "neutral"} />
          <UCStat label="WORKLOAD" value={bursty ? "BURSTY" : "STEADY"} tone={bursty ? "magenta" : "neutral"} />
          <UCStat label="INTERRUPTIONS" value={interruptions} tone="danger" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `MONTH ${month} — DAY ${days}/30 BILLING` : "IDLE — PRESS RUN TO START THE 30-DAY TICKERS"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">WORKLOAD PROFILE</p>
          <div className="flex flex-wrap gap-2">
            <UCToggle
              on={!bursty}
              onClick={() => {
                workloadRef.current = false;
                setBursty(false);
                push("WORKLOAD → STEADY — 24/7 stateful load: reserved wins (commitment saves 55%, zero reclaim risk)", "aws");
                fire("BEST FIT → RESERVED", "aws");
              }}
              ariaLabel="Simulate a steady workload"
            >
              <Timer className="w-3 h-3" /> STEADY
            </UCToggle>
            <UCToggle
              on={bursty}
              accent="magenta"
              onClick={() => {
                workloadRef.current = true;
                setBursty(true);
                push("WORKLOAD → BURSTY — interruptible spiky jobs: spot wins (no commitment, scale to zero between bursts)", "magenta");
                fire("BEST FIT → SPOT", "ok");
              }}
              ariaLabel="Simulate a bursty workload"
            >
              <Zap className="w-3 h-3" /> BURSTY
            </UCToggle>
          </div>
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CHAOS</p>
          <UCButton
            onClick={() => {
              if (spotBusy) return;
              resetSpotSeq();
              setSpotBusy(true);
            }}
            tone="danger"
            disabled={spotBusy}
            ariaLabel="Trigger a spot interruption on the spot lane"
          >
            <Zap className="w-3 h-3" /> SPOT INTERRUPTION
          </UCButton>
          <p className="text-[7px] tracking-[0.15em] text-muted-foreground uppercase">
            best fit for {bursty ? "BURSTY" : "STEADY"}: <span className={bestFit === "SPOT" ? "text-magenta" : "text-mint"}>{bestFit}</span> — the tickers back it up
          </p>
        </>
      }
      logLines={lines}
      logTitle="PRICING LEDGER // LIVE"
      logEmpty="PRESS RUN — OR TOGGLE THE WORKLOAD AND FLIP THE BEST-FIT VERDICT"
    >
      <FlowCanvas ariaLabel="EC2 pricing models comparison stage" className="h-full">
        <div className="absolute inset-0 p-3 pt-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
            <PricingLane
              name="ON-DEMAND"
              rate="0.0464"
              cost={cost.od}
              best={false}
              tone="aws"
              meta="PAY-PER-SECOND · NO COMMITMENT · PEAK FLEXIBILITY"
              chip={
                <div className="flex items-center gap-1.5 border border-aws/40 bg-aws/[0.06] px-1.5 py-1">
                  <EC2Icon className="w-3 h-3 text-aws shrink-0" />
                  <span className="text-[7px] font-bold tracking-wider truncate">i-0d1 · OD</span>
                  <span className="ml-auto text-[6px] font-extrabold text-aws">RUNNING</span>
                </div>
              }
            />
            <PricingLane
              name="SPOT"
              rate="0.0139"
              cost={cost.spot}
              best={bestFit === "SPOT"}
              tone="magenta"
              meta="SPARE CAPACITY · UP TO 90% OFF · 2-MIN RECLAIM NOTICE"
              chip={
                <div className={`flex items-center gap-1.5 border px-1.5 py-1 ${SPOT_PHASE_CLS[spotPhase].box}`}>
                  <EC2Icon className={`w-3 h-3 shrink-0 ${SPOT_PHASE_CLS[spotPhase].text}`} />
                  <span className="text-[7px] font-bold tracking-wider truncate">i-0s{spotGen} · SPOT</span>
                  <span className={`ml-auto text-[6px] font-extrabold ${SPOT_PHASE_CLS[spotPhase].text}`}>{SPOT_PHASE_CLS[spotPhase].label}</span>
                </div>
              }
            />
            <PricingLane
              name="RESERVED"
              rate="0.0210"
              cost={cost.ri}
              best={bestFit === "RESERVED"}
              tone="mint"
              meta="1-YR COMMITMENT · 55% OFF · BILLS 24/7 — IDLE TIME WASTED"
              chip={
                <div className="flex items-center gap-1.5 border border-mint/40 bg-mint/[0.05] px-1.5 py-1">
                  <EC2Icon className="w-3 h-3 text-mint shrink-0" />
                  <span className="text-[7px] font-bold tracking-wider truncate">i-0r1 · RI</span>
                  <span className="ml-auto text-[6px] font-extrabold text-mint">COMMITTED</span>
                </div>
              }
            />
          </div>

          {/* spot 2-min drain — compressed interruption timeline */}
          <div className="glass-inset px-2.5 py-2 flex flex-wrap items-center gap-2">
            <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">SPOT DRAIN SEQ</span>
            {PRICING_TIMELINE.map((p, i) => (
              <span
                key={p.key}
                className={`text-[6.5px] font-extrabold border px-1.5 py-0.5 tracking-[0.15em] ${
                  tlActive === i ? "border-danger/70 text-danger box-glow" : "border-foreground/15 text-muted-foreground/60"
                }`}
              >
                {p.label}
              </span>
            ))}
            <span className="ml-auto text-[7px] tracking-[0.15em] text-muted-foreground uppercase tabular-nums">
              MONTH {month} · DAY {days}/30
            </span>
          </div>
        </div>

        <FlowLabel x={50} y={3.5} tone="aws">SAME INSTANCE CLASS — 3.3x PRICE SPREAD</FlowLabel>
        <VerdictFlash show={flash !== null} text={flash?.text ?? ""} tone={flash?.tone ?? "aws"} />
      </FlowCanvas>

      <UseCaseNote>
        steady 24/7 stateful → RESERVED (commitment, zero reclaim risk) · bursty interruptible → SPOT (checkpoint to S3,
        migrate on the 2-minute notice, resume — pay up to 90% less)
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — GOLDEN AMI: BUILD → LAUNCH → PATCH + REBAKE                */
/* ================================================================== */

interface AmiChip {
  id: string;
  v: number;
  phase: "boot" | "in-service" | "drain";
  ticks: number;
}

const PIPE_STEPS = [
  "BASELINE — AL2023 · T3.MICRO TEMPLATE",
  "INSTALL — NGINX · NODE-20 · AWS-CLI",
  "HARDEN — CIS L1 · 47 CONTROLS",
  "BAKE — SNAPSHOT → AMI REGISTERED",
];

const PIPE_PCT = [18, 44, 72, 100];

const freshAmiFleet = (): AmiChip[] => [];

function AmiPipelineCard({ busy, step, progress, amiVersion, buildTime }: { busy: boolean; step: number; progress: number; amiVersion: number; buildTime: number }) {
  const cursor = busy ? step : amiVersion > 0 ? 4 : -1;
  return (
    <div className="glass box-glow cyber-cut p-2.5">
      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-aws/15">
        <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
          <Layers className="w-3 h-3" /> GOLDEN PIPELINE
        </span>
        <span className={`text-[6.5px] font-extrabold px-1 py-0.5 border ${busy ? "border-neon/60 text-neon" : "border-foreground/15 text-muted-foreground"}`}>
          {busy ? "BUILDING…" : amiVersion > 0 ? "READY" : "IDLE"}
        </span>
      </div>
      <div className="flex flex-col gap-1 pt-1.5">
        {PIPE_STEPS.map((s, i) => {
          const done = cursor > i;
          const active = busy && cursor === i;
          return (
            <div
              key={s}
              className={`flex items-center gap-1.5 border px-1.5 py-1 ${
                active ? "border-neon/60 text-neon box-glow" : done ? "border-mint/40 text-mint" : "border-foreground/15 text-muted-foreground"
              }`}
            >
              <span className="text-[7px] font-extrabold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[6.5px] font-bold tracking-wider truncate">{s}</span>
              {done && <ShieldCheck className="w-2.5 h-2.5 ml-auto shrink-0" />}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <div className="h-1.5 flex-1 border border-aws/20 bg-black/60 overflow-hidden">
          <motion.div className="h-full bg-aws" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
        <span className="text-[7px] font-extrabold tabular-nums text-aws w-8 text-right">{progress}%</span>
      </div>
      <p className="text-[6px] text-muted-foreground tracking-wider pt-1.5 uppercase">
        LAST BAKE — {buildTime > 0 && amiVersion > 0 ? `v${amiVersion} · ${buildTime}s` : "—"}
      </p>
    </div>
  );
}

function AmiFleetChip({ chip, latest }: { chip: AmiChip; latest: number }) {
  const drift = chip.v < latest;
  const cls =
    chip.phase === "drain"
      ? "border-neon/60 bg-neon/10 text-neon"
      : drift
        ? "border-danger/60 bg-danger/10 text-danger"
        : chip.phase === "boot"
          ? "border-neon/60 bg-neon/10 text-neon"
          : "border-mint/50 bg-mint/[0.07] text-mint";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={`flex flex-col gap-1 px-2 py-1.5 border ${cls}`}
    >
      <div className="flex items-center gap-1.5 text-[8px] font-bold tracking-wider uppercase whitespace-nowrap">
        <EC2Icon className="w-3 h-3 shrink-0" />
        {chip.id}
        <span className={`border px-1 text-[6.5px] font-extrabold ${drift ? "border-danger/60" : "border-current"}`}>v{chip.v}</span>
      </div>
      <span className="text-[6.5px] font-bold tracking-[0.15em] uppercase opacity-80">
        {chip.phase === "drain" ? "DRAINING — REPLACING" : chip.phase === "boot" ? "BOOTING FROM AMI…" : drift ? "DRIFT — OLD AMI" : "IN-SERVICE"}
      </span>
    </motion.div>
  );
}

function GoldenAmiUseCase({ immersiveActive, immersiveToggle }: Ec2UseCasesProps) {
  const [running, setRunning] = useState(false);
  const [amiVersion, setAmiVersion] = useState(0);
  const [buildTime, setBuildTime] = useState(0);
  const [builds, setBuilds] = useState(0);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [fleet, setFleet] = useState<AmiChip[]>(freshAmiFleet);
  const [lines, setLines] = useState<LogLine[]>([]);
  const { flash, fire } = useFlash();

  const amiVerRef = useRef(0);
  const fleetRef = useRef<AmiChip[]>(freshAmiFleet());
  const rebakeRef = useRef(false);
  const idRef = useRef(1);
  const logId = useRef(1);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logId.current++, text, tone }]);

  /* pipeline — 4 steps fire from the interval callback */
  const { step: pipeStep, reset: resetPipe } = useScenarioRunner(4, pipelineBusy, 1150, (s) => {
    if (s === 0) {
      push("STEP 1/4 — BASELINE: amazon-linux-2023 + t3.micro launch template", "aws");
    } else if (s === 1) {
      push("STEP 2/4 — INSTALL: nginx · node-20 · aws-cli · cloudwatch agent", "aws");
    } else if (s === 2) {
      push("STEP 3/4 — HARDEN: CIS LEVEL 1 benchmark — 47 controls applied", "magenta");
    } else {
      const nv = amiVerRef.current + 1;
      const bt = 180 + Math.floor(Math.random() * 70);
      amiVerRef.current = nv;
      setAmiVersion(nv);
      setBuildTime(bt);
      setBuilds((b) => b + 1);
      push(`STEP 4/4 — BAKE: snapshot complete — AMI v${nv} registered (${bt}s, encrypted)`, "mint");
      fire(`AMI v${nv} BAKED`, "ok");
      if (rebakeRef.current) {
        rebakeRef.current = false;
        const list = fleetRef.current.map((c) => ({ ...c, v: nv, phase: "boot" as const, ticks: 2 }));
        fleetRef.current = list;
        setFleet(list);
        push(`FLEET RELAUNCHED ON AMI v${nv} — blue/green style replace — DRIFT 0`, "mint");
      } else if (fleetRef.current.length > 0) {
        push(`FLEET DRIFT — ${fleetRef.current.length} instance(s) still on AMI v${nv - 1} — PATCH + REBAKE to converge`, "danger");
      }
      setPipelineBusy(false);
    }
  });

  /* boot countdown for chips arriving from a launch / rebake */
  const booting = fleet.some((c) => c.phase === "boot");
  useTicker(booting, () => {
    const list = fleetRef.current;
    let changed = false;
    list.forEach((c) => {
      if (c.phase === "boot") {
        c.ticks -= 1;
        changed = true;
        if (c.ticks <= 0) {
          c.phase = "in-service";
          push(`${c.id} status checks 2/2 — IN-SERVICE on AMI v${c.v}`, "dim");
        }
      }
    });
    if (changed) {
      fleetRef.current = list;
      setFleet([...list]);
    }
  }, 900);

  const doBuild = () => {
    if (pipelineBusy) return;
    push(`GOLDEN PIPELINE TRIGGERED — baking AMI v${amiVerRef.current + 1}`, "aws");
    setPipelineBusy(true);
  };

  const doLaunch = () => {
    if (pipelineBusy) return;
    if (amiVerRef.current === 0) {
      push("LAUNCH BLOCKED — no AMI yet — BUILD AMI first", "danger");
      return;
    }
    const need = 3 - fleetRef.current.length;
    if (need <= 0) {
      push("FLEET FULL — 3/3 in service — scale limit reached", "dim");
      return;
    }
    const list = [...fleetRef.current];
    for (let k = 0; k < need; k++) {
      list.push({ id: `i-0g${String(idRef.current).padStart(2, "0")}`, v: amiVerRef.current, phase: "boot", ticks: 2 });
      idRef.current += 1;
    }
    fleetRef.current = list;
    setFleet(list);
    push(`LAUNCHING ${need} × t3.micro FROM AMI v${amiVerRef.current} — user-data bootstrapping`, "mint");
  };

  const doPatch = () => {
    if (pipelineBusy) return;
    if (fleetRef.current.length === 0) {
      push("NOTHING TO PATCH — no fleet running (build + launch first)", "dim");
      return;
    }
    const drifted = fleetRef.current.filter((c) => c.v < amiVerRef.current).length;
    if (drifted === 0) {
      push("FLEET ALREADY ON LATEST AMI — zero drift, nothing to rebake", "dim");
      return;
    }
    push(`PATCH WINDOW — draining ${drifted} instance(s) on old AMI — rebaking v${amiVerRef.current + 1}`, "neon");
    const list = fleetRef.current.map((c) => ({ ...c, phase: "drain" as const }));
    fleetRef.current = list;
    setFleet(list);
    rebakeRef.current = true;
    setPipelineBusy(true);
  };

  const reset = () => {
    setRunning(false);
    resetPipe();
    amiVerRef.current = 0;
    fleetRef.current = freshAmiFleet();
    rebakeRef.current = false;
    idRef.current = 1;
    setAmiVersion(0);
    setBuildTime(0);
    setBuilds(0);
    setPipelineBusy(false);
    setFleet(freshAmiFleet());
    setLines([]);
  };

  const drift = fleet.filter((c) => c.v < amiVersion || c.phase === "drain").length;
  const inService = fleet.filter((c) => c.phase === "in-service").length;
  const progress = pipelineBusy ? PIPE_PCT[Math.min(3, pipeStep)] : amiVersion > 0 ? 100 : 0;

  return (
    <UseCaseShell
      title="USE CASE // GOLDEN AMI — SNOWFLAKE SERVERS ARE THE ENEMY"
      subtitle="BUILD ONCE → LAUNCH IDENTICAL FLEET → PATCH FORWARD, NEVER IN PLACE"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="AMI VERSIONS" value={amiVersion || "—"} />
          <UCStat label="FLEET SIZE" value={`${inService}/3`} tone="mint" />
          <UCStat label="BUILD TIME S" value={buildTime > 0 ? `${buildTime}s` : "—"} tone="neutral" />
          <UCStat label="DRIFT (OLD AMI)" value={drift} tone={drift > 0 ? "danger" : "mint"} />
          <UCStat label="BAKES" value={builds} tone="neon" />
          <UCStat label="LATEST AMI" value={amiVersion > 0 ? `v${amiVersion}` : "—"} tone="magenta" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={pipelineBusy ? "PIPELINE RUNNING — DO NOT POWER OFF THE BUILDER" : "IDLE — BUILD AN AMI OR PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">GOLDEN IMAGE ACTIONS</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={doBuild} disabled={pipelineBusy} ariaLabel="Run the golden AMI build pipeline">
              <Layers className="w-3 h-3" /> BUILD AMI
            </UCButton>
            <UCButton onClick={doLaunch} tone="mint" disabled={pipelineBusy} ariaLabel="Launch a fleet of three instances from the latest AMI">
              <Rocket className="w-3 h-3" /> LAUNCH FLEET
            </UCButton>
            <UCButton onClick={doPatch} tone="magenta" disabled={pipelineBusy} ariaLabel="Patch and rebake the AMI, then relaunch the fleet on it">
              <Wrench className="w-3 h-3" /> PATCH + REBAKE
            </UCButton>
          </div>
          <p className="text-[7px] tracking-[0.15em] text-muted-foreground uppercase">
            drift = fleet instances still running an older AMI than the latest bake
          </p>
        </>
      }
      logLines={lines}
      logTitle="GOLDEN IMAGE LOG // LIVE"
      logEmpty="PRESS BUILD AMI — INSTALL → HARDEN → BAKE → LAUNCH THE FLEET"
    >
      <FlowCanvas ariaLabel="EC2 golden AMI pipeline diagram" className="h-full">
        {/* pipeline → AMI → fleet links */}
        <FlowLink d="M31,42 C37,42 40,40 44,38" status={pipelineBusy ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M57,44 C61,48 62,50 64,50" status={booting ? "flowing" : "idle"} dotDuration={1.2} />

        {/* pipeline card */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="absolute z-10 w-[28%] min-w-[180px]" style={{ left: "4%", top: "16%" }}>
          <AmiPipelineCard busy={pipelineBusy} step={pipeStep} progress={progress} amiVersion={amiVersion} buildTime={buildTime} />
        </motion.div>

        {/* AMI node */}
        <FlowNode
          x={50}
          y={38}
          size="md"
          delay={0.25}
          icon={<Package className="w-4 h-4" />}
          label={amiVersion > 0 ? `AMI v${amiVersion}` : "AMI v—"}
          sub={amiVersion > 0 ? "ENCRYPTED · CIS L1" : "NOT BUILT"}
          status={amiVersion > 0 ? "active" : "idle"}
          pulse={pipelineBusy}
        />

        {/* fleet boundary */}
        <div className="absolute border border-dashed border-mint/40 bg-mint/[0.02] p-2.5" style={{ left: "64%", right: "3%", top: "24%", bottom: "22%" }}>
          <div className="flex flex-wrap items-center justify-between gap-1 pb-2">
            <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-mint/85">
              <Rocket className="w-3 h-3 shrink-0" />
              FLEET :: golden-fleet
            </span>
            <span className="text-[7.5px] tracking-wider text-muted-foreground uppercase">
              {inService}/3 · DRIFT {drift}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {fleet.map((c) => (
                <AmiFleetChip key={c.id} chip={c} latest={amiVersion} />
              ))}
            </AnimatePresence>
            {Array.from({ length: Math.max(0, 3 - fleet.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-1.5 border border-dashed border-foreground/15 px-2 py-1.5 text-[7px] tracking-wider text-muted-foreground/50 uppercase">
                <EC2Icon className="w-3 h-3 shrink-0" />
                EMPTY SLOT — LAUNCH FLEET
              </div>
            ))}
          </div>
        </div>

        <FlowLabel x={50} y={9} tone="aws">BUILD ONCE → PATCH FORWARD → EVERY LAUNCH IDENTICAL</FlowLabel>
        <FlowLabel x={50} y={92} tone={drift > 0 ? "danger" : "mint"}>
          {drift > 0 ? `${drift} INSTANCE(S) ON AN OLD AMI — PATCH + REBAKE TO CONVERGE` : "FLEET CONVERGED — ZERO CONFIG DRIFT"}
        </FlowLabel>

        {pipelineBusy && <StepBadge step={pipeStep} total={4} text={PIPE_STEPS[Math.min(3, pipeStep)]} />}
        <VerdictFlash show={flash !== null} text={flash?.text ?? ""} tone={flash?.tone ?? "aws"} />
      </FlowCanvas>

      <UseCaseNote>
        patch the AMI, not the servers: v2 bakes CIS hardening in, the fleet relaunches on it, and config drift is
        structurally impossible — termination is always safe
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function Ec2UseCases({ id, immersiveActive, immersiveToggle }: Ec2UseCasesProps) {
  if (id === "AUTO_SCALING") return <AutoScalingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "PRICING") return <PricingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <GoldenAmiUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
