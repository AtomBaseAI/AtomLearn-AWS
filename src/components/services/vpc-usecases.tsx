"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ban,
  Download,
  Globe,
  ShieldAlert,
  ShieldCheck,
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
import {
  EC2Icon,
  ELBIcon,
  InternetGatewayIcon,
  InternetIcon,
  NatGatewayIcon,
  RDSIcon,
  VPCIcon,
} from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES + HELPERS                                              */
/* ================================================================== */

export type VpcUseCaseId = "THREE_TIER" | "NAT" | "SG_NACL";

interface VpcUseCasesProps {
  id: VpcUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

interface UCLine {
  id: number;
  text: string;
  tone?: string;
}

/* hoisted — horizontal subnet strip for the three-tier stage */
function TierBand({ top, height, label, cidr, danger }: { top: string; height: string; label: string; cidr: string; danger?: boolean }) {
  return (
    <div
      className={`absolute left-[4%] right-[4%] border border-dashed z-[2] ${danger ? "border-danger/40" : "border-aws/25"}`}
      style={{ top, height }}
      aria-hidden="true"
    >
      <span className={`absolute top-0.5 left-1.5 text-[6px] font-bold tracking-[0.15em] uppercase ${danger ? "text-danger/80" : "text-aws/70"}`}>{label}</span>
      <span className="absolute bottom-0.5 right-1.5 text-[5.5px] tracking-wider text-muted-foreground/70 uppercase">{cidr}</span>
    </div>
  );
}

/* hoisted — generic dashed subnet box for the NAT stage */
function NetBand({ left, top, width, height, label, danger }: { left: string; top: string; width: string; height: string; label: string; danger?: boolean }) {
  return (
    <div
      className={`absolute border border-dashed z-[2] ${danger ? "border-danger/40" : "border-aws/25"}`}
      style={{ left, top, width, height }}
      aria-hidden="true"
    >
      <span className={`absolute top-0.5 left-1.5 text-[6px] font-bold tracking-[0.15em] uppercase ${danger ? "text-danger/80" : "text-aws/70"}`}>{label}</span>
    </div>
  );
}

/* hoisted — tiny SG rule chip pinned next to a hop */
function SgChip({ left, top, text, tone }: { left: string; top: string; text: string; tone: "aws" | "neon" | "mint" }) {
  const cls =
    tone === "mint"
      ? "text-mint border-mint/40"
      : tone === "neon"
        ? "text-neon border-neon/40"
        : "text-aws border-aws/40";
  return (
    <div className={`absolute -translate-x-1/2 -translate-y-1/2 z-[6] px-1.5 py-0.5 border bg-black/70 backdrop-blur-sm text-[6px] font-bold tracking-[0.12em] uppercase whitespace-nowrap ${cls}`} style={{ left, top }}>
      {text}
    </div>
  );
}

/* ================================================================== */
/* TAB 02 — THREE-TIER WEB APP (SEGMENTED ALB → APP → DATA)            */
/* ================================================================== */

const TIER_STEPS = ["CLIENT TLS :443", "ALB → APP :8080", "APP → RDS :5432", "ROWS → APP", "HTML → CLIENT", "ROUND TRIP"];

function ThreeTierUseCase({ immersiveActive, immersiveToggle }: VpcUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [attack, setAttack] = useState(false);
  const [blocked, setBlocked] = useState(0);
  const [served, setServed] = useState(0);
  const [p99, setP99] = useState(34);
  const [flash, setFlash] = useState<null | "deny">(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const fxT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  useTicker(running, () => setP99(21 + Math.floor(Math.random() * 28)), 1500);

  // scenario: client → ALB → APP → RDS → rows → HTML → settle
  const { step, reset: resetStep } = useScenarioRunner(6, running, 1800, (s) => {
    if (s === 0) push("client TLS :443 → ALB — sg-alb ingress 0.0.0.0/0 tcp/443 — healthy", "aws");
    else if (s === 1) push("ALB → APP :8080 — sg-app ingress = sg-alb ONLY — target registered", "neon");
    else if (s === 2) push("APP → RDS :5432 — sg-db ingress = sg-app ONLY — parameterized query", "mint");
    else if (s === 3) push("row set → APP — SG connection tracking auto-allows the return path", "aws");
    else if (s === 4) {
      setServed((n) => n + 1);
      push(`HTML → ALB → client — 200 OK · p99 ~${p99}ms`, "mint");
    } else push("three-tier round trip complete — the DB never left the isolated subnet", "dim");
  });

  const attackDb = () => {
    setBlocked((n) => n + 1);
    setAttack(true);
    setFlash("deny");
    if (fxT.current) clearTimeout(fxT.current);
    fxT.current = setTimeout(() => {
      setAttack(false);
      setFlash(null);
    }, 2100);
    push("DIRECT DB ATTEMPT — 203.0.113.9 → 10.0.3.50:5432 (bypassing the ALB)", "danger");
    push("✕ DROPPED — isolated subnet has no IGW route + sg-db denies 0.0.0.0/0 — defense in depth holds", "danger");
  };

  const reset = () => {
    setRunning(false);
    resetStep();
    setAttack(false);
    setBlocked(0);
    setServed(0);
    setFlash(null);
    setLines([]);
  };

  useEffect(() => () => { if (fxT.current) clearTimeout(fxT.current); }, []);

  return (
    <UseCaseShell
      title="USE CASE // THREE-TIER WEB APP — SUBNET SEGMENTATION"
      subtitle="INTERNET → ALB (PUBLIC) → APP EC2 (PRIVATE) → RDS (ISOLATED) — EACH TIER LOCKED BY ITS SG"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="TIERS" value={3} />
          <UCStat label="BLOCKED ATTEMPTS" value={blocked} tone={blocked > 0 ? "danger" : "neutral"} />
          <UCStat label="P99 LATENCY" value={`~${p99}ms`} tone="neon" />
          <UCStat label="PUBLIC DB ROUTES" value={0} tone="mint" />
          <UCStat label="REQUESTS SERVED" value={served} tone="aws" />
          <UCStat label="SG RULE SETS" value={3} tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "TIER TRAFFIC LIVE — CHAINED HOPS FLOWING" : "IDLE — PRESS RUN TO SERVE TRAFFIC"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">ADVERSARY CONSOLE</p>
          <UCButton onClick={attackDb} tone="danger" ariaLabel="Attempt to reach the database directly from the internet">
            <Ban className="w-3 h-3" /> ATTEMPT DIRECT DB ACCESS
          </UCButton>
        </>
      }
      logLines={lines}
      logTitle="SEGMENTATION LOG // LIVE"
      logEmpty="PRESS RUN — WATCH A REQUEST TRAVERSE ALL THREE TIERS"
    >
      <FlowCanvas ariaLabel="VPC three-tier web app use case diagram" className="h-full">
        <TierBand top="22%" height="17%" label="PUBLIC SUBNET — TIER 1" cidr="10.0.1.0/24 · ALB" danger={false} />
        <TierBand top="44%" height="17%" label="PRIVATE SUBNET — TIER 2" cidr="10.0.2.0/24 · APP ASG" danger={false} />
        <TierBand top="66%" height="17%" label="ISOLATED SUBNET — TIER 3" cidr="10.0.3.0/24 · DATA" danger={attack} />

        <FlowLink d="M50,13 C50,16 50,18 50,22" status={running ? "flowing" : "idle"} dotDuration={0.9} />
        <FlowLink d="M50,34 C50,38 50,40 50,44" status={running ? "flowing" : "idle"} dotDuration={0.9} dotDelay={0.2} />
        <FlowLink d="M50,56 C50,60 50,62 50,66" status={running ? "success" : "idle"} dotDuration={0.9} dotDelay={0.4} />
        <FlowLink d="M54,11 C80,20 84,56 55,72" status={attack ? "error" : "idle"} dotDuration={1.5} dashed />

        <FlowNode x={50} y={9} size="sm" delay={0.1} icon={<Globe className="w-3 h-3" />} label="INTERNET" sub="CLIENTS" status={running || attack ? "active" : "idle"} pulse={running} />
        <FlowNode x={50} y={30} size="sm" delay={0.2} icon={<ELBIcon className="w-3 h-3" />} label="ALB" sub="PUBLIC ENTRY · TLS TERM" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={50} y={52} size="sm" delay={0.3} icon={<EC2Icon className="w-3 h-3" />} label="APP EC2" sub="ASG · APP TIER" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={50} y={74} size="sm" delay={0.4} icon={<RDSIcon className="w-3 h-3" />} label="RDS" sub="MULTI-AZ · :5432" status={attack ? "error" : running ? "success" : "idle"} pulse={running && !attack} />

        {/* SG CHIPS — one per hop */}
        <SgChip left="74" top="30" text="SG-ALB · 0.0.0.0/0 :443" tone="aws" />
        <SgChip left="76" top="52" text="SG-APP · sg-alb ONLY :8080" tone="neon" />
        <SgChip left="78" top="74" text="SG-DB · sg-app ONLY :5432" tone={attack ? "aws" : "mint"} />

        <AnimatePresence>
          {attack && (
            <motion.span
              key="attack"
              initial={{ opacity: 0, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 text-[8px] font-extrabold tracking-[0.2em] text-danger"
              style={{ left: "62%", top: "65%" }}
            >
              ✕ DROP
            </motion.span>
          )}
        </AnimatePresence>

        <FlowLabel x={16} y={12} tone="aws">TIERED SEGMENTATION — ONLY THE FRONT DOOR FACES THE INTERNET</FlowLabel>
        <StepBadge step={step} total={6} text={TIER_STEPS[step]} />
      </FlowCanvas>

      <VerdictFlash show={flash === "deny"} text="BLOCKED — NO PUBLIC ROUTE" tone="deny" />
      <UseCaseNote>
        PUBLIC / PRIVATE / ISOLATED SUBNETS + ONE SG PER TIER: A COMPROMISED APP BOX STILL CANNOT EXFILTRATE THE DATABASE
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — NAT GATEWAY (EGRESS-ONLY FOR PRIVATE SUBNETS)              */
/* ================================================================== */

function NatUseCase({ immersiveActive, immersiveToggle }: VpcUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [allowInbound, setAllowInbound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pct, setPct] = useState(0);
  const [outboundOk, setOutboundOk] = useState(0);
  const [inboundBlocked, setInboundBlocked] = useState(0);
  const [inboundFlash, setInboundFlash] = useState(false);
  const [flash, setFlash] = useState<null | "deny">(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const pctRef = useRef(0);
  const flowNRef = useRef(0);
  const mile1 = useRef(false);
  const mile2 = useRef(false);
  const mile3 = useRef(false);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  // ambient outbound packets while RUN is engaged
  useTicker(running, () => {
    flowNRef.current += 1;
    setOutboundOk((n) => n + 1);
    if (flowNRef.current % 3 === 0) {
      push(`outbound flow #${flowNRef.current} — 10.0.20.17:49${String(100 + Math.floor(Math.random() * 899))} → mirror :443 — SNAT translated`, "dim");
    }
  }, 1400);

  // patch download — % ticker with milestone logs (interval-driven)
  useTicker(downloading, () => {
    const next = Math.min(100, pctRef.current + 6 + Math.floor(Math.random() * 9));
    pctRef.current = next;
    setPct(next);
    setOutboundOk((n) => n + 1);
    if (next < 30 && !mile1.current) {
      mile1.current = true;
      push("Get:1 https://deb.debian.org bullseye InRelease [181 kB] — DNS + TLS via NAT", "dim");
    } else if (next >= 30 && next < 70 && !mile2.current) {
      mile2.current = true;
      push("Unpacking openssl 3.0.11 — 14.2MB pulled through NAT-GW (EC2 has no public IP)", "aws");
    } else if (next >= 70 && next < 100 && !mile3.current) {
      mile3.current = true;
      push("Setting up security patches — SNAT 10.0.20.17 → 52.94.23.241 :49211", "neon");
    }
    if (next >= 100) {
      setDownloading(false);
      push("patch cycle complete — instance stayed 100% outbound-initiated", "mint");
    }
  }, 420);

  const inboundAttempt = () => {
    setInboundBlocked((n) => n + 1);
    setInboundFlash(true);
    setFlash("deny");
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => {
      setInboundFlash(false);
      setFlash(null);
    }, 1900);
    push("INBOUND 203.0.113.9:51000 → NAT GW — inbound blocked — NAT is egress-only", "danger");
    push("✕ dropped at the NAT — a stateful mapping exists ONLY for flows the EC2 started", "danger");
  };

  // periodic inbound attempts while the misconfigured toggle is ON + running
  useTicker(running && allowInbound, inboundAttempt, 2800);

  const startPatch = () => {
    if (downloading) {
      push("patch cycle already running — hold tight", "dim");
      return;
    }
    mile1.current = false;
    mile2.current = false;
    mile3.current = false;
    pctRef.current = 0;
    setPct(0);
    setDownloading(true);
    push("RUN PATCH UPDATE — apt-get update && apt-get upgrade -y (42 packages pending)", "aws");
  };

  const toggleInbound = () => {
    const next = !allowInbound;
    setAllowInbound(next);
    if (next) {
      push("operator tries to expose the EC2 via the NAT — inbound blocked — NAT is egress-only", "magenta");
      inboundAttempt();
    } else {
      push("inbound attempts disabled — NAT back to pure egress duty", "dim");
    }
  };

  const reset = () => {
    setRunning(false);
    setDownloading(false);
    setAllowInbound(false);
    pctRef.current = 0;
    setPct(0);
    setOutboundOk(0);
    setInboundBlocked(0);
    setInboundFlash(false);
    setFlash(null);
    setLines([]);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  const egress = running || downloading;

  return (
    <UseCaseShell
      title="USE CASE // NAT GATEWAY — ONE-WAY EGRESS FOR PRIVATE SUBNETS"
      subtitle="PRIVATE EC2 → NAT GW → IGW → INTERNET — OUTBOUND FLOWS, INBOUND DIES AT THE NAT"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="OUTBOUND OK" value={outboundOk} tone="mint" />
          <UCStat label="INBOUND BLOCKED" value={inboundBlocked} tone={inboundBlocked > 0 ? "danger" : "neutral"} />
          <UCStat label="NAT $/MO" value="$32.85" tone="aws" />
          <UCStat label="DOWNLOAD" value={`${pct}%`} tone={pct >= 100 ? "mint" : "neon"} />
          <UCStat label="SNAT PUBLIC IP" value="52.94.23.241" tone="neutral" />
          <UCStat label="INBOUND RULES" value="NONE · EGRESS-ONLY" tone="magenta" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "EGRESS LIVE — SNAT TRANSLATIONS FLOWING" : "IDLE — PRESS RUN FOR AMBIENT EGRESS"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">MAINTENANCE</p>
          <UCButton onClick={startPatch} ariaLabel="Run a patch update from the private instance through the NAT">
            <Download className="w-3 h-3" /> RUN PATCH UPDATE
          </UCButton>
          <UCToggle on={allowInbound} onClick={toggleInbound} accent="magenta" ariaLabel="Toggle inbound attempts at the NAT gateway">
            <Ban className="w-3 h-3" /> ALLOW INBOUND? {allowInbound ? "TRYING" : "NO"}
          </UCToggle>
        </>
      }
      logLines={lines}
      logTitle="NAT GATEWAY LOG // LIVE"
      logEmpty="PRESS RUN — OR FIRE A PATCH CYCLE THROUGH THE NAT"
    >
      <FlowCanvas ariaLabel="VPC NAT gateway use case diagram" className="h-full">
        <NetBand left="3%" top="18%" width="25%" height="50%" label="PRIVATE SUBNET · 10.0.20.0/24" danger={false} />
        <NetBand left="31%" top="18%" width="21%" height="50%" label="PUBLIC SUBNET · 10.0.10.0/24" danger={false} />

        <FlowLink d="M20,43 C26,43 29,43 34,43" status={egress ? "success" : "idle"} dotDuration={1} />
        <FlowLink d="M48,43 C53,43 55,43 58,43" status={egress ? "success" : "idle"} dotDuration={1} dotDelay={0.2} />
        <FlowLink d="M68,43 C73,43 76,43 80,43" status={egress ? "success" : "idle"} dotDuration={1} dotDelay={0.4} />
        <FlowLink d="M82,50 C70,60 56,60 47,51" status={inboundFlash ? "error" : "idle"} dotDuration={1.4} dashed />

        <FlowNode x={15.5} y={43} size="sm" delay={0.1} icon={<EC2Icon className="w-3 h-3" />} label="PRIVATE EC2" sub="10.0.20.17 · NO PUBLIC IP" status={egress ? "active" : "idle"} pulse={egress} />
        <FlowNode x={41.5} y={43} size="sm" delay={0.2} icon={<NatGatewayIcon className="w-3 h-3" />} label="NAT GW" sub="EGRESS-ONLY" status={inboundFlash ? "error" : egress ? "active" : "idle"} pulse={egress} />
        <FlowNode x={63} y={43} size="sm" delay={0.3} icon={<InternetGatewayIcon className="w-3 h-3" />} label="IGW" sub="VPC EDGE" status={egress ? "success" : "idle"} />
        <FlowNode x={86} y={43} size="sm" delay={0.4} icon={<InternetIcon className="w-3 h-3" />} label="INTERNET" sub="PATCH MIRRORS" status={egress ? "active" : "idle"} pulse={egress} />

        {/* PATCH PIPELINE CARD */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="absolute left-[26%] top-[82%] -translate-x-1/2 -translate-y-1/2 z-10 w-[220px] sm:w-[260px]">
          <div className="glass cyber-cut-sm px-2.5 py-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[7px] font-bold uppercase tracking-[0.15em] text-aws">
                <Download className="w-2.5 h-2.5" /> PATCH PIPELINE
              </span>
              <span className={`text-[8px] font-extrabold tabular-nums ${pct >= 100 ? "text-mint" : "text-aws"}`}>{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 bg-black/60 border border-foreground/15">
              <motion.div className={`h-full ${pct >= 100 ? "bg-mint" : "bg-aws"}`} animate={{ width: `${pct}%` }} transition={{ duration: 0.25 }} />
            </div>
            <p className="mt-1 text-[6px] tracking-wider text-muted-foreground uppercase">
              {downloading ? "APT-GET UPGRADE — SNAT VIA NAT-GW" : pct >= 100 ? "PATCHED — ZERO INBOUND EXPOSURE" : "IDLE — PRESS RUN PATCH UPDATE"}
            </p>
          </div>
        </motion.div>

        <AnimatePresence>
          {inboundFlash && (
            <motion.span
              key="inbound-drop"
              initial={{ opacity: 0, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 text-[8px] font-extrabold tracking-[0.2em] text-danger"
              style={{ left: "41.5%", top: "62%" }}
            >
              ✕ DROP
            </motion.span>
          )}
        </AnimatePresence>

        <FlowLabel x={52} y={26} tone="mint">OUTBOUND SNAT 10.0.20.17 → 52.94.23.241 · PORTS 1024-65535</FlowLabel>
        <FlowLabel x={78} y={72} tone="danger">{inboundFlash ? "✕ NO INBOUND MAPPING — EGRESS-ONLY" : "UNSATISFIED INBOUND = NO TRANSLATION = DROP"}</FlowLabel>
      </FlowCanvas>

      <VerdictFlash show={flash === "deny"} text="INBOUND DROPPED — EGRESS-ONLY" tone="deny" />
      <UseCaseNote>
        PATCHES, UPDATES, API CALLS — ALL OUTBOUND. THE INTERNET CAN NEVER OPEN A CONNECTION INTO A NAT&apos;d PRIVATE SUBNET
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — SG VS NACL (STATEFUL LANE VS STATELESS LANE)               */
/* ================================================================== */

const NACL_STEPS = ["REQUEST OUT", "RESPONSE READY", "RETURN TRAFFIC", "CYCLE DONE"];

function SgNaclUseCase({ immersiveActive, immersiveToggle }: VpcUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [sgReturns, setSgReturns] = useState(0);
  const [naclDropped, setNaclDropped] = useState(0);
  const [rulesEvaluated, setRulesEvaluated] = useState(0);
  const [flash, setFlash] = useState<null | "deny">(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const dropReturn = () => {
    setNaclDropped((n) => n + 1);
    setFlash("deny");
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1900);
    push("return traffic dropped — NACL has no memory — ephemeral ports 1024-65535 are not open inbound", "danger");
  };

  // both lanes race: request out → response ready → return traffic → settle
  const { step, reset: resetStep } = useScenarioRunner(4, running, 2200, (s) => {
    if (s === 0) {
      setRulesEvaluated((n) => n + 12); // SG evaluates ALL rules, both directions
      push("REQUEST — EC2 :49152 → api.example.com :443 (both lanes race)", "aws");
    } else if (s === 1) {
      push("request served — response packets now head back to the instances", "dim");
    } else if (s === 2) {
      setSgReturns((n) => n + 1);
      setRulesEvaluated((n) => n + 2); // NACL first-match, one rule per direction
      push("SG LANE — return flow auto-allowed: connection table maps :49152 ⇄ :443 (stateful)", "mint");
      if (ephemeral) push("NACL LANE — inbound rule 120 ALLOW TCP 1024-65535 matches — return accepted", "mint");
      else dropReturn();
    } else push("cycle done — the SG remembered everything, the NACL forgot everything", "dim");
  });

  const toggleEphemeral = () => {
    const next = !ephemeral;
    setEphemeral(next);
    push(
      next
        ? "NACL edited — inbound rule 120 added: TCP 1024-65535 — return traffic can now find a port"
        : "NACL edited — ephemeral ports closed inbound — expect silent return-traffic drops",
      next ? "mint" : "danger"
    );
  };

  const reset = () => {
    setRunning(false);
    resetStep();
    setSgReturns(0);
    setNaclDropped(0);
    setRulesEvaluated(0);
    setFlash(null);
    setLines([]);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  const responsePhase = step === 2;
  const dropLive = responsePhase && !ephemeral;

  return (
    <UseCaseShell
      title="USE CASE // SG VS NACL — STATEFUL LANE VS STATELESS LANE"
      subtitle="SAME REQUEST, TWO FIREWALLS — ONE REMEMBERS THE CONNECTION, ONE FORGETS INSTANTLY"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="SG RETURNS ALLOWED" value={sgReturns} tone="mint" />
          <UCStat label="NACL RETURNS DROPPED" value={naclDropped} tone={naclDropped > 0 ? "danger" : "neutral"} />
          <UCStat label="RULES EVALUATED" value={rulesEvaluated} />
          <UCStat label="EPHEMERAL PORTS" value={ephemeral ? "OPEN" : "CLOSED"} tone={ephemeral ? "mint" : "danger"} />
          <UCStat label="SG MEMORY" value="CONNECTION TABLE" tone="neutral" />
          <UCStat label="NACL MEMORY" value="NONE" tone="magenta" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "RACE LIVE — SAME FLOW THROUGH BOTH FIREWALLS" : "IDLE — PRESS RUN TO RACE THE LANES"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">NACL RULE SET</p>
          <UCToggle on={ephemeral} onClick={toggleEphemeral} accent="magenta" ariaLabel="Toggle ephemeral return ports on the NACL">
            <ShieldAlert className="w-3 h-3" /> EPHEMERAL PORTS ALLOWED? {ephemeral ? "YES" : "NO"}
          </UCToggle>
        </>
      }
      logLines={lines}
      logTitle="FIREWALL RACE LOG // LIVE"
      logEmpty="PRESS RUN — WATCH THE SAME RETURN PACKET SURVIVE SG AND DIE AT NACL"
    >
      <FlowCanvas ariaLabel="Security group vs NACL stateful stateless comparison diagram" className="h-full">
        {/* SG LANE (top) */}
        <FlowLabel x={26} y={10} tone="mint">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5" /> LANE A — SECURITY GROUP · STATEFUL
          </span>
        </FlowLabel>
        <FlowLink d="M15,27 C24,27 32,27 37,27" status={running ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M77,30 C66,33 58,33 51,30" status={responsePhase ? "success" : "idle"} dotDuration={1} />
        <FlowLink d="M39,32 C28,35 20,35 15,32" status={responsePhase ? "success" : "idle"} dotDuration={1} dotDelay={0.25} />

        <FlowNode x={10} y={27} size="sm" delay={0.1} icon={<EC2Icon className="w-3 h-3" />} label="APP EC2" sub=":49152" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={44} y={27} size="sm" delay={0.2} icon={<ShieldCheck className="w-3 h-3" />} label="SECURITY GROUP" sub="STATEFUL · ALL RULES" status={responsePhase ? "success" : running ? "active" : "idle"} pulse={running} />
        <FlowNode x={82} y={27} size="sm" delay={0.3} icon={<Globe className="w-3 h-3" />} label="INTERNET" sub="API :443" status={running ? "active" : "idle"} />

        {/* NACL LANE (bottom) */}
        <FlowLabel x={26} y={56} tone="magenta">
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-2.5 h-2.5" /> LANE B — NETWORK ACL · STATELESS
          </span>
        </FlowLabel>
        <FlowLink d="M15,73 C24,73 32,73 37,73" status={running ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M77,76 C66,79 58,79 50,77" status={dropLive ? "error" : responsePhase ? "success" : "idle"} dotDuration={1} />
        <FlowLink d="M39,78 C28,81 20,81 15,78" status={responsePhase && ephemeral ? "success" : "idle"} dotDuration={1} dotDelay={0.25} />

        <FlowNode x={10} y={73} size="sm" delay={0.4} icon={<EC2Icon className="w-3 h-3" />} label="APP EC2" sub=":49153" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={44} y={73} size="sm" delay={0.5} icon={<ShieldAlert className="w-3 h-3" />} label="NETWORK ACL" sub="STATELESS · FIRST MATCH" status={dropLive ? "error" : responsePhase ? "success" : running ? "active" : "idle"} pulse={running} />
        <FlowNode x={82} y={73} size="sm" delay={0.6} icon={<Globe className="w-3 h-3" />} label="INTERNET" sub="API :443" status={running ? "active" : "idle"} />

        {/* REQUEST → RESPONSE narration per lane */}
        {([{"top": "39%", "lane": "SG"}, {"top": "85%", "lane": "NACL"}] as const).map((p) => (
          <div key={p.lane} className="absolute left-[7%] -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-1" style={{ top: p.top }}>
            <span className={`text-[6px] font-extrabold px-1 py-0.5 border tracking-[0.12em] ${step <= 1 ? "text-aws border-aws/60 box-glow" : "text-muted-foreground/50 border-foreground/15"}`}>REQUEST</span>
            <span className="text-[6px] text-muted-foreground/60">→</span>
            <span className={`text-[6px] font-extrabold px-1 py-0.5 border tracking-[0.12em] ${step === 2 ? (p.lane === "NACL" && !ephemeral ? "text-danger border-danger/60 box-glow" : "text-mint border-mint/60 box-glow") : "text-muted-foreground/50 border-foreground/15"}`}>RESPONSE</span>
          </div>
        ))}

        <AnimatePresence>
          {dropLive && (
            <motion.span
              key="nacl-drop"
              initial={{ opacity: 0, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 text-[8px] font-extrabold tracking-[0.2em] text-danger"
              style={{ left: "56%", top: "84%" }}
            >
              ✕ DROP
            </motion.span>
          )}
        </AnimatePresence>

        <FlowLabel x={62} y={44} tone="aws">SG TRACKS THE FLOW — NACL JUDGES EVERY PACKET IN ISOLATION</FlowLabel>
        <StepBadge step={step} total={4} text={NACL_STEPS[step]} />
      </FlowCanvas>

      <VerdictFlash show={flash === "deny"} text="RETURN DROPPED — NO MEMORY" tone="deny" />
      <UseCaseNote>
        SGs = STATEFUL (RETURN AUTO-ALLOWED, ALL RULES EVALUATED) · NACLs = STATELESS (EPHEMERAL PORTS 1024-65535 OR THE RETURN DIES)
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function VpcUseCases({ id, immersiveActive, immersiveToggle }: VpcUseCasesProps) {
  if (id === "THREE_TIER") return <ThreeTierUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "NAT") return <NatUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <SgNaclUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
