"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { AutoLog, logTs } from "@/components/shared/auto-log";
import { VPCIcon, InternetIcon, ELBIcon, EC2Icon, RDSIcon, InternetGatewayIcon, NatGatewayIcon, AWSIconTile, AWS_EXTRA_ICONS } from "@/components/aws-icons";
import { ShieldCheck, ShieldAlert, Power, Terminal } from "lucide-react";

/* ------------------------------------------------------------------ */
/* VPC — VOID NETWORK: packet-trace architecture                        */
/* ------------------------------------------------------------------ */

type ViewMode = "sg" | "nacl";

const MAX_LOG = 60;
const BG_POOL = ["LB-B", "NAT-B", "EC2-B1", "EC2-B2", "RDS-B"];

/* tone keys for the shared AutoLog (classes preserved from the legacy renderer) */
const TRACE_TONES: Record<string, string> = {
  danger: "text-danger",
  mint: "text-mint",
  sep: "text-muted-foreground/70",
  plain: "text-foreground/70",
};

function logTone(line: string): string {
  if (line.includes("> ✕")) return "danger";
  if (line.includes("STATEFUL") || line.includes("trace complete")) return "mint";
  if (line.includes("> ───")) return "sep";
  return "plain";
}

const armedLine = () => `[${logTs()}] > packet tracer armed — press RUN or STEP TRACE`;

interface SubnetBoxProps {
  left: string;
  top: string;
  width: string;
  height: string;
  label: string;
  rt: string;
  danger?: boolean;
  tile?: string;
}

function SubnetBox({ left, top, width, height, label, rt, danger, tile }: SubnetBoxProps) {
  return (
    <div
      className={`absolute border border-dashed z-[2] ${danger ? "border-danger/50 bg-danger/[0.03]" : "border-aws/30"}`}
      style={{ left, top, width, height }}
      aria-hidden="true"
    >
      <span className={`absolute top-0.5 left-1.5 flex items-center gap-1 text-[6px] font-bold tracking-[0.15em] uppercase ${danger ? "text-danger/90" : "text-aws/70"}`}>
        {tile && <AWSIconTile src={tile} className="w-3 h-3 shrink-0" alt="" />}
        {label}
      </span>
      <span className="absolute bottom-0.5 right-1.5 text-[5.5px] tracking-wider text-muted-foreground/70 uppercase">{rt}</span>
    </div>
  );
}

export default function VPCVisualizer() {
  const [view, setView] = useState<ViewMode>("sg");
  const [natOn, setNatOn] = useState(true);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [log, setLog] = useState<string[]>(() => [armedLine()]);
  const [natFail, setNatFail] = useState(false);
  const [naclFail, setNaclFail] = useState(false);
  const [bg, setBg] = useState<string | null>(null);

  // refs-as-truth: interval mutates refs, flush once per tick
  const viewRef = useRef<ViewMode>("sg");
  const natOnRef = useRef(true);
  const stepRef = useRef(0);
  const logRef = useRef<string[]>(log); // seeded from initial state — only ever replaced with fresh arrays
  const natFailRef = useRef(false);
  const naclFailRef = useRef(false);
  const bgRef = useRef<string | null>(null);
  const traceNRef = useRef(0);

  const flush = useCallback(() => {
    setStep(stepRef.current);
    setLog([...logRef.current]);
    setNatFail(natFailRef.current);
    setNaclFail(naclFailRef.current);
    setBg(bgRef.current);
  }, []);

  const tick = useCallback(() => {
    const pushLog = (line: string) => {
      logRef.current = [...logRef.current, `[${logTs()}] ${line}`].slice(-MAX_LOG);
    };
    // ambient AZ-B background traffic so the mesh feels alive
    bgRef.current = Math.random() < 0.45 ? BG_POOL[Math.floor(Math.random() * BG_POOL.length)] : null;

    const st = stepRef.current;
    if (st === 0) {
      traceNRef.current += 1;
      pushLog(`> trace #${String(traceNRef.current).padStart(3, "0")} — new packet: TCP SYN :443 → 10.0.2.17`);
      stepRef.current = 1;
    } else if (st === 1) {
      pushLog("> 1. arrives IGW — route 0.0.0.0/0 → local VPC");
      stepRef.current = 2;
    } else if (st === 2) {
      pushLog("> 2. NACL PUBLIC-A: rule 100 ALLOW TCP:443 IN — forwarded to LB");
      stepRef.current = 3;
    } else if (st === 3) {
      pushLog("> 3. SG EC2-A1 accepts :443 — stateful connection entry created");
      stepRef.current = 4;
    } else if (st === 4) {
      if (natOnRef.current) {
        pushLog("> 4. NAT GW-A translates 10.0.2.17:49152 → egress via IGW");
        stepRef.current = 5;
      } else {
        natFailRef.current = true;
        pushLog("> ✕ 4. NAT GW-A OFFLINE — private subnet has NO ROUTE TO INTERNET (blackhole)");
        stepRef.current = 6;
      }
    } else if (st === 5) {
      if (viewRef.current === "sg") {
        pushLog("> 5. response returns — SG STATEFUL: return flow auto-allowed");
        stepRef.current = 6;
      } else {
        naclFailRef.current = true;
        pushLog("> ✕ 5. response DROPPED — NACL STATELESS: ephemeral return ports not remembered");
        stepRef.current = 6;
      }
    } else {
      pushLog("> ─── trace complete — next packet queued ───");
      stepRef.current = 0;
      natFailRef.current = false;
      naclFailRef.current = false;
    }
    flush();
  }, [flush]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(tick, 1100);
    return () => clearInterval(timer);
  }, [running, tick]);

  const reset = () => {
    setRunning(false);
    stepRef.current = 0;
    logRef.current = [armedLine()];
    natFailRef.current = false;
    naclFailRef.current = false;
    bgRef.current = null;
    flush();
  };

  const selectView = (v: ViewMode) => {
    setView(v);
    viewRef.current = v;
  };

  const toggleNat = () => {
    setNatOn((v) => {
      natOnRef.current = !v;
      return !v;
    });
  };

  const blocked = natFail || naclFail;
  const pathLive = step >= 1 && step <= 5;

  return (
    <div className="flex flex-col gap-4">
      {/* MAIN GRID — ANIMATION LEFT / RAIL RIGHT */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <GlassPanel
          title="FLOW VIEW // PACKET TRACER TOPOLOGY"
          subtitle="INTERNET → IGW → NACL → SG → NAT — STATEFUL VS STATELESS"
          className="!p-0 overflow-hidden"
          delay={0.05}
        >
          <FlowCanvas className="h-[440px] sm:h-[540px] lg:h-[560px]" ariaLabel="VPC packet trace network diagram">
            {/* SUBNET BOUNDARIES (no fill — SVG links stay visible beneath) */}
            <SubnetBox left="3%" top="36%" width="43%" height="23%" label={"PUBLIC-SUBNET-A // 10.0.1.0/24"} rt="RT: PUBLIC-RT" tile={AWS_EXTRA_ICONS.publicSubnet} danger={view === "nacl"} />
            <SubnetBox left="3%" top="62%" width="43%" height="32%" label={"PRIVATE-SUBNET-A // 10.0.2.0/24"} rt="RT: PRIVATE-RT-A" tile={AWS_EXTRA_ICONS.privateSubnet} danger={blocked} />
            <SubnetBox left="54%" top="36%" width="43%" height="23%" label={"PUBLIC-SUBNET-B // 10.0.11.0/24"} rt="RT: PUBLIC-RT" tile={AWS_EXTRA_ICONS.publicSubnet} />
            <SubnetBox left="54%" top="62%" width="43%" height="32%" label={"PRIVATE-SUBNET-B // 10.0.12.0/24"} rt="RT: PRIVATE-RT-B" tile={AWS_EXTRA_ICONS.privateSubnet} />

            {/* LINKS */}
            <FlowLink d="M50,11.5 C50,14 50,15 50,17.5" status={pathLive ? "flowing" : "idle"} dotDuration={0.9} />
            <FlowLink d="M48,26 C40,31 35,36 30.5,42" status={step >= 2 && step <= 5 ? "flowing" : "idle"} dotDuration={1.1} dotDelay={0.15} />
            <FlowLink d="M25,47 C22,47 20,47 17.5,47" status={step >= 3 && step <= 5 ? "flowing" : "idle"} dotDuration={0.8} dotDelay={0.1} />
            <FlowLink
              d="M12,51 C12,57 12,63 11,69"
              status={natFail ? "error" : step >= 3 && step <= 5 ? "flowing" : "idle"}
              dotDuration={1}
              dotDelay={0.2}
            />
            <FlowLink
              d="M7,73 C-2,55 6,30 45,17.5"
              status={step === 5 ? (view === "sg" ? "success" : "error") : "idle"}
              dotDuration={1.6}
            />

            {/* EDGE */}
            <FlowLabel x={13} y={7} tone="aws">
              <span className="flex items-center gap-1">
                <VPCIcon className="w-2.5 h-2.5" />
                VPC 10.0.0.0/16
              </span>
            </FlowLabel>
            <FlowLabel x={87} y={7} tone="default">REGION US-EAST-1</FlowLabel>

            <FlowNode
              x={50}
              y={7}
              icon={<InternetIcon className="w-3 h-3" />}
              label="INTERNET"
              sub="CLIENT"
              status={pathLive ? "active" : "idle"}
              size="sm"
              delay={0.1}
            />
            <FlowNode
              x={50}
              y={22}
              icon={<InternetGatewayIcon className="w-3 h-3" />}
              label="INTERNET GATEWAY"
              sub="IGW — VPC EDGE"
              status={step === 1 ? "active" : step >= 2 ? "success" : "idle"}
              pulse={step === 1}
              size="sm"
              delay={0.2}
            />

            <FlowLabel x={24} y={31} tone="aws">AZ-A // US-EAST-1A</FlowLabel>
            <FlowLabel x={78} y={31} tone="default">AZ-B // US-EAST-1B</FlowLabel>
            <FlowLabel x={24} y={60.5} tone={view === "sg" ? "mint" : "danger"}>
              {view === "sg" ? "SG STATEFUL — RETURN AUTO-ALLOWED" : "NACL STATELESS — RETURN NOT TRACKED"}
            </FlowLabel>

            {/* AZ-A PUBLIC */}
            <FlowNode
              x={29}
              y={47}
              icon={<ELBIcon className="w-3 h-3" />}
              label="LB-A"
              sub="10.0.1.10"
              status={step === 2 ? "active" : step >= 3 && step <= 5 ? "success" : "idle"}
              pulse={step === 2}
              size="xs"
              delay={0.3}
            />
            <FlowNode
              x={12}
              y={47}
              icon={<NatGatewayIcon className="w-3 h-3" />}
              label="NAT-A"
              sub="10.0.1.4"
              status={natFail ? "error" : (step === 4 || step === 5) && natOn ? "active" : "idle"}
              pulse={step === 4 && natOn}
              size="xs"
              delay={0.35}
            />

            {/* AZ-A PRIVATE */}
            <FlowNode
              x={11}
              y={73}
              icon={<EC2Icon className="w-3 h-3" />}
              label="EC2-A1"
              sub="10.0.2.17"
              status={step === 3 ? "active" : step === 5 ? (view === "sg" ? "success" : naclFail ? "error" : "idle") : naclFail ? "error" : "idle"}
              pulse={step === 3}
              size="xs"
              delay={0.4}
            />
            <FlowNode x={21} y={73} icon={<EC2Icon className="w-3 h-3" />} label="EC2-A2" sub="10.0.2.18" status="idle" size="xs" delay={0.45} />
            <FlowNode x={33} y={73} icon={<RDSIcon className="w-3 h-3" />} label="RDS-A" sub="10.0.2.50" status="idle" size="xs" delay={0.5} />

            {/* AZ-B — mirrored stack with ambient traffic */}
            <FlowNode
              x={80}
              y={47}
              icon={<ELBIcon className="w-3 h-3" />}
              label="LB-B"
              sub="10.0.11.10"
              status={bg === "LB-B" ? "active" : "idle"}
              size="xs"
              delay={0.55}
            />
            <FlowNode
              x={63}
              y={47}
              icon={<NatGatewayIcon className="w-3 h-3" />}
              label="NAT-B"
              sub="10.0.11.4"
              status={bg === "NAT-B" ? "active" : "idle"}
              size="xs"
              delay={0.6}
            />
            <FlowNode
              x={63}
              y={73}
              icon={<EC2Icon className="w-3 h-3" />}
              label="EC2-B1"
              sub="10.0.12.17"
              status={bg === "EC2-B1" ? "active" : "idle"}
              size="xs"
              delay={0.65}
            />
            <FlowNode
              x={76}
              y={73}
              icon={<RDSIcon className="w-3 h-3" />}
              label="RDS-B"
              sub="10.0.12.50"
              status={bg === "RDS-B" ? "active" : "idle"}
              size="xs"
              delay={0.7}
            />
            <FlowNode
              x={88}
              y={73}
              icon={<EC2Icon className="w-3 h-3" />}
              label="EC2-B2"
              sub="10.0.12.18"
              status={bg === "EC2-B2" ? "active" : "idle"}
              size="xs"
              delay={0.75}
            />

            {/* BLOCKED OVERLAY */}
            <AnimatePresence>
              {blocked && (
                <motion.div
                  key={natFail ? "nat" : "nacl"}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-1 border border-danger/70 bg-black/80 text-danger text-[8px] font-extrabold uppercase tracking-[0.18em] cyber-cut-sm"
                  style={{ left: "24.5%", top: "88%" }}
                  role="status"
                >
                  {natFail ? "✕ NO ROUTE TO INTERNET" : "✕ RETURN DROPPED — STATELESS"}
                </motion.div>
              )}
            </AnimatePresence>
          </FlowCanvas>
        </GlassPanel>

        {/* RIGHT RAIL — LIVE STATS + CONTROLS */}
        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip label="VPC CIDR" value="10.0.0.0/16" tone="neutral" />
              <StatChip label="AVAILABILITY ZONES" value="2" />
              <StatChip label="SUBNETS PUB/PRIV" value="2 / 2" />
              <StatChip label="ROUTE TABLES" value="3" tone="neutral" />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={() => setRunning((r) => !r)}
                onReset={reset}
                status={running ? "TRACEROUTE LIVE — PACKETS FLOWING" : "TRACER IDLE — PRESS RUN"}
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">FILTER ENGINE VIEW</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectView("sg")}
                  aria-pressed={view === "sg"}
                  aria-label="View security group stateful behaviour"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                    view === "sg" ? "border-mint/60 text-mint bg-mint/10" : "border-foreground/25 text-muted-foreground"
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  SG STATEFUL
                </button>
                <button
                  type="button"
                  onClick={() => selectView("nacl")}
                  aria-pressed={view === "nacl"}
                  aria-label="View network ACL stateless behaviour"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                    view === "nacl" ? "border-danger/60 text-danger bg-danger/10" : "border-foreground/25 text-muted-foreground"
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  NACL STATELESS
                </button>
              </div>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">EGRESS + TRACE</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleNat}
                  aria-label="Toggle NAT Gateway power state"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                    natOn ? "border-mint/60 text-mint" : "border-danger/60 text-danger"
                  }`}
                >
                  <Power className="w-3 h-3" />
                  NAT GATEWAY {natOn ? "ON" : "OFF"}
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={tick}
                  aria-label="Advance one packet-trace hop"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border border-aws/60 text-aws bg-black/50 backdrop-blur-md cyber-cut-sm hover:bg-aws/10"
                >
                  <Terminal className="w-3 h-3" />
                  STEP TRACE
                </motion.button>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* PACKET TRACE — full width below the grid */}
      <GlassPanel title="PACKET TRACE — HOP-BY-HOP" className="!p-0" delay={0.18}>
        <div className="p-3">
          <AutoLog
            lines={log.map((t, i) => ({ id: i, text: t }))}
            toneOf={logTone}
            tones={TRACE_TONES}
            emptyText="// packet trace empty"
          />
        </div>
      </GlassPanel>

      {/* KNOWLEDGE */}
      <div className="grid md:grid-cols-3 gap-3">
        <Callout type="exam" title="Security Groups vs NACLs">
          <span className="text-aws">SGs are STATEFUL</span> — allowed inbound traffic returns automatically; ALL rules are
          evaluated before a decision. <span className="text-danger">NACLs are STATELESS</span> — return traffic needs an
          explicit inbound rule for ephemeral ports (1024-65535), evaluated in{" "}
          <span className="text-danger">numbered order, first match wins</span>.
        </Callout>
        <Callout type="tip" title="NAT lives in the PUBLIC subnet">
          A NAT Gateway must be launched into a public subnet with a public route table (0.0.0.0/0 → IGW). The private
          route table then points 0.0.0.0/0 at the <span className="text-mint">nat-gw-id</span> — never at the IGW, or
          your "private" instances become internet-reachable.
        </Callout>
        <Callout type="info" title="VPC peering is non-transitive">
          A ↔ B and B ↔ C does NOT give A ↔ C. Every peering connection is a direct 1:1 link with no single point of
          failure or bandwidth bottleneck — but full mesh explodes combinatorially, which is exactly why{" "}
          <span className="text-aws">AWS Transit Gateway</span> exists for hub-and-spoke at scale.
        </Callout>
      </div>
    </div>
  );
}
